from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from harness.browser import setup_page_handlers
from harness.instrument import PipelineInstrument
from harness.scroll import scroll_review_container, collect_visible_review_count
from harness.selectors import resolve_selectors

logger = logging.getLogger("gbp-monitor.capture")

_OPTIONAL_ELEMENT_TIMEOUT_MS = 4000


class NavigationError(Exception):
    """Raised when ``page.goto()`` fails with a specific error classification.

    Attributes:
        url: The URL that failed to load.
        category: One of ``"dns"``, ``"timeout"``, ``"http_error"``,
            ``"connection_refused"``, ``"ssl_error"``, ``"unknown"``.
        original: The original exception message.
    """

    def __init__(self, url: str, category: str, original: str):
        self.url = url
        self.category = category
        self.original = original
        super().__init__(f"[{category}] {url}: {original}")


class CaptureTimeoutError(Exception):
    """Raised when the full capture pipeline exceeds the total timeout.

    Uses Playwright-native timeouts (``page.set_default_timeout``) for
    individual operations and a wall-clock deadline for cross-stage
    enforcement — no threading. See ``docs/engineering/KILLCRITIC.md``
    for the full root-cause analysis.

    Attributes:
        stage: Which capture phase exceeded the deadline.
        elapsed_s: Total wall-clock seconds elapsed when the timeout fired.
        timeout_s: The configured total timeout value.
        probable_cause: Human-readable description of the likely cause.
        suggested_fix: Human-readable remediation advice.
    """

    def __init__(self, stage: str, elapsed_s: float, timeout_s: int):
        self.stage = stage
        self.elapsed_s = elapsed_s
        self.timeout_s = timeout_s
        self.probable_cause = (
            f"capture stage '{stage}' exceeded {timeout_s}s total timeout "
            f"(elapsed={elapsed_s:.1f}s)"
        )
        self.suggested_fix = (
            "Increase _CAPTURE_TOTAL_TIMEOUT_S in orchestration/run_all.py "
            "if the page genuinely needs more time, or investigate whether "
            "a bot interstitial / captcha is blocking the page load"
        )
        super().__init__(
            f"[CaptureTimeoutError] stage={stage} elapsed={elapsed_s:.1f}s "
            f"timeout={timeout_s}s"
        )


def _classify_navigation_error(url: str, exc: Exception) -> NavigationError:
    msg = str(exc).lower()
    if "dns" in msg or "dnsresolutionfailed" in msg or "enotfound" in msg or "ns_error_unknown_host" in msg:
        return NavigationError(url, "dns", str(exc))
    if "timeout" in msg or "timed out" in msg or "net::err_timed_out" in msg:
        return NavigationError(url, "timeout", str(exc))
    if "refused" in msg or "connection refused" in msg or "econnrefused" in msg:
        return NavigationError(url, "connection_refused", str(exc))
    if "ssl" in msg or "cert" in msg or "tls" in msg:
        return NavigationError(url, "ssl_error", str(exc))
    if "http error" in msg or "status code" in msg:
        return NavigationError(url, "http_error", str(exc))
    return NavigationError(url, "unknown", str(exc))


def _fallback_click(
    page,
    selector_key: str,
    selectors: dict,
    tracker=None,
    comp_id: str = "",
    phase: str = "",
    settle_ms: int = 0,
    instrument: PipelineInstrument | None = None,
) -> bool:
    candidates = resolve_selectors(selectors, selector_key)
    primary = candidates[0] if candidates else None
    if not candidates:
        if instrument:
            instrument.record_selector(
                selector_key=selector_key, primary=None, fallback_used=False,
                matched=False, detail="not configured",
            )
        if tracker:
            tracker.record(
                selector_key=selector_key,
                selector_value=None,
                found=False,
                competitor_id=comp_id,
                phase=phase,
                error="not configured",
            )
        return False
    used_fallback = False
    for i, candidate in enumerate(candidates):
        t0 = time.time() if (tracker or instrument) else None
        try:
            page.wait_for_selector(candidate, timeout=_OPTIONAL_ELEMENT_TIMEOUT_MS)
            page.click(candidate, timeout=_OPTIONAL_ELEMENT_TIMEOUT_MS)
            if settle_ms:
                page.wait_for_timeout(settle_ms)
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            if instrument:
                instrument.record_selector(
                    selector_key=selector_key, primary=primary,
                    fallback_used=used_fallback, matched=True,
                    match_count=1, candidate=candidate,
                    duration_ms=duration_ms,
                )
            if tracker:
                tracker.record(
                    selector_key=selector_key,
                    selector_value=candidate,
                    found=True,
                    match_count=1,
                    duration_ms=duration_ms,
                    competitor_id=comp_id,
                    phase=phase,
                )
            return True
        except Exception as e:
            used_fallback = True
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            if instrument:
                instrument.record_selector(
                    selector_key=selector_key, primary=primary,
                    fallback_used=True, matched=False,
                    candidate=candidate, duration_ms=duration_ms,
                    detail=f"fallback {i + 1}/{len(candidates)}: {e}",
                )
            if tracker:
                tracker.record(
                    selector_key=selector_key,
                    selector_value=candidate,
                    found=False,
                    duration_ms=duration_ms,
                    error=str(e),
                    expected_missing=True,
                    competitor_id=comp_id,
                    phase=phase,
                )
            if i < len(candidates) - 1:
                logger.debug("%s fallback %d/%d failed for %s: %s", selector_key, i + 1, len(candidates), comp_id, e)
            else:
                logger.debug("%s all %d fallback(s) failed for %s: %s", selector_key, len(candidates), comp_id, e)
    return False


_BUSINESS_META_SELECTORS = [
    "h1.fontHeadlineLarge",
    "div.fontHeadlineLarge",
    "span.fontHeadlineLarge",
    "div.aMPvhf-fI6EEc-KVuj8d",
]

