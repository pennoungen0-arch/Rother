# Rother — Problems & Solutions Reference

**Last updated:** 2026-08-22  
**Branch:** `test/m15-1-validation`  
**Version:** 0.2.0

---

## Problem 9: Dashboard Scrape Fails — "Python exited with code 2"

### Symptoms
- Clicking "Run" on the RunScreen shows toast: `Scrape failed — Python exited with code 2`
- CLI scraping works fine (`python -m orchestration.run_all`)
- Status logTail shows: `error: unrecognized arguments: --business ... --max-reviews 100`

### Root Cause
`src/lib/gbp/scrape-runner.ts` was spawning the Python scraper with CLI arguments
(`--business <place_id> --max-reviews 100`) that **do not exist** in the
orchestrator's argparse definition. The Python CLI only accepts:
`--fixtures`, `--verify`, `--url`, `--validate-config`, `--init-config`,
`--schedule`, `--competitors`. Argparse rejected the unknown flags and exited
with code 2 (usage error).

### Solution Applied
**File:** `src/lib/gbp/scrape-runner.ts` (in `startInner`)

Removed all invalid args. The Python orchestrator reads business config from
files, not CLI:
```typescript
const args = ["-m", "orchestration.run_all"];
if (mode === "live") {
  const session = process.env.GBP_MONITOR_STORAGE_STATE ?? process.env.GBP_MONITOR_COOKIES_FILE;
  if (session) args.push("--session", session);
} else {
  args.push("--fixtures");
}
```
Business/competitor config comes from `listings.json` (fixed mode) or
`user-business.json` (discovery mode) via `ROTHER_DATA_DIR`.

---

## Problem 10: Hubs Blocked Until Scrape Completes (Regression)

### Symptoms
- After clicking "Run", the dashboard hubs never appear until the full live
  scrape finishes (2–8 minutes)
- Fixed-mode e2e tests time out waiting for the hub screen

### Root Cause
An earlier RunScreen change made `startRun()` wait for scrape completion via
polling before revealing hubs. This violated the design contract documented in
run-screen.tsx: *"A scrape failure must NEVER block navigation."*

### Solution Applied
**File:** `src/components/shell/run-screen.tsx`

Restored immediate hub reveal (`startRun()` in `finally`) plus a **background
watcher** that polls `/api/scrape/status` every 3s to show a progress bar and
fire success/failure toasts when the run finishes:

```
Click Run → POST /api/scrape/trigger → startRun() immediately (hubs reveal)
         └→ watchStatus(runId) polls status → progress bar + completion toast
```

---

## Problem 11: Turbopack EBUSY on Windows Dev Start

### Symptoms
```
Error: EBUSY: resource busy or locked, open '.next\dev\types\validator.ts'
```

### Root Cause
Turbopack holds exclusive file locks on Windows; locks survive ungraceful
process termination (Ctrl+C, crash).

### Solution
```powershell
taskkill /F /IM node.exe 2>$null; Remove-Item -Recurse -Force .next 2>$null; npm run dev
```
See `TURBOPACK_WINDOWS_EBUSY_FIX.md` for prevention scripts.

---

## Problem 1: Short Google Maps Link Resolution Fails in Login Screen

### Symptoms
- User pastes `https://maps.app.goo.gl/dCBcNxfk2fDjbDUC9` (Crate Cafe short link)
- Click "Validate" → shows "Could not resolve that link"
- Error: "Network error validating link" or "Could not resolve that link"
- Full Google Maps URLs work fine

### Root Cause
The `/api/places` endpoint follows redirects for short links with a **4-second timeout** (`FETCH_TIMEOUT_MS = 4000`). Google Maps short links redirect through multiple hops:
```
maps.app.goo.gl/dCBcNxfk2fDjbDUC9
  → www.google.com/maps/place/Crate+Cafe/@-8.6408826,115.1313828,703m/data=!3m2!1e3!4b1!4m6!3m5!1s0x2dd238790e10a139:0xecc711d7e02e1ace!8m2!3d-8.6408826!4d115.1339577!16s%2Fg%2F11b7gt2198?entry=tts...
```

