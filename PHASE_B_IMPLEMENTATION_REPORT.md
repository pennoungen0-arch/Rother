# Phase B Implementation Report — Manual Competitor Management

**Date:** 2026-08-21  
**Branch:** `test/m15-1-validation`  
**Commit:** Latest (post Phase B)  
**Status:** ✅ COMPLETE — All tasks implemented, all gates green

---

## Executive Summary

Phase B ("Manual Competitor Management") has been fully implemented per the `DISCOVERY_FIRST_PLAN.md` specification. The discovery-first flow now supports:

1. **Onboarding Step 3** — Add competitors via Google Maps links
2. **Start Monitoring** — Persists business + branches + competitors to `user-business.json` and triggers first scrape
3. **Config Hub (Tools tab)** — Editable competitor management in discovery mode

All 4 planned tasks (B1–B4) are complete and verified.

---

## Implemented Tasks

| Task | Description | Files Modified |
|------|-------------|----------------|
| **B1** | **Competitor list UI** — New Onboarding Step 3: "Add competitors to monitor" with paste-link input, validation via `/api/places`, "Verified" badge for real places | `src/components/shell/onboarding.tsx` |
| **B2** | **Edit/remove competitors** — Inline remove button (🗑️), duplicate prevention, validation feedback | `src/components/shell/onboarding.tsx` |
| **B3** | **"Start Monitoring" button** — Saves final config (business, branches, competitors) to `user-business.json` → triggers `/api/scrape/trigger` → opens dashboard | `src/components/shell/onboarding.tsx` |
| **B4** | **Config hub integration** — Tools tab shows competitor management UI in discovery mode (add/remove, persists to `user-business.json`) | `src/features/t-config.tsx` |

---

## Technical Details

### Onboarding — 3-Step Flow

```
Step 1: Business Setup
  ├── Search / paste Google Maps link / manual entry
  ├── Category selection
  └── Continue → Step 2

Step 2: Branch Locations  
  ├── Add branches (search + address autocomplete)
  ├── Optional: skip
  └── Continue → Step 3

Step 3: Competitors (NEW)
  ├── Paste Google Maps link → validates via /api/places
  ├── Shows competitor name + URL + "Verified" badge
  ├── Remove button (🗑️)
  ├── Empty state: "No competitors added yet..."
  └── "Start Monitoring" (disabled until ≥1 competitor)
```

### Data Persistence

**`user-business.json`** now includes competitors in each branch:

```json
{
  "id": "crate-cafe",
  "name": "Crate Cafe",
  "branches": [
    {
      "branch_id": "crate-cafe-canggu",
      "branch_name": "Crate Cafe — Canggu",
      "competitors": [
        {
          "competitor_id": "revolver-seminyak",
          "name": "Revolver Seminyak",
          "gmaps_url": "https://maps.app.goo.gl/...",
          "place_id": "ChIJ9fhCoBBH0i0R4h17JYdA484",
          "gmaps_place_id": "ChIJ9fhCoBBH0i0R4h17JYdA484",
          "verified": true
        }
      ]
    }
  ]
}
```

### Config Hub (Tools Tab) — Discovery Mode

- Loads branches from `/api/business/branches`
- Flat-maps all competitors across branches for unified list
- Add competitor: paste link → `/api/places` validation → adds to all branches → persists via `POST /api/business/branches`
- Remove competitor: filters from all branches → persists
- Empty state: "No competitors added yet. Add your first competitor above."

### API Integration

| Endpoint | Usage |
|----------|-------|
| `GET /api/places?q=<url>` | Validate competitor link, extract place_id + name |
| `POST /api/business/branches` | Persist branches + competitors to `user-business.json` |
| `POST /api/scrape/trigger` | Trigger first scrape with full config (business + branches + competitors) |

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

### Smoke Tests Verified

1. **Discovery landing** — renders with link input, validates invalid link
2. **Fixed mode via Advanced** — Advanced → Fixed → Gmail sign-in → Run gate → Hubs
3. **KPI live data** — Fixed mode → Run → Insights → KPIs (3 branches, 3 competitors, 930 new reviews)

### API Verification

| URL Format | Result |
|------------|--------|
| `maps.app.goo.gl/dCBcNxfk2fDjbDUC9` (Crate Cafe) | ✅ `ChIJOaEQDnk40i0Rzhou4NcRx-w` + "Crate Cafe" |
| `maps.app.goo.gl/FEkM7q8dPc8DrPiQ6` (Revolver) | ✅ `ChIJ9fhCoBBH0i0R4h17JYdA484` + "Revolver Seminyak" |
| `google.com/maps/search/?query_place_id=ChIJ...` | ✅ Real ChIJ place_id |
| Invalid/fake links | ✅ Correctly returns no places |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/shell/onboarding.tsx` | Added Step 3 (competitors), `CompetitorDraft` type, `addCompetitor`/`removeCompetitor`, `startMonitoring` callback, 3-step render logic |
| `src/features/t-config.tsx` | Discovery mode: loads branches from `/api/business/branches`, competitor add/remove with persistence, unified flat-mapped list |
| `src/components/shell/onboarding.tsx` imports | Added `Plus`, `Trash2`, `Loader2`, `Play` from lucide-react |

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

Phase B implements the architecture from `DISCOVERY_FIRST_PLAN.md`:

```
┌─────────────────────────────────────────────────────┐
│  Landing: "Paste Google Maps link"  [Advanced]      │
│                                                     │
│  1. Validate link → preview seed business           │
│  2. Add competitors (manual, via links)  ← B1, B2  │
│  3. "Start Monitoring" → saves user-business.json  ← B3
│  4. Auto-triggers first scrape                      │
│  5. Dashboard opens with live data                  │
└─────────────────────────────────────────────────────┘
                           │
               ┌───────────┴───────────┐
               ▼                       ▼
        ┌─────────────┐          ┌─────────────┐
        │  Scheduler  │          │   Refresh   │  ← Phase C
        │  (Tools hub)│          │  (per card) │
        └─────────────┘          └─────────────┘
```

Config hub (Tools) now shows competitor management in discovery mode (B4), completing the tenant-scoped configuration loop.

---

## Next Phase

**Phase C: Scheduling UI + Easy Refresh** (per `DISCOVERY_FIRST_PLAN.md`)

| Task | Description |
|------|-------------|
| **C1** | `gbp-monitor/config/schedule.json` with `{ enabled, intervalHours, nextRun }` |
| **C2** | Modify `run_all.py --schedule` to read `schedule.json`, update `nextRun` |
| **C3** | Dashboard schedule UI (Tools hub): toggle, interval dropdown, next/last run, "Run now" |
| **C4** | Per-competitor "Refresh" button on cards → `POST /api/scrape/trigger` with `{ competitor_ids }` |
| **C5** | Add `--competitors` filter to `run_all.py` for partial runs |

Phase B is complete and ready for Phase C.