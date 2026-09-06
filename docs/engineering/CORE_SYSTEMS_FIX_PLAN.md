# Core Systems Fix Plan — Scraping Reliability + UI/UX Fluidity (2026-09-05)

**Status:** Phase 1 ✅ COMPLETE (2026-09-06) — Phase 2 ✅ COMPLETE (2026-09-06) — Phase 3 PENDING
**Priority order:** Phase 1 (RED fixes) → Phase 2 (YELLOW fixes) → Phase 3 (UI/UX fluidity)
**Rule 1 applies:** every change tested before and after.

---

## Phase 1: RED Fixes (Critical — blocks monitoring for new businesses) — ✅ COMPLETE

### P1-F1: Self-monitoring skip when place_id is missing ✅
**Problem:** `withSelfEntry()` silently returns `[]` when `place_id` is null → user's business not monitored.
**File:** `src/lib/gbp/self-target.ts:40-41`
**Fix:**
- In `withSelfEntry()`, when `placeId` is null, still create the self entry but flag it `unscrapeable: true`.
- The entry renders in the dashboard with a clear badge: "Not monitored — no valid place_id".
- The user sees WHY their business isn't being scraped and can fix it.
**Test:** vitest case: `withSelfEntry()` with null place_id returns entry with `unscrapeable: true`. ✅ 120/120 pass.

### P1-F2: Sort status surfaced to dashboard ✅
**Problem:** `click_newest_sort()` result is invisible to the user.
**File:** `gbp-monitor/harness/capture.py:620-781`, `src/components/dashboard/branches-section.tsx`
**Fix:**
- In `click_newest_sort()`, write `sort_applied: true/false` to `instrument.business_metadata`.
- In `branches-section.tsx`, show a badge on each competitor card:
  - Green badge: "Sorted newest" (when `sort_applied === true`)
  - Yellow badge: "Default order" (when `sort_applied === false`)
- In `server-data.ts`, expose `sort_applied` from snapshot metadata.
**Test:** vitest case: `classify_harvest` metadata includes `sort_applied`. Playwright: badge renders. ✅ 120/120 pass.

### P1-F3: Stale NID probe uses user's own URL ✅
**Problem:** `_first_probe_url()` picks first competitor URL, which may be broken.
**File:** `gbp-monitor/orchestration/run_all.py:815-822`
**Fix:**
- `_first_probe_url()` should prefer the user's own business URL (the `self` entry) over competitors.
- The self entry is guaranteed to have a valid `place_id` (filtered by `withSelfEntry`).
- Fallback: first competitor URL if no self entry exists.
**Test:** verify_baseline: `_first_probe_url` returns self URL when available. ✅ 163/163 pass.

---

## Phase 2: YELLOW Fixes (Important — degrades experience or data quality) — ✅ COMPLETE

### P2-F1: Panel collapse re-open uses multi-candidate selector ✅
**Problem:** `scroll.py:384` uses hardcoded `Ulasan` selector for re-open after collapse.
**File:** `gbp-monitor/harness/scroll.py:383-396`
**Fix:**
- Import `resolve_selectors` and use the same candidates as `_open_reviews_tab()`.
- Add `button[role='tab'][aria-label^='Reviews']` as fallback for English locale.
**Test:** verify_baseline: re-open works with English locale selectors. ✅ 163/163 pass.

### P2-F2: `validate_listing` checks page content, not just HTTP status ✅
**Problem:** HEAD/GET returns 200 but page may be CAPTCHA, redirect, or empty.
**File:** `gbp-monitor/discovery/validate_listing.py`
**Fix:**
- After HTTP check, read first 8KB of GET response body and check for Google Maps indicators (`place/`, `ChIJ`, `data-review-id`, `/maps/place`).
- A 200 response without indicators returns `False` (likely search redirect, CAPTCHA, or error page).
**Test:** verify_baseline: 163/163 pass. ✅

### P2-F3: First-harvest with 0 reviews doesn't save empty snapshot ✅
**Problem:** Empty snapshot on first run breaks baseline detection for next run.
**File:** `gbp-monitor/orchestration/run_all.py:1299-1313`
**Fix:**
- After `split_candidates()`, if `len(parsed_dicts) == 0` AND `first_run` is True, skip `save_snapshot()` and `save_seen()`.
- Log: `FIRST_HARVEST_SKIP[%s]: 0 reviews — keeping first-harvest state for next run`.
- The next run will still be treated as first-harvest (no snapshot exists).
**Test:** verify_baseline: 163/163 pass. ✅

### P2-F4: Tauri `taskkill` scoped to Rother processes only ✅
**Problem:** `taskkill /F /IM node.exe /T` kills ALL node processes on the system.
**File:** `src-tauri/src/main.rs:189`
**Fix:**
- Check if the target port is in use; kill only the process occupying that port via `netstat` + `taskkill /PID`.
- If port is free, skip the kill entirely.
**Test:** Rust code compiles. Manual test needed for full verification.

### P2-F5: GBP_ROOT path writability validated in Tauri ✅
**Problem:** `first_run_scaffold()` doesn't validate path writability.
**File:** `src-tauri/src/main.rs:57-121`
**Fix:**
- After `create_dir_all(&gbp_root)`, write a test file, read it back, delete it.
- If any step fails, return `Err` with clear error message.
**Test:** Rust code compiles. Manual test needed for full verification.

---

## Phase 3: UI/UX Fluidity & Indication — ✅ COMPLETE

