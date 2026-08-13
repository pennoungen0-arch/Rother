from __future__ import annotations

import json
import logging
import time

from harness.selectors import resolve_selectors

logger = logging.getLogger("gbp-monitor.scroll")

MAX_SCROLLS = 400
STABLE_THRESHOLD = 3
SCROLL_WAIT_MS = 1200


class SelectorNotFoundError(Exception):
    """Raised when review_container selector is absent (Google DOM change)."""


# JS hunt for the scrollable review-list container. Picks the ``div.m6QErb``
# that contains the most distinct ``data-review-id`` values (Google maps the
# same id onto multiple nested nodes) and builds a unique CSS path for it.
# Returns a JSON string with {path, count, scrollable} or null.
_JS_HUNT_REVIEW_CONTAINER = """() => {
  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return s.replace(/([^a-zA-Z0-9\\-_])/g, '\\\\$1');
  }
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      if (node.classList && node.classList.length) {
        const cls = Array.from(node.classList).slice(0, 3).map(c => cssEscape(c)).join('.');
        if (cls) part += '.' + cls;
      }
      const parent = node.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        if (sameTag.length > 1) part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
      if (parts.length >= 10) break;
    }
    return parts.join(' > ');
  }
  const containers = document.querySelectorAll('div.m6QErb');
  let best = null;
  for (const el of containers) {
    const ids = new Set();
    el.querySelectorAll('[data-review-id]').forEach(n => {
      const id = n.getAttribute('data-review-id');
      if (id) ids.add(id);
    });
    if (ids.size === 0) continue;
    const scrollable = el.scrollHeight > el.clientHeight + 4;
    const score = ids.size * 1000 + (scrollable ? 500 : 0);
    if (!best || score > best.score) best = { el, score, count: ids.size, scrollable };
  }
  if (!best) return null;
  const path = cssPath(best.el);
  try {
    if (document.querySelector(path) !== best.el) return null;
  } catch (e) {
    return null;
  }
  return JSON.stringify({ path: path, count: best.count, scrollable: best.scrollable });
}"""


def _hunt_review_container(page) -> dict | None:
    """Locate the actual review-list container via a JS probe.

    Returns ``{"path": <css>, "count": <int>, "scrollable": <bool>}`` or
    ``None`` when no element carrying ``data-review-id`` is found. The
    returned path is validated to resolve back to the probed element, so a
    mid-run class shuffle degrades to the configured CSS tires instead of
    scrolling a wrong container.
    """
    import json as json_mod

    try:
        raw = page.evaluate(_JS_HUNT_REVIEW_CONTAINER)
        if not raw:
            return None
        parsed = json_mod.loads(raw)
        if not parsed.get("path"):
            return None
        parsed["scrollable"] = bool(parsed.get("scrollable"))
        parsed["count"] = int(parsed.get("count", 0))
        logger.debug("JS hunt found review container %r (count=%s, scrollable=%s)",
                     parsed["path"], parsed["count"], parsed["scrollable"])
        return parsed
    except Exception as e:
        logger.debug("JS hunt failed: %s", e)
        return None


