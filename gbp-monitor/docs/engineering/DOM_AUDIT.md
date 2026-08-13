# DOM Audit — M10 Phase 1

**Date:** 2026-07-24  
**Evidence source:** `data/verify/20260724T121337Z/comp-canggu-01/page.html` (517,484 bytes, live Google Maps real `place_id`)  
**Tool:** `python -m orchestration.run_all --verify` + offline parsel CSS/XPath analysis  
**Competitor:** comp-canggu-01 (Crate Cafe Canggu, `ChIJ9fhCoBBH0i0R4h17JYdA484`)

## Pipeline Selectors

### cookie_reject_button

| Tier | Selector | DOM Matches | Status |
|------|----------|-------------|--------|
| 0 | `//button[contains(., 'Reject all')] \| //span[contains(text(), 'Reject all')]` | 0 | Obsolete |
| 1 | `button:has-text('Reject all')` | Playwright-only | Obsolete |
| 2 | `form[action*='cookie'] button:first-of-type` | 0 | Obsolete |

**Text evidence:** 0 occurrences of "Reject all" or "cookie" in 517KB HTML. No EU cookie banner is served to en-US locale on Indonesian Google Maps.  
**Waste:** 3 × 4000ms = 12s per competitor. All 12 competitors = 144s wasted.  
**Conclusion:** Deprecated for en-US / Indonesia locale. Cookie banner does not exist in this geography.

### reviews_tab_button

| Tier | Selector | DOM Matches | Status |
|------|----------|-------------|--------|
| 0 | `button[aria-label*='Reviews']` | 0 | Obsolete |
| 1 | `button[aria-label*='Avis']` | 0 | Obsolete |
| 2 | `[role='tab'][aria-label*='Review']` | 0 | Obsolete |

**Text evidence:** 33 `data-review-id` elements found directly in initial HTML. Reviews are server-side rendered — no tab click is needed. The Google Maps reviews tab still exists in the sidebar navigation, but review content is embedded in the initial page load.  
**Waste:** 3 × 4000ms = 12s per competitor. All 12 competitors = 144s wasted.  
**Conclusion:** Obsolete for this data set. Reviews are embedded in initial HTML.

### review_container

| Tier | Selector | DOM Matches | Status |
|------|----------|-------------|--------|
| 0 | `div.m6QErb.DxyBCb.kA9KIf.dS8AEf` | 1 | Semi-stable (auto-generated classes) |
| 1 | `div[role='feed']` | 0 | Obsolete |
| 2 | `div.m6QErb[role='region']` | 2 | Stable (semantic selector) |

**Stability analysis:**
- Tier 0 uses 4 Google auto-generated class names (`m6QErb`, `DxyBCb`, `kA9KIf`, `dS8AEf`). These change across Google Maps deployments.
- Tier 1 (`role='feed'`) — 0 matches. Google removed this ARIA role from the container.
- Tier 2 (`div.m6QErb[role='region']`) — 2 matches. Uses `role='region'` (semantic, stable) + one auto-generated class (`m6QErb` repeated across many containers).

**Waste:** Tier 0 fails on mock/search pages (10000ms timeout) but succeeds on real page (9ms). Tier 1 always fails (10000ms timeout). Effective waste: ~10s on pages where Tier 0 fails.

### expand_text_button

| Tier | Selector | DOM Matches | Status |
|------|----------|-------------|--------|
| 0 | `button.w8nwRe.kyuRq` | 0 (offline) → 5 (Playwright, 262ms) | Conditional |
| 1 | `button:has-text('More')` | Playwright-only (≈3 text matches) | Semi-stable |
| 2 | `button:has-text('See more')` | Playwright-only (0 text matches) | Likely obsolete |

**Note:** Tier 0 `button.w8nwRe.kyuRq` matched 5 elements in the live Playwright run (262ms total), but 0 matches in offline DOM audit of cached HTML. This suggests buttons are dynamically added by JavaScript after page load. Tier 1 (`has-text('More')`) has potential false positives — "More" appears in navigation labels, not just review expansion.

### review_item

| Tier | Selector | DOM Matches | Status |
|------|----------|-------------|--------|
| 0 | `div.jftiEf.fontBodyMedium` | 3 | Stable |

**Lookup time:** 1.8ms. **Match rate:** 100% (3/3 reviews found).

## Parser Selectors

| Selector | Configured | Matches | Lookup | Status |
|----------|-----------|---------|--------|--------|
| `review_id_attr` | `data-review-id` | 33 elements | N/A (attribute) | Stable |
| `reviewer_name_attr` | `aria-label` | 301 elements | N/A (attribute) | Stable |
| `review_text_selector` | `span.wiI7pd` | 3 | 0.4ms | Stable |
| `rating_selector` | `span.kvMYJc` | 3 | 0.4ms | Stable |
| `rating_attr` | `aria-label` | 301 elements | N/A (attribute) | Stable |
| `relative_date_selector` | `span.rsqaWe` | 3 | 0.4ms | Stable |

## Locator Tiers

| Tier | Selector | Total | With `data-review-id` | Status |
|------|----------|-------|----------------------|--------|
| 1 | `[data-review-id]` | 33 | 33 | **Active** |
| 2 | `[role='article'][aria-label]` | 0 | 0 | Obsolete |
| 3 | `[data-review-id][aria-label]` | 24 | 24 | Unused (tier 1 wins) |
| 4 | `div[role='article'][data-review-id]` | 0 | 0 | Obsolete |
| 5 | `div.jftiEf.fontBodyMedium` | 3 | 3 | Fallback |