_BUSINESS_RATING_SELECTORS = [
    "div.fontBodyMedium span[aria-label*='star']",
    "span.kvMYJc",
    "div.aMPvhf-fI6EEc-KVuj8d span[aria-label*='star']",
]

# Overview/props probe: address, category, phone, website, opening hours from
# the business info panel. Runs BEFORE the Reviews tab is clicked (the tab view
# hides the About/overview items for this variant). All fields are conditional —
# some businesses (e.g. Crate Cafe) render no phone/website nodes at all.
#
# M18 certification (2026-08-17, live probe) corrected the phone/website
# selectors for this Maps variant:
#   phone   -> a[href^="tel:"]       (aria-label "Panggil nomor telepon")
#   website -> a[data-item-id="authority"]  (aria-label "Situs Web: ...")
# The previous selectors ([data-item-id="telephone"], [data-item-id="website"] a)
# matched nothing and returned empty phone/website for every business.
# Opening hours come from the weekly table `table.eK4R0e` (row day = td.ylH6lf,
# row hours = td.mxowUb aria-label), plus the today status line in the
# `[jsaction*="pane.openhours.wfvdle24.dropdown"]` dropdown (.ZDu9vd).
# The current-day row's day cell carries `fontTitleSmall` (verified live).
_JS_OVERVIEW_PROBE = """() => {
  const out = {};
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const inner = (el) => {
    if (!el) return null;
    const node = el.querySelector('.Io6YTe');
    return node ? clean(node.textContent) : null;
  };
  const addr = document.querySelector('button[data-item-id="address"]');
  if (addr) {
    const label = (addr.getAttribute('aria-label') || '').replace(/^Alamat\\s*:\\s*/i, '').trim();
    out['address'] = label || inner(addr);
  }
  const cat = document.querySelector('button[jsaction*="category"]');
  if (cat) out['category'] = clean(cat.textContent);
  const phone = document.querySelector('a[href^="tel:"]');
  if (phone) {
    const href = (phone.getAttribute('href') || '').replace(/^tel:/i, '').trim();
    out['phone'] = href || clean(phone.textContent);
  }
  const web = document.querySelector('a[data-item-id="authority"]');
  if (web) {
    const aria = (web.getAttribute('aria-label') || '').replace(/^Situs Web\\s*:\\s*/i, '').trim();
    out['website'] = web.getAttribute('href') || aria || clean(web.textContent);
  }
  const hours = [];
  for (const tr of document.querySelectorAll('table.eK4R0e tr.y0skZc')) {
    const dayEl = tr.querySelector('td.ylH6lf');
    const hrEl = tr.querySelector('td.mxowUb');
    if (dayEl && hrEl) {
      hours.push({
        'day': clean(dayEl.textContent),
        'hours': hrEl.getAttribute('aria-label') || clean(hrEl.textContent),
        'today': dayEl.classList.contains('fontTitleSmall'),
      });
    }
  }
  if (hours.length) out['opening_hours'] = hours;
  const todayEl = document.querySelector('[jsaction*="pane.openhours.wfvdle24.dropdown"] .ZDu9vd');
  if (todayEl) out['hours_status'] = clean(todayEl.textContent);

  // Harvest honesty (HARVEST_FIX_PLAN Phase 1): the aggregate rating +
  // review-count text live on the OVERVIEW panel and disappear once the
  // Reviews tab is opened — extract them HERE, pre-tab. Verified live
  // 2026-08-24 (_phase1_dom_probe.py): rating renders as
  // span.ceNzKf[aria-label="4,2 bintang"] inside div.F7nice; the count
  // (when present — FULL/logged variant) renders near it as an
  // ulasan/reviews-labeled element.
  const ratingEl = document.querySelector('span.ceNzKf[aria-label]')
    || document.querySelector("span[aria-label*='bintang' i]")
    || document.querySelector("span[aria-label*='star' i]");
  if (ratingEl) {
    const m = (ratingEl.getAttribute('aria-label') || '').match(/([\\d]+[.,]?[\\d]*)/);
    if (m) out['google_rating'] = m[1];
  }
  if (!out['google_rating']) {
    const f7 = document.querySelector('div.F7nice');
    if (f7) { const m = clean(f7.textContent).match(/^([\\d]+[.,]?[\\d]*)/); if (m) out['google_rating'] = m[1]; }
  }
  // Count: aria-labeled ulasan/review elements (excluding write-review buttons),
  // then F7nice container text, then body-text regex (EN + ID).
  const countFromText = (t) => {
    if (!t) return null;
    let m = t.match(/([\\d][\\d.,\\u00a0]*)\\s*(ulasan|reviews?)/i);
    if (m) return m[1];
    m = t.match(/(ulasan|reviews?)\\s*[:\\-]?\\s*([\\d][\\d.,\\u00a0]*)/i);
    return m ? m[2] : null;
  };
  let count = null;
  for (const el of document.querySelectorAll("button[aria-label], span[aria-label], a[aria-label]")) {
    const aria = el.getAttribute('aria-label') || '';
    if (/tulis|write/i.test(aria)) continue;
    const c = countFromText(aria);
    if (c) { count = c; break; }
  }
  if (!count) {
    const f7 = document.querySelector('div.F7nice');
    if (f7) count = countFromText(clean(f7.parentElement ? f7.parentElement.textContent : ''));
  }
  if (!count) count = countFromText(clean(document.body.innerText).slice(0, 4000));
  if (count) out['google_review_count'] = count;
  return JSON.stringify(out);
}"""

