# Self-Monitoring Fix Plan — "Your business is always monitored"

**Created:** 2026-08-22 · **Status:** ✅ IMPLEMENTED & PROVEN (2026-08-24)
**Companion doc:** `SELF_MONITORING_AUDIT_2026-08-22.md` (findings + evidence)
**Released in:** v0.3.2

> **Outcome:** all 5 phases executed as planned. Live run `20260824T042428Z`
> proved the fix end-to-end (`total_competitors=2, success=2`; crate-cafe
> snapshot created, 380 reviews avg 4.02). Gates: vitest 115/115 · tsc 0 ·
> eslint 0 · playwright 16/16 · notifications 25/25 · variant 32/32.
> One deviation from plan: `/api/branches` turned out to be a third
> snapshot-join consumer and was wired alongside overview (§2 matrix updated).
> Zero Python changes were required — Python accepted the `self` key untouched.

---

## 0. Problem statement (one paragraph)

Adding competitors via onboarding Step 3 overwrites the default
self-including branch config, so Rother silently stops scraping the user's
own business (Crate Cafe). With zero competitors the run is refused entirely
(422). Result: the "you" half of you-vs-them monitoring has no data. Full
evidence chain with file:line refs lives in the audit doc §3.

---

## 1. Design decision

### Chosen approach: synthesize the self entry at READ/MATERIALIZE time

Add one pure helper — `withSelfEntry(active)` — that takes an `ActiveBusiness`
and returns its branches **plus a synthetic self competitor entry** derived
from the business's own identity fields (`id`, `name`, `place_id`,
`gmaps_place_id`, lat/lng), flagged `"self": true`.

Wire this helper into every consumer that answers
*"what do we scrape?"* or *"which snapshots exist?"* — but NOT into
geographic-statistics consumers (see §2 consumer matrix).

Why NOT simply persist the self entry into `user-business.json.branches` at
onboarding:

- It would leak into every existing consumer immediately (competitive-health
  distance/density math would see `nearestM = 0` — the business is 0 m from
  itself; density and enrichment percentages skew).
- Every UI list (config tools, filters, refresh grids) would need filtering
  logic forever.
- Existing tenants would need a data migration.

Read-time synthesis fixes old tenants automatically (no migration), keeps the
persisted config honest ("these are my competitors"), and gives us exactly one
place to reason about the flag.

### Fallback behavior (honesty rules)

| Situation | Behavior |
|---|---|
| Business has usable `place_id`/`gmaps_place_id` | Self entry injected |
| Business has NO resolvable place id | Self NOT injected; scraping proceeds with competitors only (same as today) — no fabricated target (Rule 3 spirit) |
| Stored branches already contain an entry with `competitor_id === active.id` | Do NOT duplicate; leave user's entry untouched |
| Zero competitors AND no injectable self | Existing 422 `NO_COMPETITORS_CONFIGURED` fires unchanged |

---

## 2. Consumer audit — who gets the self entry, who doesn't

Verified against code during planning (file:line):

| Consumer | Reads | Gets self? | Why |
|---|---|---|---|
| `writeEffectiveListings()` — src/lib/gbp/server-data.ts:505 | stored branches | ✅ YES | This IS the scrape target list fed to Python via `ROTHER_LISTINGS_PATH` |
| `/api/overview` — src/app/api/overview/route.ts:40,77-115 | `active?.branches` | ✅ YES | Joins snapshots→stats per competitor (lines 79-107). Without self here, the scraped crate-cafe snapshot stays invisible — this is exactly today's bug surface |
| Scrape progress denominator (`effectiveTotal`) — src/lib/gbp/scrape-runner.ts:320-373 | effective listings | ✅ (automatic) | Counts whatever effective_listings holds → honest "2/2" style progress |
| Per-competitor Refresh (Phase C partial runs) — trigger route + `--competitors` passthrough | competitor ids | ✅ (automatic) | `crate-cafe` is a valid id (`_VALID_COMPETITOR_ID_RE`); refreshing your own listing becomes possible for free |
| Delta/notification plumbing (Python side) | listings | ✅ (automatic) | Deltas are keyed per competitor_id; self gets its own delta stream & notifications with zero Python changes |
| `readActiveBusinessBranches()` — server-data.ts:458 (generic reader) | stored branches | ⛔ NO (keep raw) | Raw accessor must stay unmodified; consumers below rely on it |
| `/api/competitive-health` — route.ts:60-112 | branches | ⛔ NO | Distance/density/enrichment math breaks if the business measures distance to itself (`nearestM=0`). Correlation-readiness gate (`≥2 competitors with snapshots`, line 148) intentionally stays REAL-competitor-only for v0.3.2 (conservative); revisit later |
| `/api/geo-grid` — route.ts:28-29 | branches | ⛔ NO | Geo queries anchored on branch coords vs discovered competitors; self would double-count |
| OSM discovery — src/lib/gbp/osm-discovery.ts:205-241 | branches | ⛔ NO | Discovery of *new* competitors shouldn't list the business itself as a candidate match |

---

## 3. Implementation phases

### Phase 0 — Baseline repro (Rule 1: prove broken before fixing)

- [x] With current build: confirm `data/users/crate-cafe/snapshots/` has NO
      `crate-cafe` dir after a run; `/api/overview.competitorStats` lists only
      revolver-seminyak. Screenshot/log captured into the CHANGELOG entry.
- No code changes. ~10 min.

