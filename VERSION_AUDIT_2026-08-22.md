# Rother — Full Version Audit

**Audit date:** 2026-08-22
**Version:** 0.2.0 (package) · Branch `test/m15-1-validation` · HEAD `a57c3f7`
**Scope:** Post Phase A–D + post-fix-session state (tenant-scoping fix, hydration fix, scrape-runner fixes)

---

## 1. Executive Summary

| Verdict | Detail |
|---------|--------|
| **Functional health** | 🟢 GOOD — all quality gates pass; the discovery-first flow is verified end-to-end **through the dashboard API** for the first time |
| **Repo hygiene** | 🟡 ATTENTION — 49 tracked data-file deletions pending restore decision; nothing committed yet (HEAD unchanged) |
| **Docs accuracy** | 🔴 STALE — AGENTS.md and DISCOVERY_FIRST_PLAN.md describe Phases A–D as "planned"; reality is implemented + fixed |

The critical data-path bug found earlier today (Python ignoring `ROTHER_DATA_DIR`) is confirmed **fixed and live-verified**: a dashboard-triggered scrape now writes to `data/users/crate-cafe/`, status resolves from the tenant summary, `/api/overview` returns `dataStatus: ok` with real review content, and zero fallback warnings appear in the dev log.

---

## 2. Quality Gates — All Green

| Gate | Result | Notes |
|------|--------|-------|
| `npx vitest run` | ✅ 103/103 | 8 files |
| `npx tsc --noEmit` | ✅ 0 errors | |
| `npx eslint src` | ✅ 0 errors / 6 warnings | All 6 pre-existing (see §6) |
| `npm run build` | ✅ Complete | 2 known Turbopack trace warnings (pre-existing, cosmetic) |
| `python -m tests.verify_baseline` | ✅ 131/132* | *1 expected fail: `skipped=9` assertion vs competitor-filter run — documented in FIX_PLAN.md |
| `python -m tests.verify_notifications` | ✅ 25/25 | |
| `python -m tests.verify_variant_framework` | ✅ 32/32 | |
| `npx playwright test e2e/smoke.spec.ts` | ✅ 10/10 | 5 Desktop + 5 Mobile |

**Secrets scan:** clean — no API keys/secrets/tokens in committed patterns.

---

## 3. Live Data-Flow Verification (the big one)

End-to-end check through the running dev server, not just CLI:

```
POST /api/scrape/trigger?mode=fixtures   → runId f8969181
GET  /api/scrape/status?runId=…          → completed, 3/3,
                                           summary read from TENANT dir ✓
Tenant dir contents verified:
  data/users/crate-cafe/
    ├── run_summary.json ✓  ├── run.log ✓
    ├── selector_report.json ✓  └── config_backups/ ✓
GET  /api/overview
  → branches: 1 · competitors: 1 · reviews: 20 · dataStatus: ok ✓
  → fallback warnings in dev log: 0 (was spamming before fix) ✓
GET  /api/reviews?competitor_id=comp-seminyak-01
  → 7 reviews, real content ("Hands down the best coffee shop…") ✓
e2e smoke re-run after all fixes          → 10/10 ✓
```

This closes the loop on the user-reported "only KPI shows up" issue.

---

## 4. Repo State

| Item | Count | Assessment |
|------|-------|------------|
| Modified | 24 | Code fixes (scrape-runner, run-screen, branches-section, onboarding, login-screen, places route, run_all.py, snapshot_store.py…) + docs — **all intentional, ready to commit** |
| Deleted | 49 | **All** under `gbp-monitor/data/` — the known Problem-14 situation. Backup exists at temp. Restore via `git restore gbp-monitor/data/` before committing |
| Untracked | 12 | 10 docs (PHASE_A–D reports, TROUBLESHOOTING, FIX_PLAN, etc.) + 2 source files (`src/app/api/schedule/route.ts`, `src/features/t-scheduler.tsx`) — all legit, should be committed |
| `.gitignore` | Updated this session | Now covers tenant dirs, notifications.json (creds), schedule.json (runtime state) |

**Commit-readiness:** code is green, but do NOT `git add -A` until the 49 deletions are resolved (restore recommended).

---