# Per-star review breakdown in the full Reviews tab view:
# tr.BHOKXe[role="img"][aria-label="Bintang 5,3.242 ulasan"].
_JS_STAR_BREAKDOWN = """() => {
  const out = {};
  for (const tr of document.querySelectorAll('tr.BHOKXe')) {
    const m = (tr.getAttribute('aria-label') || '').match(/Bintang\\s+(\\d+),([\\d.,]+)\\s*ulasan/i);
    if (m) out[(m[1]) + '_star'] = m[2];
  }
  return JSON.stringify(out);
}"""


def _probe_json(page, script: str) -> dict:
    import json as json_mod

    try:
        raw = page.evaluate(script)
        if not raw:
            return {}
        parsed = json_mod.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _capture_business_metadata(page, instrument: PipelineInstrument | None = None, seed: dict | None = None) -> dict | None:
    """Extract business name, displayed rating, review count + overview props.

    Uses multiple extraction strategies in priority order:
    1. Structured JSON-LD data (most reliable)
    2. Page title + body text regex
    3. Known Google Maps CSS selectors
    4. Baked-in JS probes for address/category/phone/website (seeded from the
       overview page) and the per-star review breakdown (Reviews-tab view).
    """
    import json as json_mod
    import re

    metadata: dict = dict(seed or {})

    # Strategy 1: JSON-LD structured data
    try:
        jsonld = page.evaluate("""() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const s of scripts) {
                try {
                    const data = JSON.parse(s.textContent);
                    if (data.name || (data.itemListElement && data.itemListElement[0])) {
                        return JSON.stringify(data);
                    }
                } catch(e) {}
            }
            return null;
        }""")
        if jsonld:
            parsed = json_mod.loads(jsonld)
            ld = parsed
            if not metadata.get("business_name"):
                name = ld.get("name") or (ld.get("itemListElement") and ld["itemListElement"][0].get("name"))
                if name:
                    metadata["business_name"] = str(name)[:200]
            if not metadata.get("google_rating"):
                agg = ld.get("aggregateRating") or {}
                rating = agg.get("ratingValue")
                if rating is not None:
                    metadata["google_rating"] = str(rating)
                count = agg.get("reviewCount")
                if count is not None:
                    metadata["google_review_count"] = str(count)
    except Exception:
        pass

    # Strategy 2: page title
    if not metadata.get("business_name"):
        try:
            title = page.title()
            if title:
                clean = re.sub(r"\s*[-–|].*$", "", title).strip()
                if clean:
                    metadata["business_name"] = clean[:200]
        except Exception:
            pass

    # Strategy 3: Google Maps h1 / header selectors
    try:
        name_selectors = [
            "h1.fontHeadlineLarge",
            "h1",
            "[itemprop='name']",
            "div[role='main'] h1",
        ]
        for sel in name_selectors:
            el = page.query_selector(sel)
            if el:
                text = el.inner_text()
                if text and text.strip():
                    metadata["business_name"] = text.strip()[:200]
                    break
    except Exception:
        pass

    # Strategy 4: body text regex for review count + rating
    try:
        body_text = page.locator("body").inner_text(timeout=3000)[:8000]

        if not metadata.get("google_review_count"):
            # EN + ID ("ulasan") — this Maps variant renders Indonesian.
            review_matches = list(re.finditer(
                r"(\d[\d.,\u00a0]*)\s*(?:ulasan|reviews?)", body_text[:5000], re.IGNORECASE,
            ))
            if review_matches:
                metadata["google_review_count"] = review_matches[0].group(1)

        if not metadata.get("google_rating"):
            rating_match = re.search(r"(\d[.,]?\d*)\s*stars?", body_text[:3000], re.IGNORECASE)
            if not rating_match:
                rating_match = re.search(r"(\d[.,]?\d*)\s*[(][\d,]+[)]", body_text[:3000])
            if not rating_match:
                rating_match = re.search(r"(\d[.,]?\d*)\s*out\s*of\s*5", body_text[:3000], re.IGNORECASE)
            if rating_match:
                metadata["google_rating"] = rating_match.group(1)
    except Exception:
        pass

    # Strategy 5: overview props (address/category/phone/website). Only the
    # overview page carries these; seeded before the Reviews tab is opened so
    # seed already has them. Re-probe in case seed is empty.
    if not (metadata.get("address") or metadata.get("category")):
        overview = _probe_json(page, _JS_OVERVIEW_PROBE)
        for k, v in overview.items():
            if v and not metadata.get(k):
                metadata[k] = v

    # Strategy 6: per-star review breakdown (only rendered in Reviews tab view).
    breakdown = _probe_json(page, _JS_STAR_BREAKDOWN)
    if breakdown:
        metadata["review_breakdown"] = breakdown

    result = metadata if metadata else None
    if instrument and result:
        instrument.set_business_metadata(result)
    return result


def _safe_screenshot(page, spath: Path, name: str) -> str | None:
    try:
        full = spath / name
        page.screenshot(path=str(full), full_page=False)
        return str(full)
    except Exception as e:
        logger.warning("screenshot %s failed: %s", name, e)
        return None


def _path_traversal_check(spath: Path) -> bool:
    resolved = spath.resolve()
    if ".." in str(spath) or ".." in str(resolved):
        logger.error("Path traversal detected in %r — skipping evidence save", str(spath))
        return False
    return True


