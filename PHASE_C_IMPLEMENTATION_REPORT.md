# Phase C Implementation Report — Scheduling UI + Easy Refresh

**Date:** 2026-08-21  
**Branch:** `test/m15-1-validation`  
**Commit:** Latest (post Phase C)  
**Status:** ✅ COMPLETE — All 5 tasks implemented, all gates green

---

## Executive Summary

Phase C ("Scheduling UI + Easy Refresh") has been fully implemented per the `DISCOVERY_FIRST_PLAN.md` specification. The dashboard now has a complete scheduling interface and per-competitor refresh capability, while the Python scraper supports scheduled runs and partial competitor filtering.

All 5 planned tasks (C1–C5) are complete and verified.

---

## Implemented Tasks

| Task | Description | Files Modified/Created |
|------|-------------|------------------------|
| **C1** | **Schedule config file** — `gbp-monitor/config/schedule.json` with `{ enabled, intervalHours, nextRun, lastRun, lastRunStatus }` | `gbp-monitor/config/schedule.json` (new) |
| **C2** | **Python scheduler integration** — `run_all.py --schedule` reads schedule.json, runs if due, updates `lastRun`/`nextRun`/`lastRunStatus` | `gbp-monitor/orchestration/run_all.py` |
| **C3** | **Dashboard schedule UI** — Tools hub → "Scheduler" card: toggle on/off, interval dropdown (6h/12h/24h/48h), shows "Next run", "Last run", "Run now" button | `src/features/t-scheduler.tsx` (new), `src/app/api/schedule/route.ts` (new), `src/features/t-config.tsx` (integrated) |
| **C4** | **Per-competitor "Refresh" button** — On Leaderboard and Branches cards: "⟳ Refresh" → `POST /api/scrape/trigger` with `{ competitor_ids: ["comp-xxx"] }` | `src/components/dashboard/competitor-leaderboard.tsx`, `src/components/dashboard/branches-section.tsx` |
| **C5** | **Scraper filter support** — Add `--competitors comp-a,comp-b` to `run_all.py` for partial runs | `gbp-monitor/orchestration/run_all.py` |

---

## Technical Details

### C1: Schedule Config File

**`gbp-monitor/config/schedule.json`**
```json
{
  "_comment": "Scheduler configuration for automatic scraping runs. Read/written by run_all.py --schedule and the dashboard.",
  "enabled": true,
  "intervalHours": 12,
  "nextRun": "2026-08-21T15:58:55.593299+00:00",
  "lastRun": "2026-08-21T03:58:55.593299+00:00",
  "lastRunStatus": "success"
}
```

### C2: Python Scheduler Integration

**New functions in `run_all.py`:**
- `_load_schedule_config()` — loads schedule.json with defaults
- `_save_schedule_config(config)` — atomic write
- `_update_schedule_after_run(success)` — updates `lastRun`, `lastRunStatus`, calculates `nextRun` from `intervalHours`
- `_should_run_scheduled()` — checks if enabled and `nextRun` is due

**New CLI flags:**
- `--schedule` — run in scheduler mode (checks due, exits if not due, updates on success)
- `--competitors` — comma-separated competitor_ids to filter the run

**Example usage:**
```bash
# Scheduler mode (for cron/systemd timer, run every hour)
python -m orchestration.run_all --schedule

# Partial run for specific competitors
python -m orchestration.run_all --fixtures --competitors comp-canggu-01,comp-seminyak-01
```

### C3: Dashboard Schedule UI

**`src/app/api/schedule/route.ts`** — REST API
- `GET /api/schedule` → returns schedule config
- `PATCH /api/schedule` → updates schedule config

**`src/features/t-scheduler.tsx`** — React component
- Toggle enabled/disabled
- Interval dropdown: 6h, 12h, 24h, 48h
- Shows "Next run", "Last run", "Last run status" (success/failed badges)
- "Run now" button → triggers `/api/scrape/trigger`
- Integrated into Tools hub via `t-config.tsx`

### C4: Per-Competitor Refresh Buttons

**`src/components/dashboard/competitor-leaderboard.tsx`**
- Added `RefreshCw`/`Loader2` icons
- Refresh button per row → `POST /api/scrape/trigger` with `{ competitor_ids: [comp.competitor_id] }`
- Loading spinner while refreshing

**`src/components/dashboard/branches-section.tsx`**
- Added refresh button to `CompetitorRow` inside accordion
- Same POST pattern with single competitor_id

### C5: Scraper Filter Support

**`run(fixtures_mode, competitor_filter)`** — accepts optional `competitor_filter: string[]`
- Filters competitors before processing loop
- Works with both `--fixtures` and live mode

---

## Verification Results

### Quality Gates (All Pass)

