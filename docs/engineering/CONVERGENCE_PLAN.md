# Convergence Plan — Unifying v1 Scraper + v2 UI/UX

> **Goal:** Build a single Rother product that combines v1's **proven scraping/monitoring
> pipeline** with v2's **superior UI/UX architecture**.
>
> **Target:** Replace the current v1 dashboard (`src/`) with a v2-shell-based dashboard
> that runs on v1's certified scraper. Keep `gbp-monitor/` as the single source of truth
> for scraping.

---

## 1. Product Model Decision (must decide first)

| Option | Description | Trade-off |
|---|---|---|
| **A. Multi-competitor (v1 model)** | User configures a fixed list of competitors to watch. Dashboard shows all. | Simpler backend; matches current production use case (Copenhagen Bali set). |
| **B. Single-business + auto-discovery (v2 model)** | User onboards *their* business; competitors discovered via OSM/category scan. | Better UX (onboarding, geo-grid, competitive health); backend for arbitrary-business acquisition **not yet built** (RISK-023/024/028). |
| **C. Hybrid (recommended)** | **Phase 1:** v1 model in v2 shell (fixed competitor list, v2 navigation/features). **Phase 2:** Add onboarding + discovery as optional layer. | De-risks backend work; delivers v2 UX value immediately; discovery is additive. |

**Decision for this plan:** **Option C (Hybrid)** — start with v1's competitor-list model inside v2's shell, then layer onboarding/discovery later.

---

## 2. Architecture Target

```
rother (single repo)
├── gbp-monitor/                 # v1 scraper — UNCHANGED (single source of truth)
│   ├── orchestration/run_all.py # certified, tested, production-ready
│   ├── harness/                 # stale-NID guard, probes, scroll capture
│   ├── parser/, storage/, notifications/ — all proven
│   └── data/                    # snapshots/, reviews_new/, run_summary.json
├── src/                         # CONVERGED: v2-shell dashboard wired to v1 pipeline (Phase 0 done)
│   ├── components/shell/        # AppShell, LoginScreen, Onboarding, RunScreen, Hub, SectionView, FeaturePage
│   ├── lib/features.tsx         # 28 feature registry (adapted to v1 data shapes)
│   ├── lib/app-state.tsx        # useSyncExternalStore + localStorage (single-business or multi-competitor mode)
│   ├── lib/gbp/use-api-query.ts # TanStack Query hitting v1 API routes
│   ├── features/                # i-*, r-*, c-*, t-* lazy feature pages (adapted)
│   └── app/api/                 # 29 routes (v1 core + new-reviews + v2 extras)
├── docs/engineering/            # CONVERGENCE_PLAN.md, ROTHER02_ANALYSIS.md, etc.
└── rother02-archive/            # ARCHIVE — reference only, excluded from build/test
```

---

## 3. Migration Phases

### Phase 0 — Prep ✅ DONE (2026-08-17)
- [x] Archive `rother02/` → `rother02-archive/` (renamed, untracked, excluded
      from tsconfig/vitest/gitignore; `imagetest/` also ignored)
- [x] Copy `rother02/src` → `src/` (wholesale — v2 shell is a superset of v1 UI)
- [x] Remove Tauri (`src-tauri/` stays only in archive; no tauri dep in package.json)
- [x] Merge `package.json` deps (Tailwind v3 stack, leaflet, optional lightningcss)
- [x] Fix 2 pre-existing tsc errors (tailwind oklch typing, `gmaps_place_id`)
- [x] Restore `/api/new-reviews` + new-reviews types (dropped by wholesale copy)
- [x] Verify `npm install && npm run dev` on :3000 + tsc/vitest/eslint green
      (34/34 tests, 0 tsc errors, eslint exit 0; `/api/overview` = 5,021 reviews)
- [ ] Remaining: `data/`-backup discipline unchanged; run full Python suite at next milestone

