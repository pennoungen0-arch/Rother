# AGENTS.md — Rother (GBP Monitor) agent reference

State/version knowledge for AI agents (and humans) working on this repo.
**Last updated: 2026-08-17.** For full detail see
`gbp-monitor/CHANGELOG.md`, `gbp-monitor/docs/engineering/PROJECT_SUMMARY.md`,
`gbp-monitor/docs/engineering/CURRENT_STATE_2026-08-13.md`, and
`docs/engineering/ROTHER02_ANALYSIS.md` (v1-vs-v2 reference).

---

## Project identity

- **Name:** Rother — Competitor Review Monitor (package name `rother`, version `0.2.0`).
- **What it is:** a self-hosted, zero-cost monitor for competitor Google
  Business Profile reviews. Live Python scraper + Next.js dashboard.
- **Branch:** `test/m15-1-validation`. **Latest commit:** `f7fbdec`
  (2026-08-17, "feat: first-run polish"). **31 commits total.**
- **Roadmap status:** ALL 8 productization milestones are DONE (stale-NID
  guard, new-reviews dashboard, genericize+onboarding, proactive alerts,
  selector certification re-run, business-info retrieval, first-run polish).
  No open roadmap items remain.
- **Two versions exist:** this repo's `src/`+`gbp-monitor/` is v1
  (multi-competitor monitoring, proven/certified pipeline, tabbed dashboard);
  `rother02/` is v2 (single-business UX-first rewrite: login → onboarding →
  run gate → 4 hubs, 28 lazy features, Cmd+K palette, geo-grid, discovery;
  Tauri scaffold). Full reference: `docs/engineering/ROTHER02_ANALYSIS.md`.
  v1 = proven pipeline; v2 = superior UI/UX. They complement each other.
- **Active convergence plan:** `docs/engineering/CONVERGENCE_PLAN.md` — hybrid
  approach: Phase 1 ports v2 shell (hubs, palette, 28 features) onto v1's
  certified scraper + multi-competitor model; Phase 2 adds optional onboarding
  + discovery. `rother02/` will be archived once migration starts.

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
├── src/                  # Next.js 16 dashboard (App Router, shadcn/ui, Recharts)
│   ├── app/api/          # overview, branches, reviews, new-reviews, alerts, config/...
│   ├── components/dashboard/
│   └── lib/gbp/          # server-data.ts, types.ts, format.ts
├── prisma/               # SQLite scaffold only — NOT used by dashboard runtime
├── rother02/             # v2 (untracked, to be archived) — see docs/engineering/ROTHER02_ANALYSIS.md
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
| `npx vitest run` | 77/77 | 4 files |
| `npx tsc --noEmit` | 0 `src/` errors | `rother02/` errors are pre-existing; dir is excluded/ignored |
| `npx eslint src` | exit 0 | |

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

- **`rother02/` is v2 — keep, don't commit, don't treat as regressions.** It is
  intentionally in-repo as the second (UX-first) version; its `tsc` errors are
  pre-existing and excluded from v1's checks. `imagetest/` is a leftover
  screenshot artifact (ignore). See `docs/engineering/ROTHER02_ANALYSIS.md`.
  - Run v2: `cd rother02 && npm install && npm run dev` (port 3000 conflicts
    with v1). Windows fix (2026-08-17): `lightningcss-linux-x64-gnu` moved to
    `optionalDependencies` in `rother02/package.json`.
  - **Migration target:** `rother02/` will be archived once Phase 0 of
    `docs/engineering/CONVERGENCE_PLAN.md` starts (copy shell to `src/`,
    merge deps, delete `rother02/`).
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

## Known UNPROVEN items (do not claim done)

- Live delivery to a real external webhook/email (no credentials configured;
  transport layer proven via local server + stub).
- GitHub Actions execution (workflows verified by construction only).
- `hours_status` full coverage (see above).

## When to update this file

Update the "Last updated" line and the version/commit/state bullets whenever a
milestone lands, a test count changes, or a rule/convention changes. Keep it a
terse pointer — the authoritative detail lives in CHANGELOG.md and CURRENT_STATE.