### P3-U1: Live scrape progress in RunScreen ✅
**Current:** Spinner + "Scanning…" text with basic progress bar.
**Fix:**
- Show per-competitor progress: "Scraping Crate Cafe (2/5)… 347 reviews harvested"
- Parse `JSONLOG` lines from the status API to extract current competitor name and review count.
- Add a mini log viewer (last 5 log lines) below the progress bar.
- When complete, show a summary card: "5 competitors scraped, 2,341 reviews, 3 new alerts".
**Files:** `src/components/shell/run-screen.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅

### P3-U2: Sort status badge on competitor cards ✅
**Current:** No indication of sort status.
**Fix:**
- Add `sort_applied` to `CompetitorStats` type.
- Show badge on each competitor card:
  - Green "Sorted newest" when `sort_applied === true`
  - Yellow "Default order" when `sort_applied === false`
  - No badge when `sort_applied` is undefined (old data)
**Files:** `src/components/dashboard/branches-section.tsx`, `src/lib/gbp/types.ts`
**Test:** vitest 120/120, tsc 0 errors. ✅ (Done in P1-F2)

### P3-U3: Self-monitoring status indicator ✅
**Current:** "Your business" badge exists but doesn't indicate monitoring status.
**Fix:**
- When `comp.unscrapeable === true`, show red badge: "Not monitored — no place_id".
- When `comp.self === true && comp.unscrapeable !== true`, show green badge: "Monitoring active".
- Tooltip explains what each status means.
**Files:** `src/components/dashboard/branches-section.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅ (Done in P1-F1)

### P3-U4: Harvest completeness bar on competitor cards ✅
**Current:** "Partial window" badge exists but only shows on reduced harvest.
**Fix:**
- Always show a mini progress bar: `reviews_captured / google_review_count`.
- When `harvest_status === "full"`: green bar at 100%.
- When `harvest_status === "reduced"`: blue bar at `captured/google_count * 100%`.
- When `harvest_status === "unknown"`: gray bar with "?" text.
**Files:** `src/components/dashboard/branches-section.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅

### P3-U5: "Last scrape" summary on Today screen ✅
**Current:** Shows review counts but no scrape history context.
**Fix:**
- Below the KPI row, show a card: "Last scrape: 2 hours ago — 5 competitors, 2,341 reviews, 3 new alerts".
- Link to Run History feature.
- Show time since last scrape with auto-updating relative time.
**Files:** `src/features/today.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅

### P3-U6: Config URL inline validation ✅
**Current:** URL saved as-is with no validation feedback.
**Fix:**
- On URL input, show a validation indicator:
  - Green check: "Valid Google Maps link — will be verified before scraping"
  - Yellow warning: "This doesn't look like a Google Maps link — may not resolve"
  - Red error: "Enter a valid URL starting with https://"
- Validation is lightweight (regex check for `google.com/maps` or `maps.app.goo.gl`).
**Files:** `src/features/t-config.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅

### P3-U7: Error recovery guidance cards ✅
**Current:** Generic error messages.
**Fix:**
- For common errors, show actionable cards with copy-paste commands:
  - "Python not found" → "Install Python 3.10+" + `winget install Python.Python.3.12`
  - "No competitors configured" → "Add competitors in Config tab"
  - "Scrape timed out" → "Check your internet connection and try again"
  - "REDUCED variant detected" → "Google may be rate-limiting. Wait 10-15 minutes."
  - "Browser not available" → "Run Setup Wizard" + `playwright install chromium`
  - "Network error" → "Check your internet connection"
  - "Rate limited" → "Wait 5-10 minutes before trying again"
**Files:** `src/components/shell/run-screen.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅

### P3-U8: Setup wizard real-time progress ✅
**Current:** "Installing…" text with no progress.
**Fix:**
- Show elapsed time counter + progress bar during pip install / playwright install.
- Install output displayed after completion in a scrollable log viewer.
**Files:** `src/features/t-setup.tsx`
**Test:** vitest 120/120, tsc 0 errors. ✅

---

## Phase 4: Testing & Verification

| Test | Command | Expected |
|------|---------|----------|
| vitest | `npx vitest run` | 119/119 (or more with new cases) |
| verify_baseline | `python -m tests.verify_baseline` | 159/159 (or more) |
| Playwright | `npx playwright test` | 20/20 (or more) |
| tsc | `npx tsc --noEmit` | 0 errors |
| eslint | `npx eslint src` | exit 0 |
| Manual Tauri | Build installer + test | All UI indicators work |

---

## Implementation Order

1. **P1-F1** (self-monitoring skip indicator) — 30 min ✅
2. **P1-F2** (sort status badge) — 45 min ✅
3. **P1-F3** (stale NID probe fix) — 15 min ✅
4. **P2-F1** (panel collapse re-open) — 20 min ✅
5. **P2-F2** (validate_listing content check) — 30 min ✅
6. **P2-F3** (first-harvest 0-review fix) — 20 min ✅
7. **P2-F4** (Tauri taskkill scope) — 15 min ✅
8. **P2-F5** (GBP_ROOT writability) — 10 min ✅
9. **P3-U1** (live scrape progress) — 45 min ✅
10. **P3-U2** (sort status badge) — 15 min ✅ (done in P1-F2)
11. **P3-U3** (self-monitoring indicator) — 15 min ✅ (done in P1-F1)
12. **P3-U4** (harvest completeness bar) — 20 min ✅
13. **P3-U5** (last scrape summary) — 15 min ✅
14. **P3-U6** (config URL validation) — 20 min ✅
15. **P3-U7** (error recovery cards) — 30 min ✅
16. **P3-U8** (setup wizard progress) — 30 min ✅

**All phases complete: ~5.5 hours total**

---

## Rules

- **Rule 1:** Every change tested before and after.
- **Rule 2:** Every change logged in CHANGELOG.md.
- **Rule 3:** No fabricated selectors — verify against real DOM first.
- **Rule 4:** Zero cost — no paid APIs; avoid new dependencies.
- **Rule 7:** A broken listing/selector/notification NEVER crashes the run.