def _verify_reviews_dialog(page, selectors: dict, comp_id: str, instrument: PipelineInstrument | None = None) -> bool:
    """Prove the Reviews dialog opened after clicking the Reviews tab.

    Tries selectors from config (review_dialog, review_container) and known
    Google Maps patterns. Logs a WARNING if none match — this is the early
    warning that the Reviews tab click may not have worked.
    """
    from harness.selectors import resolve_selectors
    candidates = []
    for key in ("review_dialog", "review_container"):
        candidates.extend(resolve_selectors(selectors, key))
    candidates.extend([
        "div[role='dialog'] div.m6QErb",
        "div.m6QErb.DxyBCb",
        "div[aria-label*='review' i]",
    ])
    for candidate in candidates:
        try:
            el = page.wait_for_selector(candidate, timeout=3000)
            if el:
                logger.info(
                    "REVIEWS_DIALOG[%s] detected via %r",
                    comp_id, candidate,
                )
                if instrument:
                    instrument.record_selector(
                        selector_key="review_dialog", primary=candidate,
                        fallback_used=False, matched=True,
                        match_count=1, candidate=candidate,
                        detail="Reviews dialog confirmed open",
                    )
                return True
        except Exception:
            continue
    logger.warning(
        "REVIEWS_DIALOG[%s] NOT detected — Reviews tab click may have "
        "failed or the DOM has changed. Proceeding with scroll anyway; "
        "the parser will report 0 reviews if none are found.",
        comp_id,
    )
    if instrument:
        instrument.record_selector(
            selector_key="review_dialog", primary=None,
            fallback_used=True, matched=False,
            detail="No candidate selector matched — Reviews dialog may not be open",
        )
    return False


def _open_reviews_tab(page, selectors: dict, comp_id: str, instrument: PipelineInstrument | None = None) -> bool:
    """Open the full Reviews tab so the scrollable list (not the 3 embedded
    cards) becomes the capture target.

    Best-effort: if the tab cannot be opened the flow proceeds with whatever
    reviews are embedded in the initial HTML (previous behavior).
    """
    from harness.selectors import resolve_selectors
    candidates = resolve_selectors(selectors, "reviews_tab_button")
    primary = candidates[0] if candidates else None
    if not candidates:
        logger.info("REVIEWS_TAB[%s] no reviews_tab_button configured — using embedded reviews", comp_id)
        if instrument:
            instrument.record_selector(
                selector_key="reviews_tab_button", primary=None,
                fallback_used=False, matched=False, detail="not configured",
            )
        return False
    used_fallback = False
    for i, candidate in enumerate(candidates):
        t0 = time.time() if instrument else None
        try:
            page.wait_for_selector(candidate, timeout=4000)
            page.locator(candidate).first.click(timeout=4000)
            page.wait_for_timeout(2500)
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            logger.info("REVIEWS_TAB[%s] opened via %r", comp_id, candidate)
            if instrument:
                instrument.record_selector(
                    selector_key="reviews_tab_button", primary=primary,
                    fallback_used=used_fallback, matched=True,
                    match_count=1, candidate=candidate,
                    duration_ms=duration_ms,
                    detail="Reviews tab opened",
                )
            return True
        except Exception as e:
            used_fallback = True
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            if instrument:
                instrument.record_selector(
                    selector_key="reviews_tab_button", primary=primary,
                    fallback_used=True, matched=False,
                    candidate=candidate, duration_ms=duration_ms,
                    detail=f"fallback {i + 1}/{len(candidates)}: {e}",
                )
            if i < len(candidates) - 1:
                logger.debug("reviews_tab fallback %d/%d failed for %s: %s", i + 1, len(candidates), comp_id, e)
            else:
                logger.warning("REVIEWS_TAB[%s] all %d candidate(s) failed: %s — using embedded reviews", comp_id, len(candidates), e)
    return False


# HARVEST S3 (2026-08-25): Google's Reviews panel defaults to "Most relevant"
# ordering, so a brand-new review can sit outside the rendered ~500-card
# window entirely. Clicking the panel's own "Urutkan → Terbaru" (Sort →
# Newest) control before scrolling makes the window strictly newest-first —
# the single biggest monitoring-accuracy improvement available. Selectors
# verified live 2026-08-25 (_phase_s3_sort_probe.py, id-ID variant):
#   sort button: button[aria-label="Urutkan ulasan"]
#   menu option: button text "Terbaru" (class wR3cXd fontLabelMedium)
_SORT_BUTTON_CANDIDATES = [
    "button[aria-label*='urutkan' i]",
    "button[aria-label*='sort' i]",
]

# Count VISIBLE elements whose entire label is exactly Terbaru/Newest.
# NOTE: the sort-menu options are NOT <button> elements (live DOM 2026-08-25:
# plain divs/spans in the dropdown) — hence the broad element query.
_COUNT_NEWEST_JS = """() => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  return [...document.querySelectorAll('button, div, span, li, [role="menuitem"], [role="option"]')]
    .filter(el => {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      if (el.children.length > 1) return false;
      return /^(terbaru|newest)$/i.test(clean(el.textContent));
    }).length;
}"""

# Click the VISIBLE exact-text Terbaru/Newest element NEAREST the sort
# control (the menu option drops adjacent to it; the app-rail nav item is
# farther away).
_CLICK_NEAREST_NEWEST_JS = """(sortSel) => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  // Re-find the sort button live: opening the menu can re-render the header
  // and replace the original node (live evidence: 'sort button gone').
  let sortBtn = document.querySelector(sortSel);
  if (!sortBtn) {
    sortBtn = [...document.querySelectorAll('button')].find(b =>
      /urutkan|sort/i.test(b.getAttribute('aria-label') || ''));
  }
  if (!sortBtn) return { ok: false, reason: 'sort button gone' };
  const sb = sortBtn.getBoundingClientRect();
  const cands = [...document.querySelectorAll('button, div, span, li, [role="menuitem"], [role="option"]')]
    .filter(el => {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      if (el.children.length > 1) return false;
      return /^(terbaru|newest)$/i.test(clean(el.textContent));
    });
  if (cands.length === 0) return { ok: false, reason: 'no visible option' };
  let best = null, bestD = Infinity;
  for (const c of cands) {
    const r = c.getBoundingClientRect();
    const d = Math.hypot(r.x - sb.x, r.y - sb.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  const info = { ok: true, count: cands.length, dist: Math.round(bestD) };
  best.click();
  return info;
}"""