### Phase 1 — Types + helper + unit tests

- [x] `src/lib/gbp/types.ts`: add optional `self?: boolean` to
      `CompetitorConfig` (line 83).
- [x] New pure helper `withSelfEntry(active: ActiveBusiness): BranchConfig[]`
      — location: `src/lib/gbp/server-data.ts` (near
      `writeActiveBusinessBranches`) or a new `src/lib/gbp/self-target.ts` if
      server-data.ts import weight matters for vitest speed (decide during
      implementation; helper itself must stay dependency-free/pure).
      Logic:
      - returns `[]` when no active business;
      - builds `{ competitor_id: active.id, name: active.name,
        gmaps_url: placeId ? maps URL : "", place_id, gmaps_place_id,
        lat/lng, verified: !active.unverified, self: true }`;
      - skips injection when neither `place_id` nor `gmaps_place_id` exists;
      - dedups against stored entries with same competitor_id (user entry
        wins);
      - prepends self so it appears first in UI lists.
- [x] Vitest suite `self-target.test.ts`: covers all four fallback rows in §1
      table + ordering + field mapping. Target: ≥8 assertions.
- Exit criteria: `npx vitest run` green including new suite.

### Phase 2 — Wire the two YES consumers

- [x] `writeEffectiveListings()`: compute `branches =
      withSelfEntry(active)` instead of raw `active.branches`; recompute
      `totalCompetitors` from the augmented set; keep returning `null` only
      when the AUGMENTED total is 0 (preserves honest-422 semantics).
- [x] `/api/overview/route.ts:40`: `const branchConfig = active ?
      withSelfEntry(active) : (await readListings()).branches;`
      — fixed-mode path untouched.
- [x] Grep-sweep for any OTHER `active?.branches` / `readActiveBusinessBranches()`
      consumer missed above; classify each into the §2 matrix before touching.
- Exit criteria: tsc clean; vitest green; manual dev-server check shows
  overview `totalCompetitors` = 2 and a second competitorStats row for
  crate-cafe even BEFORE any new scrape (empty stats, honest zeros).

### Phase 3 — UI labeling (polish, small)

- [x] Wherever competitor rows render (Onboarding step 3 list, Tools ›
      Configuration, per-feature competitor filter dropdowns, Refresh buttons):
      render a subtle "Your business" badge when `entry.self === true`.
- [x] Ensure the self row's Refresh button works (it will — partial-run
      passthrough accepts the id).
- [x] No removal affordance for the self row in scrape contexts (it isn't a
      stored row anyway — nothing to remove).
- Exit criteria: eslint clean; visual check desktop + mobile viewport.

### Phase 4 — End-to-end verification (the PROVEN gate)

- [x] `npx vitest run` — all suites incl. new one.
- [x] `npx tsc --noEmit` — 0 errors.
- [x] `npx eslint src` — exit 0.
- [x] Extend `e2e/discovery-persistence.spec.ts`: after skip-branches
      onboarding adds a competitor, assert `/api/business/branches` response
      AND `/api/overview` include the business-id row (self) alongside it.
- [x] `npx playwright test` — full suite green (dev server running).
- [x] Python hygiene (no Python files changed, run anyway per audit §5):
      `verify_notifications` (25) + `verify_variant_framework` (32). Do NOT run
      `verify_baseline` (wipes `data/`; unnecessary — zero scraper edits).
- [x] LIVE proof (manual): trigger a real scrape → assert
      `data/users/crate-cafe/snapshots/crate-cafe/<ts>.json` created with
      Crate Cafe's actual reviews; run_summary shows `total_competitors: 2,
      success: 2`; dashboard Overview shows both rows; notification/delta file
      exists for crate-cafe.
- Only after ALL pass: mark PROVEN in CHANGELOG (Rule 2), bump version →
  v0.3.2, update AGENTS.md state bullets, RELEASE_NOTES_v0.3.2.md.

### Phase 5 — Docs & bookkeeping

- [x] `gbp-monitor/CHANGELOG.md` newest-top entry: timestamp, files, reason,
      evidence, PROVEN status.
- [x] AGENTS.md: last-updated line, version bullets, note the new invariant —
      "self is always a scrape target when the business has a resolvable
      place id; competitors are additive."
- [x] Mark this plan's checkboxes; move completed plan reference into
      SELF_MONITORING_AUDIT §6 status.

---

## 4. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Python rejects unknown `self` key in listings JSON | Low | Orchestrator parses JSON leniently (fixtures/effective files already carry `_comment` keys); verify in Phase 4 live step before marking PROVEN |
| Progress denominator confusion (users see "2/2" for "1 competitor") | Medium | Honest by definition; UI badge explains the extra row is Your business |
| Self place_id stale/unverified | Low | Entry carries `verified: !active.unverified`; existing unverified-badge UX already handles display |
| Double-count in future analytics added blindly | Medium | §2 matrix is the canonical map; AGENTS.md invariant note warns future contributors |
| Fixed-mode regression (root listings.json users) | Low | Helper only invoked when `active` business exists; fixed-mode path byte-identical |
| Concurrent-run 409 interplay during live verification | Low | Known-good behavior; wait for idle manager between triggers |

## 5. Effort estimate

Phases 1–3 ≈ one focused session (~2–3 h incl. tests). Phase 4 live scrape
adds ~5 min runtime (Revolver took 169 s; two targets ≈ 4–5 min). Phase 5
~20 min.
