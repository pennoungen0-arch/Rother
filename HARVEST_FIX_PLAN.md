# Harvest Fix Plan â€” completeness honesty + variance-proof deltas

**Created:** 2026-08-24 Â· **Status:** âœ… ALL PHASES DONE & PROVEN (2026-08-25)
**Companion doc:** `HARVEST_AUDIT_2026-08-24.md`
**Outcome:** Tauri gate SATISFIED. Live proof: harvest_status=reduced with
google_review_count=5.281 (crate-cafe) / 8.435 (revolver) persisted into
snapshot metadata + served by both stats APIs + shown in the UI; two
consecutive live runs â‡’ 0 phantom "new" (was 240/run). Gates:
verify_baseline 159/159 Â· notifications 25/25 Â· variant 32/32 Â· vitest
119/119 Â· tsc 0 Â· eslint 0/0 Â· Playwright 16/16. Evidence:
phase-reports/harvest-phase{0,1,2,3}-evidence.txt.

---

## Phase 0 â€” Baseline evidence Â· âœ… DONE (2026-08-24, read-only)

Evidence: `phase-reports/harvest-phase0-evidence.txt`. Key numbers:
- Correct consecutive-run pairing (20 min apart): run1 410+470 (empty
  baseline flood) â†’ run2 510+610 â‡’ **240 phantom "new" = 100% of reported
  delta** (deeper render discovered old reviews; 0 genuinely new).
- Backup-vs-tonight pairs: strict subsets â€” 0 phantom but 21.5% / 4.9%
  DROPOUT (baselines silently shrink).
- Metadata probe: 4-strategy extraction runs AFTER the reviews-tab switch
  when the overview count text is gone â‡’ google_count=None â‡’ status
  "unknown". Fix direction: extract in the PRE-tab overview probe.
- **Phase 2 design refined:** seen-ID union ALONE is insufficient (deeper
  renders surface never-seen old IDs). Final design = union + RECENCY GATE
  (new ID + date â‰¤ ~30d â‡’ posted-new; old-date â‡’ backfill, silent merge)
  + first-run flood suppression (seed union, mark delta "baseline").

- [x] Quantify render variance offline (both directions: expansion + dropout)
- [x] Diagnose degraded metadata probe (timing: post-tab-switch)
- [x] Refine Phase 2 design from evidence

## Phase 1 â€” Harvest honesty (scraper) Â· âœ… DONE & PROVEN (2026-08-24)

Evidence: `phase-reports/harvest-phase1-evidence.txt`. Live run a99ec000:
`BUSINESS_META rating=4,2 reviews=5.281` (was `?`/`?`); snapshot metadata
sidecar now carries `google_rating` + `google_review_count` +
`harvest_status: "reduced"` + `harvest_detail: "520 of 5281 reviews
harvested â€” partial newest window"`. verify_baseline **141/141** (9 new
classification checks incl. 90%-threshold boundary). Rule 3 satisfied via
anonymous DOM probe + logged-in live run (count only renders in FULL
variant).

- [x] Repair aggregate extraction (pre-tab overview probe; Rule 3 verified)
- [x] Indonesian "ulasan" fallback in post-tab regex
- [x] `classify_harvest()` pure function + harvest_status/detail persisted
      into run_summary parser_efficiency + snapshot metadata sidecar
- [x] Python tests (verify_baseline Phase 7, 9 checks)
- [x] LIVE proof: reduced + google_count populated for crate-cafe

## Phase 2 â€” Variance-proof deltas Â· âœ… DONE & PROVEN (2026-08-25)

Evidence: `phase-reports/harvest-phase2-evidence.txt`. Two consecutive live
runs: run 1 (migration) `new_reviews=0, backfill=70` (silent); run 2
`new_reviews=0, backfill=0`. Pre-fix the same scenario produced 240 phantom
alerts. verify_baseline **159/159** (16 new seen-store checks; baseline
artifact assertions updated to the new first-harvest semantics).

- [x] `storage/seen_store.py` (union + recency gate + first-harvest detection)
- [x] Recency gate via review_date with conservative unparseable default
- [x] run_all delta step rewritten (migration seed, baseline suppression,
      silent backfill, union persisted post-classification)
- [x] Python tests (16 checks) + baseline artifact assertions updated
- [x] LIVE proof: 0 phantom across two consecutive runs

## Phase 3 â€” Dashboard honesty Â· âœ… DONE (2026-08-25)

Evidence: `phase-reports/harvest-phase3-evidence.txt`. Live: both routes
serve `harvest_status=reduced` + `google_review_count` per competitor
(crate-cafe 5.281, revolver 8.435 â€” bonus discovery). UI: "Partial window"
badge + "of ~N on Google" on cards; "Harvested X of ~N (newest window)"
line in the detail sheet. Gates: tsc 0 Â· eslint clean Â· vitest 119/119 Â·
Playwright 16/16 (fixtures snapshots carry no metadata â‡’ graceful absence,
covered by suite passing unchanged).

- [x] readHarvestInfo() metadata reader (tenant-scoped, graceful null)
- [x] harvest fields through /api/branches + /api/overview stats rows
- [x] UI badge + count-suffix + detail-sheet line with explanatory tooltips
- [x] Gates green

## Phase 4 â€” Closing gate + docs

- [x] Full offline gates + Python suites.
- [x] Two consecutive LIVE runs: run #2 must report ~0 new reviews
      (variance-proofed), harvest_status present for both listings.
- [x] CHANGELOG (Rule 2) + AGENTS.md sync + plan checkboxes.
- [x] THEN unblock Tauri planning (fresh plan against current architecture;
      the archived 2026-08-13 plan is stale on scraper/tenant-data grounds â€”
      see conversation notes).

## Explicitly OUT of scope

- Deep backfill of all ~5,009 reviews (Google virtualization fights it;
  monitoring needs only the newest window).
- Real OAuth, auto-update infra, mobile â€” Tauri-plan concerns, later.

## Effort

Phases 0â€“4 â‰ˆ 5â€“7 h including two live runs (~5 min each).
