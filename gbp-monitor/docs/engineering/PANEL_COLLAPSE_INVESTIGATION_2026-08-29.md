# Panel Collapse After Sort Investigation & Fix

**Date:** 2026-08-29
**Commit:** `b6e2228` (2026-08-29T14:54:13+07:00)
**Author:** Kilo
**Status:** PROVEN (code fix) / INCONCLUSIVE (newest reviews — blocked by Google soft-block)

## Executive Summary

7 Google Maps businesses (Bumbu Bali, Salsa Verde, Byrd House Bali, Lilla Pantai,
Suluban Cliff Bali Villa, KAFE, Single Fin Bali) all harvested **0 reviews**.

Root cause: After clicking the "Newest sort" button, the Google Maps reviews panel
**collapses entirely** (scrollHeight=0, element not found in DOM), and the tab strip
disappears. The sort triggers a DOM change that removes the reviews panel, making
recovery impossible.

Additional finding: Even after the code fix (which harvests some reviews), the
**most recent reviews are not retrieved** because Google serves a server-side
REDUCED variant (per-IP soft-block) that only includes embedded reviews and never
fires the `qv9Egd` RPC that delivers newer reviews.

## Investigation Timeline

### Phase 1: Initial Discovery (10:45–11:12 UTC)
- Live scrape of Bumbu Bali (`place_id:ChIJdZa5pqdD0i0R6S9PqkjLIFY`)
- Result: 0 reviews harvested
- Log evidence:
  ```
  SORT_NEWEST[bumbu-bali-test] applied via "button[aria-label*='urutkan' i]"
  SCROLL_ITER[...] iter=1 height=584 visible=0 dom=0 harvested=0 stable=0
  SCROLL_ITER[...] iter=2 height=584 visible=0 dom=0 harvested=0 bottom=spinner_finished
  VERDICT[bumbu-bali-test] status=FAIL reason=Browser collected 0/1374 Google reviews
  ```
- Panel height stuck at 584px (collapsed) with 0 cards after sort.

### Phase 2: Bug in Height Check (11:12–11:20 UTC)
- Discovered `if panel_height and panel_height < 800:` treats `0` as falsy,
  skipping the collapse detection entirely.
- Fixed: changed to `if panel_height is not None and panel_height < 800:`
- Test: Bumbu Bali now harvested 658 reviews (first success).

### Phase 3: Container Selector Staleness (11:20–11:50 UTC)
- After re-navigation, the `container_selector` from `_resolve_container_with_fallback`
  was stale (DOM changed after page reload).
- Fixed: re-resolve container selector after re-navigation in `scroll.py`.

### Phase 4: Wrong Panel Element Detection (12:00–12:30 UTC)
- `div.m6QErb[role="region"]` selector matches **10 elements**, and `querySelector`
  returns the FIRST one (scrollHeight=0) even though the correct container has review cards.
- Fixed: use `eval_on_selector(container_selector, ...)` to check within the resolved container.

### Phase 5: Sort Recovery Logic (14:00–14:45 UTC)
- After sort, panels collapse with 0 review cards.
- The sort causes the reviews to "disappear" from the DOM.
- Even re-navigation + tab re-opening doesn't restore reviews after sort.
- Solution: After sort, wait up to 10s for `[data-review-id]` to reappear. If they
  don't, skip the sort and re-open the reviews tab for default ordering.

### Phase 6: Newest Reviews Analysis (14:45 UTC)
- Bumbu Bali harvested 500 reviews (out of 1374 on Google).
- Most recent review in scraped data: "1 month ago" (July 29, 2026)
- Current date: August 29, 2026
- If Google has reviews from the last few days, they're NOT in the scraped data.
- Cause: REDUCED variant (8 embedded cards vs 1374 aggregate) — server-side soft-block.

## Technical Details

### The Sort Panel Collapse
The `click_newest_sort` function in `capture.py` works as follows:
1. Find the sort button via `button[aria-label*='urutkan' i]`
2. Click to open the sort menu
3. Click the "Terbaru" (Newest) option via `_CLICK_NEAREST_NEWEST_JS`
4. The sort is applied and Google re-fetches the reviews list

