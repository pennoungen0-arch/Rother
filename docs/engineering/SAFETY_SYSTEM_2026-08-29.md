# Safety System — New Business Acquisition (v0.4.1)

**Date:** 2026-08-29  
**Commit:** `b6e2228` (2026-08-29T14:54:13+07:00) / `9d860fe` (2026-08-29T10:52:00+07:00)  
**Author:** Kilo  

## Purpose

This document catalogs all safety mechanisms that protect Rother when adding new
Google Maps businesses. Each mechanism is listed with its implementation location,
trigger conditions, and failure-isolation behavior (Rule 7).

## Complete Safety Mechanism Catalog

### 1. Pre-Flight Variant Detection (STALE-NID Guard)
**Location:** `orchestration/run_all.py:812` (`_ensure_full_variant`), `harness/capture.py:1134` (`probe_review_variant`)

**Trigger:** At session bootstrap, BEFORE the main scrape run.

**How it works:**
- Navigates the first competitor URL and opens the Reviews tab
- Performs a bounded incremental harvest (12 scroll iterations, capped)
- Counts distinct `data-review-id` cards and parses the aggregate count from page header
- If cards ≤ 20 but aggregate ≥ 100 → REDUCED variant detected (stale NID jar)
- Invalidates the stale jar, tears down the browser context, launches fresh context
- Warms up with Google.com (obtains fresh NID cookie), persists new storage_state

**Failure isolation:** If re-warm fails, the run proceeds with the fresh context anyway.
Never raises — degrades to "unknown" variant and continues.

**Evidence:** M7 investigation proved NID is necessary+sufficient for FULL variant
(13-experiment matrix: DIRECT anonymous → REDUCED 3/3; NID-only → FULL 3/3).

---

### 2. Network Retry (Exponential Backoff)
**Location:** `orchestration/run_all.py:1479` (`_capture_listing_with_retry`)

**Trigger:** On any exception during `capture_listing_html` EXCEPT:
- `SelectorNotFoundError` (broken selector — retrying just hammers the page)
- `CaptureTimeoutError` (hard pipeline cap — retrying exhausts it again)

**How it works:**
- Retries up to `_NETWORK_RETRY_MAX` (2) times
- Backoff: `[2s, 5s]` (hardcoded in `_NETWORK_RETRY_BACKOFF_S`)
- Each retry gets a fresh page within the same browser context

**Failure isolation:** After retries exhausted, the listing is marked as failed
and the orchestrator proceeds to the next business.

---

### 3. Sort Outcome Monitoring (NEW — v0.4.1)
**Location:** `harness/capture.py:617` (`_sort_structured_log`)

**Trigger:** During `click_newest_sort()` for each business.

**How it works:**
- Emits JSON-structured log lines (`JSONLOG:` prefix) for every sort outcome:
  - `outcome="sort_applied"` — sort succeeded (page has newest-first ordering)
  - `outcome="sort_control_not_found"` — no sort button found (REDUCED variant)
  - `outcome="sort_menu_not_opened"` — button found but menu didn't render
  - `outcome="sort_option_click_failed"` — menu opened but option click failed
  - `outcome="panel_collapsed"` — sort applied but panel collapsed (our fix)

**Machine-parseable:** Downstream tools can grep for `JSONLOG:` to extract
sort outcomes and track which businesses have successful vs skipped sorts.

**Log fields:** `comp_id`, `stage`, `ts`, `outcome`, + context-specific fields
(`selector`, `reason`, `distance_px`, etc.)

---

### 4. Panel Collapse Recovery (v0.4.0 fix)
**Location:** `harness/capture.py:700-740` (in `click_newest_sort`), `harness/scroll.py:363-399` (in `scroll_review_container`)

**Trigger:** After `click_newest_sort` completes.

**How it works (two-pronged):**
1. **In `click_newest_sort`:** After sort is applied, wait 10s for `[data-review-id]`
   elements to reappear. If they don't (panel collapsed):
   - Close sort menu (Escape key)
   - Re-open the reviews tab
   - Wait for panel to re-expand (scrollHeight > 1000px)
   - Return `False` — proceed with Google's default (relevance) ordering
2. **In `scroll_review_container`:** Before the scroll loop, check if the container
   has review cards. If 0 cards (collapsed):
   - Re-navigate to the business page URL
   - Re-open the reviews tab
   - **Re-resolve** the container selector (DOM changes after re-navigation)
   - Re-check for cards

**Failure isolation:** If recovery fails, the scroll loop still runs with whatever
container is available. Zero reviews is possible but the run continues (Rule 7).

---

### 5. Initial Viewport Harvest (v0.3.3 fix)
**Location:** `harness/scroll.py:413-452` (in `scroll_review_container`)

**Trigger:** Before the first scroll iteration.

**How it works:**
- After sort (or after collapse recovery), harvest visible review cards BEFORE
  scrolling to bottom
- This prevents the "virtualization gap" — where the scroll loop scrolls to the
  bottom first, virtualizing the top cards before they're ever captured
- Logs the first 3 review dates to verify sort order worked:

  ```
  SCROLL[comp-id] initial viewport harvested N review(s) before scrolling (first dates: ...)
  ```

**Failure isolation:** If initial harvest fails, it falls through to the scroll loop.

---

### 6. Harvest Completeness Classification
**Location:** `harness/capture.py:1113` (`classify_harvest`)

**Trigger:** After each business capture completes, when writing the snapshot.

