# Session Summary — Rother v0.3.2 → Harvest-Honest Core
**Period:** 2026-08-22 → 2026-08-25 · **Branch:** `test/m15-1-validation`
**Commits:** `769e5e7` (v0.3.2, tagged) · `a8c2de9` (smoke hardening) · `d562b86` (harvest honesty)

This document indexes everything accomplished across the session's three
major efforts, with pointers to the authoritative per-topic docs.

---

## Effort 1 — v0.3.2: Self-Monitoring Fix (2026-08-22/24)

**Problem:** adding competitors via onboarding silently disabled scraping of
the user's own business (Crate Cafe) — "you vs. them" lost its "you" half.

**Fix:** `withSelfEntry()` read-time synthesis — the active business is
always a scrape target (never persisted; geo-stats keep raw branches).
UI: "Your business"/YOU badges.

**Proven:** live `success=2/2` (crate-cafe 380→650 reviews captured);
vitest 115; Playwright 16 (2 new invariant tests).
Docs: `SELF_MONITORING_AUDIT_2026-08-22.md` + `_FIX_PLAN.md`.

## Effort 2 — Systems Hardening (2026-08-24)

**Problems found & fixed:**
1. **Rate limiter starved the product** — middleware capped 20 req/min/path;
   the dashboard's own polling tripped 429s that parsed as "no data"
   (contributed to user's "data doesn't show up" sessions). Raised → 120.
2. **10 routes joined against the seed demo set** — /api/reviews branch
   filter returned ZERO rows for the user's own branch (user screenshot);
   sweep found 9 more (alerts, new-reviews, correlation, history×3,
   exports×3). All now go through `resolveMonitoredConfig()`.
   `configSource` field + "Demo dataset" TopBar badge added.
3. **Data "loss"** was a failed restore (truncated command + nested backup);
   real data recovered from `rother_backup_*/data/`.
4. **E2E flake** — three stacked causes: Google link throttling (→ offline
   `/api/places` mock), toast-vs-React-commit race (→ committed-item wait),
   and the rate limiter itself.

**Proven:** true-clean-start walkthrough (5 checkpoints); vitest 119;
Playwright 16/16 ×2 + repeat-each 42/42.
Docs: `SYSTEMS_AUDIT_2026-08-24.md` + `_FIX_PLAN.md`, runbook guards.

## Effort 3 — Harvest Honesty + Variance-Proof Deltas (2026-08-24/25)

**User question:** "Crate Cafe shows 5,000+ reviews on Google; Rother gets
~500. Is there a cap?"

**Audit verdict:** NO Rother cap (MAX_SCROLLS=400). The ceiling is **Google's
virtualized panel** stopping card delivery. But Rother had two real defects:
(a) completeness was invisible (degraded aggregate probe), (b) render-depth
jitter manufactured phantom alerts (240 "new" in 20 minutes — 100% phantom).

**Fixed:**
1. Aggregate rating/count extracted PRE-tab (was extracted after the
   overview text left the DOM). `classify_harvest()` → `harvest_status`
   (full/reduced/unknown) persisted into run_summary + snapshot sidecars.
   Live: crate-cafe **520 of 5,281 (reduced)**; revolver **8,435** true total.
2. `storage/seen_store.py`: ever-seen ID union + 30-day recency gate +
   first-harvest flood suppression. Two consecutive live runs: **0 phantom
   "new"** (was 240/run); 70 deeper-render discoveries correctly silent.
3. Dashboard: "Partial window" badge + "of ~N on Google" on cards and
   detail sheet.

**Proven:** verify_baseline 159/159 · vitest 119/119 · Playwright 16/16.
Docs: `HARVEST_AUDIT_2026-08-24.md` + `HARVEST_FIX_PLAN.md`, 4 phase reports.

---

## Current test floor

| Suite | Count |
|---|---|
| verify_baseline | 159/159 |
| verify_notifications | 25/25 |
| verify_variant_framework | 32/32 |
| vitest | 119/119 |
| Playwright | 16/16 (42/42 under repeat-each stress) |
| tsc / eslint | 0 / 0-0 |

## Known limitations (documented, accepted)

- Harvest window ≈ newest 410–650 of Google's true total (platform
  virtualization; now honestly labeled in UI + metadata).
- Snapshot totals fluctuate with render depth; the ever-seen union keeps
  delta/alert correctness independent of that.
- Real webhook/email delivery unproven in production; GitHub Actions
  execution unproven; `hours_status` semi-stable (5/12).
- Dev-toolchain npm advisories only; node 22.11 vs ^22.13 warning;
  middleware→proxy rename pending.

## What's next

1. **Tauri desktop revival — now UNBLOCKED** (the gate was: honest core
   first). Requires a fresh plan: archived 2026-08-13 plan is stale
   (scraper/tenant-data assumptions changed). Key decisions: embedded
   Python+Chromium strategy vs first-run download, tenant data dir →
   app-data, installer size budget.
2. Optional polish: middleware→proxy rename, node upgrade, `npm audit fix`.