## 5. Architecture Snapshot (current)

```
Landing (paste link) ──► /api/places  [short-link expand + CID→ChIJ conversion]
        │               works: maps.app.goo.gl, place URLs, query_place_id=
        ▼
Onboarding (3 steps, seed prefill via sessionStorage)
        ▼
RunScreen ──► POST /api/scrape/trigger ──► Python (ROTHER_DATA_DIR=tenant dir)
   │              │                            writes snapshots/deltas/summary → tenant dir
   │              └─ fire-and-forget watcher ── poll status → progress bar + toast
   └─ startRun() immediately (hubs never blocked)
        ▼
Dashboard hubs ── read tenant dir ──► overview/reviews/health OK
Tools hub: competitor CRUD + Scheduler UI ↔ /api/schedule ↔ schedule.json
                                          ↔ run_all.py --schedule / --competitors
```

---

## 6. Known Issues & Debt (all non-blocking)

### Pre-existing ESLint warnings (6)
| Location | Warning |
|----------|---------|
| history-comparison-section.tsx:46 | unused `refreshKey` |
| PlaceConfirmCard.tsx:31 | `<img>` instead of next/image |
| onboarding.tsx:93 | unused eslint-disable directive |
| onboarding.tsx:352,417 | unnecessary `showManual` dep |
| use-api-query.ts:3 | unused React import |

### Test gaps
| Gap | Impact | Suggested fix |
|-----|--------|---------------|
| `e2e/features.spec.ts` (28 tests) still uses old login flow | Broken suite, excluded from runs | Rewrite its `setup()` to Advanced→Gmail flow, or delete if superseded by smoke coverage |
| verify_baseline skipped-count assertion | 131/132 forever | Make assertion filter-aware (FIX_PLAN.md Fix 6) |
| No automated e2e for Tools-hub scheduler UI | Phase C untested in Playwright | Add spec: toggle → PATCH /api/schedule → assert state |

### Deferred (per plan decisions)
| Item | Where recorded |
|------|----------------|
| Parallel scraping (perf) | FIX_PLAN.md — deferred, rate-limit risk |
| Real webhook/email credentials | UNPROVEN item; delivery logic tested via stubs only |
| GitHub Actions CI execution | No git remote configured |
| `hours_status` selector coverage (5/12) | SELECTOR_CERTIFICATION.md M18 |

### Repo hygiene pending
1. `git restore gbp-monitor/data/` — clear the 49 phantom deletions (Problem 14, backup exists)
2. Commit the session's work: ~24 modified + 12 untracked files (docs + scheduler feature)
3. AGENTS.md refresh (see §7)

---

## 7. Documentation Drift

| Doc | Status line says | Reality |
|-----|------------------|---------|
| `DISCOVERY_FIRST_PLAN.md` | "Planned - not yet implemented" | **Phases A–D complete** |
| `AGENTS.md` (updated 2026-08-20) | "Next: Discovery-first product vision (Phases A–D planned)"; e2e "30/30 features" | A–D done; e2e is now 10-test smoke (features.spec.ts broken/stale); new files: schedule.json, /api/schedule, t-scheduler.tsx, tenant-dir behavior, TROUBLESHOOTING.md |
| Phase A–D reports + TROUBLESHOOTING | n/a (new, accurate) | Should be committed |

Per repo convention (AGENTS.md "When to update this file"), a doc-sync pass should accompany the next commit.

---

## 8. Scorecard

| Dimension | Grade | Note |
|-----------|-------|------|
| Correctness | A− | All gates green; one expected-fail baseline assertion remains |
| Data integrity | B+ | Tenant scoping now correct & verified; root production-data deletions still unresolved in working tree |
| Test coverage | B | Strong unit + smoke; features.spec.ts stale; no scheduler e2e |
| Security | A | Secrets scan clean; creds-bearing configs gitignored; Rule 7 isolation intact |
| Docs | C | Implementation outpaced docs; sync needed before release |
| Hygiene | B | Nothing committed yet — single clean commit possible after restore |

**Overall: healthy, shippable local build. Two actions before any commit:
① `git restore gbp-monitor/data/` ② doc-sync pass (AGENTS.md + plan status).**
