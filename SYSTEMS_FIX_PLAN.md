# Systems Fix Plan — Post-Clean-Start Findings

**Created:** 2026-08-24 · **Status:** ✅ ALL PHASES DONE & PROVEN (2026-08-24)
**Companion docs:** `SYSTEMS_AUDIT_2026-08-24.md` (diagnoses),
`SELF_MONITORING_FIX_PLAN.md` (✅ v0.3.2, shipped)

**Outcome:** Phases A–E all executed. Live closing gate: `success=2/2`,
crate-cafe 650 reviews (4.05★, self=True) + revolver 640 (4.54★) = 1290 total,
delta streams flowing for both sides. Gates: vitest 119/119 · tsc 0 · eslint
0/0 · Playwright 16/16 (×2) · notifications 25/25 · variant 32/32.
Note: one transient live run captured 0 reviews for crate-cafe (Google
rendering variance; orchestrator surfaced VERDICT FAIL honestly) — immediate
retry scraped 650. See phase-reports/systems-*.txt for per-phase evidence.

**Goal:** close out the three findings from the 2026-08-24 procedure run
(§1a clean-start confusion, §1b e2e race flake, §1c state pollution) and
harden the one structural risk (S6 silent demo-fallback), then re-prove the
stack live.

---

## Phase A — E2E race fix (§1b) · ✅ DONE & PROVEN (2026-08-24)

**Outcome — three stacked causes found, all fixed:**
1. **Google short-link throttling** under repeat runs → tests now mock
   `/api/places` offline (`mockPlacesApi()` with the real ChIJ place_ids).
2. **Toast-vs-React-commit race**: sonner's "Competitor added" toast renders
   from an external store BEFORE `competitorList` commits, so a text-based
   wait let Start Monitoring click with a stale empty closure → tests now wait
   on the committed list item (`Remove competitor` button).
3. **THE BIG ONE — API rate limiting** (`src/middleware.ts`, 20 req/min/path):
   the dashboard's own polling plus test reads tripped 429s whose JSON bodies
   parse to "no data" — masquerading as data loss. This likely contributed to
   the USER'S manual "Crate Cafe doesn't show up" sessions too. Raised
   `RATE_LIMIT_MAX` 20 → **120** with rationale comment.

Test asserts now use `expect.poll` (750ms intervals, 15s window) for all
server-side invariants — correct pattern against shared mutable server state.

**Files:** `e2e/discovery-persistence.spec.ts`, `src/middleware.ts`.
**Evidence:** file suite `--repeat-each=3` 12/12; FULL Playwright 16/16 ×2
consecutive; vitest 115/115; tsc 0; eslint clean.

- [x] Await branches POST before asserting (superseded by poll approach)
- [x] Offline `/api/places` mock for deterministic link validation
- [x] Rate-limit root cause fixed at the source (middleware)
- [x] `--repeat-each=3` stable + full suite green twice

## Phase B — Current-state diagnosis (§1c) · ✅ DONE (2026-08-24, read-only + prescribed remediation)

**Outcome:** decision tree landed on "restore never completed". Full evidence:
`phase-reports/systems-phaseB-diagnosis.txt`. Key facts:
- Real data was SAFE inside the nested backup
  (`rother_data_backup\data\users\...`): crate-cafe 380 reviews,
  revolver-seminyak 470 (+16 older real snapshots).
- Tenant dir had only 5-review fixture stubs from e2e runs — dashboard was
  honestly serving what was on disk.
- Remediated: restored both real snapshot dirs; live overview verified
  (`totalReviews=850, dataStatus=ok`, self flags correct).
- Runbook lessons recorded: fresh backup dir; verify restores immediately;
  treat `user-business.json` + tenant snapshots as volatile during e2e runs.

- [x] Inspect user-business.json / tenant dirs / snapshots / APIs
- [x] Apply decision-tree remediation (careful restore from backup)
- [x] Verify live dashboard serves real data again

## Phase C — True-clean-start walkthrough (S1 verification) · ✅ DONE (2026-08-24)

**Outcome:** S1 verified end-to-end from zero. All 5 checkpoints expected —
full evidence: `phase-reports/systems-phaseC-clean-start.txt`. Highlights:
- Cold state: seed-demo fallback + `configSource=seed-demo` provenance working.
- Zero-competitor path: trigger ACCEPTED (no 422) — self entry materialized,
  self-only run executes (v0.3.2 behavior confirmed live).
- Competitor path: stored config stays competitor-only; effective targets =
  self + revolver (2/2); synthetic-self invariant holds.
- Overview matched disk at every checkpoint; fixture runs wrote nothing
  (success=0 ⇒ no snapshot write) — no re-pollution.
