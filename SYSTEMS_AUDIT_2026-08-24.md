# Systems Audit & Clean-Start Findings — 2026-08-24

**Context:** full Prepare→Run→Test procedure executed by the user against
v0.3.2 (self-monitoring fix). Three symptoms surfaced during/after the run.
This doc records the diagnoses, the corrected system-by-system map of the
whole pipeline, and the proposed fix order.

**Procedure results (2026-08-24):**

| Gate | Result |
|---|---|
| vitest | ✅ 115/115 (9 files incl. self-target) |
| tsc / eslint | ✅ clean |
| Playwright | ⚠️ **15/16** — Mobile self-monitoring invariant failed (see §1b) |
| verify_baseline | ✅ 132/132 |
| verify_notifications | ✅ 25/25 |
| verify_variant_framework | ✅ 32/32 |
| Data backup/restore | ✅ executed (backup → baseline wipe → restore) |

---

## 1. The three symptoms, diagnosed

### 1a. "Revolver Seminyak still monitored after a clean start" — EXPECTED, not a bug

The user's business + competitor config does **NOT live in `data/`**. It lives
in **`gbp-monitor/config/user-business.json`**, plus browser-side onboarding
state (`localStorage` / `sessionStorage`, key `rother_seed_place`).

The procedure backs up/restores only `data/`. Deleting `data/` therefore never
resets monitoring config. A TRUE clean start requires:

```powershell
Remove-Item gbp-monitor\config\user-business.json -ErrorAction SilentlyContinue
# AND clear site data for localhost:3000 in the browser (or use incognito)
```

This step exists in `CLEAN_START_RUNBOOK.md` but was skipped in this pass.
Additionally, the Playwright suite itself rewrites `config/user-business.json`
multiple times per run (every onboarding e2e persists a config) — so running
e2e against a dev server you are manually testing through WILL mutate your
live config. This is a known operational hazard to remember.

### 1b. Playwright Mobile self-monitoring test failure — THREE stacked causes (Phase A investigated)

Initial signature:

```
Expected value: "revolver-seminyak"
Received array: ["comp-canggu-01", "comp-seminyak-01", "comp-ubud-01"]   ← seed demo set
```

**FINAL DIAGNOSIS (2026-08-24, after instrumented debugging — see
`SYSTEMS_FIX_PLAN.md` Phase A outcome):** three independent issues stacked:

1. **API RATE LIMITING (the headline bug — product-level, not test-level).
   `src/middleware.ts` limited every API path to 20 req/min per IP. The
   dashboard's own polling (/api/scrape/status, /api/overview, ...) plus any
   test/manual read burst tripped HTTP 429s whose JSON bodies
   (`{ok:false,...}`) parse to "no data" at every consumer — masquerading as
   data loss. This very likely CONTRIBUTED TO THE USER'S MANUAL SYMPTOMS
   ("Crate Cafe does not show up"): a browsing session with auto-refresh can
   approach/exceed 20/min/path. FIXED: `RATE_LIMIT_MAX` raised 20 → 120 with
   rationale comment.
2. **Google short-link throttling** under repeat runs → tests now mock
   `/api/places` offline with real ChIJ place_ids.
3. **Toast-vs-React-commit race**: sonner's "Competitor added" toast renders
   from an external store BEFORE `competitorList` commits, so text-based waits
   allowed clicking Start Monitoring with a stale empty closure. Tests now
   wait on the committed list item (`Remove competitor` button).

Test assertions hardened with `expect.poll` (750ms intervals, 15s window) —
the correct pattern against shared mutable server state where a prior test's
in-flight onboarding chain may still be settling.

### 1c. "Crate Cafe data still doesn't show up" — STATE POLLUTION, needs file-level confirmation

Most likely composition of causes (to be confirmed by inspection):

1. e2e runs overwrote `config/user-business.json` after the last good state
   (last writer wins; several tests onboard businesses).
2. The final restore command may have been truncated (`Copy-Item … -Recurse .`
   trailing dot visible in transcript) — `data/users/crate-cafe` contents need
   verification.
3. S6 fallback masking (§2): when active-business data is missing, read APIs
   silently serve seed-demo data instead of saying "your config/data is
   missing" — making broken states look populated and confusing.

Lesson: any time the dashboard looks wrong, FIRST inspect ground truth:
`config/user-business.json`, `data/users/<id>/snapshots/`,
`data/users/<id>/run_summary.json`.

---

## 2. Corrected system map — the full pipeline (7 systems)

User's intuition was 4 systems (scraping / monitoring / updating /
analysis). Corrected model — each with code anchors and dominant failure
modes:

