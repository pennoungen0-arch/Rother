# Self-Monitoring Audit & Session Findings — 2026-08-22

**Scope:** Full post-v0.3.1 health check of the Rother stack (dashboard +
scraper), triggered by a clean-start runbook pass and one user-visible
symptom: **"Crate Cafe review data does not show up on the dashboard."**

**Environment:** v0.3.1 (`4fa6765` docs addendum HEAD; feature line `757a487`),
branch `test/m15-1-validation`, Windows, node v22.11.0, Python 3.14,
Next.js 16.2.11 (Turbopack).

**Verdict up front:** the stack is healthy and every test suite is green.
The Crate Cafe symptom is a **real seam regression**: adding competitors via
onboarding silently disables scraping of the user's own business, which
contradicts the original design intent found in the code.

---

## 1. Test evidence (all green, 2026-08-22 ~21:15–22:20 local)

| Suite | Result |
|---|---|
| `npx vitest run` | 8 files passed (run-summary, health-trend, categories, sanitize, app-mode, geocode, validate, format) |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint src` | clean exit |
| `npx playwright test` | 14/14 (smoke + scheduler + discovery-persistence, Desktop & Mobile) |
| `python -m tests.verify_baseline` | 132/132 (backup/restore discipline observed) |
| `python -m tests.verify_notifications` | 25/25 (webhook POST received; SMTP stub verified; Rule 7 held) |
| `python -m tests.verify_variant_framework` | 32/32 |

Live scrape during the session: Revolver Seminyak — 580 real reviews captured
and parsed (100% parse rate, `VERDICT: PASS`), snapshot written to the correct
tenant dir `gbp-monitor/data/users/crate-cafe/snapshots/revolver-seminyak/`.

---

## 2. Confirmed-correct behaviors (not bugs)

These looked suspicious in logs but are working as designed:

### 2a. `POST /api/scrape/trigger → 409`
Concurrent-run detection (v0.3.1). `ScrapeRunManager.start()` returns `null`
when a run is already active (`src/lib/gbp/scrape-runner.ts:287`) and the
trigger route maps it to an honest 409 with a "wait for the current run"
message (`src/app/api/scrape/trigger/route.ts:167-181`). Fired correctly when
the dashboard double-triggered during a live run.

### 2b. `[server-data] no file (using fallback): …users/crate-cafe/category_scan/latest.json`
Category Scan has simply never been run for this tenant. The read side
degrades gracefully (`readCategoryScan`, `src/lib/gbp/server-data.ts:532-548`)
and the write side exists and is tenant-scoped
(`runCategoryScan` → `<dataDir>/category_scan/`, `src/lib/gbp/scrape-runner.ts:245`).
Dead-end risk: none — the file appears once a scan runs.

### 2c. `new_reviews: 0` in run_summary
Correct. Second live run over identical data: `compute_new_reviews: 0 new
(old=580, new=580)`.

### 2d. Tenant data pipeline integrity
Audited every API route's data sourcing:
- All readers resolve active business → `data/users/{businessId}/`
  consistently (snapshots, reviews_new, run_summary, run.log, category_scan)
  via `businessDataDir()` (`src/lib/gbp/paths.ts:46-48`).
- Scrape trigger regenerates `effective_listings.json` per run and passes
  `ROTHER_DATA_DIR` + `ROTHER_LISTINGS_PATH` to Python
  (`scrape-runner.ts:307-337`).
- No route mixes tenants or reads root data when tenant data exists.
- Live run artifacts landed in the right tenant dir; `latest.json` pointer
  valid; snapshots ~300 KB each (real data).

---

## 3. MAIN FINDING — Self-monitoring seam regression

### Symptom
Crate Cafe (the monitored business itself) has no review data anywhere on the
dashboard. Only the competitor (Revolver Seminyak) has snapshots.

### Root cause chain (evidence)

1. **Original design DID self-scrape.** When no explicit branches exist,
   `persistUserBusiness()` synthesizes a branch whose *competitor entry is the
   user's own business* (`competitor_id = id = "crate-cafe"`,
   `place_id` = own place):
   `src/app/api/scrape/trigger/route.ts:71-95`. The comment states the intent:
   > "Ensure at least one branch + competitor exists so /api/overview … renders
   > the scraped reviews. The competitor_id matches the scraper's output
   > directory name (== business id)."

2. **Onboarding overwrites it.** Step 3 (add competitors) POSTs explicit
   branches to `/api/business/branches`
   (`src/app/api/business/branches/route.ts:32-56`) →
   `writeActiveBusinessBranches()` replaces the default self-including config
   with a competitor-only list. The self-entry vanishes from
   `user-business.json` → and therefore from `effective_listings.json`
   (`writeEffectiveListings()`, `src/lib/gbp/server-data.ts:505-526`, which
   materializes only the stored branches' `competitors` arrays).

3. **The scraper only ever scrapes listed competitors.** `run_all.py` loops
   `branches × competitors`; the branch (own business) is never a target by
   itself. Confirmed by the live run: `progress: "1/1"`, `total_competitors: 1`
   (revolver-seminyak only).

4. **v0.3.1 removed the implicit fallback.** Pre-v0.3.1, zero competitors fell
   back to the self-entry path. Now `startInner()` throws
   `NO_COMPETITORS_CONFIGURED` when the effective total is 0
   (`scrape-runner.ts:318-364`), mapped to an honest 422
   (`trigger/route.ts:184-199`). So without competitors NOTHING is scraped —
   including the user's own business.

### Behavior matrix (current, shipped v0.3.1)

| State | Own business scraped? | Competitors scraped? | Trigger result |
|---|---|---|---|
| Fresh business, zero competitors | ❌ | ❌ | **422 refused** |
| ≥1 competitor added via onboarding | ❌ **(regression)** | ✅ | 200, runs |
| Fresh business, no branches persisted yet | ✅ (via self-entry default) | — | 200, runs |

### Why it matters
- The product's core value ("you vs. them") loses its "you" half: no own-rating
  trend, no alerts for YOUR new reviews, no rating-gap comparisons.
- It contradicts the code's own documented design (the self-entry default).
- It surprises users exactly when they complete onboarding correctly.

---

## 4. Secondary observations (minor, non-blocking)

### 4a. Parser duplication overhead
`parse_locator` matched **4,982** `[data-review-id]` items for **580 unique**
reviews (~8.6× duplication — nested/duplicated DOM nodes after expand-clicks).
Dedup handles it correctly (`unique=580, missing=0`), but it inflates parse
work per run. Candidate future cleanup; not urgent.

### 4b. Degraded selector — business metadata
`BUSINESS_META[revolver-seminyak] name=… rating=? reviews=?` — rating/review-
count extraction failed, matching `selector_report: healthy=1, degraded=1`.
Does not affect review capture. Should be re-certified against the live DOM
per Rule 3 before touching.

### 4c. Log replay artifact
The entire SCROLL_ITER history was re-emitted at `22:14:34` (duplicate block
after scroll_complete). Looks like buffered-flush replay in the instrument
logger. Cosmetic/noisy only.

### 4d. npm audit — 9 high advisories, dev-toolchain only
- `brace-expansion` (×2 paths) — via eslint/typescript-estree
- `js-yaml` — via @eslint/eslintrc
- `deepmerge-ts` — via prisma/@prisma/config
None ship to runtime. `npm audit fix` clears most of them.

### 4e. Node engine warning
`eslint-visitor-keys@5.0.1` requires node `^20.19 || ^22.13 || >=24`; host is
on v22.11.0. Cosmetic today; upgrade node to ≥22.13 when convenient.

### 4f. Next.js middleware deprecation
"The 'middleware' file convention is deprecated. Please use 'proxy' instead."
A `proxy.ts` already exists and serves requests (visible in timing lines), so
this is a leftover-file/rename cleanup item.

---

## 5. Proposed solution (self-monitoring fix)

**Goal:** self-monitoring becomes explicit and permanent; competitors are
additive and never displace the user's own business.

**Option A (recommended): always include self as a scrape target.**
- When persisting branches (`writeActiveBusinessBranches()` or the branches
  route) AND when materializing `writeEffectiveListings()`: prepend a synthetic
  competitor entry derived from the active business (`competitor_id = business
  id`, own place_id/name), flagged e.g. `"self": true` so the UI can label it
  "Your business".
- Guard against duplicates (skip if a same-id entry already exists).
- Keep the 422 guard: now it only fires if the business somehow has neither a
  usable self place_id nor any competitor.
- Dashboard: overview/refresh flows keep working unchanged because the join
  key (`competitor_id == snapshot dir name == business id`) is exactly what the
  original design expected (see trigger/route.ts comment).

**Option B (rejected): separate self-scrape channel outside the listings
mechanism.** More code, duplicates scheduling/lock/notification plumbing, and
diverges from the orchestrator's single loops-brands-×-competitors model.

**Files expected to change:**
- `src/lib/gbp/server-data.ts` (`writeEffectiveListings`, possibly
  `writeActiveBusinessBranches`)
- `src/app/api/business/branches/route.ts` (preserve/augment self entry)
- `src/lib/gbp/types.ts` (optional `self?: boolean` on CompetitorConfig)
- UI label where competitor lists render (optional polish)
- Tests: extend vitest suites (`sanitize`/`run-summary` adjacent) + one
  Playwright assertion that the self target survives competitor adds.

**Verification plan (Rule 1):**
1. Reproduce current bug first (zero-self state) — document as baseline.
2. Implement Option A.
3. `npx vitest run`, `npx tsc --noEmit`, `npx eslint src`.
4. `npx playwright test` (needs dev server).
5. Manual live check: trigger scrape → confirm `crate-cafe` snapshot dir is
   created alongside `revolver-seminyak` under `data/users/crate-cafe/`, and
   overview shows both sides.
6. Python suites untouched but re-run `verify_notifications` +
   `verify_variant_framework` as hygiene; `verify_baseline` only if Python
   files change (they should not).

---

## 6. Status

- Findings: **documented** (this file).
- Fix implementation: **DONE & PROVEN (2026-08-24)** — see
  `SELF_MONITORING_FIX_PLAN.md` outcome note and CHANGELOG entry
  `2026-08-24T11:35:00+07:00`. Option A implemented via read-time synthesis
  (`withSelfEntry()`); live run scraped Crate Cafe (380 reviews) alongside
  Revolver Seminyak (470), `success=2/2`.
- CHANGELOG entry added per Rule 2 with full gate results.
