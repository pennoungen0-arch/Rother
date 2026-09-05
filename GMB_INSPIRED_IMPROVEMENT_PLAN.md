# Rother Data & UX Improvement Plan — GMB Everywhere Insights
**Created:** 2026-09-05 · **Status:** PLANNED
**Inputs:** `GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md`
**Baseline:** Rother v0.3.3 (sealed), web + Tauri versions
**Goal:** Make Rother's ~500-review window as useful as possible, surface
        harvest honesty prominently, and fix the concrete Tauri gaps.

---

## Phase 1 — Review Filters in UI · HIGH · ~2h

The `/api/reviews` route already supports `q`, `date_from`, `date_to`,
`rating` params (per `reviews-section.tsx`). The dashboard UI has no
controls for them. GMB Everywhere lets you filter the visible window;
Rother can too.

- [ ] Add filter controls to `ReviewsSection`: keyword search input,
      rating selector (1–5 multi-select), date-range picker.
- [ ] Wire each control to the existing query params.
- [ ] Reset-to-page-1 behavior already exists via `useEffect` on filters
      (line 114).
- [ ] UI: collapse filters into a "Filters" expandable row so the reviews
      list isn't permanently cluttered.
- Exit: `npx tsc --noEmit` clean, manual check filtering reviews works.

## Phase 2 — Harvest Window Header · MEDIUM · ~1h

GMB Everywhere shows "Reviews available: 5,281" prominently. Rother's
`google_review_count` + `harvest_status` exist in metadata but aren't
visible to the user at the review-list level.

- [ ] `ReviewsSection` header: show "Showing N of ~G on Google" when
      `harvest_status === "reduced"`, using `readHarvestInfo()` data from
      the `/api/reviews` response or a companion header prop.
- [ ] `branches-section.tsx` card already has "of ~N on Google" suffix —
      verify consistency.
- [ ] If harvest_status === "full" or "unknown", omit the header note
      (matching existing behavior).
- Exit: visual check on dashboard; `npx tsc` clean.

## Phase 3 — Comparison Table View · MEDIUM · ~2–3h

GMB Everywhere's Local Scan compares businesses side-by-side. Rother's
`c-comparison` feature only has a radar chart. The snapshot metadata
already contains all the data needed.

- [ ] New component `ComparisonTable` (or extend `c-comparison.tsx`):
      table with rows = business, columns = Rating, Reviews, Categories,
      Hours, Services, Distance.
- [ ] Data source: `/api/branches` already returns `BranchWithStats[]`
      with per-competitor aggregated stats.
- [ ] Add a tab/toggle in the Competitors hub "Comparison" feature:
      "Radar" vs "Table" view.
- [ ] Ensure self-entry row is included (it's already in `/api/branches`
      via `withSelfEntry`).
- Exit: visual check both views work; `npx tsc` clean.

## Phase 4 — Tauri Startup Indicator · MEDIUM · ~1.5h

GMB Everywhere is instant (Chrome extension). Tauri launches Python
silently with no feedback. Add a startup progress indicator.

- [ ] `RunScreen` / `AppShell`: detect active scrape on mount (already
      polls `/api/scrape/status?active=1`). Show a non-blocking banner:
      "Scraper running… (1/11 businesses, ~X min remaining)".
- [ ] Tauri first-launch: `main.rs` logs progress to
      `rother-tauri-startup.log`. Mirror this in the UI — detect if
      `run_summary.json` is missing/stale and show "Initial scrape
      starting" state.
- [ ] Python-warm-up indicator: `/api/scrape/status` returns status
      "starting" during NID warm-up; already surfaced by RunScreen polling.
- [ ] Add a "first-run" banner to the dashboard when no snapshots exist yet.
- Exit: manual check in Tauri; `npx tsc` clean.

## Phase 5 — Cleanup & Documentation · LOW · ~1h

- [ ] Update `AGENTS.md` with harvest-window feature count bump (25→26
      or document as enhancement, not new feature).
- [ ] Update `TAURI_SCRAPING_ANALYSIS_2026-09-05.md` §9 with this plan
      as the actionable follow-up.
- [ ] Remove stale temp files: `_phase0_variance.py`, `_phase1_dom_probe.py`
      (already deleted) — verify clean.
- [ ] Run final gates: `npx vitest run && npx tsc --noEmit && npx eslint src`.
- Exit: all gates green, plan checkboxes filled.

---

## Not in scope (documented as future)

| Item | Why deferred |
|---|---|
| GBP Posts monitoring | New DOM selectors + parser needed; not blocking any user request |
| Category comparison | Requires new extraction pipeline; can do later |
| Geo-grid/rank visualization | Existing `c-geo-grid` feature already covers this |
| AI features | Forbidden by Rule 4 (zero cost, no external APIs) |
| Increase review coverage beyond ~500 | Google platform limit; no code change helps |

---

## Status
PLANNED — ready to execute in order.