| # | System | Code anchors | Dominant failure modes |
|---|--------|--------------|------------------------|
| S0 | **Link resolution** — Maps share link → place identity (name, place_id, coords) | `/api/places` route, resolve-gmaps lib, PasteFromMapsParser | short-link throttle/block; hex-CID & `query_place_id=` variants; wrong-business identity; missing gmaps place_id downstream |
| S1 | **Identity/config** — WHO is monitored *(user's "monitoring system")* | onboarding.tsx (`buildBranchesToPersist`), `/api/business`, `/api/business/branches` → `config/user-business.json`; localStorage seed | persistence races (§1b); config clobbered by concurrent writers (e2e vs manual); fixed/discovery mode mixing; clean start misses this file (§1a) |
| S2 | **Target materialization** — config → what Python scrapes | `writeEffectiveListings()` (server-data.ts), `ROTHER_LISTINGS_PATH` + `ROTHER_DATA_DIR` env, `withSelfEntry()` (self-target.ts), scrape-runner spawn | env vars not reaching child process; honest-422 on zero targets; stale effective_listings if trigger skipped regeneration |
| S3 | **Acquisition** — Google Maps DOM capture *(user's "scraping system")* | harness/capture.py, scroll.py, acquisition.py (NID warm-up), storage_state | auth wall → REDUCED variant; selector drift (Rule 3 territory); scroll caps/stale-NID guard; nav timeouts |
| S4 | **Parsing** — DOM → Review records | locator.py tiered resolution, parser/reviews.py, relative_date.py | selector tiers exhausted; duplicate nodes (~8.6× observed); relative-date unparseable → null dates |
| S5 | **Storage** — versioned snapshots + deltas *(part of "updating")* | storage/snapshot_store.py (latest.json pointer), delta_store.py | manual/baseline wipes of `data/`; pointer corruption; tenant-dir vs root confusion |
| S6 | **Read/serve layer** — joins snapshots→dashboard *(front half of "analysis")* | `/api/overview`, `/api/branches`, `/api/reviews`, server-data.ts readers, `withSelfEntry` join | join-key mismatch; TTL cache staleness (10s); **silent fallback-to-demo masks missing data** ⚠️ |
| S7 | **Analysis/alerts** — derived insight *(back half)* | health-trend, competitor-correlation, alerts route, notifier.py | all downstream of S0–S6 correctness; notification delivery config |

**Key structural risk flagged:** S6's silent demo-fallback. When no active
business exists (or tenant data is absent), read endpoints serve the seeded
demo competitors as if they were real. This has now caused confusion twice
(§1a observation, §1b test signature). Candidate hardening: explicit
`source: "seed-demo"` field / UI banner whenever fallback is active.

---

## 3. Proposed fix order (system-per-system, pending approval)

1. **E2E race fix** (§1b): await branches POST in the self-monitoring test;
   re-run Playwright to 16/16. ~5 min.
2. **S1 true-clean-start walkthrough**: delete `user-business.json` + clear
   browser storage → redo onboarding → inspect `user-business.json` +
   dashboard at every step. Confirms identity/config system end-to-end.
3. **Current-state diagnosis**: inspect today's actual files
   (`config/user-business.json`, `data/users/crate-cafe/snapshots/`,
   run_summary) to explain §1c precisely before touching anything.
4. **S6 hardening candidate**: explicit fallback signaling (banner/field) so
   demo data can never masquerade as user data. Small, high-value.
5. Re-run live scrape proof (crate-cafe + revolver `success=2/2`) as the
   closing gate.

## 4. Status

- Diagnoses: documented (this file).
- **Phase A (e2e race + rate-limit fix): DONE & PROVEN 2026-08-24** — headline:
  `RATE_LIMIT_MAX=20` starved legitimate polling clients (429s parsed as
  "no data"); raised to 120. Tests made offline-deterministic + poll-based.
- **Phase B (diagnosis + remediation): DONE** — restore had never landed;
  real data recovered from nested backup and restored. Escalation found the
  `/api/reviews` branch-filter bug (user screenshot), which exposed a
  systematic gap → Phase D expanded.
- **Phase D (S6 sweep + provenance): DONE & EXPANDED** — 11 routes swept onto
  `resolveMonitoredConfig()`; `configSource` field + "Demo dataset" TopBar
  badge shipped.
- **Phase C (true-clean-start): DONE** — all 5 checkpoints passed, incl. the
  zero-competitor path (no 422) and competitor path invariants.
- **Phase E (closing gate): DONE** — live `success=2/2`, 1290 total reviews
  (crate-cafe 650 self=True + revolver 640), deltas flowing both sides.
- ALL SYSTEMS-FIX PHASES COMPLETE. See `SYSTEMS_FIX_PLAN.md` outcome blocks +
  `phase-reports/systems-*.txt`.