The redirect chain sometimes exceeds 4 seconds (network latency, Google's redirect chain, TLS handshake), causing the fetch to abort. The API then falls back to the original short URL which has no parseable place_id.

**Why it works in direct API tests but fails in browser:**
- Direct `Invoke-RestMethod` / `curl` uses longer default timeouts
- Browser `fetch()` respects the 4000ms AbortController timeout strictly

### Solution Applied
**File:** `src/app/api/places/route.ts` (line 15)
```typescript
// Before
const FETCH_TIMEOUT_MS = 4000;

// After
const FETCH_TIMEOUT_MS = 10000; // Increased from 4s to 10s
```

### Verification
```bash
# Test the API directly
curl "http://localhost:3000/api/places?q=https%3A%2F%2Fmaps.app.goo.gl%2FdCBcNxfk2fDjbDUC9"
# Returns: {"places":[{"place_id":"gmaps/ChIJOaEQDnk40i0Rzhou4NcRx-w","name":"Crate Cafe",...}]}
```

### Alternative Links That Work
| Format | Example | Works? |
|--------|---------|--------|
| Short link | `maps.app.goo.gl/dCBcNxfk2fDjbDUC9` | ✅ After fix |
| Place URL | `google.com/maps/place/Crate+Cafe/@-8.6408826,115.1313828,17z` | ✅ |
| Search with place_id | `google.com/maps/search/?api=1&query=Crate+Cafe&query_place_id=ChIJ...` | ✅ |
| goo.gl short | `goo.gl/maps/...` | ⚠️ Deprecated by Google |

---

## Problem 2: "Main Feature" (Google Business Data) Not Showing After Onboarding

### Symptoms
- User completes onboarding: link → validate → continue → add competitor → "Start Monitoring"
- Dashboard loads but shows **no data** in Insights/KPIs/Competitors hubs
- User expects immediate Google business data (reviews, ratings, etc.)

### Root Cause
**No scrape has been triggered yet.** The discovery flow is:

```
1. Landing: Paste Google Maps link → Validate → Preview shows business
2. Continue → Login (mock) → Mode=discovery
3. Onboarding Step 1: Business prefilled → Continue
4. Onboarding Step 2: Branches (optional) → Continue  
5. Onboarding Step 3: Add competitors → "Start Monitoring"
6. Click "Start Monitoring" → POST /api/scrape/trigger with business+branches+competitors
7. Scraper runs in BACKGROUND (1-6 minutes per competitor)
8. Dashboard polls /api/overview → Data appears ONLY after scrape completes
```

**The user completed onboarding but didn't wait for the scrape to finish.** The "Start Monitoring" button triggers the scrape and immediately returns. The scraper runs asynchronously (takes 1-6 minutes per competitor). Data only appears after the scrape completes.

### Expected Flow Timeline
| Step | Duration | User Action |
|------|----------|-------------|
| "Start Monitoring" click | Instant | Click button |
| Scraper starts | Background | Wait |
| Crate Cafe (450 reviews) | ~2.5 min | Wait |
| Revolver (20 reviews) | ~30 sec | Wait |
| Seniman (500 reviews) | ~3 min | Wait |
| **Total** | **~6 min** | Check `/api/scrape/status` |
| Data appears in dashboard | After completion | Refresh page |

### Solution
**Wait for scrape completion**, then refresh dashboard.

### How to Monitor Scrape Progress
```bash
# Option 1: API endpoint
curl http://localhost:3000/api/scrape/status
# Returns: {"status":"running","progress":"2/3","current":"comp-seminyak-01"}

# Option 2: Dashboard UI (after implementing status UI)
# Tools hub → Scheduler card shows "Last run: ..."

# Option 3: Scraper logs (gbp-monitor/)
tail -f gbp-monitor/data/run.log
```

### For Immediate Testing (Skip Live Scrape)
```bash
# Run scraper in fixtures mode (instant, uses test HTML)
cd gbp-monitor
python -m orchestration.run_all --fixtures

# Or partial run for specific competitors
python -m orchestration.run_all --fixtures --competitors comp-canggu-01,comp-seminyak-01
```

---

## Problem 3: Playwright Not Found for Live Scraping

### Symptoms
```
WARNING gbp-monitor.run_all PREFLIGHT: Playwright Chromium binary not installed. 
Run: playwright install chromium
```

### Solution
```bash
cd gbp-monitor
python -m playwright install chromium
# Or: playwright install chromium --with-deps (includes system dependencies)
```

---

## Problem 4: `playwright` Command Not Found in PowerShell

### Symptoms
```
playwright : The term 'playwright' is not recognized as the name of a cmdlet
```

### Root Cause
`playwright` is installed as a Python package (`pip install playwright`), not as a global CLI. The CLI entry point isn't in PATH.

### Solution
```bash
# Use python module syntax
python -m playwright install chromium

# Or add Python Scripts to PATH
# Windows: $env:PATH += ";$env:APPDATA\Python\Python314\Scripts"
```

---

## Problem 5: Playwright Timeout for Complex Businesses (Seniman Coffee)

### Symptoms
- Scraper hangs on Seniman Coffee Studio (500+ reviews)
- Scroll iterations: 55 iterations, ~98 seconds
- `comp-ubud-01` takes ~145 seconds total

### Root Cause
Seniman Coffee has 500+ reviews requiring 55 scroll iterations. The scraper's polite delay (5-10s between listings) + scroll time + expand time = ~2.5 min per competitor.

### Mitigation
- **Fixtures mode** for development: `python -m orchestration.run_all --fixtures`
- **Partial runs** for testing: `--competitors comp-canggu-01`
- **Accept longer runs** for production (3 competitors = ~6 min total)

---

## Problem 6: Dashboard Shows No Data Until Scrape Completes

### Symptoms
- After "Start Monitoring", dashboard loads but KPIs/Insights/Competitors show empty/zero
- User thinks feature is broken

### Root Cause
Dashboard queries `/api/overview`, `/api/reviews`, `/api/competitive-health` which read from `data/snapshots/` and `data/reviews_new/`. These are populated **only after scraper completes**.

### UX Improvement Needed (Phase D+)
- Show "Scrape in progress..." status in dashboard
- Poll `/api/scrape/status` and show progress
- Auto-refresh when status changes to "completed"

---

## Problem 7: Short Link Redirect Timeout (Browser vs Direct API)

### Technical Detail
The browser `fetch()` in `login-screen.tsx` calls `/api/places?q=...` which internally does:
```javascript
const res = await fetch(input, { redirect: "follow", signal: ctrl.signal });
```
With `AbortController` timeout of 4000ms. Google's redirect chain for `maps.app.goo.gl` sometimes exceeds this.

### Fix Applied
```typescript
// src/app/api/places/route.ts
const FETCH_TIMEOUT_MS = 10000; // Was 4000
```

---

## Problem 8: `playwright` Command Not Recognized

### Root Cause
`playwright` is a Python package, not a global executable. The CLI is at `python -m playwright`.

### Fix
```bash
# Always use:
python -m playwright install chromium

# Not:
playwright install chromium  # ❌ Won't work
```

---

## Problem 12: localhost:3000 Still Active With No `npm run dev` Running

### Symptoms
- Browser still loads `http://localhost:3000`
- No visible terminal running `npm run dev`
- Port 3000 appears occupied; a new dev server can't bind to it

### Root Cause
An **orphaned `node.exe` process** is still serving the app. This happens when:
1. The dev server was started detached/backgrounded (e.g., via
   `Start-Process`, CI scripts, or a closed terminal window whose child
   process survived)
2. A previous `npm run dev` was killed via `taskkill /IM node.exe` but only
   one of several node processes died (Next.js spawns multiple workers)
3. System sleep/resume left the process alive while its parent terminal died

### Solution: Find and Kill the Orphan

**Step 1 — Find which PID holds port 3000:**
```powershell
netstat -ano | findstr ":3000"
```
Look at the `LISTENING` rows — the last column is the PID:
```
TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12932   ← this PID
```

**Step 2 — Confirm it's node before killing (safety check):**
```powershell
tasklist /FI "PID eq 12932"
```

**Step 3 — Kill by PID:**
```powershell
taskkill /F /PID 12932
```

### One-liners

**Kill whatever holds port 3000 (PowerShell):**
```powershell
$pid3000 = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid3000) { Stop-Process -Id $pid3000 -Force; Write-Host "Killed PID $pid3000" } else { Write-Host "Port 3000 free" }
```

**Nuclear option — kill ALL node processes (closes every Node app):**
```powershell
taskkill /F /IM node.exe
```

### Note on TIME_WAIT entries
After killing the listener you may still see rows like:
```
TCP    [::1]:50495    [::1]:3000    TIME_WAIT    0
```
These are **dying client connections**, not a server. They clear automatically
within 30–120 seconds. Only a `LISTENING` row means something still owns the
port.

---

## Problem 13: Dashboard Shows No Reviews After Successful Scrape (Data-Path Mismatch)

### Symptoms
- Scrape triggers fine (no more "exit code 2"), status polls run
- Dev-server log repeats: `[server-data] no file (using fallback): ...\data\users\crate-cafe\run_summary.json`
- KPI/overview may render, but **reviews/competitors show nothing**
- CLI scrape (`python -m orchestration.run_all`) works and writes data

### Root Cause — Three-Layer Mismatch
1. **Python ignored `ROTHER_DATA_DIR`**: `scrape-runner.ts` spawns Python with
   `ROTHER_DATA_DIR=data/users/{businessId}` for tenant isolation, but
   `run_all.py`, `storage/snapshot_store.py`, etc. hardcoded cwd-relative
   `Path("data/...")`. Zero references to the env var existed in `gbp-monitor/`.
   → Scraper wrote snapshots/deltas/summary to **root** `gbp-monitor/data/`.
2. **Dashboard reads the tenant dir** (`data/users/crate-cafe/`) → always empty.
3. **Status close-handler read root summary** (`GBP_RUN_SUMMARY_PATH`) instead of
   the tenant dir's — status resolution was coupled to the wrong file.

Plus a **hydration bug masking rendering**: the per-competitor refresh button
was nested inside `CompetitorRow`'s outer `<button>` (invalid HTML:
`<button>` inside `<button>`), breaking React hydration of that subtree.