### Phase 1 — Shell + Data Wiring (3–5 days)
- [ ] **AppShell** — keep gated flow (login → onboarding → run gate → hubs) but:
  - Login: replace mock with **v1 config-driven auth** (or keep mock for local-dev, add real OAuth later)
  - Onboarding: **Option C** → step 1 = select "monitoring mode": (a) Fixed competitor list (v1) OR (b) My business + discovery (v2). Start with (a) only.
  - RunScreen: call v1's `POST /api/scrape/trigger` (already exists)
  - Hubs: keep 4-hub structure (Insights, Reputation, Competitors, Tools)
- [ ] **App State** (`useSyncExternalStore`):
  - Persist: `user`, `business` (optional), `mode` ('fixed' | 'discovery'), `runStarted`, `selectedCompetitors[]`
  - Remove single-business invariant (`readListings()` returning `[]`)
- [ ] **API Layer** (`useApiQuery`):
  - Point at v1 endpoints: `/api/overview`, `/api/branches`, `/api/reviews`, `/api/new-reviews`, `/api/alerts`, `/api/run-history`, `/api/run-summary`, `/api/config/listings`
  - Add transformers to map v1 JSON → v2 feature props

### Phase 2 — Feature Port (5–8 days)
Port 28 features from v2 to v1 data shapes. Priority order:

| Priority | Features | Notes |
|---|---|---|
| **P0 (core)** | KPIs, Run Health, Run History, Run Comparison, All Reviews, Branches & Competitors, Branch Comparison, Leaderboard, Configuration, Run Logs | Direct v1 data matches |
| **P1 (analytics)** | Rating Distribution, New Reviews per Branch, Reviews over Time, Review Lengths, Word Cloud | v1 has review text + dates |
| **P2 (v2-exclusive)** | **Geo Grid**, **Competitive Health**, **Discover Competitors**, **Competitor Correlation**, **Growth Rate**, **Radar Compare**, **Rating Distribution Compare**, Review Recency Heatmap, Review Language, Top Reviewers | Need new data derivations |
| **P3 (ops)** | Export Data, Scrape Schedule, Shortcuts Help, Live Clock, Freshness Badge, Health Sparkline, Auto-refresh Toggle, Competitor Detail Dialog, Alerts | Mostly UI |

**Key adaptations for P2:**
- **Geo Grid** → plot v1's 12 competitors (lat/lng from `listings.json` or geocode on demand). No arbitrary-business backend needed.
- **Competitive Health** → use v1's selector-health + run-health + OSM discovery (can call `/api/discover` stub now, implement later).
- **Discover Competitors** → build UI first, backend = `POST /api/discover` returning OSM results (mock initially).
- **Correlation / Growth Rate / Radar** → pure client-side derivations from v1 review time-series.

### Phase 3 — Polish + Hardening (2–3 days)
- [ ] Command palette (Cmd+K) searching all 28 features
- [ ] Design system: Bali oklch palette + Geist fonts (copy `globals.css`, `tailwind.config.ts`)
- [ ] Reduced-motion, a11y (aria labels, focus rings, `aria-busy`)
- [ ] Offline/online toasts (`OnlineStatusProvider`)
- [ ] Empty states themed (copy v2 patterns)
- [ ] Test suite: vitest (77→100+), playwright e2e for critical flows
- [ ] Update CI: add dashboard build/test/lint to GitHub Actions

### Phase 4 — Optional: Onboarding + Discovery (future)
- [ ] Real OAuth (Google) replacing mock login
- [ ] Onboarding step 1: business search (OSM autocomplete + Maps link paste)
- [ ] Onboarding step 2: branch locations
- [ ] `POST /api/discover` real implementation (category scan + OSM)
- [ ] Switch `mode` to 'discovery' → hide fixed competitor config

---

## 4. Data Shape Mapping (v1 → v2 features)