def _resolve_container_with_fallback(
    page, selectors: dict, tracker=None, comp_id: str = "",
    instrument=None,
) -> str:
    candidates = resolve_selectors(selectors, "review_container")
    primary = candidates[0] if candidates else None
    if not candidates:
        raise SelectorNotFoundError("review_container not configured in selectors.json")
    errors = []
    used_fallback = False

    # Tier -1: JS hunt. In the full Reviews-tab view the configured CSS tires
    # can resolve to the overview panel instead of the actual (deep, scrollable)
    # review list; probing the live DOM for the container with the most
    # ``data-review-id`` values fixes that without embedding a brittle selector.
    hunt = _hunt_review_container(page)
    if hunt:
        candidate = hunt["path"]
        duration_ms = 0.0
        if instrument:
            instrument.record_selector(
                selector_key="review_container", primary=primary,
                fallback_used=False, matched=True,
                match_count=hunt["count"], candidate=candidate,
                duration_ms=duration_ms,
                detail=f"JS hunt: {hunt['count']} distinct review ids (scrollable={hunt['scrollable']})",
            )
        if tracker:
            tracker.record(
                selector_key="review_container",
                selector_value=candidate,
                found=True,
                match_count=hunt["count"],
                duration_ms=duration_ms,
                competitor_id=comp_id,
                phase="scroll",
            )
        logger.info("review_container[%s] resolved via JS hunt: %r (%d ids)", comp_id, candidate, hunt["count"])
        return candidate

    for i, candidate in enumerate(candidates):
        t0 = time.time() if tracker else None
        try:
            page.wait_for_selector(candidate, timeout=10000)
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            if instrument:
                instrument.record_selector(
                    selector_key="review_container", primary=primary,
                    fallback_used=used_fallback, matched=True,
                    match_count=1, candidate=candidate,
                    duration_ms=duration_ms,
                )
            if tracker:
                tracker.record(
                    selector_key="review_container",
                    selector_value=candidate,
                    found=True,
                    match_count=1,
                    duration_ms=duration_ms,
                    competitor_id=comp_id,
                    phase="scroll",
                )
            return candidate
        except Exception as e:
            used_fallback = True
            errors.append(f"fallback {i + 1}/{len(candidates)} ({candidate}): {e}")
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            if instrument:
                instrument.record_selector(
                    selector_key="review_container", primary=primary,
                    fallback_used=True, matched=False,
                    candidate=candidate, duration_ms=duration_ms,
                    detail=f"fallback {i + 1}/{len(candidates)}: {e}",
                )
            if tracker:
                tracker.record(
                    selector_key="review_container",
                    selector_value=candidate,
                    found=False,
                    duration_ms=duration_ms,
                    error=str(e),
                    competitor_id=comp_id,
                    phase="scroll",
                )
            if i < len(candidates) - 1:
                logger.debug("review_container %s", errors[-1])
    logger.error("review_container all %d fallbacks failed: %s", len(candidates), "; ".join(errors))
    raise SelectorNotFoundError(
        f"review_container selector failed — all {len(candidates)} fallback(s) exhausted"
    )


def _collect_dom_stats(page, container_selector: str) -> dict:
    """Count total DOM nodes and visible cards inside the container.

    Returns dict with total DOM nodes, visible cards count.

    NOTE (M5 live validation): Google Maps renders the SAME ``data-review-id``
    on multiple nested elements per review card (outer div, inner div, avatar
    button, ...). Raw attribute counting inflated the total 10-11x (33 DOM
    nodes for 3 distinct reviews). We now dedupe by review-id value so the
    numbers represent DISTINCT reviews, matching the parser's dedup.
    """
    try:
        result = page.eval_on_selector(
            container_selector,
            """el => {
                const raw = el.querySelectorAll('[data-review-id]');
                const ids = new Set();
                const visibleIds = new Set();
                const rect = el.getBoundingClientRect();
                for (const item of raw) {
                    const id = item.getAttribute('data-review-id');
                    if (!id) continue;
                    ids.add(id);
                    const ir = item.getBoundingClientRect();
                    if (ir.top < rect.bottom && ir.bottom > rect.top) {
                        visibleIds.add(id);
                    }
                }
                return {
                    total: ids.size,
                    visible: visibleIds.size,
                    raw_attr_matches: raw.length,
                    has_data_review_id: ids.size,
                };
            }""",
        )
        if isinstance(result, dict):
            return {
                "total": result.get("total", 0),
                "visible": result.get("visible", 0),
                "raw_attr_matches": result.get("raw_attr_matches", 0),
                "has_data_review_id": result.get("has_data_review_id", 0),
            }
        return {"total": 0, "visible": 0, "raw_attr_matches": 0, "has_data_review_id": 0}
    except Exception as e:
        logger.debug("_collect_dom_stats failed: %s", e)
        return {"total": 0, "visible": 0, "raw_attr_matches": 0, "has_data_review_id": 0}


# JS extractor that snapshots every distinct review card currently rendered
# in the container. Google virtualizes the list (DOM caps at ~350 distinct
# ``data-review-id`` values even as the container keeps growing), so a single
# end-of-run ``page.content()`` only ever contains the LAST rendered cards.
# Harvesting the card HTML on every scroll iteration BEFORE the old cards are
# unmounted lets us accumulate the FULL review set instead of the tail window.
_JS_HARVEST_REVIEW_CARDS = """(container) => {
  const byId = new Map();
  container.querySelectorAll('[data-review-id]').forEach((el) => {
    const id = el.getAttribute('data-review-id');
    if (!id || byId.has(id)) return;
    byId.set(id, el.outerHTML);
  });
  const out = [];
  byId.forEach((html, id) => out.push({ id, html }));
  return JSON.stringify(out);
}"""