### Fixes Applied
| File | Fix |
|------|-----|
| `gbp-monitor/orchestration/run_all.py` | `_DATA_BASE = Path(os.environ.get("ROTHER_DATA_DIR", "data"))`; all data paths (snapshots, reviews_new, run_summary, run.log, selector_history, config_backups) derive from it; `mkdir(parents=True)` before FileHandler; lock file + NID jar stay global at root |
| `gbp-monitor/storage/snapshot_store.py` | Same `_DATA_BASE` pattern for `_SNAPSHOT_DIR` |
| `src/lib/gbp/scrape-runner.ts` | Close handler reads `${dataDir}/run_summary.json`; removed unused import |
| `src/components/dashboard/branches-section.tsx` | `CompetitorRow` outer `<button>` → `div[role=button]` with keyboard handler (fixes nested-button hydration error) |

### Verification
```bash
# Tenant-scoped spawn writes to tenant dir:
$env:ROTHER_DATA_DIR='data/users/test-tenant'
python -c "import orchestration.run_all as ra; print(ra._SUMMARY_PATH)"
# → data\users\test-tenant\run_summary.json  ✓

# CLI without env var still writes to root (backward compat)  ✓
# verify_baseline 131/132 · notifications 25/25 · variant 32/32  ✓
# vitest 103/103 · tsc 0 · e2e 10/10  ✓
```

