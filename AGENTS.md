# AGENTS.md — Rother (GBP Monitor) agent reference

State/version knowledge for AI agents (and humans) working on this repo.
**Last updated: 2026-09-06T20:00:00+07:00 (v0.4.2 + Tauri audit fixes).**
For full detail see `gbp-monitor/CHANGELOG.md`,
`gbp-monitor/docs/engineering/PROJECT_SUMMARY.md`,
`gbp-monitor/docs/engineering/CURRENT_STATE_2026-08-13.md`, and
`docs/engineering/ROTHER02_ANALYSIS.md` (v1-vs-v2 reference).
**Planning docs:** `DISCOVERY_FIRST_PLAN.md` (✅ implemented — see phase reports),
`VERSION_AUDIT_2026-08-22.md`, `DISCOVERY_DATAFLOW_AUDIT/FIX_PLAN.md`
(✅ v0.3.1 seam fixes), `SELF_MONITORING_AUDIT_2026-08-22.md` +
`SELF_MONITORING_FIX_PLAN.md` (✅ v0.3.2 self-monitoring fix),
`SYSTEMS_AUDIT_2026-08-24.md` + `SYSTEMS_FIX_PLAN.md` (✅ rate-limit fix,
11-route tenant-scoping sweep, configSource provenance, e2e hardening —
see phase-reports/systems-*.txt), `HARVEST_AUDIT_2026-08-24.md` +
`HARVEST_FIX_PLAN.md` (✅ v0.3.3 harvest honesty + variance-proof deltas),
`SESSION_SUMMARY_2026-08-25.md` (session index),
`SCREENSHOT_ANALYSIS_2026-08-27.md` (full 46-screenshot review),
`SOLIDIFICATION_PLAN_2026-08-27.md` (✅ Phase 1-4 + Phase 7-8 bug fixes complete),
`TAURI_SCRAPING_ANALYSIS_2026-09-05.md` (Tauri scraping system audit + copy-logs + enhanced logging),
`GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md` (GMB Everywhere feature analysis → Rother comparison table + startup banner),
`GMB_INSPIRED_IMPROVEMENT_PLAN.md` (✅ all 5 phases complete),
`CORE_SYSTEMS_AUDIT_2026-09-05.md` (full pipeline audit: 3 RED + 7 YELLOW + 6 GREEN failure modes),
`CORE_SYSTEMS_FIX_PLAN.md` (✅ Phase 1-3 complete: RED fixes → YELLOW fixes → UI/UX fluidity).
Ops: `CLEAN_START_RUNBOOK.md` + `TROUBLESHOOTING.md` + `PRODUCTION_SETUP.md`.
Releases: `RELEASE_NOTES_v0.3.0/1/3.md`.
Session summaries: `SESSION_SUMMARY_2026-08-25.md`, `SESSION_SUMMARY_2026-08-27_PART2.md`.

---

## Project identity

- **Name:** Rother — Competitor Review Monitor (package name `rother`, version `0.2.0`).
- **What it is:** a self-hosted, zero-cost monitor for competitor Google
  Business Profile reviews. Live Python scraper + Next.js dashboard.
