# Core Systems Audit — Tauri v0.4.1 (2026-09-05)

**Auditor:** opencode (mimo-v2.5-pro)
**Scope:** Full scraping/monitoring pipeline for Tauri desktop version
**Goal:** Identify failure modes when adding new businesses via Google Maps links; ensure UI/UX provides clear feedback at every step.

---

## Pipeline Overview

```
User adds business (Onboarding)
  ↓
POST /api/scrape/trigger (trigger/route.ts)
  ↓
persistUserBusiness() → config/user-business.json
  ↓
scrapeRunManager.start() (scrape-runner.ts)
  ↓
writeEffectiveListings() → data/users/{id}/effective_listings.json
  ↓
spawn Python: run_all.py (cwd = GBP_ROOT)
  ↓
get_browser_context() → Playwright Chromium (browser.py)
  ↓
warm_up() NID cookie → persist storage_state
  ↓
_ensure_full_variant() probe (stale-NID guard)
  ↓
loop branches × competitors:
  ├─ validate_listing() [HTTP HEAD/GET reachability]
  ├─ _capture_with_retries() [up to 2 retries]
  │   └─ capture_listing_html():
  │       ├─ page.goto(url)
  │       ├─ _verify_reviews_dialog()
  │       ├─ _probe_json(_JS_OVERVIEW_PROBE) [address/category/phone/website]
  │       ├─ _open_reviews_tab() [multi-candidate selector]
  │       ├─ click_newest_sort() [Urutkan → Terbaru, proximity click]
  │       ├─ scroll_review_container() [incremental harvest, MAX_SCROLLS=400]
  │       │   ├─ initial viewport harvest (before first scroll)
  │       │   └─ per-scroll harvest (_harvest_review_cards)
  │       ├─ _fallback_expand() [expand truncated review text]
  │       ├─ _capture_business_metadata() [JSON-LD + CSS + JS probes]
  │       └─ page.content() [final HTML]
  ├─ parse_reviews() → Review[]
  ├─ split_candidates() [seen_store: posted_new vs backfill]
  ├─ save_snapshot() + save_seen()
  └─ _append_new_reviews() [delta files]
  ↓
run_summary.json → dashboard polls /api/scrape/status
  ↓
Dashboard reads snapshots/deltas → renders UI
```

---

## Failure Modes Found

### RED — Critical (blocks monitoring for new businesses)

#### R1: New business with no valid `place_id` → silent self-monitoring skip
- **Files:** `self-target.ts:40-41`, `server-data.ts:557-581`
- **Problem:** If the user pastes a Google Maps URL that doesn't resolve to a `ChIJ` place_id (e.g. `maps.app.goo.gl` short link, search URL, or CID-based URL), `withSelfEntry()` returns `[]` (no self entry). The user's own business is silently NOT monitored. Competitors added in Step 3 ARE scraped, giving the illusion that everything works.
- **User sees:** Dashboard shows competitor reviews but 0 reviews for "Your business". No error message.
- **Impact:** User thinks their business is being monitored but it isn't.

#### R2: `click_newest_sort` fails silently → reviews in wrong order, new reviews missed
- **Files:** `capture.py:620-781`
- **Problem:** Sort button selector is `button[aria-label*='urutkan' i]` (Indonesian locale). If Google serves English or other locale, the sort control is not found. The function returns `False` and proceeds with "Most relevant" ordering. New reviews outside the ~500-card window are missed entirely.
- **User sees:** Dashboard shows reviews but newest reviews are missing. "New reviews" alerts may never fire.
- **Impact:** Monitoring accuracy degraded. User has no visibility into whether sort was applied.

