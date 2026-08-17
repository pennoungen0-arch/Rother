# Selector Certification — M18 (schema v5 era)

**Certification ID:** M18-20260817  
**Certified by:** browser_agent (live Playwright probe, 12 real place_id competitors)  
**Date:** 2026-08-17  
**Business set:** all 12 configured competitors (real Google Maps place_id URLs)  
**Evidence source:** `data/verify/20260817T150808Z/selector_cert/evidence.json`  
**Machine-readable report:** `data/golden/selector_certification.json`  
**Supersedes:** M10-20260724 for the 3 schema-v5 selectors (M10 predates them)

## Certification Summary

| Metric | Value |
|--------|-------|
| Business set | 12 competitors (all real place_ids) |
| Total selectors evaluated | 7 (3 capture selectors + 4 business-metadata selectors) |
| Certified **Stable** | 6 |
| Certified **Semi-stable** | 1 |
| Certified **Fragile** | 0 |
| Certified **Obsolete** | 0 |

## Capture selectors (schema v5)

| Selector | Value | Classification | Evidence |
|----------|-------|----------------|----------|
| `reviews_tab_button` | `button[role='tab'][aria-label^='Ulasan']` | **stable** (12/12) | 1 match on every competitor; full-list capture depends on it |
| `review_like_selector` | `button.gllhef` | **stable** (11/12) | 6 matches on 11/12; 0 on `comp-uluwatu-02` (real negative case — no like buttons rendered) |
| `review_list_container` | `div.m6QErb.XiKgde` | **stable** (12/12) | Present on all 12 (14–23 matches); scroll resolves the concrete container by JS hunt |

## Business-metadata selectors (corrected 2026-08-17)

The M10-era probe used `[data-item-id="telephone"]` and `[data-item-id="website"] a`,
which **match nothing** in this Maps variant — every competitor returned empty
phone/website. A live DOM audit (probe_overview.html, Revolver Seminyak) proved
the real nodes and the probe was corrected.

| Selector | Value | Classification | Positive / Negative |
|----------|-------|----------------|---------------------|
| `phone` | `a[href^='tel:']` | **stable** | 10/12 positive, 2 negative (business renders no phone node) |
| `website` | `a[data-item-id='authority']` | **stable** | 11/12 positive, 1 negative |
| `opening_hours` | `table.eK4R0e tr.y0skZc` (`td.ylH6lf` day / `td.mxowUb` hours) | **stable** | 9/12 positive (7 days each), 3 negative |
| `hours_status` | `[jsaction*='pane.openhours.wfvdle24.dropdown'] .ZDu9vd` | **semi-stable** | 5/12 positive, 7 negative (status line rendered for some businesses only) |

Opening-hours rows carry the day name (e.g. `Senin`) and the hours range in the
`td.mxowUb` `aria-label` (e.g. `07.00 hingga 23.00`); the current-day row's day
cell also carries `fontTitleSmall`. Example today statuses captured live:
`Buka · Tutup pukul 23.00`, `Segera buka · 16.00`.

## Negative cases (real, not fabrication)

| Competitor | phone | website | hours | Notes |
|------------|-------|---------|-------|-------|
| `comp-seminyak-02` | x | x | x | No phone/website/hours/status — a data-light listing |
| `comp-uluwatu-02` | yes | yes | x | No hours table + no like buttons |
| `comp-sanur-01` | yes | yes | x | No hours table |
| `comp-canggu-01` | x | yes | yes | No phone node (website present) |

## Recommendations (M18)

1. **Keep** the corrected `_JS_OVERVIEW_PROBE` selectors (phone/website/hours).
2. **Keep** `reviews_tab_button`, `review_like_selector`, `review_list_container`.
3. All business-metadata fields remain **conditional** — empty values are valid
   when the DOM omits the node (Rule 3: no fabricated data).
4. `hours_status` is best-effort; treat `opening_hours` (weekly table) as the
   canonical hours source.

---
# Selector Certification â€” M10 Phase 4

**Certification ID:** M10-20260724  
**Certified by:** browser_agent (offline DOM audit + Playwright live capture)  
**Date:** 2026-07-24  
**Evidence source:** `data/verify/20260724T121337Z/comp-canggu-01/page.html` (517KB, real place_id)  
**Machine-readable report:** `data/golden/selector_certification.json`

## Certification Summary

| Metric | Value |
|--------|-------|
| Total selectors evaluated | 15 (including tiers and locators) |
| Certified **Stable** | 6 |
| Certified **Semi-stable** | 2 |
| Certified **Fragile** | 2 |
| Certified **Obsolete** | 6 |
| Certified **Unknown** | 0 |
| Overall confidence | 0.77 (77%) |

