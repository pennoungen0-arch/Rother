# Rother — Completion Plan (Finish Everything)

**Created:** 2026-08-22
**Based on:** VERSION_AUDIT_2026-08-22.md findings
**Goal:** Take the current green-but-uncommitted build to a fully committed,
documented, release-ready v0.3.0 — plus close the small functional gaps found
during audit.

---

## Gap Analysis (what's actually left)

Discovered during audit — ordered by user impact:

| # | Gap | Severity | Source |
|---|-----|----------|--------|
| G1 | **Per-competitor Refresh buttons don't actually do partial scrapes** — UI posts `{competitor_ids}`, but `/api/scrape/trigger` ignores it and `scrape-runner.ts` never passes `--competitors` to Python | 🔴 Functional gap (Phase C promise unfulfilled) | Audit §5 trace |
| G2 | 49 tracked production-data deletions in working tree | 🟠 Repo safety | Problem 14 |
| G3 | Docs drift (AGENTS.md, DISCOVERY_FIRST_PLAN status) | 🟠 Release blocker | Audit §7 |
| G4 | Today's scraper fixes missing from `gbp-monitor/CHANGELOG.md` | 🟠 Rule 2 violation | EXECUTION_RULES |
| G5 | `e2e/features.spec.ts` — 28 broken tests using removed login flow | 🟡 Dead suite | Audit §6 |
| G6 | verify_baseline skipped-count assertion fails under filter | 🟡 Eternal 131/132 | FIX_PLAN Fix 6 |
| G7 | No e2e for Scheduler UI (Phase C) | 🟡 Coverage gap | Audit §6 |
| G8 | 6 pre-existing lint warnings | 🟢 Cosmetic | Audit §6 |
| G9 | `<img>` in PlaceConfirmCard | 🟢 Cosmetic | Audit §6 |

Everything else from earlier sessions is **done and verified** (Phases A–D,
tenant scoping, hydration fix, Turbopack doc, orphan-port doc).

---

## Phase 0 — Safety & Restore (10 min)

| Step | Action | Verify |
|------|--------|--------|
| 0.1 | Confirm backup intact: `Test-Path C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup` | `True` |
| 0.2 | `git restore gbp-monitor/data/` | `git status` shows 0 deletions |
| 0.3 | Re-run smoke e2e to confirm nothing broke | 10/10 |

> Note: restore re-points fixed-mode `latest.json` to Aug-13 data — expected;
> discovery mode (tenant dirs) unaffected; next scrape self-heals pointers.

---

## Phase 1 — Close Functional Gap G1 (~45 min)

**Wire `competitor_ids` end-to-end so Refresh buttons do real partial scrapes.**

| Step | File | Change |
|------|------|--------|
| 1.1 | `src/app/api/scrape/trigger/route.ts` | Accept `competitor_ids?: string[]` in TriggerBody; pass through to `scrapeRunManager.start(mode, competitorIds)` |
| 1.2 | `src/lib/gbp/scrape-runner.ts` | `start(mode, competitorIds?)`; when live + ids present → `args.push("--competitors", ids.join(","))` |
| 1.3 | Python side | Already supports `--competitors` (verified in Phase C) — no change |
| 1.4 | Test | CLI: fixtures+filter still works; API: POST `{competitor_ids:["comp-seminyak-01"]}` → summary shows success=1 |
| 1.5 | Gates | vitest/tsc/eslint/build |

---

## Phase 2 — Test Debt (~60 min)

| Step | Action | Detail |
|------|--------|--------|
| 2.1 | **Delete `e2e/features.spec.ts`** (G5) | Its 28 tests target the removed login flow and are excluded from runs anyway; smoke suite (10 tests incl. discovery flow + KPI live data) supersedes coverage. Record deletion rationale in commit message |
| 2.2 | **Filter-aware baseline assertion** (G6) | `tests/verify_baseline.py`: expect `skipped == 0` when config is the minimal 3-competitor listings.json; keep `== 9` only for the full 12-competitor fixture set — simplest: assert `skipped == total_competitors - processed_expected` or drop exact count, assert `>= 0` and consistency with summary. Target: 132/132 |
| 2.3 | **Scheduler e2e** (G7) | New spec `e2e/scheduler.spec.ts`: fixed-mode login → Tools hub → Scheduler card visible → toggle enabled → PATCH persisted (verify via GET /api/schedule) → interval select works |
| 2.4 | Full regression | vitest · tsc · eslint · build · all playwright · 3 python suites |

---

## Phase 3 — Lint Polish (15 min, optional but cheap)

| Step | File | Fix |
|------|------|-----|
| 3.1 | history-comparison-section.tsx:46 | Prefix unused param `_refreshKey` or remove prop |
| 3.2 | use-api-query.ts:3 | Drop unused React import |
| 3.3 | onboarding.tsx:93 | Delete stale eslint-disable directive |
| 3.4 | onboarding.tsx:352,417 | Remove `showManual` from dep arrays (or restructure guard) |
| 3.5 | PlaceConfirmCard.tsx:31 | `<img>` → `next/image` (unoptimized, external host allowlist check needed — if friction, leave + suppress with comment) |

Target: eslint 0 errors / 0–1 warnings.

---

## Phase 4 — Docs Sync (30 min, Rule 2 + release blocker)

| Step | Doc | Change |
|------|-----|--------|
| 4.1 | `gbp-monitor/CHANGELOG.md` (G4) | New top entry (2026-08-22): tenant-scoped data writes (`ROTHER_DATA_DIR` honored by run_all.py + snapshot_store.py), lock/jar stay global, log rotation/disk-check scoped — PROVEN via tenant-dir spawn test + overview dataStatus ok |
| 4.2 | `DISCOVERY_FIRST_PLAN.md` | Status → "✅ Implemented — Phases A–D complete (2026-08-22); see PHASE_*_REPORTS" |
| 4.3 | `AGENTS.md` | Update: version bullet (A–D done), repo layout (+schedule.json, /api/schedule, t-scheduler, TROUBLESHOOTING/audit docs), test table (e2e 10-test smoke; baseline counts), known-limitations refresh, "Last updated" date |
| 4.4 | README(s) | Add scheduler + refresh usage lines; link TROUBLESHOOTING.md |

---

## Phase 5 — Commit & Tag (20 min)

| Step | Action |
|------|--------|
| 5.1 | Stage deliberately (NO `git add -A` until Phase 0 confirmed): code fixes, new scheduler files, docs, .gitignore, e2e changes |
| 5.2 | Commit message: `feat: discovery-first complete — tenant-scoped scraping, scheduler UI, per-competitor refresh, hardening` (or split into 2–3 logical commits: fix/scrape-tenant-scope, feat/scheduler-refresh, docs/reports) |
| 5.3 | Tag `v0.3.0` at HEAD |
| 5.4 | Final `git status` → clean working tree |

---

## Definition of Done

- [ ] `git status` clean (no D, no ?? except intentionally ignored)
- [ ] All gates: vitest ✅ tsc ✅ eslint ≤1 warning ✅ build ✅ playwright ✅ python 132/132 + 25 + 32 ✅
- [ ] Refresh button performs a *partial* scrape (summary.success reflects filter)
- [ ] CHANGELOG documents today's scraper changes (Rule 2)
- [ ] AGENTS.md + plan status reflect implemented reality
- [ ] Tagged v0.3.0

## Explicitly NOT in scope (deferred, documented)

Parallel scraping · real webhook/SMTP credentials · GitHub Actions execution ·
hours_status selector coverage · multi-tenant auth · PWA.
(All recorded in VERSION_AUDIT §6 deferred table.)