def _close_sort_menu(page) -> None:
    """Best-effort menu close so the panel is never left in menu state."""
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)
    except Exception:
        pass


def click_newest_sort(
    page,
    comp_id: str,
    instrument=None,
) -> bool:
    """Switch the Reviews panel to Newest ordering. Best-effort (Rule 7).

    Returns True when the panel is now newest-first; False ⇒ caller proceeds
    with Google's default (most-relevant) ordering exactly as before.
    """
    sort_btn = None
    used_candidate = None
    for candidate in _SORT_BUTTON_CANDIDATES:
        try:
            sort_btn = page.query_selector(candidate)
            if sort_btn:
                used_candidate = candidate
                break
        except Exception:
            continue
    if not sort_btn:
        logger.info(
            "SORT_NEWEST[%s] sort control not found — proceeding with default ordering",
            comp_id,
        )
        if instrument:
            instrument.record_selector(
                selector_key="reviews_sort_newest", primary=None,
                fallback_used=False, matched=False,
                detail="sort control not found (embedded/reduced variant?)",
            )
        return False
    try:
        # Count VISIBLE Terbaru/Newest buttons BEFORE opening the menu — the
        # app rail also has a "Terbaru" nav button (live evidence 2026-08-26:
        # a naive has-text click hit the NAV button and navigated away from
        # the place panel entirely, harvesting 0 reviews).
        visible_before = page.evaluate(_COUNT_NEWEST_JS)
        sort_btn.click(timeout=4_000)
        # The menu renders async — wait until a NEW visible Terbaru/Newest
        # button appears (menu option), or time out.
        option_opened = False
        for _ in range(16):  # ~8s
            page.wait_for_timeout(500)
            if page.evaluate(_COUNT_NEWEST_JS) > visible_before:
                option_opened = True
                break
        if not option_opened:
            _close_sort_menu(page)
            logger.warning(
                "SORT_NEWEST[%s] sort menu did not open — proceeding with default ordering",
                comp_id,
            )
            if instrument:
                instrument.record_selector(
                    selector_key="reviews_sort_newest", primary=used_candidate,
                    fallback_used=True, matched=False,
                    detail="sort menu did not open (menu closed)",
                )
            return False
        # Click the menu option NEAREST the sort button — never the nav rail.
        result = page.evaluate(_CLICK_NEAREST_NEWEST_JS)
        if not result.get("ok"):
            _close_sort_menu(page)
            logger.warning(
                "SORT_NEWEST[%s] menu option click failed (%s) — proceeding with default ordering",
                comp_id, result.get("reason"),
            )
            if instrument:
                instrument.record_selector(
                    selector_key="reviews_sort_newest", primary=used_candidate,
                    fallback_used=True, matched=False,
                    detail=f"option click failed: {result.get('reason')}",
                )
            return False
        # Switching to Terbaru re-fetches the list: the panel collapses and
        # re-renders (live evidence: an immediate scroll saw height 584 /
        # 0 cards and declared bottom via spinner_finished). Wait for the
        # first review card of the re-sorted list before handing off.
        try:
            page.wait_for_selector("[data-review-id]", timeout=20_000)
        except Exception:
            page.wait_for_timeout(6_000)
        page.wait_for_timeout(1_500)
        # Wait for the panel to fully expand after sort. A collapsed panel
        # has height ~584px with 0 visible cards; an expanded panel has
        # height > 1000px. Without this wait, the scroll phase starts
        # against a collapsed panel and harvests 0 reviews.
        try:
            page.wait_for_function(
                """() => {
                    const el = document.querySelector('div.m6QErb[role="region"]');
                    if (!el) return false;
                    return el.scrollHeight > 1000;
                }""",
                timeout=15_000,
            )
        except Exception:
            page.wait_for_timeout(3_000)
        page.wait_for_timeout(1_000)
        # Verify the sort actually took effect: the panel should now show
        # the newest reviews first. If the first review is older than ~7 days,
        # the sort likely failed — retry once.
        try:
            first_review_rel = page.evaluate("""() => {
                const el = document.querySelector('[data-review-id]');
                if (!el) return null;
                const card = el.closest('div[jsmodel]') || el.parentElement?.parentElement;
                if (!card) return null;
                const texts = card.querySelectorAll('span, div');
                for (const t of texts) {
                    const txt = t.textContent?.trim() || '';
                    if (/^\\d+\\s*(jam|menit|hari|minggu|bulan|tahun|lalu|yang lalu)/i.test(txt)) return txt;
                }
                return null;
            }""")
            if first_review_rel and any(unit in first_review_rel.lower() for unit in ['hari', 'minggu', 'bulan', 'tahun']):
                logger.warning(
                    "SORT_NEWEST[%s] first review is '%s' — sort may not have applied, retrying",
                    comp_id, first_review_rel,
                )
                # Retry: click the sort option again
                result = page.evaluate(_CLICK_NEAREST_NEWEST_JS)
                if result.get("ok"):
                    page.wait_for_timeout(2_000)
                    logger.info("SORT_NEWEST[%s] retry applied", comp_id)
        except Exception:
            pass  # Verification is best-effort; proceed regardless
        logger.info(
            "SORT_NEWEST[%s] applied via %r (menu candidates=%s, dist=%spx)",
            comp_id, used_candidate, result.get("count"), result.get("dist"),
        )
        if instrument:
            instrument.record_selector(
                selector_key="reviews_sort_newest",
                primary=used_candidate, fallback_used=False,
                matched=True, match_count=1,
                candidate=f"nearest-Terbaru(dist={result.get('dist')}px)",
                detail="Newest ordering applied",
            )
        return True
    except Exception as e:
        # Rule 7: never leave the menu open or raise — close + fall back.
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(800)
        except Exception:
            pass
        logger.warning(
            "SORT_NEWEST[%s] failed (%s) — menu closed, proceeding with default ordering",
            comp_id, e,
        )
        if instrument:
            instrument.record_selector(
                selector_key="reviews_sort_newest", primary=used_candidate,
                fallback_used=True, matched=False, detail=f"error: {e}",
            )
        return False


