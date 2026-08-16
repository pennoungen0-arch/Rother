"""Production acquisition: NID warm-up + storage-state reuse (M8).

Per ``docs/validation/M7_FULL_ACQUISITION.md``, Google serves the FULL
Maps variant only when the browser context carries a valid ``NID`` cookie
(logged-out identity/entitlement token). Anonymous direct navigation gets
REDUCED 3/3 + 1 timeout; with ``NID`` present FULL 5/5 warm-up, 3/3
cookie-only, 1/1 jar-reuse.

This module implements the M7 recommendation in production:

1. **Reuse** a previously persisted ``storage_state`` (contains ``NID``)
   when the Maps context is created — direct navigation, no warm-up.
2. **Warm-up** when no valid jar exists: navigate the hardened context to
   ``https://www.google.com/`` and wait for Google to issue ``NID``
   (~2-3s), then persist the ``storage_state`` for the next run.
3. **Validation gate**: the orchestration layer logs a loud WARNING if no
   ``NID`` cookie is present after bootstrap (REDUCED variant likely).

No network/browser logic runs at import time — this module is safe to
import in offline tests (``verify_baseline``).
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

logger = logging.getLogger("gbp-monitor.acquisition")

NID_COOKIE_NAME = "NID"
GOOGLE_DOMAIN = "google.com"
WARMUP_URL = "https://www.google.com/"
WARMUP_WAIT_S = 2.5
WARMUP_MAX_WAIT_S = 6.0
STORAGE_STATE_PATH = Path("data/storage_state.json")


def _cookie_has_nid(cookie: dict) -> bool:
    name = cookie.get("name", "")
    domain = cookie.get("domain", "")
    value = cookie.get("value", "")
    return name == NID_COOKIE_NAME and GOOGLE_DOMAIN in domain and bool(value)


def has_nid_cookie(cookies: list[dict]) -> bool:
    """Return True if ``cookies`` contains a valid Google ``NID`` cookie."""
    return any(_cookie_has_nid(c) for c in cookies)


def context_has_nid(context) -> bool:
    """Return True if the Playwright context's cookie jar has ``NID``."""
    try:
        return has_nid_cookie(context.cookies())
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("ACQUISITION: could not read context cookies: %s", e)
        return False


def valid_storage_state_path(path: Path | None = None) -> Path | None:
    """Return *path* if it holds a usable ``NID`` storage_state, else None.

    None means: missing, unreadable, no ``NID`` cookie. The caller then
    falls back to warm-up.
    """
    p = path or STORAGE_STATE_PATH
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("ACQUISITION: storage_state %s unreadable (%s) — will re-warm-up", p, e)
        return None
    if not has_nid_cookie(data.get("cookies", [])):
        logger.warning("ACQUISITION: persisted storage_state has no NID cookie — will re-warm-up")
        return None
    return p


def warm_up(context, url: str = WARMUP_URL, max_wait_s: float = WARMUP_MAX_WAIT_S) -> bool:
    """Navigate a Google domain in *context* so Google issues ``NID``.

    Returns True if a ``NID`` cookie is present afterwards. Never raises —
    failures degrade to False and the orchestration layer decides how to
    proceed (per Rule 7, one bad listing/step is isolated).
    """
    page = context.new_page()
    try:
        try:
            page.goto(url, timeout=30000)
        except Exception as e:
            logger.warning("ACQUISITION: warm-up navigation to %s failed: %s", url, e)
    finally:
        try:
            page.close()
        except Exception:
            pass

    deadline = time.time() + max_wait_s
    while time.time() < deadline:
        if context_has_nid(context):
            logger.info("ACQUISITION: NID cookie present after warm-up")
            return True
        time.sleep(0.5)
    logger.warning("ACQUISITION: no NID cookie within %.1fs of warm-up", max_wait_s)
    return False


def persist_storage_state(context, path: Path | None = None) -> Path | None:
    """Persist the context's cookie jar to *path* (default storage_state)."""
    p = path or STORAGE_STATE_PATH
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        context.storage_state(path=str(p))
        logger.info("ACQUISITION: storage_state persisted to %s", p)
        return p
    except Exception as e:
        logger.warning("ACQUISITION: could not persist storage_state: %s", e)
        return None


def invalidate_stale_storage_state(path: Path | None = None, stamp: str = "") -> Path | None:
    """Move a stale ``storage_state`` jar aside so it is never reused.

    Called by the orchestrator's stale-NID guard when a probe detects the
    REDUCED variant being served from a reused jar. The jar is *renamed* (not
    deleted) to ``<name>.stale-<stamp>.json`` for forensic review.

    Returns the stale path, or None if there was nothing to invalidate or the
    rename failed (the orchestrator then logs a warning and re-warms anyway).
    """
    p = path or STORAGE_STATE_PATH
    if not p.exists():
        return None
    if not stamp:
        stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    stale = p.with_name(f"{p.name}.stale-{stamp}.json")
    try:
        p.rename(stale)
        logger.warning(
            "ACQUISITION: stale storage_state %s invalidated -> %s", p, stale
        )
        return stale
    except Exception as e:
        logger.warning(
            "ACQUISITION: could not invalidate stale storage_state %s: %s", p, e
        )
        return None