## Certified Stable (no changes needed)

| Selector | Match rate | Evidence |
|----------|-----------|----------|
| `review_item` (`div.jftiEf.fontBodyMedium`) | 100% (3/3) | DOM: `<div class="jftiEf fontBodyMedium" data-review-id="...">` |
| `review_id_attr` (`data-review-id`) | 100% (33/33) | 33 `data-review-id` elements in 517KB HTML |
| `reviewer_name_attr` (`aria-label`) | 100% (301/301) | 301 `[aria-label]` elements |
| `review_text_selector` (`span.wiI7pd`) | 100% (3/3) | DOM: `<span class="wiI7pd">Vibes na enak banget...</span>` |
| `rating_selector` + `rating_attr` | 100% (3/3) | DOM: `<span class="kvMYJc" aria-label="5 bintang">` |
| `relative_date_selector` (`span.rsqaWe`) | 100% (3/3) | DOM: `<span class="rsqaWe">seminggu lalu</span>` |

## Certified Semi-stable

| Selector | Confidence | Evidence |
|----------|-----------|----------|
| `review_container` tier 2 (`div.m6QErb[role='region']`) | 0.9 | Matches 2 containers, 8ms lookup. Semantic selector + 1 auto-generated class. |
| `expand_text_button` tier 1 (`button:has-text('More')`) | 0.7 | Playwright text matcher. â‰ˆ3 text occurrences. Resistant to class changes. |

## Certified Fragile

| Selector | Confidence | Evidence |
|----------|-----------|----------|
| `review_container` tier 0 (4-class variant) | 0.5 | Works on real pages (9ms), fails on search pages (10s). 4 auto-generated classes. |
| `expand_text_button` tier 0 (`button.w8nwRe.kyuRq`) | 0.5 | Works on real page (262ms, 5 buttons). Auto-generated classes. |

## Certified Obsolete (should be removed)

| Selector | Evidence |
|----------|----------|
| `cookie_reject_button` (all 3 tiers) | 0 matches, 0 text occurrences. No cookie banner in Indonesia. |
| `reviews_tab_button` (all 3 tiers) | 0 matches. Reviews are embedded in initial HTML. |
| `review_container` tier 1 (`div[role='feed']`) | 0 matches. Google removed `role='feed'`. |
| `expand_text_button` tier 2 (`button:has-text('See more')`) | 0 matches. "See more" text removed from UI. |
| Locator tier 2 (`[role='article'][aria-label]`) | 0 matches. `role='article'` removed. |
| Locator tier 4 (`div[role='article'][data-review-id]`) | 0 matches. `role='article'` removed. |

## Performance Impact

| Metric | Before | After (projected) | Improvement |
|--------|--------|-------------------|-------------|
| Per-competitor captue time (real page) | ~55s | ~15s | 73% |
| Per-competitor captue time (mock page) | ~55s | ~35s | 36% |
| Full run (12 competitors) | ~11min | ~2min | 82% |
| Obsolete selector waste | 288s (4.8min) | 0s | 100% |

## Verification Evidence

### HTML snippets from live capture:

**review_item with all fields:**
```html
<div class="jftiEf fontBodyMedium" data-review-id="Ci9DQUlRQUNvZENodHljRjlvT2xkSWMyTnlVMFkzYlZaYU1sRmpkSGRKVnpsZk4zYxAB" aria-label="Chelvy Soetanto">
  <span class="kvMYJc" aria-label="5 bintang"></span>
  <span class="wiI7pd">Vibes na enak banget, vintage n unik...</span>
  <span class="rsqaWe">seminggu lalu</span>
</div>
```

**review_container:**
```html
<div class="m6QErb DxyBCb kA9KIf dS8AEf" role="region" ...>
```

**Screenshot:** `data/verify/20260724T121337Z/comp-canggu-01/page.png` (full-page screenshot)

## Recommendations for Phase 5

1. **Remove** `cookie_reject_button` and `reviews_tab_button` from `config/selectors.json`
2. **Restructure** `review_container`: tier 0 = `div.m6QErb[role='region']`, tier 1 = the 4-class variant
3. **Remove** `expand_text_button` tier 2
4. **Remove** locator tiers 2 and 4 from `harness/locator.py`
5. **Preserve** all parser selectors unchanged
6. **Update** `_meta.selector_health` metadata to reflect new certifications