def capture_listing_html(
    context,
    url: str,
    selectors: dict,
    screenshot_dir: str | None = None,
    tracker=None,
    comp_id: str = "",
    total_timeout_s: int = 90,
    instrument: PipelineInstrument | None = None,
) -> str:
    phase_timings = {}
    spath = None
    page = context.new_page()
    setup_page_handlers(page, comp_id=comp_id)
    start = time.time()
    deadline = start + total_timeout_s
    try:
        # Playwright-native timeouts for individual operations. These cap
        # each single Playwright call (goto, wait_for_selector, click) so
        # no operation blocks forever. The total across all phases is
        # enforced by the wall-clock deadline checks below — no threading.
        page.set_default_navigation_timeout(30000)
        page.set_default_timeout(10000)

        if instrument:
            instrument.start_phase("navigation")

        t0 = time.time()
        try:
            page.goto(url, timeout=30000)
        except Exception as e:
            if instrument:
                instrument.end_phase("fail", detail=str(e))
            raise _classify_navigation_error(url, e)
        phase_timings["goto"] = round(time.time() - t0, 2)
        if instrument:
            instrument.end_phase("success", detail=f"loaded {url[:80]}...")

        if screenshot_dir:
            spath = Path(screenshot_dir)
            if not _path_traversal_check(spath):
                spath = None
            if spath:
                spath.mkdir(parents=True, exist_ok=True)
                shot = _safe_screenshot(page, spath, "01-business-loaded.png")
                if shot and instrument:
                    instrument.record_screenshot("business_loaded", shot)

        if instrument:
            instrument.start_phase("reviews_dialog_verify")
        _verify_reviews_dialog(page, selectors, comp_id, instrument)
        if instrument:
            instrument.end_phase()

        if time.time() > deadline:
            raise CaptureTimeoutError("reviews_dialog", time.time() - start, total_timeout_s)

        # Overview props (address/category/phone/website) are only present on
        # the initial business page — the Reviews-tab view hides them. Capture
        # them BEFORE opening the tab and seed the metadata capture.
        business_meta_seed = _probe_json(page, _JS_OVERVIEW_PROBE)

        if instrument:
            instrument.start_phase("open_reviews_tab")
        t0 = time.time()
        tab_opened = _open_reviews_tab(page, selectors, comp_id, instrument)
        phase_timings["open_reviews_tab"] = round(time.time() - t0, 2)
        if instrument:
            instrument.end_phase("success",
                                 detail="full Reviews list loaded" if tab_opened
                                 else "tab not opened — using embedded reviews")

        if time.time() > deadline:
            raise CaptureTimeoutError("open_reviews_tab", time.time() - start, total_timeout_s)

        # Harvest S3 (HARVEST plan follow-up): switch the panel to Newest
        # ordering so the rendered window reliably starts with the newest
        # reviews. Best-effort — on failure we proceed with Google's default
        # ordering exactly as before (Rule 7).
        if tab_opened:
            click_newest_sort(page, comp_id, instrument)

        if instrument:
            instrument.start_phase("scroll")
        t0 = time.time()
        scroll_result = scroll_review_container(page, selectors, tracker=tracker, comp_id=comp_id, deadline=deadline, instrument=instrument)
        phase_timings["scroll"] = round(time.time() - t0, 2)
        if instrument:
            instrument.end_phase()
            if scroll_result:
                for entry in scroll_result.get("scroll_progress", []):
                    instrument.record_scroll_iteration(
                        iteration=entry["iteration"],
                        height=entry["height"],
                        visible_cards=entry["visible_cards"],
                        dom_nodes=entry["dom_nodes"],
                        stable=entry["stable"],
                        bottom_reason=entry.get("bottom_reason"),
                        new_harvested=entry.get("new_harvested", 0),
                        harvested_total=entry.get("harvested_total", 0),
                    )

        if screenshot_dir and spath:
            shot = _safe_screenshot(page, spath, "03-after-scroll.png")
            if shot and instrument:
                instrument.record_screenshot("after_scroll", shot)

            final_shot = _safe_screenshot(page, spath, "04-final-state.png")
            if final_shot and instrument:
                instrument.record_screenshot("final_state", final_shot)

        if instrument:
            instrument.start_phase("expand_reviews")
        t0 = time.time()
        _fallback_expand(page, selectors, tracker=tracker, comp_id=comp_id, instrument=instrument)
        phase_timings["expand"] = round(time.time() - t0, 2)
        if instrument:
            instrument.end_phase()

        if instrument:
            instrument.start_phase("html_capture")

        raw_html = page.content()

        # Reconstruct the FULL review list from the cards harvested during
        # scrolling. Google virtualizes the review DOM (only ~350 distinct
        # cards stay mounted; the rest are unmounted as you scroll), so the
        # single end-of-run page.content() only contains the LAST window.
        # Wrapping every harvested card's outerHTML into one container gives
        # the parser the complete set while keeping raw_html as evidence.
        harvested = (scroll_result or {}).get("harvested_reviews", []) or []
        html = raw_html
        if harvested:
            cards_html = "".join(card["html"] for card in harvested)
            html = (
                "<html><head><meta charset='utf-8'></head><body>"
                "<div id='harvested-reviews' class='m6QErb'>"
                + cards_html
                + "</div></body></html>"
            )

        _validate_capture_output(html, comp_id, logger)
        if instrument:
            instrument.end_phase(
                "success",
                detail=f"{len(html)} bytes captured "
                       f"(harvested {len(harvested)} distinct review cards)",
            )

        if instrument:
            instrument.start_phase("business_metadata")
        _capture_business_metadata(page, instrument, seed=business_meta_seed)
        if instrument:
            instrument.end_phase()

        if spath:
            spath.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(spath / "page.png"), full_page=True)
            spath.joinpath("page.html").write_text(raw_html, encoding="utf-8")
            if harvested:
                spath.joinpath("harvested_reviews.html").write_text(html, encoding="utf-8")

        logger.info("capture[%s] phases: %s", comp_id, ", ".join(f"{k}={v}s" for k, v in phase_timings.items()))
        return html
    except NavigationError:
        if instrument:
            instrument.phase_result("navigation", "fail")
        raise
    except CaptureTimeoutError:
        if instrument:
            instrument.phase_result("capture_timeout", "fail")
        raise
    finally:
        try:
            page.close()
        except Exception as close_err:
            logger.warning("page.close() failed: %s", close_err)


