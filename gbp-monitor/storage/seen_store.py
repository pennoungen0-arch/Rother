"""Per-competitor seen-ID union — variance-proof delta base (HARVEST_FIX_PLAN Phase 2).

Google's review panel renders a jittering ~410–650-card window per session
(Phase 0 evidence: 240 phantom "new" in 20 minutes). Diffing against the
previous snapshot manufactures phantoms in BOTH directions:

  - deeper render ⇒ old reviews never seen before fire as "new" (backfill
    discovery), and
  - shallower render ⇒ baseline silently shrinks.

This store keeps a cumulative **ever-seen** ID union per competitor. Delta
candidates = current-run IDs − ever-seen. On top of the union, a RECENCY
GATE separates "newly POSTED" (recent review_date → alert) from "newly
DISCOVERED" (old review_date the render finally reached → silent backfill):
a union alone cannot tell those apart, because backfill IDs are also
never-seen.

First-harvest flood suppression: when no union AND no prior snapshot exists,
the caller marks the run `baseline` — everything merges into the union,
nothing alerts.

The `reviews_new/*.json` delta files keep their format; only the diff base
and classification change.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger("gbp-monitor.seen_store")

# Mirror snapshot_store's tenant resolution (ROTHER_DATA_DIR when
# dashboard-spawned, root `data/` otherwise).
_DATA_BASE = Path(os.environ.get("ROTHER_DATA_DIR", "data"))
_SEEN_DIR = _DATA_BASE / "seen"

# A review whose resolved date is within this many days of the run is
# "newly posted"; anything older is "newly discovered" backfill.
DEFAULT_RECENCY_DAYS = 30


def _seen_path(competitor_id: str, base_dir: Path | None = None) -> Path:
    base = base_dir if base_dir is not None else _SEEN_DIR
    return base / f"{competitor_id}.json"


def load_seen(competitor_id: str, base_dir: Path | None = None) -> set[str]:
    """Load the ever-seen ID union. Tolerant: missing/corrupt ⇒ empty set."""
    path = _seen_path(competitor_id, base_dir)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        ids = data.get("review_ids", []) if isinstance(data, dict) else data
        return {str(i) for i in ids if i}
    except FileNotFoundError:
        return set()
    except Exception as e:  # Rule 7: a broken seen file must never crash a run
        logger.warning(
            "SEEN_STORE[%s]: unreadable (%s) — starting from empty union",
            competitor_id, e,
        )
        return set()


def save_seen(
    competitor_id: str,
    ids: set[str] | list[str],
    base_dir: Path | None = None,
) -> None:
    """Persist the union. Best-effort: log on failure, never raise (Rule 7)."""
    path = _seen_path(competitor_id, base_dir)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(
                {
                    "review_ids": sorted(ids),
                    "count": len(ids),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )
    except Exception as e:
        logger.error("SEEN_STORE[%s]: save failed: %s", competitor_id, e)


def merge_seen(seen: set[str], review_dicts: list[dict]) -> set[str]:
    """Pure: union the current render's IDs into the ever-seen set."""
    out = set(seen)
    for r in review_dicts:
        rid = r.get("review_id")
        if rid:
            out.add(rid)
    return out


def _resolved_date(review: dict, now: datetime) -> str | None:
    """Best-effort ISO date for a review dict: review_date field, else
    re-resolve relative_date. None when unparseable."""
    date = review.get("review_date")
    if date:
        return str(date)[:10]
    rel = review.get("relative_date")
    if not rel:
        return None
    try:
        from parser.relative_date import resolve_relative_date

        iso, _ = resolve_relative_date(rel, now)
        return iso
    except Exception:
        return None


def is_recently_posted(review: dict, now: datetime | None = None,
                       recency_days: int = DEFAULT_RECENCY_DAYS) -> bool:
    """True when the review's date is within `recency_days` of `now`.

    Conservative default: **unparseable/missing dates count as recently
    posted** — better a false-positive alert than a silently missed review.
    """
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    iso = _resolved_date(review, now)
    if not iso:
        return True
    try:
        review_dt = datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    return review_dt >= now - timedelta(days=recency_days)


def split_candidates(
    new_reviews: list[dict],
    seen: set[str],
    now: datetime | None = None,
    recency_days: int = DEFAULT_RECENCY_DAYS,
) -> tuple[list[dict], list[dict]]:
    """Split never-seen reviews into (posted_new, backfill_discovered).

    Pure function. posted_new = never-seen AND recently posted (alert-worthy);
    backfill = never-seen but old (the render finally reached them — merge
    silently).
    """
    posted: list[dict] = []
    backfill: list[dict] = []
    for r in new_reviews:
        rid = r.get("review_id")
        if not rid or rid in seen:
            continue
        if is_recently_posted(r, now, recency_days):
            posted.append(r)
        else:
            backfill.append(r)
    return posted, backfill


def is_first_harvest(seen: set[str], old_snapshot: list[dict]) -> bool:
    """True when this run is the competitor's first harvest ever (no union
    AND no prior snapshot) — its delta must be suppressed as `baseline`,
    never alerted."""
    return not seen and not old_snapshot