Tier 1 (`[data-review-id]`) wins on real Google Maps HTML — 33 matches, all with valid IDs. Tiers 2 and 4 use `role='article'` which Google no longer emits on review cards. They can be removed.

## Summary

| Selector | Verdict | Action |
|----------|---------|--------|
| `cookie_reject_button` | **Obsolete** (no cookie banner in Indonesia) | Remove or reduce timeout to 100ms |
| `reviews_tab_button` | **Obsolete** (reviews are in initial HTML) | Remove entire section |
| `review_container` tier 0 | **Semi-stable** (auto-generated classes) | Demote to tier 2 |
| `review_container` tier 1 | **Obsolete** (`role='feed'` removed by Google) | Remove |
| `review_container` tier 2 | **Stable** (semantic `role='region'`) | Promote to tier 0 |
| `expand_text_button` tier 0 | **Conditional** (works on real pages) | Keep as-is |
| `expand_text_button` tier 1 | **Semi-stable** (text matching) | Keep as-is |
| `expand_text_button` tier 2 | **Obsolete** ("See more" not found) | Remove |
| All parser selectors | **Stable** (100% match rate) | No changes needed |
| Locator tiers 2, 4 | **Obsolete** (`role='article'` removed) | Remove |

---

# GMBE-PARITY Appendices (2026-08-12)

**Evidence source:** `data/verify/20260812T073304Z/*/page.html` (12 real listings, live Google Maps) + Playwright probes under the opencode temp dir (NOT shipped). All captures served to the hardened context (NID cookie, en-US/id-ID, Indonesia).

## Appendix A — Reviews-tab full-list capture

**Facts (verified by live Playwright probes):**
- The initial business page renders only **3** embedded review cards (`data-review-id` in initial HTML). This is what M10 documented.
- Clicking the Reviews tab (`button[role='tab'][aria-label^='Ulasan']`) loads a **full virtualized list**: Crate Cafe's tab view grew to **230 unique review IDs** after 25 scrolls on the list container.
- The tab-view list container is `div.m6QErb.XiKgde` — scrollHeight 6416px vs clientHeight 647px. It is a *different* element from the `div.m6QErb[role='region']` used as `review_container` tier 0.
- M10's "reviews_tab_button obsolete" verdict was correct **for the embedded-3-capture goal**, but the tab is REQUIRED for full-list capture. The selector is re-introduced as `reviews_tab_button`.

**Implementation:** `harness/scroll.py` resolves the review container via a JS hunt (most distinct `data-review-id` among `div.m6QErb`, validated CSS path) instead of relying on static tiers, so scrolling targets the correct list in both views. `harness/capture.py` opens the tab best-effort before scrolling.

## Appendix B — Per-review like count & date resolution

- Like button: `button.gllhef[aria-label='Suka']` with inner label `span.NlVald`. **All observed labels were plain "Suka" (count 0)** — no numeric counts appeared in any captured page. Parser therefore returns `0` when the button shows no number, `None` when no button is rendered.
- Date: `span.rsqaWe` is **relative-only** ("7 tahun lalu", "Diedit 6 tahun lalu"). **No absolute timestamp attribute** (`title`/`datetime`) exists in the served DOM. Dates are resolved approximately from relative strings by `parser/relative_date.py` (ID + EN), yielding an ISO date + epoch anchored to `scraped_at`.

## Appendix C — Business overview metadata

- Address: `button[data-item-id="address"]` (`aria-label="Alamat: ..."`, inner `.Io6YTe`). Present on the initial business page; **hidden in the Reviews-tab view** — must be captured before the tab opens.
- Category: `button[jsaction*="category"]` (e.g. "Kafe").
- Rating block: `div.F7nice` → `"4,2\n(5.272)"`.
- Review count: `role="img" aria-label="5.272 ulasan"`.
- Phone/website: `[data-item-id="telephone"]`, `[data-item-id="website"] a`. **Conditional** — Crate Cafe renders neither.
- Per-star breakdown: `tr.BHOKXe[role="img"][aria-label="Bintang 5,3.242 ulasan"]` — 5 rows, only rendered in the Reviews-tab view.

## Appendix D — Confirmed ABSENT (not fabricated, per Rule 3)

| Feature | Search evidence | Verdict |
|---------|-----------------|---------|
| Owner replies | 0 hits for `Pemilik balasan`, `Balasan pemilik`, `Response from the owner`, `ownerResponse`, `balasan` across ~170 pages + 10 probes (incl. lowest-rating sort showing 10x 1-star reviews, AYANA Resort search+tab flow, 230-review deep scroll) | **Not rendered by this Maps variant** — no reply selector exists in captured DOM |
| JSON-LD structured data | 0 `application/ld+json` blocks in any captured page | `_capture_business_metadata` JSON-LD strategy never fires for this variant |
| Absolute review timestamps | no `title`/`datetime` attribute on `span.rsqaWe` | Dates must be approximated from relative strings |
| Absolute business timestamps (busy hours etc.) | not present in captured DOM | out of scope |