def _validate_capture_output(html: str, comp_id: str, log: logging.Logger) -> None:
    size = len(html)
    if size < 1024:
        log.error("CAPTURE_EMPTY[%s]: HTML is only %d bytes — page likely failed to load", comp_id, size)
    elif size < 10240:
        log.warning("CAPTURE_SMALL[%s]: HTML is only %d bytes — may be incomplete or an interstitial page", comp_id, size)
    else:
        log.info("capture[%s]: %d bytes captured", comp_id, size)


def _fallback_expand(
    page, selectors: dict, tracker=None, comp_id: str = "",
    instrument: PipelineInstrument | None = None,
) -> None:
    candidates = resolve_selectors(selectors, "expand_text_button")
    primary = candidates[0] if candidates else None
    if not candidates:
        if instrument:
            instrument.record_selector(
                selector_key="expand_text_button", primary=None,
                fallback_used=False, matched=False, detail="not configured",
            )
        if tracker:
            tracker.record(
                selector_key="expand_text_button",
                selector_value=None,
                found=False,
                competitor_id=comp_id,
                phase="expand",
                error="not configured",
            )
        return
    total_clicked = 0
    best_candidate = None
    used_fallback = False
    outcomes: list[tuple] = []
    for i, candidate in enumerate(candidates):
        t0 = time.time() if (tracker or instrument) else None
        try:
            buttons = page.query_selector_all(candidate)
            clicked = 0
            for btn in buttons:
                try:
                    btn.click(timeout=_OPTIONAL_ELEMENT_TIMEOUT_MS)
                    clicked += 1
                except Exception as e:
                    logger.debug("expand fallback %d/%d click failed: %s", i + 1, len(candidates), e)
            if clicked > total_clicked:
                total_clicked = clicked
                best_candidate = candidate
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            outcomes.append((candidate, clicked, duration_ms, None))
            if instrument:
                instrument.record_selector(
                    selector_key="expand_text_button", primary=primary,
                    fallback_used=used_fallback, matched=clicked > 0,
                    match_count=clicked, candidate=candidate,
                    duration_ms=duration_ms,
                    detail=f"{clicked} button(s) clicked" if clicked else "no buttons found",
                )
        except Exception as e:
            used_fallback = True
            duration_ms = (time.time() - t0) * 1000 if t0 else 0
            outcomes.append((candidate, 0, duration_ms, str(e)))
            if instrument:
                instrument.record_selector(
                    selector_key="expand_text_button", primary=primary,
                    fallback_used=True, matched=False,
                    candidate=candidate, duration_ms=duration_ms,
                    detail=f"fallback {i + 1}/{len(candidates)}: {e}",
                )
            logger.debug("expand fallback %d/%d query failed: %s", i + 1, len(candidates), e)
        if total_clicked > 0:
            break
    if tracker:
        for candidate, clicked, duration_ms, err in outcomes:
            tracker.record(
                selector_key="expand_text_button",
                selector_value=candidate,
                found=clicked > 0,
                match_count=clicked,
                duration_ms=duration_ms,
                competitor_id=comp_id,
                phase="expand",
                expected_missing=clicked == 0 and err is None,
                error=err,
            )
    if total_clicked > 0:
        logger.info("EXPAND[%s] expanded %d truncated review(s) via %s", comp_id, total_clicked, best_candidate)


def _expand_truncated_reviews(
    page, selectors: dict, tracker=None, comp_id: str = "",
    instrument: PipelineInstrument | None = None,
) -> None:
    _fallback_expand(page, selectors, tracker=tracker, comp_id=comp_id, instrument=instrument)


# ---------------------------------------------------------------------------
# Stale-NID variant guard (2026-08-16)
# ---------------------------------------------------------------------------
# Google serves the FULL Maps review variant only when the context carries a
# valid NID. A persisted storage_state whose NID has gone stale gets served
# the REDUCED variant: a handful (~5) review cards regardless of the real
# count (evidence: 07:54 run jftiEf=5 vs OLD jftiEf=350). `probe_review_variant`
# cheaply classifies the served variant so the orchestrator can invalidate the
# stale jar and re-warm a fresh NID BEFORE wasting a full run on 5 cards.

# Aggregate review count shown in the business header ("X reviews" / "X ulasan")
# — the REDUCED variant still renders the TRUE aggregate even though it mounts
# only ~5 cards, so comparing cards vs aggregate disambiguates a genuinely
# small business from a stale-NID reduced capture.
_JS_READ_AGGREGATE_REVIEWS = """() => {
  const body = document.body ? document.body.innerText.slice(0, 6000) : '';
  const m = body.match(/([\\d][\\d,.\\u00a0]*)\\s+(?:reviews?|ulasan)/i);
  if (m) return m[1];
  const p = body.match(/\\(\\s*([\\d][\\d,.\\u00a0]*)\\s*\\)/);
  return p ? p[1] : null;
}"""