#### R3: Stale NID cookie → REDUCED variant → ~5-20 reviews instead of ~500
- **Files:** `run_all.py:825-891`, `run_all.py:815-822`
- **Problem:** If the NID cookie expires between runs, Google serves the REDUCED variant (no Reviews tab, only 3-5 embedded reviews). The stale-NID guard probes the first URL and re-warms if REDUCED is detected. BUT: `_first_probe_url()` picks the FIRST competitor URL — if that URL is broken, the probe fails silently and the run proceeds with a stale jar.
- **User sees:** Dashboard shows only 5-20 reviews for a business with 500+ reviews.
- **Impact:** Massive data loss for that run.

### YELLOW — Important (degrades experience or data quality)

#### Y1: Panel collapse after sort → 0 reviews harvested
- **Files:** `scroll.py:367-398`, `capture.py:863-864`
- **Problem:** After `click_newest_sort`, the reviews panel sometimes collapses. The scroll phase detects this and re-navigates + re-opens the reviews tab. BUT: the re-open uses hardcoded `button[role='tab'][aria-label^='Ulasan']` (Indonesian) instead of the multi-candidate selector from `_open_reviews_tab()`.
- **User sees:** 0 reviews for that competitor. Error in run_summary.
- **Impact:** One competitor's data lost per run.

#### Y2: `validate_listing()` only checks HTTP status, not page content
- **Files:** `validate_listing.py:38-110`
- **Problem:** The pre-check sends HEAD/GET and checks for 2xx. It does NOT verify that the page is a real Google Maps place page (vs redirect to search, CAPTCHA, or 404 that returns 200).
- **User sees:** A URL that passes validation can still produce 0 reviews.
- **Impact:** False confidence in URL validity.

#### Y3: First-harvest with 0 reviews saves empty snapshot → breaks next-run baseline
- **Files:** `run_all.py:1299-1313`, `seen_store.py:166-170`
- **Problem:** When `is_first_harvest()` returns True, ALL reviews are marked as baseline (no alerts). If the scraper fails to extract reviews (REDUCED variant, broken selector, panel collapse), the run "succeeds" with 0 reviews and saves an empty snapshot. The next run is NOT a first-harvest (empty snapshot exists), so the second run's reviews fire as "new" even though they're the first real data.
- **User sees:** First run: 0 reviews, no alert. Second run: 500 reviews, 500 "new" alerts.
- **Impact:** Alert flood on second run; first run data lost.

#### Y4: Sort status not surfaced to dashboard
- **Files:** `capture.py:620-781`
- **Problem:** `click_newest_sort()` logs to the run log but does NOT write `sort_applied` to `instrument.business_metadata`. The dashboard has no way to know if reviews are sorted by newest or in default order.
- **User sees:** No indication of sort status.
- **Impact:** User can't tell if monitoring is optimal.

#### Y5: Dashboard shows no feedback during scrape trigger
- **Files:** `t-config.tsx`, `run-screen.tsx`
- **Problem:** When the user clicks "Run scan again" or "Run now", the UI shows a loading spinner but no progress (which competitor is being scraped, how many done, etc.). The scrape status endpoint provides this data but the UI doesn't display it prominently enough.
- **User sees:** Spinner for 2-10 minutes with no progress indication.
- **Impact:** User thinks the app is frozen.

#### Y6: Tauri `taskkill /F /IM node.exe /T` kills ALL node processes
- **Files:** `main.rs:189`
- **Problem:** On startup, the Tauri shell kills ALL `node.exe` processes on the system, not just orphaned Rother processes. This can kill other Node.js applications (VS Code extensions, other dev servers, etc.).
- **User sees:** Other Node.js applications crash when Rother starts.
- **Impact:** System-wide side effect.

#### Y7: `GBP_ROOT` path writability not validated
- **Files:** `main.rs:57-121`
- **Problem:** `first_run_scaffold()` copies config files to `<app_data>/rother/gbp-monitor/config/` but doesn't validate that the path is writable. If the path contains spaces, Unicode characters, or is read-only, the copy silently fails.
- **User sees:** App starts but scraping fails with cryptic Python errors.
- **Impact:** Silent configuration failure.