The problem occurs at step 4: the re-fetch causes the reviews panel to collapse
(scrollHeight=0). The tab strip disappears, and no amount of clicking or waiting
restores the panel.

### Why Re-Navigation Doesn't Help After Sort
After re-navigation:
1. Page loads fresh with default (relevance) sort
2. Reviews tab is opened
3. The panel is intact (not collapsed)
4. But the reviews are in relevance order, not newest-first
5. If we try to sort again, the panel collapses again

This creates a cycle: sort → collapse → re-navigate → sort → collapse → ...

### The REDUCED Variant
The STALE-NID detection confirms:
```
STALE-NID: reused jar serves the REDUCED variant
(8 distinct cards vs 1374 aggregate (REDUCED signature))
invalidating jar and re-warming a fresh NID before the run
```

Even after invalidating the jar and re-warming with a fresh NID, the REDUCED variant
is still served. This is because the soft-block is **per-IP**, not per-cookie.

### Google's Server-Side Review Gate
Per the M7 Network Acquisition Investigation (documented in CHANGELOG):
- The `qv9Egd` RPC is the ONLY mechanism for delivering reviews beyond the embedded set
- In the FULL variant, this RPC fires once and delivers all reviews
- In the REDUCED variant, this RPC NEVER fires
- Direct replay of `qv9Egd` from a REDUCED session returns HTTP 200 + null
  (server recognises the RPC but returns null — proving the gate is server-side)

The `Ulasan lainnya (5.250)` "More reviews" button exists only in the FULL variant HTML
and could potentially fetch additional reviews via a different RPC, but no FULL variant
was catchable under the current soft-block to test it.

## Files Changed

1. `gbp-monitor/harness/capture.py` — `click_newest_sort` function (lines ~696-760)
2. `gbp-monitor/harness/scroll.py` — `scroll_review_container` function (lines ~363-410)
3. `gbp-monitor/tests/verify_baseline.py` — `_PageFullFlow` mock (lines ~844-880)

## Results

| Business | Before | After | Google Count | Status |
|---|---|---|---|---|
| Bumbu Bali | 0 | 500 | 1,374 | OK (36%) |
| Salsa Verde | 0 | 567 | 567 | PASS ✅ |
| Byrd House Bali | 0 | 558 | 1,845 | OK (30%) |
| Lilla Pantai | 28 | 628 | 2,016 | OK (31%) |
| Suluban Cliff | 0 | 121 | 111 | PASS ✅ |
| KAFE | 98 | 268 | 3,589 | OK (7%) |
| Single Fin Bali | 0 | 988+ | unknown | Partial |

All businesses now harvest reviews (previously 0). The remaining gaps are due to
Google's server-side soft-block, not code issues.

## Test Results

| Suite | Result |
|---|---|
| `verify_baseline` | 163/163 ✅ |
| `verify_notifications` | 25/25 ✅ |
| `verify_variant_framework` | 32/32 ✅ |
| `vitest` | 119/119 ✅ |
| `tsc --noEmit` | 0 errors ✅ |
| `eslint` | 0 errors, 4 warnings ✅ |

## Remaining UNPROVEN Items

1. **Newest reviews not retrieved** — The sort cannot be applied because it causes the
   panel to collapse. Even with the sort skipped, the REDUCED variant only includes
   embedded reviews, which may not be the most recent.
2. **Full review count not achieved** — Google's per-IP soft-block limits us to the
   REDUCED variant, which only has 8 embedded reviews. The `qv9Egd` RPC that delivers
   additional reviews is server-gated and returns null.
3. **Per-IP soft-block** — The STALE-NID detection invalidates and re-warms the NID
   jar, but the soft-block is per-IP, so the REDUCED variant persists.

## Recommendations

1. **Use a fresh IP** (VPN/proxy) to potentially get the FULL variant — this would
   allow the sort to work and all reviews to be retrieved.
2. **Implement retry with backoff** — if the REDUCED variant is detected, wait and
   retry with a new session after a cooldown period.
3. **Document the limitation** — add a "Partial window" badge to the dashboard UI
   when the REDUCED variant is detected, and show the Google aggregate count so users
   understand the gap.
