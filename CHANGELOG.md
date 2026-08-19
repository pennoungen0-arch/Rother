# Changelog — Rother

## Phase 2 (2026-08-19) — Feature port data-gap fixes

### Added
- **v2 runSummary contract from v1 data.** `/api/overview` now derives
  `status`/`reviewCount`/`targetCount` from v1 `run_summary.json`
  (`success`/`failed`/`total_reviews`/`total_competitors`) so v2 consumers
  (ScrapeSchedule "Last scrape run" panel) render in fixed mode. Added
  optional `total_competitors` to `RunSummary` type. Never overwrites fields
  the v2 single-path scraper already wrote.

### Changed
- **Competitive Health works in fixed mode.** `/api/competitive-health` removed
  its hard 409 (was "No active business") and is now tenant-scoped like
  `/api/overview`: prefers the active business, falls back to the fixed
  competitor list. Enrichment counts `gmaps_place_id OR place_id` (both the
  OSM-discovery and configured-list fields). `discoveredAt` null-safe.
- **c-competitive-health feature** gated: "Re-run discovery" button + OSM badge
  + auto-discovery only shown/run in `discovery` mode; fixed mode shows a
  config/run-health description instead.
- **c-discover feature** shows an explanatory EmptyState in fixed mode
  (discovery is a single-business capability; competitor set comes from
  `listings.json`).

### Verified (Rule 1)
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 2 files / 34 tests pass.
- `npx eslint src` → exit 0 (0 errors, 4 pre-existing warnings).
- Dev :3000 → `/api/overview` 200 (`runSummary.status=OK`, `reviewCount=5021`,
  `targetCount=12`); `/api/competitive-health` 200 (`competitors=12`,
  `source=none`, `enrichedPct=100`, `correlationAvailable=true`, `branches=6`);
  `/api/category-scan` GET 200 empty fallback (discovery-only UI gated);
  `/api/competitors/discover` 409 (no active business — correct).
  `data/` untouched.

## Phase 1 (2026-08-19) — Fixed-list mode (v1 model in v2 shell)

### Added
- **Monitoring mode selector.** `MonitoringMode` (`"fixed" | "discovery"`) added
  to `src/lib/app-state.tsx`, persisted in localStorage (`rother.mode`, default
  `"fixed"`), exposed via `setMode`. Switching modes resets the run gate.
- **Login screen mode picker.** `src/components/shell/login-screen.tsx` now offers
  two monitoring modes: "Fixed competitor list" (v1) and "My business +
  discovery" (v2).
- **Fixed-mode AppShell gating.** `src/components/shell/app-shell.tsx` skips
  Onboarding in fixed mode (login → run gate → hubs); discovery mode keeps the
  onboarding step. TopBar + Hub labels show "Competitor list" in fixed mode.

### Changed
- **Fixed-mode RunScreen.** `src/components/shell/run-screen.tsx` POSTs
  `/api/scrape/trigger` with an EMPTY body in fixed mode — so no
  `user-business.json` is written and the fixed competitor list remains the
  active dataset. Discovery mode keeps the business-bodied POST.
- **Removed the single-business invariant.** `src/lib/gbp/server-data.ts`
  `readListings()` no longer returns `[]` when `user-business.json` exists — the
  fixed competitor list from `listings.json` is always the UI-facing dataset
  (v1 model). Deleted now-unused `hasActiveUserBusiness()`. Updated stale
  comments on `readSeedListings`/`readActiveBusinessBranches`.
- **Tools › Config branches by mode.** `src/features/t-config.tsx` shows the
  configured competitor list (branch/competitor counts from
  `/api/config/listings`) with a re-run affordance in fixed mode; keeps the
  per-business view in discovery mode.

### Verified (Rule 1)
- `npx tsc --noEmit` → 0 errors.
- `npx vitest run` → 2 files / 34 tests pass.
- `npx eslint src` → exit 0 (0 errors, 4 pre-existing warnings).
- Dev :3000 → `/api/overview` HTTP 200 (`totalReviews=5001`, 12 competitors,
  6 branches), `/api/branches` 200, `/api/geo-grid` 200, `/api/competitive-health`
  409 (discovery-only, correct in fixed mode). Empty-body trigger POST 200 and
  does NOT create `gbp-monitor/config/user-business.json`. `data/` untouched.

## Phase 0 (2026-08-17) — Convergence kickoff

### Added
- **Converged dashboard: v2 shell wired to v1 pipeline.** Copied `rother02/src`
  (AppShell: login → onboarding → run gate → 4 hubs → 28 lazy features, Cmd+K
  palette, geo-grid, discovery, Bali oklch design system) into `src/`, replacing
  the v1 tabbed dashboard. `gbp-monitor/` (certified scraper) untouched.