_REDUCED_VARIANT_MAX_CARDS = 20
_FULL_VARIANT_MIN_CARDS = 50
# A business with more reviews than this threshold, yet serving <= MAX_CARDS
# mounted cards, is the stale-NID REDUCED signature (Google hides the list).
_AGGREGATE_REDUCED_THRESHOLD = 100
# Bounded probe scroll: enough iterations for a FULL variant to clearly exceed
# _FULL_VARIANT_MIN_CARDS but far fewer than a real capture's MAX_SCROLLS.
_PROBE_MAX_SCROLLS = 12
_PROBE_SCROLL_WAIT_MS = 900


def _parse_aggregate_count(raw: str | None) -> int | None:
    """Parse a Google review-count string like ``"3.243"`` / ``"1,024"``."""
    if not raw:
        return None
    cleaned = raw.replace("\u00a0", "").replace(",", "").replace(".", "")
    try:
        return int(cleaned)
    except ValueError:
        return None


def _classify_variant(cards: int, aggregate: int | None) -> tuple[str, str]:
    """Classify FULL/REDUCED/UNKNOWN from mounted card count + aggregate count.

    Returns ``(variant, detail)``. Pure logic — unit-testable offline.
    """
    if cards >= _FULL_VARIANT_MIN_CARDS:
        return "full", f"{cards} distinct cards"
    if (
        cards <= _REDUCED_VARIANT_MAX_CARDS
        and aggregate is not None
        and aggregate >= _AGGREGATE_REDUCED_THRESHOLD
    ):
        return (
            "reduced",
            f"{cards} distinct cards vs {aggregate} aggregate (REDUCED signature)",
        )
    return "unknown", f"{cards} distinct cards (aggregate={aggregate})"


# Harvest completeness (HARVEST_FIX_PLAN Phase 1): how much of the listing's
# true total did this capture window reach? Distinct from _classify_variant
# (which detects the stale-NID REDUCED-variant signature). Google's panel
# virtualizes and typically stops serving cards after ~500-1000, so
# "reduced" here means "partial newest window", not a broken capture.
_HARVEST_FULL_RATIO = 0.9


def classify_harvest(harvested: int, google_count: int | None) -> tuple[str, str]:
    """Classify harvest completeness vs Google's own aggregate count.

    Returns ``(status, detail)`` where status is:
      - ``full``    — harvested >= 90% of Google's count (or count tiny)
      - ``reduced`` — harvested < 90% of Google's count (partial window)
      - ``unknown`` — Google's count unavailable (probe degraded)
    Pure logic — unit-testable offline.
    """
    if google_count is None or google_count <= 0:
        return "unknown", (
            f"{harvested} harvested; Google aggregate count unavailable"
        )
    if harvested >= google_count * _HARVEST_FULL_RATIO:
        return "full", f"{harvested} of {google_count} reviews harvested"
    return "reduced", (
        f"{harvested} of {google_count} reviews harvested — "
        "partial newest window (Google panel virtualization)"
    )


def probe_review_variant(context, url: str, selectors: dict, comp_id: str = "") -> dict:
    """Classify the variant a Maps URL serves on *context* without a full capture.

    Navigates a fresh page, opens the Reviews tab, resolves the scroll
    container, and does a *bounded* incremental harvest (same mechanism as a
    real capture, capped at ``_PROBE_MAX_SCROLLS``) counting distinct
    ``data-review-id`` cards. The FULL variant grows to hundreds of distinct
    cards; the REDUCED variant stays stuck at ~5 no matter how far we scroll.

    The probe ALSO reads the aggregate review count from the business header
    so a genuinely small listing (e.g. KAFE Ubud, 8 reviews) is not misread as
    a stale-NID reduced capture.

    Returns:
      ``{"variant": "full"|"reduced"|"unknown", "cards": int,
          "aggregate": int|null, "detail": str}``

    Never raises — failures degrade to ``"unknown"`` so the orchestrator's Rule
    7 isolation holds. This probe is cheaper than a full capture (~15-30s vs
    ~2-3 min) and runs at bootstrap time on every reused jar.
    """
    from harness.scroll import (
        _harvest_review_cards,
        _resolve_container_with_fallback,
    )

    page = context.new_page()
    setup_page_handlers(page, comp_id=comp_id or "__probe__")
    try:
        page.set_default_navigation_timeout(30000)
        page.set_default_timeout(10000)
        try:
            page.goto(url, timeout=30000)
        except Exception as e:
            return {"variant": "unknown", "cards": 0, "aggregate": None,
                    "detail": f"goto failed: {e}"}

        _verify_reviews_dialog(page, selectors, comp_id or "__probe__")
        _open_reviews_tab(page, selectors, comp_id or "__probe__")
        page.wait_for_timeout(1500)

        container_selector = _resolve_container_with_fallback(
            page, selectors, comp_id=comp_id or "__probe__"
        )

        aggregate = None
        try:
            aggregate = _parse_aggregate_count(
                page.evaluate(_JS_READ_AGGREGATE_REVIEWS)
            )
        except Exception:
            aggregate = None

        cards = 0
        if container_selector:
            harvested: set[str] = set()
            for _ in range(_PROBE_MAX_SCROLLS):
                if cards >= _FULL_VARIANT_MIN_CARDS:
                    break  # already full — no need to keep scrolling
                try:
                    page.eval_on_selector(
                        container_selector, "el => el.scrollTop = el.scrollHeight"
                    )
                    page.wait_for_timeout(_PROBE_SCROLL_WAIT_MS)
                    for card in _harvest_review_cards(page, container_selector):
                        harvested.add(card["id"])
                except Exception as e:
                    break
                cards = len(harvested)

        variant, detail = _classify_variant(cards, aggregate)
        return {"variant": variant, "cards": cards, "aggregate": aggregate,
                "detail": detail}
    finally:
        try:
            page.close()
        except Exception:
            pass