---

## Problem 14: Tracked Production Data Shows as Deleted After Test Runs

### Symptoms
```
git status --porcelain
D gbp-monitor/data/snapshots/comp-canggu-01/2026-08-13T09-11-32Z.json
D gbp-monitor/data/reviews_new/comp-canggu-01_20260813T090503Z.json
... (~30+ files under gbp-monitor/data/)
```
The committed Aug-13 production set (12 competitors / ~5,021 reviews) appears
deleted after `python -m tests.verify_baseline` or any suite that wipes
`gbp-monitor/data/`.

### Root Cause
Those snapshot/delta files were **committed before** the blanket `data/`
ignore rule existed. Gitignore only affects *untracked* files — tracked files
stay tracked, so wiping the directory registers as deletions.

### Is Restoring Safe? (Decision Record — 2026-08-22)

**YES.** Restore has zero impact on the current codebase:

| Area | Impact |
|------|--------|
| Code / all Phase A–D features | None — data files are independent of code |
| Discovery mode (primary flow) | None — reads tenant dir `data/users/{businessId}/`, untouched by restore |
| Fixed-mode dashboard | Cosmetic only — KPIs show Aug-13 numbers until next scrape re-points them |
| Newer live-scrape snapshots (e.g. `comp-canggu-01/2026-08-21T*.json`) | Safe — merge-restore adds old timestamped files back; newer ones remain (versioned store by design) |
| `run_summary.json` / selector history | Overwritten with Aug-13 versions; self-heals on next run |

