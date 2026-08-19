# Post-Convergence Hardening Plan

> **Goal:** Raise confidence in the *current* converged product (v2 shell on v1 pipeline,
> fixed-list mode) before any optional Phase 4 work.
>
> **Context:** All 8 roadmap milestones + Phases 0–3 complete. 12 competitors / 5,021
> reviews in committed production data. Dashboard on :3000, scraper in gbp-monitor/.

---

## 1. Per-Feature Browser Check (28 features)

**Target:** Expand Playwright e2e from 2 smoke tests → full 28-feature coverage.

**Approach:** Each test logs in → run gate → clicks hub → clicks feature tile → asserts
real data renders (no skeletons, no "no data" empty states).

**Priority order (matching CONVERGENCE_PLAN.md):**

| Priority | Hub | Features | Expected Data Assertions |
|---|---|---|---|
| **P0** | Insights | KPIs, Run Health, Run History, Run Comparison, All Reviews, Branches & Competitors, Branch Comparison, Leaderboard, Configuration, Run Logs | KPIs: `totalReviews=5001`, `totalCompetitors=12`; Leaderboard: 12 rows; Branches: 6 branches |
| **P1** | Reputation | Rating Distribution, New Reviews per Branch, Reviews over Time, Review Lengths, Word Cloud | Ratings: 1★–5★ counts sum to 5001; New Reviews: ≥0; Word Cloud: ≥1 word |
| **P2** | Competitors | Geo Grid, Competitive Health, **Discover Competitors** (gated), Competitor Correlation, Growth Rate, Radar Compare, Rating Distribution Compare, Review Recency Heatmap, Review Language, Top Reviewers | Geo Grid: 12 markers; Correlation: matrix ≥2×2; Growth Rate: ≥1 bar |
| **P3** | Tools | Export Data, Scrape Schedule, Shortcuts Help, Live Clock, Freshness Badge, Health Sparkline, Auto-refresh Toggle, Competitor Detail Dialog, Alerts | Schedule: next run time; Export: CSV download |

**Test file:** `e2e/features.spec.ts` (new), one `test()` per feature.
**Data dependency:** Requires committed Aug-13 production data in `gbp-monitor/data/`.

---

## 2. Consolidate Duplicated Types

**Target:** Move all inline/duplicate interfaces into `src/lib/gbp/types.ts` as single
source of truth; update imports across `src/features/` and `src/components/dashboard/`.

**Known duplicates to promote:**

| Interface | Current Location(s) | Target |
|---|---|---|
| `CorrelationData` / `CompetitorCorrelation` | `competitor-correlation.tsx` | `types.ts` |
| `RatingDistResponse` / `RatingDistributionData` | `rating-distribution.tsx`, `rating-dist-comparison.tsx` | `types.ts` |
| `HealthResponse` / `RunHealthData` | `run-health.tsx`, `competitive-health.tsx` | `types.ts` |
| `GrowthRateEntry` / `GrowthRateData` | `competitor-growth-rate.tsx` | `types.ts` |
| `RadarCompareData` | `radar-compare.tsx` | `types.ts` |
| `ReviewLengthsData` | `review-lengths.tsx` | `types.ts` |
| `TopReviewer` / `TopReviewersData` | `top-reviewers.tsx` | `types.ts` |
| `LanguageData` / `ReviewLanguageData` | `language.tsx` | `types.ts` |
| `HeatmapData` / `RecencyHeatmapData` | `recency-heatmap.tsx` | `types.ts` |
| `AlertItem` / `AlertsData` | `alerts.tsx` | `types.ts` |

**Verification:** `npx tsc --noEmit` 0 errors; all features still render.

---

## 3. Resolve UNPROVEN Items (AGENTS.md)

| Item | Action | Verification |
|---|---|---|
| **Live webhook delivery** | Add a `webhook.site` URL to `gbp-monitor/config/notifications.json` (`webhook.url`); run `python -m orchestration.run_all --fixtures` (offline run triggers notifier); check webhook.site receives payload. | Payload received with `run_summary` + any `new_reviews`. |
| **Live SMTP delivery** | Add real SMTP creds (or use Ethereal test account) to `notifications.json`; run offline scrape; verify email arrives. | Email received with subject "Rother Scrape Complete". |
| **GitHub Actions execution** | Push `test/m15-1-validation` branch to origin; confirm both `Python Tests` and `Dashboard` jobs pass in Actions tab. | Both jobs green on PR. |
| **`hours_status` coverage** | Document which of the 12 businesses render `hours_status` (manual check via `/api/overview` → `branches[].hours_status`); update CURRENT_STATE.md §7. | Coverage table in docs. |

---

## Execution Order

1. **Types consolidation** (1–2 hrs) — clears import debt, no runtime risk.
2. **Per-feature e2e** (2–3 hrs) — run against local dev server; commit tests.
3. **UNPROVEN items** (1–2 hrs) — webhook/SMTP need external creds; GH Actions needs push.
4. **Final verification** — full local gate: `npx vitest run && npx tsc --noEmit && npx eslint src && npm run test:e2e && npm run build` all green.

---

## Success Criteria

- [x] `e2e/features.spec.ts` covers all 28 features; `npm run test:e2e` 28/28 pass.
- [x] Zero duplicate type definitions outside `src/lib/gbp/types.ts`.
- [ ] Webhook + SMTP delivery proven with real endpoints.
- [ ] GitHub Actions CI green on this branch.
- [ ] `hours_status` coverage documented.

---

## Out of Scope (Phase 4)

- Real Google OAuth
- Onboarding flow (business search, branch picker)
- `POST /api/discover` implementation
- Switch to `mode: 'discovery'`

These remain future work triggered by a real user need.