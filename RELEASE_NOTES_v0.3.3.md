# Release Notes — v0.3.3 (Harvest Honesty + Variance-Proof Deltas)
**Date:** 2026-08-25 · **Tag:** `v0.3.3` · **Base:** v0.3.2 (`769e5e7`)

## Headline

Rother now tells the truth about review coverage and never invents new
reviews. Crate Cafe shows **520 of ~5,281 on Google (Partial window)**;
two consecutive scrapes produce **zero phantom "new" reviews** (was 240).

## Since v0.3.2

### Harvest honesty
- The ~500-review ceiling is **Google's virtualized panel**, not a Rother
  limit (`MAX_SCROLLS=400`; no count cap exists).
- Aggregate rating/count extraction moved into the pre-tab overview probe
  (root cause of `rating=? reviews=?`: post-tab extraction ran after the
  overview text left the DOM). Indonesian "ulasan" fallback added.
- New `classify_harvest()` → `harvest_status` (full/reduced/unknown) +
  Google's aggregate persisted into run_summary parser_efficiency AND
  snapshot metadata sidecars.

### Variance-proof deltas
- New `storage/seen_store.py`: per-competitor **ever-seen ID union** +
  30-day recency gate + first-harvest flood suppression.
- Render-depth jitter can no longer manufacture alerts: deeper renders'
  never-seen old IDs are classified as silent backfill; only recently
  posted reviews alert.
- Migration seeds unions from existing snapshots; `backfill_discovered`
  is a new run_summary key.

### Dashboard honesty
- "Partial window" badge + "Reviews: N of ~M on Google" on competitor
  cards; "Harvested X of ~N (newest window)" in detail sheets.
- Discovery: Revolver Seminyak's true total is **8,435**.

### Systems hardening recap (also in this line)
Rate limiter 20→120 req/min/path; 11 routes swept onto
`resolveMonitoredConfig()` (tenant joins no longer hit seed data);
`configSource` provenance field + Demo-dataset badge; e2e suite made
offline-deterministic and stress-stable.

## Evidence

| Gate | Result |
|---|---|
| verify_baseline | **159/159** (9 harvest-classification + 16 seen-store checks) |
| verify_notifications | 25/25 |
| verify_variant_framework | 32/32 |
| vitest | 119/119 |
| Playwright | 16/16 (42/42 under repeat-each stress) |
| tsc / eslint | 0 / 0-0 |
| Live | two consecutive runs `new_reviews=0`; harvest_status=reduced with google_count for both listings |

Full evidence: `phase-reports/harvest-phase{0,1,2,3}-evidence.txt`,
`phase-reports/systems-*.txt`, `HARVEST_FIX_PLAN.md`, `SYSTEMS_FIX_PLAN.md`.

## Upgrade notes

- No config changes required; first live run after upgrade migrates the
  seen-store unions from existing snapshots automatically.
- Expect `new_reviews` to be quiet immediately after upgrading (the union
  absorbs render jitter); genuinely new reviews (≤30 days) still alert.