### GREEN — Working Correctly

#### G1: `click_newest_sort` proximity-based click
- **Status:** The `_CLICK_NEAREST_NEWEST_JS` script correctly handles the app-rail nav button issue by finding the visible "Terbaru/Newest" element NEAREST to the sort button.

#### G2: Incremental harvest across scroll iterations
- **Status:** `_harvest_review_cards()` snapshots every distinct `data-review-id` on each scroll iteration, building a union. Correctly handles Google's virtualization.

#### G3: `seen_store.py` variance-proof delta
- **Status:** `split_candidates()` correctly separates "newly posted" from "newly discovered" backfill. Recency gate is 30 days.

#### G4: Anti-bot hardening (browser.py)
- **Status:** Three-layer Client Hints override (extra_http_headers + CDP + JS init script) is solid. Windows UA fingerprint is self-consistent.

#### G5: Tenant scoping (paths.ts + server-data.ts)
- **Status:** `businessDataDir()` correctly isolates per-business data. `resolveMonitoredConfig()` correctly routes all read routes through tenant-aware config.

#### G6: Process lifecycle (scrape-runner.ts)
- **Status:** `hasActiveRun()` correctly detects dead/orphaned processes via `process.kill(pid, 0)`. `killProcessTree()` correctly kills entire process tree on Windows.

---

## UI/UX Gaps

### U1: No progress indication during scrape
- **Current:** Spinner + "Scraping..." text
- **Needed:** Live progress bar showing "Scraping Crate Cafe (2/5)... 347 reviews harvested"

### U2: No sort status indicator
- **Current:** No indication
- **Needed:** Badge: "Reviews sorted by newest" or "Reviews in default order (sort unavailable)"

### U3: No harvest completeness indicator per competitor
- **Current:** "Partial window" badge exists but only shows on hover
- **Needed:** Prominent badge on each competitor card: "500/1,234 reviews (40%)" with tooltip

### U4: No self-monitoring status indicator
- **Current:** "Your business" badge exists
- **Needed:** Clear status: "Your business — monitoring active" vs "Your business — no place_id, not monitored"

### U5: Setup wizard doesn't show real-time progress
- **Current:** "Installing..." text with no progress
- **Needed:** Real-time log output from pip install / playwright install

### U6: No error recovery guidance
- **Current:** Generic error messages
- **Needed:** Actionable error cards: "Python not found → Install Python 3.10+" with copy-paste commands

### U7: Config tab doesn't validate URLs before saving
- **Current:** URL saved as-is
- **Needed:** Inline validation: "This URL will be checked before scraping" + green/red indicator

### U8: No "last scrape" summary on Today screen
- **Current:** Shows review counts
- **Needed:** "Last scrape: 2 hours ago — 5 competitors, 2,341 reviews, 3 new alerts" with link to run history

---

## Test Results (Current)

| Suite | Count | Status |
|-------|-------|--------|
| vitest | 119/119 | ✅ |
| verify_baseline | 159/159 | ✅ |
| verify_notifications | 25/25 | ✅ |
| verify_variant_framework | 32/32 | ✅ |
| Playwright | 20/20 | ✅ |
| tsc | 0 errors | ✅ |
| eslint | 0 errors, 4 warnings | ✅ |

---

## Related Documents

- `TAURI_SCRAPING_ANALYSIS_2026-09-05.md` — Tauri scraping system analysis
- `GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md` — GMB Everywhere feature comparison
- `GMB_INSPIRED_IMPROVEMENT_PLAN.md` — 5-phase improvement plan (all complete)
- `HARVEST_AUDIT_2026-08-24.md` — Harvest honesty + variance-proof delta docs
- `SYSTEMS_AUDIT_2026-08-24.md` — Systems hardening docs
- `SELF_MONITORING_AUDIT_2026-08-22.md` — Self-monitoring fix docs
