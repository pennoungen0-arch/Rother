# Release Notes — Rother v0.3.1

**Released:** 2026-08-22 · Tag `v0.3.1` at `757a487` on `test/m15-1-validation`
**Theme:** Discovery scrapes what YOU configured — closing the last seam.

---

## Why v0.3.1 Exists

v0.3.0's clean-start user walkthrough proved the pipeline worked (link →
scrape → dashboard), but careful reading of the runtime evidence exposed two
stacked bugs that broke discovery-first's **central promise**:

> *"Add the competitors YOU want monitored, and Rother monitors exactly those."*

1. Competitors added in onboarding Step 3 were **silently dropped** if the
   user skipped Step 2 (own branches) — persistence was nested inside a
   `branchList.length > 0` gate.
2. Even when persisted, discovery scrapes ran the **legacy demo set**
   (`comp-canggu-01`, `comp-seminyak-01`, `comp-ubud-01` from root
   `listings.json`) — the orchestrator never read tenant config.

Plus one honest-UX gap: clicking Run while a scrape was already in flight
returned an unfriendly 409 with no in-product signal.

Full analysis: `DISCOVERY_DATAFLOW_AUDIT.md` · plan:
`DISCOVERY_DATAFLOW_FIX_PLAN.md`.

---

## Fixes

### Fix A — Competitors survive skip-branches (P0-1)
`onboarding.tsx` now builds the persist list via `buildBranchesToPersist()`:
user branches carry the shared competitor list as before; **when none exist,
one branch is auto-created from the seed business itself** carrying every
Step-3 competitor. Both `finish()` (persistence) and `startMonitoring()`
(trigger body) use it.

### Fix B — Scrapes derive targets from tenant config (P0-2)
New `writeEffectiveListings()` materializes the active business's branches
into `data/users/{id}/effective_listings.json`; `scrape-runner.ts` passes its
path to Python via new env `ROTHER_LISTINGS_PATH`; `run_all.py` resolves its
listings path from that env with a one-line fallback to root config. CLI and
fixed mode behave exactly as before. Zero-competitor active businesses get an
honest **HTTP 422** ("add at least one competitor…") instead of an empty run,
and progress denominators now reflect the tenant/effective count.

### Fix C — Concurrent-run UX (P1-4)
`GET /api/scrape/status?active=1` probe; RunScreen detects in-flight scrapes
on mount + 5s polling → shows **"Scrape already running…"** disabled state
with explanatory copy; 409 toast rewritten friendly.

### Test isolation (P1-3)
Root-caused the "flaky" smoke failures: Run-clicking tests spawned
**multi-minute LIVE scrapes**, which then blocked sibling tests via Fix C's
honest busy state and starved the dev server CPU. All Run-clicking tests now
force `?mode=fixtures` via Playwright route interception — suite runs in ~34s.

---

## Verification Evidence

```
Persistence e2e (new, 2/2): captures POST /api/business/branches payload →
  auto-branch "crate-cafe" containing "revolver-seminyak" after the exact
  skip-branches flow; server-side GET confirms.
Live targeting proof: Start Monitoring scraped ONLY revolver-seminyak →
  success=1, new_reviews=600 → data/users/crate-cafe/snapshots/
  revolver-seminyak/ → served by reviews API (600 total).
422 guard: emptied-config trigger → HTTP 422 with actionable message.
Honest denominator: fixtures trigger through tenant config → "1 / 1".
Gates: vitest 103/103 · tsc 0 · eslint 0 errors/0 warnings · build OK ·
  playwright 14/14 (smoke 10 + scheduler 2 + persistence 2) ·
  baseline 132/132 · notifications 25/25 · variant framework 32/32.
```

---

## Commits

| SHA | Subject |
|-----|---------|
| `757a487` | fix: discovery scrapes user-configured competitors; competitors survive skip-branches (14 files, +842/−75; incl. CLEAN_START_RUNBOOK.md, both audit docs, persistence spec) |

Tag: **`v0.3.1`** (annotated). Working tree clean.

---

## New Operational Notes

| Note | Where |
|------|-------|
| Clean-start prepare/run/test procedure (Phases A–F) | `CLEAN_START_RUNBOOK.md` |
| Zombie python orphans after external node kills: kill PID + remove `data/.run.lock`, restart dev | TROUBLESHOOTING #14 follow-up |
| Smoke Run-clicks force fixtures mode — never spawn live scrapes in CI/test | e2e/smoke.spec.ts route interception comments |

---

## Still Deferred (unchanged)

Real webhook/email credentials · GitHub Actions execution (no remote) ·
parallel scraping · `hours_status` coverage · multi-tenant auth · PWA ·
historical trend alerts.