- Restored `/api/new-reviews` (v1 route absent from v2 shell) + re-added
  `NewReviewsResponse`/`NewReviewGroup`/`NewReviewsRun` types to `types.ts`.
- `rother02/` archived → `rother02-archive/` (untracked, excluded from
  tsconfig/vitest/gitignore). `tsconfig.json`, `vitest.config.mjs`, `.gitignore`
  updated accordingly.
- `package.json` deps merged: adopted Tailwind v3 stack (tailwindcss,
  autoprefixer, postcss, tailwindcss-animate), added leaflet + @types/leaflet
  (geo-grid), kept `lightningcss-linux-x64-gnu` in `optionalDependencies`
  (Windows-safe), dropped Tauri CLI + v4-only deps.
- `next.config.ts` updated: OSM tile URLs added to CSP (geo-grid), turbopack
  root set. `postcss.config.mjs`/`tailwind.config.ts`/`components.json` now from
  v2 (oklch palette, Geist fonts).
- `tailwind.config.ts` oklch opacity-function colors typed via
  `ResolvableTo<RecursiveKeyValuePair>` cast (Tailwind v3 rejects the function
  form in types); fixed `CompetitorConfig.gmaps_place_id` type in `types.ts`.
- `docs/engineering/CONVERGENCE_PLAN.md` — full 4-phase migration strategy.

### Verified (Rule 1)
- `npx vitest run` → 2 files / 34 tests pass (active `src/` only; archive
  excluded).
- `npx tsc --noEmit` → 0 errors (0 `src/` errors).
- `npx eslint src` → exit 0 (0 errors, 4 pre-existing warnings).
- `npm run dev` → Next.js 16.2.11 on :3000; `/`, `/api/overview` (5,021
  reviews), `/api/new-reviews`, `/api/history`, `/api/branches`,
  `/api/geo-grid`, `/api/competitive-health` all HTTP 200 with production data.
- `python -m tests.verify_variant_framework` → 32/32 (gbp-monitor unchanged,
  0 diff).

## Unreleased (2026-08-17)

### Added
- `docs/engineering/ROTHER02_ANALYSIS.md` — two-version reference: current v1
  (multi-competitor monitoring, proven scraper, tabbed dashboard) vs `rother02/`
  (single-business UX-first rewrite: login → onboarding → run gate → 4 hubs,
  28 lazy features, Cmd+K palette, geo-grid map, competitive health, category
  discovery; Tauri desktop scaffold). Covers architecture, design system, new
  features, gaps, GMB-Everywhere-style feature coverage, and the convergence
  strategy.
- `AGENTS.md` updated with a "Two versions" section (see below).

### Fixed (rother02)
- Windows `npm install` hard-fail: `lightningcss-linux-x64-gnu` (a Linux-only
  binary) was a hard dependency — moved to `optionalDependencies` in
  `rother02/package.json`. Dev server verified running (Next.js 16.2.11,
  HTTP 200 on :3000).

## 0.2.0 (2026-07-29)

### Added
- Versioned snapshot storage with `latest.json` pointer
- Health-trend endpoint with JSONLOG run_summary parsing
- Graceful shutdown (SIGTERM/SIGINT handlers, killProcessTree)
- Rate limiting (20 req/min per IP) via middleware
- Competitor_id validation on API filesystem paths
- Vitest configuration excluding build output
- Audit trail documentation (PRODUCTION_VALIDATION_REPORT, RELEASE_CANDIDATE_REPORT, FINAL_RELEASE_CERTIFICATION)

### Changed
- Migrated from Bun to npm as single package manager
- Replaced hardcoded `/home/z/...` paths with configurable `GBP_ROOT` env var
- Replaced `Run summary:` log format with structured JSONLOG
- Fixed progress reporting (stderr JSONLOG parsing)
- Standardized all API responses on `satisfies` typed patterns
- Updated version display from 0.0.1 to 0.2.0

### Fixed
- TOCTOU race condition in POST /api/scrape/trigger (check-and-start now atomic)
- Health-trend endpoint returning empty points (regex now matches JSONLOG)
- `PROCESS_TIMEOUT_MS` set to 600s (was 0.6s — 600ms)
- Zombie Python processes on Windows (taskkill /T /F)
- ESLint re-enabled: 37 errors + 43 warnings resolved across 39 files
- 0 tsc errors, 0 ESLint warnings, clean production build

### Removed
- `bun.lock` from repository (npm is single package manager)

### Security
- Added competitor_id input validation matching Python `_sanitize_competitor_id()`

## 0.1.0 (2026-07-20)

### Added
- Initial project scaffolding
- Python scraper (fixtures + live mode)
- Next.js dashboard with 21 API routes
- shadcn/ui component library
- Fixture-based scraper verification