def _harvest_review_cards(page, container_selector: str) -> list[dict]:
    """Snapshot all distinct review cards currently rendered in the container.

    Returns a list of ``{"id": <data-review-id>, "html": <outerHTML>}`` in
    document order, deduped by id (Google maps the same id onto multiple
    nested nodes). Best-effort: any failure returns ``[]`` so the scroll
    loop degrades gracefully to the old DOM-count-only behavior.
    """
    try:
        raw = page.eval_on_selector(container_selector, _JS_HARVEST_REVIEW_CARDS)
        if not raw:
            return []
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return [item for item in parsed if item.get("id") and item.get("html")]
    except Exception as e:
        logger.debug("_harvest_review_cards failed: %s", e)
        return []


def _detect_bottom(page, container_selector: str, previous_height: int, previous_dom: int) -> str | None:
    """Explicitly detect whether we have reached the bottom of the review list.

    Checks multiple signals and returns the reason if bottom is confirmed.
    Returns None if bottom is not confirmed.
    """
    try:
        current_height = page.eval_on_selector(
            container_selector, "el => el.scrollHeight",
        )

        current_dom = _collect_dom_stats(page, container_selector)["total"]

        height_unchanged = (current_height == previous_height)
        dom_unchanged = (current_dom == previous_dom) and (current_dom > 0)

        if height_unchanged and dom_unchanged:
            return "stable_scroll"

        spinner_visible = page.eval_on_selector(
            container_selector,
            """el => {
                const spinners = el.querySelectorAll('[class*=\"spinner\"], [class*=\"Spinner\"], [role=\"progressbar\"]');
                return spinners.length > 0;
            }""",
        )
        if not spinner_visible and height_unchanged:
            return "spinner_finished"

        sentinel_visible = page.eval_on_selector(
            container_selector,
            """el => {
                const all = el.querySelectorAll('*');
                for (const node of all) {
                    if (node.children.length === 0 && node.textContent.trim()) {
                        const txt = node.textContent.toLowerCase();
                        if (txt.includes('no more') || txt.includes('end') || txt.includes('showing all') || txt.includes('you\'ve seen')) {
                            return true;
                        }
                    }
                }
                return false;
            }""",
        )
        if sentinel_visible:
            return "sentinel_detected"

    except Exception as e:
        logger.debug("_detect_bottom check failed: %s", e)

    return None


def collect_visible_review_count(page, container_selector: str) -> int:
    """Simple wrapper returning visible count only (backward compat)."""
    stats = _collect_dom_stats(page, container_selector)
    return stats.get("visible", 0)