| v1 API | v2 Feature Consumers |
|---|---|
| `GET /api/overview` → `{competitors: [{id, name, rating, reviewCount, ...}]}` | KPIs, Leaderboard, Branch Comparison, Branches & Competitors |
| `GET /api/branches` → `{branches: [...], competitors: [...]}` | Branches & Competitors, Branch Comparison |
| `GET /api/reviews?competitor_id=X` → `{reviews: [...], meta}` | All Reviews, Reviews over Time, Review Lengths, Word Cloud, Recency Heatmap, Language, Top Reviewers |
| `GET /api/new-reviews` → `{newReviews: [...]}` | New Reviews per Branch, Alerts |
| `GET /api/run-history` → `[{timestamp, success, failed, newReviews, ...}]` | Run History, Run Comparison, Run Health |
| `GET /api/run-summary` → `{selectorHealth, durations, ...}` | Run Health, Run Logs |
| `GET /api/alerts` → `[{type, message, ts, ...}]` | Alerts |
| `GET /api/config/listings` → `{branches, competitors}` | Configuration |
| `POST /api/scrape/trigger` → `{runId, status}` | RunScreen trigger |

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| v2 shell expects single-business; v1 is multi-competitor | Phase 1 `mode` flag in app-state; features branch on `mode` |
| v2 features assume arbitrary-business data (geo-grid, discovery) | Build UI against v1's fixed 12 competitors first; discovery backend later |
| TanStack Query cache keys differ | Wrap v1 endpoints in `useApiQuery` with stable keys |
| Port 3000 conflict during transition | Run v1 on :3001 temporarily (`PORT=3001 npm run dev`) |
| `rother02` deps conflict with v1 | Audit `package.json`; v2 uses newer shadcn/ui, framer-motion, leaflet — add to v1 |
| Data loss during `verify_baseline` | Backup discipline unchanged (already documented) |

---

## 6. Success Criteria (Definition of Done)

- [ ] Single `npm run dev` starts dashboard on :3000 with v2 shell
- [ ] Login → (optional onboarding) → Run → Hubs navigable
- [ ] All 28 features render with **v1 production data** (12 competitors, 5,021 reviews)
- [ ] Geo Grid plots the 12 competitors on Leaflet/OSM map
- [ ] Run Now triggers live scrape via v1 pipeline; results appear in New Reviews
- [ ] Alerts tab shows v1 scrape failures + new-review alerts
- [ ] Config tab edits `listings.json` (v1 validation)
- [ ] `npx vitest run` ≥ 100 tests pass; `npx tsc --noEmit` 0 errors; `npx eslint src` exit 0
- [ ] GitHub Actions: build + test + lint on PR; daily scrape workflow unchanged
- [ ] `rother02/` archived; no code duplication

---

## 7. Effort Estimate

| Phase | Days | Notes |
|---|---|---|
| Phase 0 (Prep) | 1 | Mechanical copy + deps |
| Phase 1 (Shell + Data) | 3–5 | Core wiring |
| Phase 2 (Features) | 5–8 | Bulk of work; parallelizable |
| Phase 3 (Polish) | 2–3 | Quality bar |
| **Total** | **11–17 days** | ~2–3 weeks |

---

## 8. Immediate Next Steps

1. **Create `CONVERGENCE_PLAN.md`** (this file) — ✓
2. **Update `AGENTS.md`** to reference this plan as the active convergence strategy
3. **Archive `rother02/`** — `git mv rother02 rother02-archive` (or tag and delete)
4. **Start Phase 0** — copy `rother02/src` → new `src/`, merge deps
5. **Daily standups** — track against phase checklists

---

## 9. Reference Links

- v1 scraper certification: `gbp-monitor/docs/engineering/SELECTOR_CERTIFICATION.md`
- v1 project summary: `gbp-monitor/docs/engineering/PROJECT_SUMMARY.md`
- v2 analysis: `docs/engineering/ROTHER02_ANALYSIS.md`
- v2 known limitations: `rother02/KNOWN_LIMITATIONS.md`
- v1 current state: `gbp-monitor/docs/engineering/CURRENT_STATE_2026-08-13.md`