- Final state healthier than pre-walkthrough (proper gmaps_place_id,
  unverified=false). Backup retained: `phaseC_backup_20260824T175855`.

- [x] Backup config + tenant data first (risk register)
- [x] Cold-state verification (file deleted, server restarted)
- [x] Zero-competitor path (was 422 pre-v0.3.2)
- [x] Competitor path (the original regression scenario)
- [x] Overview↔disk consistency at every step

## Phase D — S6 provenance hardening · ✅ DONE & EXPANDED (2026-08-24)

**Scope expansion (justified by Phase B escalation):** the user's screenshot
(All Reviews filtered by their own branch → zero rows) exposed that the
original P2 tenant-scoping sweep had missed TEN routes, not one. `/api/reviews`
was fixed ad-hoc in Phase B; Phase D replaced all of them with one choke point.

**Shipped:**
- `pickMonitoredConfig(active, seedBranches)` — pure decision core
  (self-target.ts) + 4 unit tests.
- `resolveMonitoredConfig()` — IO wrapper (server-data.ts), the ONE sanctioned
  way to obtain the monitored config.
- **Routes swept (11 total):** reviews, overview, branches, alerts,
  new-reviews, competitor-correlation, history, history/compare,
  history/export, reviews/export, export/branches, export/competitors.
  Only `config/listings` (the fixed-mode editor) legitimately keeps
  `readListings()`.
- `configSource: "tenant" | "seed-demo"` added to OverviewResponse +
  BranchesResponse; verified live (`tenant` in discovery mode).
- UI: amber "Demo dataset" badge in the TopBar for fixed mode (client-side
  derivation: seed-demo ⟺ fixed mode; discovery-without-business shows
  Onboarding instead of the shell).
- alerts route: dropped a genuinely-unused readAllSnapshots fetch (also clears
  a lint warning).

**Gates:** vitest **119/119** · tsc 0 · eslint 0 errors/0 warnings ·
Playwright **16/16** · live joins verified (branch filter 850, self 380,
revolver 470, new-reviews labeled).

- [x] Helper + unit tests (tenant / seed / none / no-mixing)
- [x] Sweep all routes onto the helper
- [x] configSource field + TopBar badge
- [x] Full gates green

### Phase A follow-up (discovered in procedure-run #2, 2026-08-24) · ✅ DONE

`smoke.spec.ts` was NOT ported to the Phase A hardening — its Mobile
"Discovery flow" flaked identically (live link resolution + toast-race text
wait, smoke.spec.ts:165). Evidence: `phase-reports/systems-procedure2-results.txt` §I1.

- [x] Extract shared `e2e/helpers/places-mock.ts` (mockPlacesApi + MOCK_PLACES)
- [x] Port mock + "Remove competitor" committed-item wait to smoke.spec.ts
      discovery test; discovery-persistence.spec.ts refactored onto the helper
- [x] Verify: smoke+discovery `--repeat-each=3` → **42/42**; full suite **16/16**

### Phase B — Copy-logs + enhanced scraper logging · ✅ DONE (2026-09-05)

- [x] Copy button added to LogsSection (navigator.clipboard + blob fallback)
- [x] Human-readable logging in run_all.py: run-start banner, acquisition status, per-listing harvest summary, final run summary
- [x] TAURI_SCRAPING_ANALYSIS_2026-09-05.md created with full scraping system analysis
- [x] Committed: 8b6f549

**ALL PLAN ITEMS COMPLETE.**

## Phase E — Closing gate · ~30 min (incl. one live scrape)

- [ ] Full offline gates: vitest · tsc · eslint · playwright (all suites).
- [ ] Python hygiene: notifications + variant framework (baseline ONLY if
      Python files changed — none are planned).
- [ ] TRUE clean start (Phase C procedure) → onboard Crate Cafe → add Revolver
      → LIVE scrape → assert `success=2`, both snapshot dirs, overview joins
      with self flags, provenance badge reads tenant source.
- [ ] CHANGELOG entry (Rule 2) + AGENTS.md test-count sync if any count moved;
      mark this plan's checkboxes; update SYSTEMS_AUDIT §4 status.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| repeat-each=3 e2e still flakes | Low-Med | If so, await trigger response too; worst case poll status until terminal before asserts |
| Provenance badge confuses fixed-mode users | Low | Copy distinguishes "Demo dataset" clearly; fixed-mode is a documented advanced path |
| `configSource` leaks into older clients | None | Additive optional field |
| Clean-start walkthrough mutates good tenant data | Medium | Backup `user-business.json` + `data/users` first; restore after |
| Scope creep into fallback-behavior change | Medium | Out-of-scope note above is binding for this release |

## Effort total

≈ 2.5–3.5 h including one live scrape (~5 min runtime) and docs.
