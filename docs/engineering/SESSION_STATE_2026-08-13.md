# Session State Reference — Rother, as of 2026-08-13

> Single entry point for the next session: what exists, what was done, current git
> state, verification commands, and what is intentionally left uncommitted.
> Read this file (plus `gbp-monitor/docs/engineering/CURRENT_STATE_2026-08-13.md`)
> **before** extending anything.

---

## 1. Project overview

**Rother** = a zero-cost, no-AI competitor review monitoring tool. It scrapes
Google Business Profile (Google Maps) review data with Playwright and presents it
through a Next.js dashboard.

Two halves in one repo:

| Half | Location | Tech |
|------|----------|------|
| **gbp-monitor** | `gbp-monitor/` | Python + Playwright scraper, offline test suites, variant-framework |
| **Dashboard** | `src/` (repo root) | Next.js App Router, Vitest, npm |

See `gbp-monitor/docs/engineering/CURRENT_STATE_2026-08-13.md` (scraper detail,
M7/M8/GMBE parity) and `docs/engineering/ENGINEERING_BASELINE.md` (v0.2.0 baseline).

---

## 2. Git state (head of repo)

- **Branch:** `test/m15-1-validation` (working branch) — no remote configured.
- **Other branch:** `main` (older line, tip `5a87b8c`).
- **Tags:** `v0.2.0` → `afe1785` (annotated), `m15.1` → `ec3ee88` (annotated).
- **Relevant history (newest → oldest):**

```
afe1785  feat: release v0.2.0 dashboard hardening and cleanup   (tag v0.2.0)
9eb2c64  feat: complete M8 live acquisition pipeline and variant framework
b7b45de  Complete Phase 1 production hardening
ec3ee88  M15.1 Wave A+B1: Product identity and async update workflow  (tag m15.1)
5a87b8c  fix: replace threaded capture timeout w/ Playwright-native timeout  (main)
dc0502f  feat: implement cross-platform scraping pipeline and dashboard integration
472c428  <uuid> … 856ffde <uuid>   (15 accidental auto-commits)
bdb0468  Initial commit
```

- **UUID commits:** 15 auto-generated commits (message = UUID) sit between
  `Initial commit` and `dc0502f`. They carry real content (incl. `freshness-badge`,
  `live-clock`, `scrape-schedule`, `use-app-mode`). A squash was proposed and
  **cancelled by user** — history left untouched. Any future cleanup should squash
  only `bdb0468..472c428` into one clean `Initial commit` and re-point tags.

### Working tree: NOT clean — 32 items intentionally uncommitted

All remaining changes are **`gbp-monitor/data/` runtime churn** (26 deletions of old
timestamped snapshots + `reviews_new/`, 6 modified runtime JSON). These are scrape
run/test artifacts, **not source work**, and are deliberately left out of commits:

- `gbp-monitor/data/snapshots/{comp-canggu-01,comp-seminyak-01,comp-ubud-01}/*.json`
  deleted (old 2026-07-25/26 snapshots), `latest.json` modified
- `gbp-monitor/data/reviews_new/*.json` deleted
- `gbp-monitor/data/run_summary.json`, `selector_history.json`, `selector_report.json`
  modified (now reflect the 2026-08-13 fixture/live runs)

Everything else is committed.

---

## 3. Recent work completed (this session chain)

### a. gbp-monitor scraper — M8 + GMBE parity (commit `9eb2c64`)
- **harness/acquisition.py** — real-network acquisition, `NID` cookie warm-up,
  `data/storage_state.json` reuse (that file is gitignored — real cookies, never commit).
- **harness/instrument.py** — `PipelineInstrument` with proper `_phase_stack`
  (kills spurious "end_phase without matching start_phase" warnings).
- **variant_framework/** — DOM-variant investigation (classifier, context_builder,
  evidence, reporting, runner, spec); offline suite 32/32.
- **parser/relative_date.py** + review_parser.py — relative-date → ISO+epoch,
  like-count extraction, per-star `review_breakdown`, business metadata address/category.
- **selector health** — `expand_text_button` false-degradation fixed
  (`expected_missing` credited toward healthy).
- Verified: `verify_baseline` 108/108, `verify_variant_framework` 32/32, live
  `--verify` 12/12 at earlier runs; a full clean 12/12 post-GMBE run was not
  completed live (aborted / timeout on one listing) — see CHANGELOG for the UNPROVEN note.

### b. Dashboard v0.2.0 hardening (commit `afe1785`, tag `v0.2.0`)
- TOCTOU race fix in `ScrapeRunManager` (atomic `start()` mutex).
- `validateCompetitorId()` path-traversal guard (`src/lib/gbp/validate.ts` + `server-data.ts`).
- `health-trend` JSONLOG parser + Vitest suite (`health-trend.test.ts`).
- ESLint re-enabled (37 errors + 43 warnings fixed); `vitest.config.mjs` added.
- Pruned unused shadcn/ui components + removed matching deps from `package.json`
  (radix, dnd-kit, react-hook-form, next-auth, next-intl, zod, zustand, …).
- Migrated Bun → **npm** (single package manager); cross-platform build via
  `.zscripts/build.mjs`; configurable `GBP_ROOT` env replaces hardcoded paths.
- Docs: `CHANGELOG.md`, `RELEASE_NOTES.md`, `KNOWN_LIMITATIONS.md`,
  `RELEASE_CHECKLIST.md`, `docs/engineering/FINAL_*`, `PRODUCTION_VALIDATION_REPORT.md`,
  `RUNTIME_VALIDATION_REPORT.md`, `project-manifest.txt`, `tree.txt`.

---

## 4. Verification commands

Python (run from `gbp-monitor/`):

```powershell
python -m tests.verify_baseline            # offline fixtures: 108/108 expected
python -m tests.verify_variant_framework   # offline variants: 32/32 expected
python -m orchestration.run_all            # live scraping run (12 listings)
```

Dashboard (repo root):

```powershell
npm test        # Vitest: 34/34 expected
npm run lint    # ESLint: 0 errors / 0 warnings expected
npm run build   # cross-platform build via .zscripts/build.mjs
```

---

## 5. Working conventions to preserve

- **No AI / no paid APIs** (Rule 4): acquisition is cookie-based, not fabricated.
- **No fabricated selectors** (Rule 3): if the DOM variant doesn't render a field
  (owner replies, absolute timestamps), do NOT invent selectors — document as absent.
- `data/` = runtime data: `storage_state.json`, `verify/`, `raw_html/`, `*.log`
  never committed; timestamped `snapshots/`/`reviews_new/` churn left uncommitted.
- Follow `gbp-monitor/CHANGELOG.md` format (timestamp, files, reason, status) for
  every scraper change; the file is the project memory, never rewrite past entries.
- Fixture HTML must have embedded Google `AIza…` keys scrubbed (fixtures were
  updated so the keys only exist in old HEAD lines, not in the tree).

---

## 6. Known limitations / open items (UNPROVEN)

- Full 12-listing live `--verify` after the Reviews-tab + scroll change did not
  complete end-to-end (transient timeout); need one clean 12/12 live run.
- NID cookie freshness/rotation and cross-IP FULL-variant generalization
  (M7 A-7) unproven.
- A clean history squash of the 15 UUID commits is desired but **not performed**
  (cancelled by user).