def scroll_review_container(
    page, selectors: dict, tracker=None, comp_id: str = "",
    deadline: float | None = None, instrument=None,
) -> dict | None:
    """Scroll the review container and return scroll progress data.

    Returns a dict with scroll_progress list and bottom_reason, or None if
    the container could not be resolved.
    """
    if instrument:
        instrument.start_phase("scroll_resolve_container")

    container_selector = _resolve_container_with_fallback(
        page, selectors, tracker=tracker, comp_id=comp_id, instrument=instrument
    )

    if instrument:
        instrument.end_phase()

    previous_height = 0
    previous_dom = 0
    stable_count = 0
    overall_start = time.time()
    scroll_progress: list[dict] = []
    bottom_reason: str | None = None
    harvested: dict[str, str] = {}
    max_harvested = 0

    for i in range(MAX_SCROLLS):
        if deadline is not None and time.time() >= deadline:
            bottom_reason = "timeout"
            logger.warning(
                "scroll[%s]: deadline exceeded after %d scroll(s) — "
                "returning partial data (harvested %d reviews)",
                comp_id, i, len(harvested),
            )
            break

        iter_start = time.time()
        iteration_label = f"scroll_iteration_{i + 1}"

        if instrument:
            instrument.start_phase(iteration_label)

        page.eval_on_selector(
            container_selector,
            "el => el.scrollTop = el.scrollHeight",
        )
        page.wait_for_timeout(SCROLL_WAIT_MS)

        current_height = page.eval_on_selector(
            container_selector,
            "el => el.scrollHeight",
        )

        dom_stats = _collect_dom_stats(page, container_selector)
        visible = dom_stats.get("visible", 0)
        dom_nodes = dom_stats.get("total", 0)

        # Incremental harvest: snapshot every distinct review card now in the
        # DOM BEFORE older cards get virtualized away. Because Google keeps
        # only ~350 distinct cards mounted at once, the union across scroll
        # iterations is the ONLY way to capture the full review list.
        new_cards = _harvest_review_cards(page, container_selector)
        added = 0
        for card in new_cards:
            rid = card["id"]
            if rid not in harvested:
                harvested[rid] = card["html"]
                added += 1
        harvested_total = len(harvested)
        max_harvested = max(max_harvested, harvested_total)

        iter_duration = time.time() - iter_start

        bottom = _detect_bottom(page, container_selector, previous_height, previous_dom)
        if bottom and not bottom_reason:
            bottom_reason = bottom

        scroll_progress.append({
            "iteration": i + 1,
            "height": current_height,
            "visible_cards": visible,
            "dom_nodes": dom_nodes,
            "new_harvested": added,
            "harvested_total": harvested_total,
            "stable": stable_count,
            "bottom_reason": bottom_reason,
            "duration_s": round(iter_duration, 3),
        })

        if instrument:
            instrument.record_scroll_iteration(
                iteration=i + 1, height=current_height,
                visible_cards=visible, dom_nodes=dom_nodes,
                stable=stable_count, bottom_reason=bottom_reason,
                new_harvested=added, harvested_total=harvested_total,
            )

        detail = (
            f"height={current_height} visible_cards={visible} "
            f"dom_nodes={dom_nodes} harvested={harvested_total} "
            f"stable={stable_count}/{STABLE_THRESHOLD}"
        )

        if current_height == previous_height:
            stable_count += 1
            if stable_count >= STABLE_THRESHOLD and not bottom_reason:
                bottom_reason = "stable_scroll"
                if instrument:
                    instrument.end_phase("success", detail=f"{detail} — STABILIZED (bottom={bottom_reason})")
                logger.info(
                    "SCROLL[%s] iteration %d stabilized (height=%s, visible=%d, dom=%d, harvested=%d, %.2fs, +%d new)",
                    comp_id, i + 1, current_height, visible, dom_nodes, harvested_total, iter_duration, added,
                )
                break
            if instrument:
                instrument.end_phase("success", detail=detail)
        else:
            stable_count = 0
            if instrument:
                instrument.end_phase("success", detail=detail)

        previous_height = current_height
        previous_dom = dom_nodes

        if bottom_reason:
            logger.info(
                "SCROLL[%s] iteration %d bottom detected: %s (height=%s, visible=%d, dom=%d, harvested=%d, %.2fs)",
                comp_id, i + 1, bottom_reason, current_height, visible, dom_nodes, harvested_total, iter_duration,
            )
            break

        logger.debug(
            "SCROLL[%s] iteration %d height=%s visible=%d dom=%d harvested=%d (%.2fs, +%d new)",
            comp_id, i + 1, current_height, visible, dom_nodes, harvested_total, iter_duration, added,
        )
    else:
        bottom_reason = "max_scroll"
        logger.info(
            "SCROLL[%s] hit MAX_SCROLLS=%d without stabilizing "
            "(final height=%s, last visible=%d, dom=%d, harvested=%d) — results may be truncated",
            comp_id, MAX_SCROLLS, previous_height,
            scroll_progress[-1]["visible_cards"] if scroll_progress else 0,
            scroll_progress[-1]["dom_nodes"] if scroll_progress else 0,
            harvested_total,
        )

    total_scrolls = len(scroll_progress)
    max_visible = max((s["visible_cards"] for s in scroll_progress), default=0)
    max_dom = max((s["dom_nodes"] for s in scroll_progress), default=0)

    if bottom_reason is None:
        bottom_reason = "unknown"

    if instrument:
        instrument.phase_result(
            "scroll_complete", "success",
            detail=f"{total_scrolls} scrolls, max visible={max_visible}, max dom={max_dom}, harvested={len(harvested)}, bottom={bottom_reason}",
        )

    logger.info(
        "SCROLL_COMPLETE[%s] %d scroll(s), max_visible=%d, max_dom=%d, harvested=%d, final_height=%s, bottom=%s, %.2fs total",
        comp_id, total_scrolls, max_visible, max_dom, len(harvested), previous_height,
        bottom_reason, time.time() - overall_start,
    )

    return {
        "scroll_progress": scroll_progress,
        "bottom_reason": bottom_reason,
        "total_scrolls": total_scrolls,
        "max_visible_cards": max_visible,
        "final_height": previous_height,
        "total_duration_s": round(time.time() - overall_start, 3),
        "harvested_reviews": [
            {"id": rid, "html": html} for rid, html in harvested.items()
        ],
        "harvested_count": len(harvested),
    }
