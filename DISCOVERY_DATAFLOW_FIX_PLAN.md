# Discovery Data-Flow Fix Plan — Prioritized

**Created:** 2026-08-22 (post v0.3.0 user testing)
**Source:** `DISCOVERY_DATAFLOW_AUDIT.md` (§2 persistence bug, §3 scraper-target gap, §4 designed fixes)
**Goal:** Close the last seam — make discovery mode scrape **exactly what the user configured**, not the legacy demo set.
**Estimated total:** ~3 h

---

## Priority Order (why this sequence)

```
P0  Fix A  persist competitors          ← foundation: nothing downstream matters
                                        until user config survives onboarding
P0  Fix B  scrape tenant targets        ← THE product promise; depends on A
P1  Fix D  regression tests             ← lock A+B so it can't silently regress
P1  Fix C  concurrent-run UX            ← quality polish, independent
P2  Docs + release                      ← Rule 2 changelog, tag v0.3.1
```

Fix A must precede B (B reads what A persists). Tests (D) come right after the
code they cover, not at the end.

---

## P0-1 · Fix A — Competitor persistence independent of branches

**File:** `src/components/shell/onboarding.tsx` (`finish()`)

| Step | Change |
|------|--------|
| A1 | Extract competitor→BranchConfig mapping into a helper `buildCompetitorBranches(bizId, bizName, competitorList)` returning `BranchConfig[]` |
| A2 | Restructure persistence: if `branchList.length > 0` → attach `competitorList` to each user branch (current behavior); **else if `competitorList.length > 0`** → auto-create one branch from the seed business itself: `{ branch_id: bizId, branch_name: bizName, competitors: competitorList }` |
| A3 | POST `/api/business/branches` whenever either list is non-empty (remove the combined gate) |
| A4 | Also fix the `/api/scrape/trigger` body inside `startMonitoring()`: same auto-branch fallback so the trigger body carries competitors even when branchList is empty |

**Verify:** skip Step 2 → add Revolver in Step 3 → Start Monitoring →
`GET /api/business/branches` returns ≥1 branch containing `revolver-seminyak`.

---

## P0-2 · Fix B — Discovery scrape derives targets from tenant config

| Step | File | Change |
|------|------|--------|
| B1 | `src/lib/gbp/server-data.ts` (new helper) | `writeEffectiveListings(businessId): Promise<string \| null>` — reads active business branches, writes `data/users/{id}/effective_listings.json` in ListingsConfig shape, returns its path; returns `null` when no active business or zero total competitors |
| B2 | `src/lib/gbp/scrape-runner.ts` (`startInner`) | Live mode + active business: call B1; if path → set `env.ROTHER_LISTINGS_PATH`; if null AND active business exists → surface honest "no competitors configured" error to caller |
| B3 | `gbp-monitor/orchestration/run_all.py` | `_LISTINGS_PATH = Path(os.environ.get("ROTHER_LISTINGS_PATH", "config/listings.json"))` — one line; everything downstream unchanged |
| B4 | Trigger route | If active business has 0 competitors across branches → return `422 { error: "No competitors configured — add competitors before starting a scrape" }` instead of spawning an empty run |

**Design notes:**
- Root `config/listings.json` remains untouched (Rule: never mutate seed config)
- Fixed mode (no active business) → env unset → legacy behavior identical
- Rule 7 intact: malformed effective file → Python's existing config-error path
  produces clean summary, no traceback

**Verify:** with tenant config = Revolver only → spawned JSONLOG shows
`config_loaded competitors=1` and listing_start only for `revolver-seminyak`;
root listings.json mtime unchanged.

---

## P1-3 · Fix D — Regression coverage (locks A+B)

| Step | Test | Asserts |
|------|------|---------|
| D1 | Extend `e2e/scheduler.spec.ts` seeding pattern → new spec `e2e/discovery-persistence.spec.ts`: seed session → Tools › Configuration shows added competitor after full skip-branches onboarding replay via API-seeded state | `GET /api/business/branches` contains seeded competitor |
| D2 | API-level test (Playwright request context): POST trigger (fixtures) with active business whose effective listings contain 1 competitor → status summary.success == 1 and competitor id matches | Scraper honored tenant targets |
| D3 | Unit: `sanitizeCompetitorIds` dedupe/drop cases (already covered implicitly — formalize if cheap) |

**Verify:** all new tests pass on Desktop + Mobile projects where applicable.

---

## P1-4 · Fix C — Concurrent-run UX

| Step | File | Change |
|------|------|--------|
| C1 | `src/components/shell/run-screen.tsx` | On mount, probe recent run activity: if `scrapeRunManager.hasActiveRun()` exposed via a lightweight `GET /api/scrape/status?active=1` (add route support), show "A scrape is already running" state with progress instead of enabling Run |
| C2 | Trigger route 409 body | Keep structured error; RunScreen toast copy → "A scrape is already running — watch its progress below" |

**Verify:** start live scrape → reload page → Run button shows running state,
not a clickable Run that 409s.

---

## P2-5 · Full regression + docs + release

| Step | Action |
|------|--------|
| R1 | Gates: vitest · tsc · eslint (0/0) · build · playwright full (expect 14+: 12 prior + D1/D2) · python suites (baseline/notifications/variant) with backup+restore discipline |
| R2 | Manual walkthrough mirroring the user's exact flow: Crate Cafe link → skip branches → add 2 competitors → Start Monitoring → confirm ONLY those scraped → dashboard populated |
| R3 | `gbp-monitor/CHANGELOG.md` Rule-2 entry (PROVEN with evidence) |
| R4 | AGENTS.md roadmap bullet + TROUBLESHOOTING #15 entry (competitors dropped / demo-set scraped) |
| R5 | Commit(s) + tag `v0.3.1`, clean tree |

---

## Definition of Done

- [ ] Skip-branches onboarding keeps every added competitor (persisted to
      `user-business.json.branches`)
- [ ] Discovery live scrape processes ONLY tenant-configured competitors;
      root `listings.json` untouched (mtime + content)
- [ ] Zero-competitor trigger → honest 422, no spawn
- [ ] Active-run reload → friendly running state (no dead-end 409 click)
- [ ] New e2e/API regression tests green; full suite green
- [ ] CHANGELOG + AGENTS updated; tagged v0.3.1; clean working tree

## Explicitly out of scope (unchanged deferrals)

Real webhook creds · GitHub Actions execution · parallel scraping ·
hours_status coverage · multi-tenant auth · PWA.