- **Branch:** `test/m15-1-validation`. **Latest commit:** `0bfd4db` (fix: S1 config persistence + S6 review sorting + S3 newest-sort harvest). **Tag: `v0.3.1`.** Working tree has uncommitted v0.4.0 solidification + bug fix changes. **Tag: `v0.2.0`** at `ac5f70b` (converged HEAD, 52 commits). **Tag: `v0.3.3`** (latest). **Post-v0.4.0 panel collapse fix (2026-08-29T14:54:13+07:00, commit `b6e2228`):** after `click_newest_sort`, the Google Maps reviews panel collapses and the tab strip disappears, making re-expansion impossible. Fixed by skipping the sort when the panel collapses (proceeding with default ordering) and re-navigating + re-resolving the container selector in the scroll phase. 7 businesses tested: all went from 0 → 121-988+ reviews.
- **Roadmap status:** ALL 8 productization milestones DONE + **Discovery-first
  product vision (Phases A–D) IMPLEMENTED & VERIFIED (2026-08-22)** + **v0.3.2
  self-monitoring fix (2026-08-24)**: the active business itself is always a
  scrape target via read-time `withSelfEntry()` synthesis (never persisted;
  geo-stats consumers keep raw branches) — adding competitors no longer
   silently disables main-cafe monitoring. Live-proven: crate-cafe 380 reviews
   scraped alongside revolver-seminyak, `success=2/2`. Discovery-first flow:
   paste Google Maps link → validate (short links, place URLs,
  `query_place_id=``,
  hex-CID→ChIJ conversion) → onboarding prefill → manual competitor add →
  Start Monitoring; scheduler UI (`/api/schedule` ↔ `schedule.json` ↔
  `run_all.py --schedule`) and per-competitor Refresh buttons (trigger route →
  `--competitors` passthrough, sanitized). Live scraping fix (2026-08-20):
  real place_ids for 3 Indonesian businesses (Crate Cafe Canggu, Revolver
  Seminyak, Seniman Coffee Studio); certified selectors work. **Tenant-scoped
  data writes (2026-08-22):** dashboard-spawned Python runs honor
  `ROTHER_DATA_DIR=data/users/{businessId}` — snapshots/deltas/run_summary/
  run.log isolated per business; lock file + NID jar stay global at root.
  **v0.3.1 seam fixes (2026-08-22):** competitors persist even when onboarding
  Step 2 is skipped; discovery scrapes derive targets from tenant config via
  `effective_listings.json` + `ROTHER_LISTINGS_PATH` env (root listings.json
  untouched in discovery mode); honest 422 on zero competitors; concurrent-run
  detection in RunScreen. **Systems hardening (2026-08-24):** middleware rate
  limit raised 20→120 req/min/path (old cap starved dashboard polling and
  429s parsed as "no data"); ALL read routes join via
  `resolveMonitoredConfig()` (11 routes swept off direct `readListings()` —
  /api/reviews branch filter, alerts, new-reviews, correlation, history×3,
  exports×3); `configSource` field + "Demo dataset" TopBar badge in fixed
  mode; e2e offline-deterministic with `expect.poll` server assertions.
  **Harvest honesty + variance-proof deltas (2026-08-25):** aggregate
  rating/count extracted PRE-tab (post-tab probe ran after the overview text
  left the DOM); `classify_harvest()` emits `harvest_status`
  (full/reduced/unknown) + Google's aggregate into run_summary + snapshot
  metadata; deltas diffed against a per-competitor **ever-seen ID union**
  (`storage/seen_store.py`) with a 30-day recency gate — render-depth jitter
  can no longer manufacture phantom "new" alerts (was 240/run; now 0 across
  consecutive live runs); backfill discoveries merge silently; dashboard
  shows "Partial window" badge + "of ~N on Google". The ~500-review ceiling
  is Google's virtualized panel, NOT a Rother cap (MAX_SCROLLS=400). See
  `HARVEST_AUDIT_2026-08-24.md` + `HARVEST_FIX_PLAN.md`.
- **Convergence status — Phase 3 hardening DONE (2026-08-19):** `src/` is
  the **v2 shell** (AppShell, 4 hubs, 28 lazy features, Cmd+K palette, geo-grid,
  Bali oklch design system) on v1's certified pipeline, with a **monitoring mode
  selector** (`fixed` = v1 competitor-list model, default; `discovery` =
  v2 single-business + onboarding). Fixed mode skips Onboarding, POSTs
  `/api/scrape/trigger` with an empty body (no `user-business.json`), and the
  single-business invariant in `readListings()` was removed. Phase 2 closed the
  fixed-mode data gaps: `/api/overview` derives the v2 runSummary contract
  (`status`/`reviewCount`/`targetCount`) from v1 run_summary; `/api/competitive-health`
  no longer 409s (tenant-scoped, config-list fallback); c-competitive-health and
  c-discover gate their discovery UI by mode. Phase 3 hardening: vitest
  **34 → 103 tests** (new `run-summary`/`sanitize`/`validate`/`geocode`/`format`/
  `categories`/`app-mode` suites), **Playwright e2e** smoke spec (login → run →
  hubs → feature data) passing against dev server, `prefers-reduced-motion`
  in `globals.css`, and a **`dashboard` CI job** (tsc/vitest/eslint/build).
  Post-convergence hardening DONE: types consolidated into `src/lib/gbp/types.ts`
  (zero duplicates outside it) and a full **per-feature Playwright e2e**
  (`e2e/features.spec.ts`, 28 features across all 4 hubs + smoke) proves every
  feature renders real data (`npm run test:e2e` 30/30). `gbp-monitor/` untouched.
  `rother02/` archived → `rother02-archive/` (untracked, excluded from
  build/test). Reference: `docs/engineering/CONVERGENCE_PLAN.md` +
  `ROTHER02_ANALYSIS.md`.
- **UX consolidation (v0.4.0, 2026-08-27)**: 28 → 25 features via three merges:
  Run Health + Run History + Run Comparison + Run Logs → **Runs** (tabbed);
  Reviews over Time + Recency Heatmap → **Reviews over Time** (timeline/heatmap
  toggle); Today composite added as default landing screen. Hubs now show
  **Pinned** features first, then **More analytics**. See
  `UX_AUDIT_2026-08-26.md` + `SOLIDIFICATION_PLAN_2026-08-27.md`.
- **Post-v0.4.0 bug fixes (2026-08-27):** Today back button fixed (`back()` now
  sets `showToday: false` instead of unused `showHubs: true`); rating filter
  buttons wrap within card instead of overflowing; FeaturePage header gets
  `bg-background` + `shrink-0` to prevent content bleed-through during scroll.
  **Harvest fix (2026-08-27):** initial viewport now harvested BEFORE the first
  scroll in `scroll_review_container()` — newest reviews no longer missed after
  a "Terbaru" sort (the old loop scrolled to bottom first, virtualizing the top
  cards before capture). **Trigger UI fix (2026-08-27):** Config "Run scan again"
  and Scheduler "Run now" now poll `/api/scrape/status` and show live progress +
  completion toast (the API always worked; the UI gave zero feedback, making it
  appear broken). **Trigger stuck-state fix (2026-08-27):** `hasActiveRun()` now
  verifies the process is actually alive via `process.kill(pid, 0)` — dead/orphaned
  processes are auto-marked "failed" so they don't block future triggers. Added
  `DELETE /api/scrape/stop` endpoint + red "Stop" button in Config and Scheduler
  UIs. **Reviews sort fix (2026-08-27):** `/api/reviews` now sorts by resolved
  review DATE (not `scraped_at`), so recently posted reviews appear at the top
  regardless of when they were scraped. **Header Refresh button (2026-08-27):**
  TopBar now has a "Refresh" button (with refresh icon) between "Hubs" and
  user info — one-click access to trigger scraping without navigating menus.
  Button toggles to red "Stop" while scraping, polls status every 3s, shows
  completion toast. **Duplicate place_id detection (2026-08-27):** `addCompetitor`
  now detects when a competitor points to the same Google Maps place as an
  existing competitor or the active business — shows warning instead of silently
  adding duplicate. **Stale branches fix (2026-08-27):** `persistUserBusinessLight`
  now detects business name change and regenerates ID + clears old branches,
  preventing stale branches from persisting across business changes. **Panel
  expand fix (2026-08-27):** `click_newest_sort` now waits for the reviews panel
  to fully expand (scrollHeight > 1000px) after sorting — previously the scroll
  phase started against a collapsed panel (height=584px, 0 cards), harvesting
  0 reviews. `scroll_review_container` also detects collapsed panel and re-opens
  the reviews tab if needed. **Panel expand fix Part 2 (2026-08-29):** Changed
  from waiting for the panel to expand on its own to actively clicking the
  reviews tab again if the panel is collapsed after sorting — waiting alone
  didn't work because the panel never expands without user interaction. Test
  counts: vitest 119/119, Playwright 20/20, verify_baseline 163/163.

## Repo layout

```
.
├── gbp-monitor/          # Python scraper (Playwright + Parsel)
│   ├── orchestration/    # run_all.py — the ONLY place that loops branches × competitors
│   ├── harness/          # capture.py (probes, _JS_OVERVIEW_PROBE), scroll.py, storage_state warm-up
│   ├── parser/           # schema.py (Review), relative_date.py, reviews.py
│   ├── storage/          # snapshot_store.py, delta_store.py
│   ├── notifications/    # notifier.py (webhook + SMTP; never raises)
│   ├── config/           # listings.json, selectors.json (+ .example.json), notifications.example.json
│   ├── data/             # snapshots/, reviews_new/, run_summary.json, run.log (partly gitignored)
│   ├── tests/            # verify_baseline.py, verify_notifications.py, verify_variant_framework.py, fixtures/
│   └── docs/engineering/ # CURRENT_STATE, SELECTOR_CERTIFICATION, PROJECT_SUMMARY, DOM_AUDIT...
├── src/                  # Next.js 16 dashboard (v2 shell: AppShell, hubs, 25 features, palette)
│   ├── app/api/          # 29 routes (v1 core + new-reviews + v2: geo-grid, discover, competitive-health...)
│   ├── components/shell/ # AppShell, LoginScreen, Onboarding, RunScreen, Hub, SectionView, FeaturePage
│   ├── components/dashboard/
│   ├── features/         # i-*, r-*, c-*, t-* lazy feature pages
│   └── lib/gbp/          # server-data.ts, types.ts, format.ts, use-api-query.ts
├── prisma/               # SQLite scaffold only — NOT used by dashboard runtime
├── rother02-archive/     # v2 reference (untracked, excluded from build/test) — see CONVERGENCE_PLAN.md
├── docs/                 # repo-level docs (engineering/, product/, management/...)
│   └── engineering/
│       ├── CONVERGENCE_PLAN.md    # active migration strategy (v1 scraper + v2 shell)
│       └── ROTHER02_ANALYSIS.md   # v1-vs-v2 reference
├── .zscripts/            # Unix-only deploy scripts (dev.sh/build.sh/start.sh)
└── README.md
```

## How to run

```powershell
# Dashboard (repo root) — dev server on :3000
npm install
npx prisma db push
npm run dev

# Scraper (MUST run from gbp-monitor/ — paths are cwd-relative)
cd gbp-monitor
pip install -r requirements.txt        # playwright, parsel, requests
playwright install chromium
python -m orchestration.run_all --init-config      # scaffold configs from examples (optional)
python -m orchestration.run_all --validate-config  # check listings.json + selectors.json
python -m orchestration.run_all --fixtures         # offline end-to-end (no browser)
python -m orchestration.run_all                    # live scrape (needs Playwright + real place_ids)
python -m orchestration.run_all --verify           # live verification -> data/verify/<ts>/
```

## Tests — must stay green (Rule 1)

Run from `gbp-monitor/`:

| Command | Count | Notes |
|---|---|---|
| `python -m tests.verify_baseline` | 163/163 | **WIPES `data/`** — back it up first, restore after. Includes Phase 7 harvest-classification + Phase 8 seen-store suites || `python -m tests.verify_notifications` | 25/25 | local HTTP server + stubbed SMTP |
| `python -m tests.verify_variant_framework` | 32/32 | offline variant classifier |

From repo root:

| Command | Count | Notes |
|---|---|---|
| `npx vitest run` | 119/119 | 9 files (src/lib/gbp + lib, incl. self-target); archive + e2e excluded |
| `npx tsc --noEmit` | 0 errors | `rother02-archive/` excluded via tsconfig |
| `npx eslint src` | exit 0 | 0 errors, 0 warnings |
| `npx playwright test` | 20/20 | Smoke (10) + Scheduler (2) + Discovery-persistence (4, incl. self-monitoring invariants ×2) + Config-persistence (4). Needs `npm run dev` running. `features.spec.ts` (28 stale tests) removed 2026-08-22 — superseded by smoke coverage |

> **IMPORTANT — `data/` backup discipline.** `tests/verify_baseline.py` deletes
> `data/`. Production data (12 competitors / 5,021 reviews in committed Aug-13
> snapshots) has been lost once this way. ALWAYS back up first:
> `Copy-Item data C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup -Recurse`
> and restore with `Remove-Item -Recurse data; Copy-Item <backup> data -Recurse`.

## Hard rules (from gbp-monitor/EXECUTION_RULES.md)

- **Rule 1:** every change tested/proven before and after.
- **Rule 2:** every change logged in `gbp-monitor/CHANGELOG.md` (newest at top)
  with timestamp, files, reason, `PROVEN`/`UNPROVEN` status.
- **Rule 3:** no fabricated selectors — verify against real DOM first.
- **Rule 4:** zero cost — no paid APIs; avoid new dependencies (stdlib preferred).
- **Rule 7:** a broken listing/selector/notification NEVER crashes the run
  (failure isolation; notifier wraps everything in try/except).

## Working conventions / gotchas

- **`rother02-archive/` is the archived v2 reference — untracked, excluded from
  build/test (tsconfig, vitest, eslint ignores).** Do NOT commit it; do NOT treat
  its errors as regressions. `imagetest/` is a leftover screenshot artifact
  (ignore). See `docs/engineering/CONVERGENCE_PLAN.md` + `ROTHER02_ANALYSIS.md`.
- **Post-convergence hardening plan:** `docs/engineering/POST_CONVERGENCE_PLAN.md`
  covers per-feature e2e (25 features), type consolidation, and UNPROVEN items
  (webhook/SMTP, GitHub Actions, hours_status).
- **Python paths are cwd-relative** (`config/listings.json`, `data/...`). Always
  run Python from `gbp-monitor/`. Never `cd` via shell; use the tool's `workdir`.
- **Don't re-attempt DOM-impossible features** (Rule 3 evidence): owner replies
  and absolute review timestamps do NOT exist in this Maps variant. See
  `docs/engineering/CURRENT_STATE_2026-08-13.md` §7.
- **`hours_status`** is semi-stable (~5/12 businesses render it); the weekly
  `opening_hours` table (`table.eK4R0e`) is the canonical hours source.
- **Phone/website selectors (M18-corrected):** phone = `a[href^="tel:"]`;
  website = `a[data-item-id="authority"]`. The old
  `[data-item-id="telephone"]` / `[data-item-id="website"] a` matched nothing.
- **Selector truth:** `config/selectors.json` (schema v5), certified in
  `data/golden/selector_certification.json` (M18-20260817) and
  `docs/engineering/SELECTOR_CERTIFICATION.md`.
- **Dashboard config tab is hidden in "Client" mode** (`showConfigTab`);
  `/api/config/listings` PATCH validates via `validateBranchConfig`.
- Dev server log if needed: `C:\Users\HP\AppData\Local\Temp\opencode\rother_dev.log`.

## Known limitations / remaining UNPROVEN items

- Live delivery to a real external webhook/email is PROVEN (webhook.site + Ethereal test account, 2026-08-19); no production credentials configured for real-world delivery (`config/notifications.json` gitignored — scaffold via `--init-config`).
- GitHub Actions execution (workflows verified by construction only; no git remote configured — deferred, see POST_CONVERGENCE_PLAN).
- `hours_status` full coverage (5/12 businesses render it; canonical source is the weekly `opening_hours` table).
- Windows/Turbopack dev quirk: `.next` EBUSY after ungraceful kills — see `TROUBLESHOOTING.md` + `TURBOPACK_WINDOWS_EBUSY_FIX.md`.

## Recommended Audit Checklist (run before release)

| Audit | Command | Frequency |
|-------|---------|-----------|
| Secrets scan | `git grep -E "(api[_-]?key|secret|password|token).*=" -- "*.json" "*.py" "*.ts" "*.tsx" \| grep -v example` | Pre-release |
| Dead code | `npx ts-prune` (dashboard) / `vulture gbp-monitor/` (scraper) | Quarterly |
| Doc consistency | Diff AGENTS.md vs CHANGELOG.md vs POST_CONVERGENCE_PLAN.md | Pre-release |
| Dependency vulns | `npm audit` / `pip-audit` | Monthly |
| Test coverage | `npx vitest run --coverage` (dashboard) / `coverage run -m pytest` (scraper) | Quarterly |
| Data discipline | `git check-ignore gbp-monitor/data/run_summary.json` (must NOT be ignored) | Pre-release |
| Backup test | `Copy-Item data <tmp>; Remove-Item data -Recurse; Copy-Item <tmp> data -Recurse; python -m tests.verify_baseline` | Quarterly |

---

## When to update this file

Update the "Last updated" line and the version/commit/state bullets whenever a
milestone lands, a test count changes, or a rule/convention changes. Keep it a
terse pointer — the authoritative detail lives in CHANGELOG.md and CURRENT_STATE.