| Command | Result |
|---------|--------|
| `npx vitest run` | 103/103 ✅ |
| `npx tsc --noEmit` | 0 errors ✅ |
| `npx eslint src` | 0 errors (6 pre-existing warnings) ✅ |
| `npm run build` | ✅ Compiled successfully |
| `npx playwright test e2e/smoke.spec.ts` | 3/3 ✅ |

### Functional Verification

| Test | Result |
|------|--------|
| Schedule API GET | ✅ Returns `{ enabled, intervalHours, nextRun, lastRun, lastRunStatus }` |
| Schedule API PATCH | ✅ Updates config (e.g., `intervalHours: 12`) |
| `run_all.py --schedule` | ✅ Exits if not due, runs if due, updates `lastRun`/`nextRun`/`lastRunStatus` |
| `run_all.py --competitors comp-a,comp-b` | ✅ Processes only specified competitors |
| Dashboard Scheduler UI | ✅ Toggle, dropdown, next/last run display, "Run now" button |
| Leaderboard refresh button | ✅ POSTs `{ competitor_ids: ["comp-xxx"] }` |
| Branches refresh button | ✅ Same POST pattern |

### Live Verification Commands

```bash
# Schedule API
curl http://localhost:3000/api/schedule
# → { "enabled": true, "intervalHours": 12, "lastRun": "2026-08-21T03:58:55Z", "lastRunStatus": "success", "nextRun": "2026-08-21T15:58:55Z" }

# Scheduler mode (checks due, exits if not due)
cd gbp-monitor && python -m orchestration.run_all --schedule
# → "Scheduler: no run due at this time (nextRun not reached or disabled)"

# Partial run with competitor filter
cd gbp-monitor && python -m orchestration.run_all --fixtures --competitors comp-canggu-01,comp-seminyak-01
# → Processes only specified competitors, updates schedule.json with lastRun/lastRunStatus/nextRun
```

---

## Files Modified/Created

| File | Type | Changes |
|------|------|---------|
| `gbp-monitor/config/schedule.json` | New | Schedule config with defaults |
| `gbp-monitor/orchestration/run_all.py` | Modified | Added scheduler functions, `--schedule`, `--competitors` flags, filter logic |
| `src/app/api/schedule/route.ts` | New | GET/PATCH schedule API |
| `src/features/t-scheduler.tsx` | New | Scheduler UI component |
| `src/features/t-config.tsx` | Modified | Integrated `SchedulerFeature` |
| `src/components/dashboard/competitor-leaderboard.tsx` | Modified | Added per-competitor refresh button |
| `src/components/dashboard/branches-section.tsx` | Modified | Added per-competitor refresh button in accordion rows |

---

## Known Limitations (Pre-existing)

| Item | Location | Note |
|------|----------|------|
| `refreshKey` unused | `history-comparison-section.tsx:46` | Pre-existing |
| `<img>` element | `PlaceConfirmCard.tsx:31` | Pre-existing, could use `next/image` |
| `showManual` dependency | `onboarding.tsx:341,406` | Pre-existing callback dependency |
| `React` unused | `use-api-query.ts:3` | Pre-existing |

---

## Architecture Alignment

Phase C implements the scheduler/refresh architecture from `DISCOVERY_FIRST_PLAN.md`:

```
┌─────────────────────────────────────────────────────┐
│  Landing: "Paste Google Maps link"  [Advanced]      │
│                                                     │
│  1. Validate link → preview seed business           │
│  2. Add competitors (manual, via links)             │
│  3. "Start Monitoring" → saves user-business.json   │
│  4. Auto-triggers first scrape                      │
│  5. Dashboard opens with live data                  │
└─────────────────────────────────────────────────────┘
                           │
               ┌───────────┴───────────┐
               ▼                       ▼
        ┌─────────────┐          ┌─────────────┐
        │  Scheduler  │          │   Refresh   │  ← Phase C ✅
        │  (Tools hub)│          │  (per card) │
        │  • on/off   │          │  • POST     │
        │  • interval │          │    /scrape/ │
        │  • next run │          │    trigger  │
        │  • run now  │          │    {ids}    │
        └─────────────┘          └─────────────┘
```

---

## Next Phase

**Phase D: Polish & Hardening** (per `DISCOVERY_FIRST_PLAN.md`)

| Task | Description |
|------|-------------|
| **D1** | Error states — link invalid, place_id not found, scraper failures → friendly toasts |
| **D2** | Loading states — skeleton loaders during link validation, competitor add, scrape runs |
| **D3** | Empty states — "No competitors yet — add your first competitor" |
| **D4** | Mobile responsive — test onboarding + competitor management on mobile |
| **D5** | E2E tests — add Playwright specs for: paste link → add competitor → run → verify data |

Phase C is complete and ready for Phase D.