# AGENTS.md — Rother (GBP Monitor) agent reference

State/version knowledge for AI agents (and humans) working on this repo.
**Last updated: 2026-08-19.** For full detail see
`gbp-monitor/CHANGELOG.md`, `gbp-monitor/docs/engineering/PROJECT_SUMMARY.md`,
`gbp-monitor/docs/engineering/CURRENT_STATE_2026-08-13.md`, and
`docs/engineering/ROTHER02_ANALYSIS.md` (v1-vs-v2 reference).

---

## Project identity

- **Name:** Rother — Competitor Review Monitor (package name `rother`, version `0.2.0`).
- **What it is:** a self-hosted, zero-cost monitor for competitor Google
  Business Profile reviews. Live Python scraper + Next.js dashboard.
- **Branch:** `test/m15-1-validation`. **Latest commit:** `609700a`
  (2026-08-19, "docs: defer GitHub Actions verification (no remote configured)"). **51 commits total.**
- **Roadmap status:** ALL 8 productization milestones are DONE (stale-NID
  guard, new-reviews dashboard, genericize+onboarding, proactive alerts,
  selector certification re-run, business-info retrieval, first-run polish).
  No open roadmap items remain.
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
├── src/                  # Next.js 16 dashboard (v2 shell: AppShell, hubs, 28 features, palette)
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
| `python -m tests.verify_baseline` | 132/132 | **WIPES `data/`** — back it up first, restore after |
| `python -m tests.verify_notifications` | 25/25 | local HTTP server + stubbed SMTP |
| `python -m tests.verify_variant_framework` | 32/32 | offline variant classifier |

From repo root:

| Command | Count | Notes |
|---|---|---|
| `npx vitest run` | 103/103 | 8 files (src/lib/gbp + lib); archive + e2e excluded |
| `npx tsc --noEmit` | 0 errors | `rother02-archive/` excluded via tsconfig |
| `npx eslint src` | exit 0 | 0 errors, 4 pre-existing warnings |
| `npm run test:e2e` | 30/30 | Playwright (smoke 2 + per-feature 28) — needs `npm run dev` running + committed production data |

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
  covers per-feature e2e (28 features), type consolidation, and UNPROVEN items
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

- Live delivery to a real external webhook/email is now PROVEN (webhook.site + Ethereal test account, 2026-08-19); no production credentials configured for real-world delivery.
- GitHub Actions execution (workflows verified by construction only; no git remote configured — deferred, see POST_CONVERGENCE_PLAN).
- `hours_status` full coverage (5/12 businesses render it; canonical source is the weekly `opening_hours` table).

## When to update this file

Update the "Last updated" line and the version/commit/state bullets whenever a
milestone lands, a test count changes, or a rule/convention changes. Keep it a
terse pointer — the authoritative detail lives in CHANGELOG.md and CURRENT_STATE.