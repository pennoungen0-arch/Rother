# Release Notes — Rother v0.3.0

**Released:** 2026-08-22 · Tag `v0.3.0` at `1ef5c78` on `test/m15-1-validation`
**Theme:** The Discovery-First Product — paste a Google Maps link, get monitored competitor intelligence.

---

## The Story of This Release

This release took Rother from a fixed-config dashboard to a link-driven
product, then through a hard audit that caught three integration bugs no test
had seen, and ended fully green and committed.

### Act 1 — Audit honesty (Phase A recheck)
A claimed-complete Phase A was re-audited and found **broken**: the landing
"Continue" button never signed the user in, the seed place was written to
sessionStorage nothing read, short links failed to resolve names/place_ids,
and smoke tests only covered the error path — so "3/3 passing" proved nothing.
Five bugs were found and fixed; the end-to-end discovery flow was verified for
the first time.

### Act 2 — Build the vision (Phases B, C, D)
- **B:** Onboarding Step 3 (competitor management) + Start Monitoring +
  Config-hub CRUD.
- **C:** Scheduler (`schedule.json` ↔ `/api/schedule` ↔ UI ↔ `run_all.py
  --schedule`) + per-competitor refresh buttons + `--competitors` CLI filter.
- **D:** Sonner toasts, loading states, empty states, mobile viewport tests,
  full discovery-flow e2e.

### Act 3 — Real-world testing exposes reality
First real user run surfaced: Turbopack EBUSY lockups, an orphaned localhost,
`playwright` not on PATH, "Scrape failed — Python exited with code 2", and the
big one — **only KPIs rendered; reviews never appeared**.

### Act 4 — Root causes, not patches
Audits traced the failures to true roots:
1. `scrape-runner.ts` passed argv flags Python never defined (`--business`,
   `--max-reviews`) → argparse exit code 2.
2. Python ignored `ROTHER_DATA_DIR` entirely — the dashboard read
   `data/users/{id}/` while the scraper wrote to root `data/`. Reviews existed;
   they were in another directory.
3. A nested `<button>` inside `<button>` broke React hydration in the
   branches view.
All fixed properly (no suppression), plus a RunScreen regression repaired to
honor its design contract: *a scrape failure must NEVER block navigation*.

### Act 5 — Completion plan executed
Phases 0–5: data restore discipline, the one remaining functional gap
(partial-run wiring), test debt (baseline finally 132/132; stale suite
deleted; scheduler e2e added), lint to 0/0, docs synced per Rule 2, two clean
commits, tagged.

---

## Features Shipped

| Feature | Where |
|---------|-------|
| Paste-link entry resolving every Google Maps URL shape (short links via redirect-follow + name extraction + hex-CID→ChIJ conversion; `query_place_id=`; full place URLs) | Landing → `/api/places` |
| Link validation preview with real business name + ChIJ place_id | Login screen |
| Seed handoff: validated place pre-fills onboarding | sessionStorage contract |
| 3-step onboarding: business → branches → competitors (add/remove/verified badge) | Onboarding |
| Start Monitoring: persists `user-business.json` (tenant config) + triggers first scrape | Onboarding → `/api/scrape/trigger` |
| Tenant-scoped runtime data isolation | `data/users/{businessId}/` via `ROTHER_DATA_DIR` |
| Scrape progress bar + completion/failure toasts (background watcher) | RunScreen |
| Scheduler UI: enable toggle, interval select (6/12/24/48h), next/last run, run-now | Tools › Configuration ↔ `/api/schedule` ↔ `run_all.py --schedule` |
| Per-competitor ⟳ Refresh = genuine partial scrape (`--competitors`, sanitized; honest filtered progress denominator) | Leaderboard + Branches cards |
| Competitor CRUD in Config hub (discovery mode) | Tools › Configuration |
| Mobile-responsive flows verified by dedicated viewport project | Playwright |

---

## Problems Found & Fixed (full catalog in TROUBLESHOOTING.md)

| # | Problem | Root cause class |
|---|---------|------------------|
| 1 | Short Google Maps link unresolved | Missing name/CID extraction + 4s redirect timeout |
| 2 | No data after onboarding | Async scrape vs. immediate expectation (UX + later real path bug) |
| 3–4 | Playwright missing / CLI not on PATH | Setup + Windows PATH semantics |
| 5 | Large listings slow (Seniman ~500 reviews) | Inherent scroll+expand cost; mitigations documented |
| 6 | Dashboard empty until scrape completes | Design clarified; later made honest via watcher |
| 7–8 | Redirect timeout variants | `FETCH_TIMEOUT_MS` 4s→10s |
| 9 | **Python exited with code 2** | Nonexistent argv flags from Node runner |
| 10 | Hubs blocked during scrape | Regression vs. navigation contract — restored |
| 11 | Turbopack EBUSY on dev start | Windows file-lock lifecycle |
| 12 | Orphaned localhost:3000 | Detached node.exe; netstat→taskkill procedure |
| 13 | **Reviews never render after successful scrape** | `ROTHER_DATA_DIR` implemented nowhere + wrong summary path + nested-button hydration error |
| 14 | Tracked production data shows deleted after test wipes | Pre-ignore tracked files; restore decision record |

---

## Verification Evidence

```
Dashboard   vitest 103/103 · tsc 0 errors · eslint 0 errors/0 warnings · build ✅
E2E         playwright 12/12 — smoke 10 (Desktop+Mobile incl. discovery flow,
            KPI live data) + scheduler 2 (toggle & interval persist via API)
Scraper     baseline 132/132 (first fully-green run; assertion now filter-aware)
            notifications 25/25 · variant framework 32/32
Live        tenant-dir spawn test; partial scrapes success=1 ("1 / 1") and =2
            ("2 / 2"); overview dataStatus ok w/ real review text; 0 fallback
            warnings in dev log
Security    secrets scan clean; creds-bearing configs gitignored
```

## Commits

| SHA | Subject |
|-----|---------|
| `4b56451` | feat: discovery-first complete — tenant-scoped scraping, scheduler, partial-run refresh (25 files, +1776/−679) |
| `1ef5c78` | docs: phase A-D reports, troubleshooting catalog, full audit; sync AGENTS/README/plan (15 files, +2721) |

Tag: **`v0.3.0`** (annotated).

---

## Deferred (conscious decisions, recorded)

- Parallel scraping (rate-limit risk) — COMPLETION_PLAN.md
- Real webhook/email credentials — delivery logic proven via stubs only
- GitHub Actions execution — no git remote configured
- `hours_status` selector coverage (5/12 businesses)
- Multi-tenant auth, PWA, historical trend alerts

## Key Documents

| Doc | Purpose |
|-----|---------|
| `TROUBLESHOOTING.md` | 14 problems: symptoms → root cause → fix |
| `VERSION_AUDIT_2026-08-22.md` | Full audit + scorecard |
| `COMPLETION_PLAN.md` | The 5-phase finish plan (executed) |
| `PHASE_A/B/C/D_*_REPORT.md` | Per-phase implementation evidence |
| `DISCOVERY_FIRST_PLAN.md` | Original vision doc (status: ✅ implemented) |
| `TURBOPACK_WINDOWS_EBUSY_FIX.md` | Windows dev-server lock fix |
| `gbp-monitor/CHANGELOG.md` | Rule-2 log, newest-first |
