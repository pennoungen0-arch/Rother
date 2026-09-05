# Rother Data & UX Improvement Plan — GMB Everywhere Insights
**Created:** 2026-09-05 · **Status:** PLANNED
**Inputs:** `GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md`
**Baseline:** Rother v0.3.3 (sealed), web + Tauri versions
**Goal:** Make Rother's ~500-review window as useful as possible, surface
        harvest honesty prominently, and fix the concrete Tauri gaps.

---

## Phase 1 — Review Filters in UI · ✅ ALREADY IMPLEMENTED

All filter controls already exist in `ReviewsSection` (lines 397–516):
- keyword search (debounced, line 132), rating 1–5 multi-select (lines 440–468),
  date-range picker (lines 471–495), branch + competitor dropdowns, clear-all
  button, page-1 reset on filter change. All wired to the existing `/api/reviews`
  query params (`q`, `rating`, `date_from`, `date_to`, `branch_id`,
  `competitor_id`). No code changes needed.

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

## Phase 3 — Comparison Table View · ✅ DONE (2026-09-05)

Extended `c-comparison.tsx` with a Radar/Table toggle (pill buttons in header).
Table view: `ComparisonTable` component — table with rows = competitor,
columns = Name (+ "You" badge if self), Reviews, Rating (star component),
New (badge), Trend (icon), Branch. Sorted by reviews descending, self-row
highlighted. Same data source as radar chart (`useOverview` → `competitorStats`).
All self-entry + harvest-status fields available for future enhancement.
tsc 0, eslint clean.

- [x] Tab/toggle between Radar and Table views in comparison feature header
- [x] `ComparisonTable` component with full per-competitor stats
- [x] Self-entry row highlighted (bg-primary/5, "You" badge)
- [x] Trend icons (up/down/stable) + new reviews badges
- [x] TS clean, committed

## Phase 4 — Tauri Startup Indicator · ✅ DONE (2026-09-05)

Added `StartupBanner` component to `today.tsx` — non-blocking progress
banner shown on the Today screen when no data exists yet. Two states:
- **No active scrape detected:** amber card — "First run detected — your
  businesses are being configured. Run a scrape to start monitoring."
- **Active scrape detected (polls /api/scrape/status?active=1 every 4s):**
  primary card — spinner + "Scraping in progress — 1/11 businesses
  processed" with a CSS progress bar + "N businesses remaining" text.

The existing `busyElsewhere` + progress bar in `RunScreen` (lines 30, 193–216)
already handles the initial trigger UI; this new banner handles the Today
screen after the first scrape trigger completes but before data lands.
It polls and auto-hides once `!loading && hasData` is true.
`Loader2` unused import removed; tsc + eslint clean.

- [x] `StartupBanner` in Today feature with two states
- [x] Polls `/api/scrape/status?active=1` for warm-up/progress visibility
- [x] Auto-hides once data exists (loading/hasData guard)
- [x] TS + ESLint clean, committed

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
