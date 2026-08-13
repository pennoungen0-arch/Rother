# SELECTOR_CHANGELOG — M10 Selector Audit & Certification

## 2026-08-12 — GMBE-PARITY selector additions

### Re-introduced selectors

| Selector | Reason | Evidence |
|----------|--------|----------|
| `reviews_tab_button` (`button[role='tab'][aria-label^='Ulasan']`, `...^='Reviews']`) | M10 marked this obsolete because the initial page embeds 3 reviews. The **full** virtualized list (230 unique IDs for Crate Cafe) requires clicking the Reviews tab. Best-effort open, graceful degrade. | LIVE probe 20260812 — tab view scrollHeight 6416 vs embedded ~647 |

### Added selectors

| Selector | Value | Purpose |
|----------|-------|---------|
| `review_like_selector` | `button.gllhef` | Per-review like count (aria-label or inner text) |
| `review_list_container` | `div.m6QErb.XiKgde` | Documented tab-view list container (resolution is JS-hunt based, this is the observed class for reference) |

### Configuration version

- `config/selectors.json` schema version: 4 → 5
- Added 3 top-level keys.
- `scroll.py` resolves the review container by **JS hunt** (most distinct `data-review-id`, validated path) before falling back to configured CSS tiers — no static selector change required for the tab view.

## 2026-07-24 — M10 Targeted Improvements

### Removed selectors (obsolete)

| Selector | Reason | Evidence |
|----------|--------|----------|
| `cookie_reject_button` (all 3 tiers) | No cookie banner served in Indonesia for en-US locale | 0 matches across 12 competitors, 0 text occurrences in 517KB HTML |
| `reviews_tab_button` (all 3 tiers) | Reviews are server-side rendered in initial HTML — no tab click needed | 33 `data-review-id` elements found without any interaction |
| `review_container` tier 1 (`div[role='feed']`) | Google removed `role='feed'` from review containers | 0 matches across all page types |
| `expand_text_button` tier 2 (`button:has-text('See more')`) | "See more" text removed from Google Maps review expansion | 0 matches, 0 text occurrences |

### Restructured selectors

| Selector | Before | After |
|----------|--------|-------|
| `review_container` tier 0 | `div.m6QErb.DxyBCb.kA9KIf.dS8AEf` (4 auto-generated classes) | `div.m6QErb[role='region']` (semantic `role='region'`) |
| `review_container` tier 1 | `div[role='feed']` (obsolete) | `div.m6QErb.DxyBCb.kA9KIf.dS8AEf` (demoted from tier 0) |
| `review_container` tier 2 | `div.m6QErb[role='region']` (promoted to tier 0) | *removed* |

### Updated locator tiers (harness/locator.py)

| Tier | Before | After |
|------|--------|-------|
| 1 | `[data-review-id]` | `[data-review-id]` (unchanged) |
| 2 | `[role='article'][aria-label]` | `[data-review-id][aria-label]` (was tier 3) |
| 3 | `[data-review-id][aria-label]` | seed CSS (was tier 5) |
| 4 | `div[role='article'][data-review-id]` | *removed* |
| 5 | seed CSS | *removed* |

### Performance impact

| Metric | Before | After | Δ |
|--------|--------|-------|---|
| Captue time (real page) | ~55s/comp | ~15s/comp | -73% |
| Captue time (search page) | ~55s/comp | ~35s/comp | -36% |
| Full run (12 competitors) | ~11min | ~2min | -82% |
| Obsolete selector waste | 288s | 0s | -100% |

### Configuration version

- `config/selectors.json` schema version: 3 → 4
- Removed 2 top-level keys, removed 1 container tier, removed 1 expand tier
- All backward compatibility preserved — `_fallback_click` gracefully handles missing keys via `resolve_selectors` returning `[]`.
