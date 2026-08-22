# Discovery-First Product Vision — Rother

**Created:** 2026-08-20  
**Status:** ✅ Implemented — Phases A–D complete (2026-08-22). See `PHASE_A_AUDIT_REPORT.md`, `PHASE_B_IMPLEMENTATION_REPORT.md`, `PHASE_C_IMPLEMENTATION_REPORT.md`, `PHASE_D_IMPLEMENTATION_REPORT.md`, and `VERSION_AUDIT_2026-08-22.md` for verification evidence.  
**Based on:** User conversation 2026-08-20  

---

## Vision Statement

> "When a user or worker inputs a Google Maps business location link into Rother, it will detect, scan and analyze the link (e.g., for a cafe called Crate Cafe). Then when the user clicks Run, Rother will auto-retrieve and show all necessary data to be tracked and monitored. The retrieved data will then be updatable by scheduled scraping or by the user manually clicking refresh."

This shifts Rother from **fixed-config** (edit `listings.json` manually) to **link-driven discovery** (paste link → get monitoring).

---

## Current State (Post Phase 4)

| Capability | Status |
|------------|--------|
| Place search / link parsing (`/api/places`) | ✅ Works for some URL formats |
| Onboarding UI (multi-step) | ✅ Exists in Discovery mode |
| Competitor discovery (OSM/Overpass) | ✅ `/api/category-scan` works |
| Manual scrape trigger | ✅ `/api/scrape/trigger` |
| Scheduler (CLI) | ✅ `run_all.py --schedule` (24h interval) |
| **Unified "Paste Link" entry** | ❌ Missing — only in Discovery mode, not default |
| **Auto-competitor list from seed** | ❌ Category-scan runs but no reviewable UI |
| **Scheduling UI** | ❌ CLI only |
| **Per-competitor Refresh button** | ❌ Only global "Run" |
| **Link → place_id robustness** | ❌ Limited URL format support |

---

## Phased Implementation Plan

### Phase A: Unified Link Entry + Discovery as Default (2-3 days)

| Task | Details | Files |
|------|---------|-------|
| **A1. Redesign landing page** | Replace mode picker with single "Paste Google Maps link" input. Add "Advanced → Fixed competitor list" link below. | `src/components/shell/RunScreen.tsx`, `src/lib/app-mode.ts` |
| **A2. Enhance `/api/places`** | Parse all Google Maps URL formats: `maps.app.goo.gl/...`, `google.com/maps/place/...`, `google.com/maps/search/...`, `goo.gl/maps/...`. Return `place_id`, name, address, category, lat/lng, website, phone. | `src/app/api/places/route.ts` |
| **A3. Link validation flow** | User pastes link → loading → preview card (name, address, category, map thumbnail) → "Continue" | `src/components/shell/Onboarding.tsx` (new step) |
| **A4. Save to `user-business.json`** | Create business entry with seed place_id. This becomes the "my business" for discovery mode. | `src/app/api/business/route.ts` |

---

### Phase B: Manual Competitor Management (1-2 days)

| Task | Details | Files |
|------|---------|-------|
| **B1. Competitor list UI** | After onboarding, show editable competitor list (initially empty). "Add competitor" → paste Google Maps link → validates via `/api/places` → adds to list. | `src/components/shell/Onboarding.tsx` (new step), `src/features/t-configuration.tsx` |
| **B2. Edit/remove competitors** | Inline edit name, remove button. | `src/features/t-configuration.tsx` |
| **B3. "Start Monitoring" button** | Saves final list to `user-business.json` → triggers first scrape via `/api/scrape/trigger`. | `src/components/shell/Onboarding.tsx`, `src/app/api/scrape/trigger/route.ts` |
| **B4. Config hub integration** | Config tab (Tools hub) shows the competitor list with add/edit/remove. | `src/features/t-configuration.tsx`, `src/app/api/config/listings/route.ts` |

---

### Phase C: Scheduling UI + Easy Refresh (1-2 days)

| Task | Details | Files |
|------|---------|-------|
| **C1. Schedule config file** | `gbp-monitor/config/schedule.json` with `{ enabled: true, intervalHours: 24, nextRun: ISO }` | New file |
| **C2. Python scheduler integration** | Modify `run_all.py --schedule` to read `schedule.json`; on each run, update `nextRun`. | `gbp-monitor/orchestration/run_all.py` |
| **C3. Dashboard schedule UI** | Tools hub → "Scheduler" card: toggle on/off, interval dropdown (6h/12h/24h/48h), shows "Next run: …", "Last run: …", "Run now" button. | `src/features/t-scheduler.tsx` (new), `src/app/api/schedule/route.ts` (new) |
| **C4. Per-competitor "Refresh" button** | On competitor cards (Leaderboard, Branch Comparison): "⟳ Refresh" → `POST /api/scrape/trigger` with `{ competitor_ids: ["comp-xxx"] }`. | `src/features/c-leaderboard.tsx`, `src/features/c-branch-comparison.tsx`, `src/app/api/scrape/trigger/route.ts` |
| **C5. Scraper filter support** | Add `--competitors comp-a,comp-b` to `run_all.py` for partial runs. | `gbp-monitor/orchestration/run_all.py` |

---

### Phase D: Polish & Hardening (1 day)

| Task | Details |
|------|---------|
| **D1. Error states** | Link invalid, place_id not found, scraper failures → friendly toasts |
| **D2. Loading states** | Skeleton loaders during link validation, competitor add, scrape runs |
| **D3. Empty states** | "No competitors yet — add your first competitor" |
| **D4. Mobile responsive** | Test onboarding + competitor management on mobile |
| **D5. E2E tests** | Add Playwright specs for: paste link → add competitor → run → verify data |

---

## Architecture (Discovery-First)

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
       │  Scheduler  │          │   Refresh   │
       │  (Tools hub)│          │  (per card) │
       │  • on/off   │          │  • POST     │
       │  • interval │          │    /scrape/ │
       │  • next run │          │    trigger  │
       │  • run now  │          │    {ids}    │
       └─────────────┘          └─────────────┘
```

---

## Decisions from User (2026-08-20)

| Question | Decision |
|----------|----------|
| **Default mode?** | Discovery as primary; Fixed mode hidden behind "Advanced" link |
| **Competitor discovery?** | Manual only for now (user adds via links); no auto-discovery UI |
| **Scheduling?** | Use existing CLI scheduler; add dashboard UI toggle + "Run now" |
| **Refresh?** | Per-competitor "Refresh" button on cards (easy access) |
| **Scope** | Comprehensive plan (Phases A–D) |

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| User pastes any Google Maps link → gets validated `place_id` | Manual test + unit tests for URL parser |
| User adds 1+ competitors via links → "Start Monitoring" works | E2E: link → add competitor → run → data appears |
| Scheduler toggle in UI enables/disables background scraping | UI shows next/last run; `run_all.py --schedule` respects config |
| Per-competitor Refresh button triggers partial scrape | Click → only that competitor's reviews update |
| All existing tests still pass | `npm run test:e2e` 30/30, vitest 103/103, tsc 0 |

---

## Rollback / Safety

- All changes behind feature flags or new routes — existing `listings.json` fixed mode untouched
- `user-business.json` already gitignored (commit `20923af`)
- Data backup discipline per AGENTS.md applies

---

## Dependencies

- No new external dependencies (Rule 4)
- Uses existing: `/api/places`, `/api/category-scan`, `/api/scrape/trigger`, `run_all.py --schedule`
- New internal: `schedule.json`, `/api/schedule` (if needed), `--competitors` filter