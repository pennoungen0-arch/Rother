"""Cheap URL-reachability pre-check before committing to a Playwright capture.

Per GBP_MONITOR_PLAN.md Section 5.7. The plan calls for Spider (local mode,
not Spider Cloud) as the preferred tool here, with a plain HTTP HEAD/GET
fallback if Spider's Python binding proves impractical. Spider's `spider-py`
package is not part of `requirements.txt` (it would add an extra dependency
for a narrow HEAD/GET need) and the plain HTTP fallback is what the plan
explicitly allows. This decision is recorded in `CHANGELOG.md` per the
plan's instruction.

This pre-check is OPTIONAL — the orchestration layer (`run_all.py`) calls
it before the Playwright capture, but a `False` return only logs a warning
and skips the listing; it does NOT raise. The actual capture can still
fail (and be isolated) even if this check passed — Google can return 200
to HEAD but render an empty page, or rate-limit mid-scroll. This is a
fast-fail for the obvious "the URL is wrong / the place was deleted" case
to save a Playwright launch.
"""

from __future__ import annotations

import logging
import re

import requests

logger = logging.getLogger("gbp-monitor.discovery")

# Google Maps has historically rejected HEAD requests on some listing URLs
# (returns 405). The fallback to a streaming GET (which we abort after the
# headers arrive) is the documented workaround per Section 5.7.
_TIMEOUT_SECONDS = 10
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# P2-F2: Patterns that indicate a real Google Maps place page (not a search
# redirect, CAPTCHA, or error page). These are checked in the first 8KB of
# the response body when the GET succeeds.
_MAPS_INDICATORS = re.compile(
    rb"(maps\.google\.com|"
    rb"place/|"
    rb"ChIJ|"
    rb"data-review-id|"
    rb"review-dialog|"
    rb"/maps/place|"
    rb"google\.com/maps)",
    re.IGNORECASE,
)


def validate_listing(url: str) -> bool:
    """Return True if `url` appears reachable, False otherwise.

    Strategy (per Section 5.7 fallback):
      1. Try `requests.head(url, allow_redirects=True, timeout=_TIMEOUT)`.
         HEAD is cheap — no body download — but some Google endpoints 405.
      2. On any HEAD failure (405, network, etc.), fall back to
         `requests.get(url, stream=True, ...)` and call `raise_for_status`.
         `stream=True` means the body is not downloaded until we read it;
         we close the response immediately, so this is still cheap.
      3. Any non-2xx final status or network error → False.

    P2-F2 enhancement: when the GET succeeds, read the first 8KB of the
    body and check for Google Maps indicators (place patterns, review
    elements). A 200 response that lacks these patterns is likely a search
    redirect, CAPTCHA, or error page — return False to skip the listing
    rather than wasting a Playwright capture that will produce 0 reviews.

    This function MUST NOT raise — it is a best-effort pre-check. Callers
    (the orchestration layer) treat a `False` return as a skip-with-warn,
    not as a hard failure. The real capture might still succeed even if
    this returns False (transient blip); the orchestration layer is the
    final authority on whether to proceed.
    """
    headers = {"User-Agent": _USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}

    # Step 1 — HEAD.
    try:
        resp = requests.head(
            url,
            headers=headers,
            allow_redirects=True,
            timeout=_TIMEOUT_SECONDS,
        )
        # 2xx → reachable. 3xx shouldn't happen (allow_redirects=True) but
        # is also OK. 4xx/5xx → fall through to GET (some servers reject
        # HEAD with 405/403 but accept GET).
        if 200 <= resp.status_code < 400:
            logger.debug(
                "validate_listing[%s]: HEAD %s → reachable",
                url,
                resp.status_code,
            )
            return True
        logger.debug(
            "validate_listing[%s]: HEAD %s — falling back to GET",
            url,
            resp.status_code,
        )
    except requests.RequestException as e:
        logger.debug(
            "validate_listing[%s]: HEAD raised %s — falling back to GET",
            url,
            e,
        )

    # Step 2 — GET (streaming, read first 8KB for content check).
    try:
        with requests.get(
            url,
            headers=headers,
            allow_redirects=True,
            timeout=_TIMEOUT_SECONDS,
            stream=True,
        ) as resp:
            resp.raise_for_status()
            # P2-F2: Read first 8KB to check for Maps indicators.
            # `stream=True` + `iter_content` keeps this cheap.
            try:
                chunk = next(resp.iter_content(chunk_size=8192))
                if chunk and _MAPS_INDICATORS.search(chunk):
                    logger.debug(
                        "validate_listing[%s]: GET %s → reachable (Maps indicators found)",
                        url,
                        resp.status_code,
                    )
                    return True
                elif chunk:
                    logger.warning(
                        "validate_listing[%s]: GET %s → reachable but no Maps indicators "
                        "in first 8KB — likely search redirect, CAPTCHA, or error page",
                        url,
                        resp.status_code,
                    )
                    return False
                else:
                    # Empty body — still reachable (some redirects).
                    logger.debug(
                        "validate_listing[%s]: GET %s → reachable (empty body)",
                        url,
                        resp.status_code,
                    )
                    return True
            except StopIteration:
                # No body at all — still reachable.
                logger.debug(
                    "validate_listing[%s]: GET %s → reachable (no body)",
                    url,
                    resp.status_code,
                )
                return True
    except requests.RequestException as e:
        logger.warning(
            "validate_listing[%s]: not reachable — %s",
            url,
            e,
        )
        return False
