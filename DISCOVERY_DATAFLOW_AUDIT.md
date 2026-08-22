# Discovery Data-Flow Audit — Post-v0.3.0 User Testing

**Date:** 2026-08-22 (after v0.3.0 clean-start user test)
**Trigger:** User's first real end-to-end run succeeded for the core goal but
revealed anomalies in the "Add competitors to monitor" flow.
**Status:** 🔴 OPEN — fixes designed, not yet applied

---

## 1. What the User Test Proved Works ✅

| Capability | Evidence |
|------------|----------|
| Clean-start procedure | No EBUSY, no orphaned ports, all phases A–F executed cleanly |
| All automated gates | vitest 103/103 · playwright 12/12 · baseline **132/132** · notifications 25/25 · variant 32/32 |
| Git restore discipline | `git status` clean after test suites (only untracked runbook) |
| **Core goal** | **New short link `https://maps.app.goo.gl/dv39dG2mtuSW7oig8` → resolved → live-scraped Crate Cafe: 3/3 success, 440 new reviews, 1,470 total, ~414s** |
| Tenant isolation | `data/users/crate-cafe/` fully populated: snapshots ×3 competitors, deltas, run_summary.json, selector reports, config_backups |
| Dashboard rendering | Reviews visible; rating distribution populated (1★109 / 2★51 / 3★74 / 4★231 / 5★1005 = 1470) |

---

## 2. Bug Found — "Add competitors" Silently Dropped

### Symptoms (user's own `/api/overview` output)
```json
{
  "runSummary":   { "success": 3, "new_reviews": 440, "total_reviews": 1470 },
  "totalReviews": 1470,
  "ratingDistribution": [ ...1470 total... ],
  "totalBranches": 0,          ← ???
  "totalCompetitors": 0,       ← ???
  "newReviewsLastRun": 0,      ← ???
  "newReviewsPerBranch": [],   ← empty!
  "competitorStats": []        ← empty!
}
```
Data exists (reviews scraped and stored), but the dashboard's branch/competitor
layer is empty even though the user added a competitor in onboarding Step 3.

### Root Cause

In `src/components/shell/onboarding.tsx`, `finish(includeBranches)`:

```typescript
if (includeBranches && branchList.length > 0) {     // ← gate
  const branches: BranchConfig[] = branchList.map((b, i) => ({
    ...
    // Phase B: include competitors in each branch
    competitors: competitorList.map((c) => ({ ... })),   // ← nested here
  }));
  await fetch("/api/business/branches", { ... });
}
```

The competitor list is persisted **nested inside** each user-branch entry, and
the whole block is gated on `branchList.length > 0`.

**User flow that triggers it:**
Step 2 ("Add your own branch locations") → **Skip for now** →
`branchList === []` → entire block skipped → **competitors added in Step 3 are
silently discarded**, never written to `user-business.json`.

Secondary confirmation from dev-log: multiple `POST /api/business` calls (from
`persistBusiness`) appear during onboarding, but no successful
`POST /api/business/branches` occurs in the final flow.

### Why earlier tests missed it

- e2e "Discovery flow" asserts Start-Monitoring button enabled — not persistence
- Manual API tests created branches directly via `POST /api/business/branches`,
  bypassing the skip-path
- The bug only manifests on the **skip-branches path**, which is also the
  fastest path real users take

---

## 3. Deeper Gap — Scraper Targets Legacy Config, Not User Competitors

Evidence: the post-onboarding live scrape processed exactly
`comp-canggu-01`, `comp-seminyak-01`, `comp-ubud-01` — the three entries in
**root `config/listings.json`** (the v0.2 test config). The competitor the
user actually added (`maps.app.goo.gl/U3LnDRxWchgSZTjq9`) was validated via
`/api/places` but never scraped.

Cause chain:
1. Bug §2 → user's competitors never reach `user-business.json.branches`
2. Even if they had: discovery-mode scrape (`run_all.py` live, no args) reads
   root `config/listings.json`, not the tenant business file
3. Net effect: **the product scrapes a hardcoded demo set regardless of what
   the user configures** — the central promise of discovery-first is broken
   at this seam.

Related UX observation: repeated Start-Monitoring clicks during an active
~7-min live run returned `409` conflicts (`POST /api/scrape/trigger 409` ×4 in
dev log). Correct behavior, but the rejection message could be friendlier and
the RunScreen could surface "already running" state instead of allowing the
click.

---

## 4. Designed Fixes (not yet implemented)

### Fix A — Persist competitors independently of branches
In `onboarding.tsx finish()`:
- Always persist at least one auto-created branch derived from the seed
  business itself (e.g. `{branch_id: <bizId>, branch_name: <bizName>,
  competitors: competitorList}`) when the user added competitors but skipped
  own-branches
- Keep explicit user branches when provided; attach the shared competitor list
  as today

### Fix B — Discovery scrape derives targets from tenant config
`scrape-runner.ts startInner()` (live mode): read active business's branches/
competitors from `user-business.json`; build a temporary filtered listings
view or pass ids — preferred approach:
- Write/refresh `data/users/{id}/effective_listings.json` from the tenant
  branches before spawn, and point Python at it via an env var
  (e.g. `ROTHER_LISTINGS_PATH`) — avoids mutating root config, keeps Rule-7
  failure isolation, works with existing `--competitors` filter if needed
- Fallback: root listings.json when no active business (fixed mode unchanged)

### Fix C — Friendly concurrent-run UX
- RunScreen: poll `/api/scrape/status` on mount; if a run is active, show
  "A scrape is already running — showing progress" instead of allowing Run
- Toast copy for 409: "A scrape is already running — watch its progress below"

### Fix D — Regression tests
- e2e: skip-branches path → after Start Monitoring, GET
  `/api/business/branches` returns ≥1 branch containing the added competitor
- Unit/integration: trigger route + runner derive targets from tenant config
  when active business exists

---

## 5. Verification Plan (after fixes)

1. Clean browser session → paste Crate Cafe link → skip branches → add
   Revolver + one more link → Start Monitoring
2. Assert `GET /api/business/branches` shows the competitor(s)
3. Assert spawned Python log lists ONLY the user's competitors
4. Assert overview: `totalCompetitors ≥ 1`, `competitorStats` non-empty,
   `newReviewsPerBranch` populated
5. Full gate suite re-run (vitest/tsc/eslint/build/playwright/python suites)

---

## 6. Decision Requested

Proceed with Fixes A–D (est. 2–3 h including regression)? This is the last
known seam between "product works" and "product does what the user configured".