### The Fix (when you choose to apply it)

```powershell
# Preferred — restores EXACTLY the committed state, leaves untracked newer
# timestamped snapshots untouched:
git restore gbp-monitor/data/

# Alternative — file-copy from backup (also safe, merges):
Copy-Item C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup\* gbp-monitor\data\ -Recurse -Force
```

Backup currently exists at:
`C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup`

### Prevention Rule (AGENTS.md discipline)

ALWAYS back up before running data-wiping suites, and restore before commit:

```powershell
# Before verify_baseline:
Copy-Item gbp-monitor\data C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup -Recurse

# Before git add/commit:
git restore gbp-monitor/data/     # or copy backup back
git status                         # confirm no 'D' entries under gbp-monitor/data/
```

NEVER run `git add -A` while the deletions are present — that would commit
the loss of production data permanently.

---

## Summary: Quick Reference

| Problem | Quick Fix |
|---------|-----------|
| Short link fails | Increase `FETCH_TIMEOUT_MS` to 10000 in `src/app/api/places/route.ts` |
| No data after onboarding | Wait for scrape (check `/api/scrape/status`), then refresh |
| Playwright not found | `python -m playwright install chromium` |
| `playwright` cmd not found | Use `python -m playwright install chromium` |
| Seniman takes too long | Use `--fixtures` or `--competitors` filter for testing |
| No data in dashboard | Scrape hasn't finished; check `/api/scrape/status` |
| Short link timeout | Increase `FETCH_TIMEOUT_MS` to 10000 |
| **"Python exited with code 2"** | Fixed — scrape-runner no longer passes invalid `--business`/`--max-reviews` args |
| **No reviews in dashboard after scrape** | Fixed — Python now honors `ROTHER_DATA_DIR` (tenant data isolation); see Problem 13 |
| **Nested-button hydration warning** | Fixed — CompetitorRow outer element is now a `div[role=button]` |
| **Hubs blocked during scrape** | Fixed — RunScreen reveals hubs immediately + background toast watcher |
| **Turbopack EBUSY on dev start** | `taskkill /F /IM node.exe; Remove-Item -Recurse -Force .next; npm run dev` |
| **Orphaned localhost:3000** | `netstat -ano \| findstr ":3000"` → `taskkill /F /PID <pid>` |
| **Production data shows as deleted (git)** | Safe to restore — `git restore gbp-monitor/data/`; see Problem 14 before committing |

---

## Files Modified for Fixes

| File | Change |
|------|--------|
| `src/app/api/places/route.ts` | `FETCH_TIMEOUT_MS = 10000` (line 15) |
| `src/components/shell/login-screen.tsx` | Added toast notifications for validation |
| `src/components/shell/onboarding.tsx` | Added toast notifications for competitor actions |
| `src/features/t-config.tsx` | Added toast notifications for competitor actions |
| `playwright.config.ts` | Added Mobile viewport project (375×667) |
| `e2e/smoke.spec.ts` | Added discovery flow E2E test + mobile viewport test |

---

## Verification Checklist After Fixes

```bash
# 1. Test short link resolution
curl "http://localhost:3000/api/places?q=https%3A%2F%2Fmaps.app.goo.gl%2FdCBcNxfk2fDjbDUC9"

# 2. Run all dashboard tests
npx vitest run && npx tsc --noEmit && npx eslint src && npm run build

# 3. Run E2E tests
npx playwright test e2e/smoke.spec.ts

# 4. Test scraper
cd gbp-monitor
python -m orchestration.run_all --fixtures
python -m orchestration.run_all --schedule
python -m orchestration.run_all --competitors comp-canggu-01

# 4. Run full test suite
python -m tests.verify_baseline
python -m tests.verify_notifications
python -m tests.verify_variant_framework
```