**How it works:**
- Compares harvested count vs Google's aggregate count (from run_summary)
- `full` — harvested ≥ 90% of Google's count
- `reduced` — harvested < 90% of Google's count (partial window)
- `unknown` — aggregate count unavailable

**Dashboard impact:** Dashboard shows "Partial window" badge + "of ~N on Google"
when harvest is `reduced`.

**Failure isolation:** None needed — this is purely informational classification.

---

### 7. Variant Classification
**Location:** `harness/capture.py:1086` (`_classify_variant`)

**Trigger:** During the pre-flight variant probe (see #1).

**How it works:**
- `full` — cards ≥ 50 (FULL variant threshold)
- `reduced` — cards ≤ 20 AND aggregate ≥ 100 (REDUCED signature)
- `unknown` — anything else (small business, degraded page, probe failure)

**Constants:**
- `_REDUCED_VARIANT_MAX_CARDS = 20`
- `_FULL_VARIANT_MIN_CARDS = 50`
- `_AGGREGATE_REDUCED_THRESHOLD = 100`

**Failure isolation:** Returns `"unknown"` on any error (never raises).

---

### 8. Per-Business Failure Isolation (Rule 7)
**Location:** `orchestration/run_all.py` (main `run()` loop)

**Trigger:** Any exception during a single business capture.

**How it works:**
- Each business capture is wrapped in try/except
- Failures are logged with full context (stage, error, traceback)
- The orchestrator marks the business as "failed" and moves to the next one
- A broken URL, selector mismatch, or browser crash NEVER stops the whole run

**Evidence:** Production runs show 5-7 simultaneous business failures degrade
gracefully — the run completes with partial data and a clear failure log.

---

### 9. Sort Verification (Date Check)
**Location:** `harness/scroll.py:413-452` (first-dates logging), `harness/capture.py:700-722`

**Trigger:** After sort is applied (if successful).

**How it works:**
- The initial viewport harvest in `scroll_review_container` extracts the first
  3 review dates (relative timestamps like "2 jam lalu", "1 minggu lalu")
- If the most recent review is "weeks/months ago" despite today's date,
  the sort may have failed even though `[data-review-id]` reappeared
- This is for diagnosis — the log entry helps determine if default ordering
  was used instead of newest-first

---

### 10. Lock File + Concurrent-Run Detection
**Location:** `orchestration/run_all.py` (`run()` function, `_acquire_lock`)

**Trigger:** At run start.

**How it works:**
- `acquire_lock()` creates `data/.run.lock` with PID + start time
- If lock exists and `process.kill(pid, 0)` succeeds → another run is active
- `hasActiveRun()` (dashboard) uses the same check
- Dead/orphaned processes are auto-marked "failed" (verified alive via signal 0)

**Failure isolation:** Prevents overlapping browser contexts that would
interfere with each other.

---

## Safety System Flow Diagram (Per Business)

```
┌─────────────────────────────────────┐
│ Session bootstrap                   │
│ ├── STALE-NID guard (probe)         │
│ │   ├── FULL variant → proceed      │
│ │   └── REDUCED → invalidate+rewarm │
│ └── Network retry (2 retries)       │
└─────────────────────────────────────┘
         ▼
┌─────────────────────────────────────┐
│ For each business:                  │
│ ├── capture_listing_html            │
│ │   ├── Open reviews tab            │
│ │   ├── click_newest_sort           │
│ │   │   ├── Sort applied → ✅       │
│ │   │   └── Panel collapse →      │
│ │   │       ├── Skip sort → ⚠️     │
│ │   │       └── Re-open tab +      │
│ │   │           re-navigate →      │
│ │   │           scroll.py checks   │
│ │   ├── scroll_review_container   │
│ │   │   ├── Check panel expanded   │
│ │   │   ├── If collapsed:          │
│ │   │   │   ├── Re-navigate        │
│ │   │   │   ├── Re-resolve selector│
│ │   │   │   └── Re-open tab        │
│ │   │   ├── Harvest initial viewport│
│ │   │   │   └── Log first dates     │
│ │   │   └── Scroll loop (max 400)   │
│ │   └── Return HTML + reviews       │
│ └── classify_harvest → full/reduced │
└─────────────────────────────────────┘
```

---

## Known Limitations

1. **Per-IP soft-block** (server-side, unfixable client-side):
   - Google serves REDUCED variant based on IP reputation
   - Even with fresh NID + warm-up, per-IP block persists
   - Evidence: 1 FULL out of 37+ attempts across 9 hours
   - Mitigation: Use VPN/proxy from a different IP class

2. **Sort panel collapse** (Google UI behavior):
   - `click_newest_sort` sometimes causes the reviews panel to collapse
   - The fix skips the sort and uses default ordering
   - Newest reviews are still harvested, just potentially not at the top

3. **MAX_SCROLLS ceiling** (Google virtualization):
   - `MAX_SCROLLS=400` — Google's virtualized panel typically serves ~500-1000
     reviews before stopping
   - This is NOT a Rother limitation
   - Evidence documented in `HARVEST_AUDIT_2026-08-24.md`

---

## Recommendations for New Businesses

1. **Validate place_id first** — use `python -m orchestration.run_all --validate-config`
2. **Pre-flight probe** — `_ensure_full_variant` will auto-detect REDUCED variant
3. **Check structured logs** — grep for `JSONLOG:` to track sort outcomes
4. **Verify harvest ratio** — if `reduced`, consider a different IP/network
5. **Review initial viewport dates** — log output shows if sort worked
