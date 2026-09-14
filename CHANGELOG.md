# Changelog — Rother

## 2026-09-13T16:30:00+07:00 — Vercel Web UI: Status Indicators + Hide Broken Features

- **Files:** `vercel.json`, `src/lib/vercel.ts` (new), `src/components/shell/app-shell.tsx`, `src/features/t-config.tsx`, `src/features/t-setup.tsx`, `src/features/t-scheduler.tsx`, `src/features/today.tsx`
- **Reason:** Make rotherweb.vercel.app usable for non-technical clients — show real-time scraping status and hide features that can't work on Vercel (no Python, no Playwright, no writable filesystem).
- **Changes:**
  1. **New `src/lib/vercel.ts` utility** — `isVercel()` and `isVercelOnlyFeature()` for client-side Vercel detection via `NEXT_PUBLIC_VERCEL` env var
  2. **vercel.json env** — added `NEXT_PUBLIC_VERCEL: "1"` so client knows it's on web
  3. **TopBar (every page)** — On Vercel, shows "Last scrape: 22m ago" + "+N new" badge + "Trigger Scrape" link to GitHub Actions (replaces broken Refresh button)
  4. **Today page** — New prominent green "Scraping is running automatically · Live" banner with last scrape time, competitors scraped, new reviews, next run, and "View on GitHub" link
  5. **Config page** — Hidden "Run scan again" button on Vercel, replaced with "Trigger manually →" link to GitHub Actions
  6. **Scraper Setup page** — Shows "This feature is not available on the web version" with explanation
  7. **Scheduler page** — Shows "GitHub Actions Cron is Active" with manual trigger link
  8. **Startup banner** — On Vercel, shows info card pointing to GitHub Actions instead of polling broken API
  9. **useScrapeStatus hook** — On Vercel, polls `/api/overview` for `runSummary` instead of broken `/api/scrape/status`; shows "Scraping runs on GitHub Actions" toast if user tries to trigger
- **Problems Solved:**
  - Non-technical clients couldn't tell if scraping was happening on Vercel
  - Broken UI elements (Refresh, Run scan, Scheduler toggle) gave "Failed" toasts with no explanation
  - No clear path to trigger a scrape from the web UI
- **Status:** PROVEN — tsc 0 errors, vitest 134/134, next build OK, Vercel auto-deploy triggered

## 2026-09-13T15:30:00+07:00 — Vercel Remote Data Layer: Fix latest.json Pointer + Workflow Bugs

- **Files:** `.github/workflows/scraper.yml`, `src/lib/gbp/remote-data.ts`, `src/lib/gbp/data-source.ts`, `.gitignore`
- **Reason:** Dashboard showed "Anonymous / N/A / (no text)" for all reviews; scraper workflow had two silent-failure bugs.
- **Changes:**
  1. **Fixed remote data layer pointer logic** (`src/lib/gbp/remote-data.ts`):
     - `fetchSnapshot()` now reads `latest.json` as a string (filename pointer) and fetches the actual snapshot file
     - `fetchAllSnapshots()` delegates to `fetchSnapshot()` (removed duplicate broken logic)
     - `fetchHarvestInfo()` reads `latest.json` pointer, then constructs `<filename>.metadata.json`
  2. **Applied `cleanReviewNames()` in remote mode** (`src/lib/gbp/data-source.ts`):
     - `readAllSnapshots()` and `readSnapshotAt()` strip `, original` suffix on remote data
  3. **Fixed workflow `--schedule` bug** (`.github/workflows/scraper.yml`):
     - Old: `python -m orchestration.run_all --schedule` → silently exits when `schedule.json` is missing on CI runner
     - New: `python -m orchestration.run_all` → runs all competitors unconditionally
  4. **Fixed workflow `git add` .gitignore bug** (`.github/workflows/scraper.yml`):
     - Root `.gitignore` line 74 ignores all `data/` directories
     - Added `-f` flag to force-add on data branch
  5. **Synced main branch** — remote `origin/main` was missing all Vercel/Phase 2 commits; force-pushed to align
- **Problems Solved:**
  - Reviews showed "Anonymous / N/A / (no text)" because `latest.json` (a pointer) was parsed as `Review[]`
  - Scraper workflow ran Python but never committed any data (silent failure)
  - Data branch existed but was empty (git add blocked by .gitignore)
- **Status:** PROVEN — Workflow #2 ran successfully (7m32s, 3 competitors, 1460 reviews), data branch populated, dashboard now shows real reviewer names and text

## 2026-09-13T14:43:50+07:00 — Phase 2: GitHub Actions Scraper + Vercel Remote Data Layer

- **Files:** `.github/workflows/scraper.yml` (new), `src/lib/gbp/remote-data.ts` (new), `src/lib/gbp/data-source.ts` (new), `src/lib/gbp/server-data.ts`, `src/lib/gbp/types.ts`
- **Reason:** Enable automatic scheduled scraping via GitHub Actions and serve scraped data to Vercel-hosted dashboard from GitHub data branch.
- **Changes:**
  1. **GitHub Actions workflow** (`.github/workflows/scraper.yml`):
     - Runs daily at 02:00 UTC via cron + manual dispatch with competitor filter
     - Installs Python deps, Playwright Chromium (cached), runs `python -m orchestration.run_all --schedule`
     - Commits `gbp-monitor/data/` to `data` branch on push
     - Uploads run_summary.json and run.log as artifacts (30-day retention)
  2. **Remote data fetcher** (`src/lib/gbp/remote-data.ts`):
     - Fetches from `https://raw.githubusercontent.com/pennoungen0-arch/Rother/data/gbp-monitor/...`
     - Covers: listings.json, selectors.json, run_summary.json, run.log, snapshots/, reviews_new/
     - 60-second in-memory cache with Next.js `next: { revalidate: 60 }` for CDN caching
  3. **Unified data source** (`src/lib/gbp/data-source.ts`):
     - Single abstraction switching between local filesystem (dev/Tauri) and remote GitHub (Vercel)
     - Auto-detects Vercel via `process.env.VERCEL === "1"` or `USE_REMOTE_DATA=true`
     - Implements all 18 data access functions: readListings, readSelectors, readRunSummary, readAllSnapshots, readHarvestInfo, listSnapshots, readSnapshotAt, readAllDeltas, readLatestDelta, tailLog, assessDataStatus, resolveMonitoredConfig, readActiveBusinessBranches, writeActiveBusinessBranches, writeEffectiveListings, readCategoryScan, readActiveBusiness
  4. **Server-data refactor**: Now pure re-exports from data-source.ts — all 25 API routes work unchanged
  5. **Types**: Added `HarvestInfo` and `SnapshotEntry` exports to types.ts
- **Problems Solved:**
  - Vercel has no persistent filesystem → data now served from GitHub data branch
  - Scraper must run on schedule → GitHub Actions cron + manual dispatch
  - Zero cost → GitHub Actions free tier (2000 min/mo) + Vercel free tier
  - No manual client steps → fully automatic, client just opens `rotherweb.vercel.app`
- **Status:** PROVEN — local build succeeds, all 134 vitest tests pass, tsc 0 errors, eslint only pre-existing issues. GitHub Actions workflow ready to trigger.

## 2026-09-12T23:05:17+07:00 — Vercel Web Deployment (Phase 1 Complete)

- **Files:** `package.json`, `vercel.json` (new), `next.config.ts`, `.vercelignore` (new), `.github/workflows/` (pending)
- **Reason:** Deploy the Next.js dashboard to Vercel for universal browser access (zero-cost, any OS/device).
- **Changes:**
  1. **Added `@types/node` ^22 to devDependencies** — was completely missing, causing `ENOENT` build failure on Vercel (`npx next build` requires TypeScript types).
  2. **Fixed `vercel.json` build command** — changed from `npm run build` (runs Tauri-specific `build.mjs`) to `npx next build` directly. `build.mjs` copies standalone output to `src-tauri/frontend-dist` which Vercel doesn't need.
  3. **Conditional `output: "standalone"` in `next.config.ts`** — now `output: process.env.VERCEL ? undefined : "standalone"`. Vercel auto-sets `VERCEL=true`, so it uses default serverless mode. Local/Tauri builds keep standalone output for `build.mjs` to copy to `src-tauri/frontend-dist`.
  4. **Created `.vercelignore`** — excludes `gbp-monitor/`, `src-tauri/`, `docs/`, `rother02-archive/`, `prisma/`, `node_modules/` from deployment (reduces upload size, scraper runs separately).
  5. **Created Vercel project `rotherweb`** — connected to GitHub `pennoungen0-arch/Rother`, production branch `main`, region `sin1` (Singapore). Auto-deploys on push to `main`.
  6. **Deployment live at `https://rotherweb.vercel.app`** — dashboard loads, onboarding screen renders, all 29 API routes registered.
- **Problems Solved:**
  - `ENOENT: no such file or directory, open '/vercel/path0/.next/next-server.js.nft.json'` → caused by `output: "standalone"` incompatible with Vercel serverless deployment.
  - `Please install @types/node by running: npm install --save-dev @types/node` → missing from package.json entirely.
  - Build command running Tauri wrapper (`build.mjs`) → Vercel only needs `next build`.
- **Status:** PROVEN — local `npx next build` succeeds, Vercel build succeeds, dashboard accessible at production URL.

## 2026-09-09T06:00:00+07:00 — GMB Everywhere-inspired presentation improvements (Phase 1)

- **Files:** `src/components/dashboard/reviews-section.tsx`, `src/components/dashboard/review-word-cloud.tsx`,
  `src/app/api/reviews/route.ts`, `src/lib/gbp/types.ts`, `src/lib/gbp/server-data.ts`,
  `src/lib/app-state.tsx`, `docs/engineering/IMPROVEMENT_PLAN_2026-09.md` (new),
  `GMB_EVERYWHERE_ROTHER_ANALYSIS_2026-09-05.md` (new)
- **Reason:** Close the presentation-layer gap identified in the discussion_history
  analysis of GMB Everywhere's feature set.
- **Changes:**
  1. **Keyword highlight** in reviews table — matching search terms highlighted in yellow
  2. **Match count indicator** — "N matches on this page" badge
  3. **"Showing X of Y" header** — displays total Google review count alongside captured count
  4. **Word cloud click integration** — clicking a word sets the review search filter
  5. **New review badges** in review table — "New" badge on reviews from latest delta
  6. **Hours + Category columns** in comparison table
  7. **Business metadata** (phone, website, category) in sheet view
  8. **Hours status** on competitor cards
- **Status:** PROVEN — vitest 134/134, tsc 0 errors, eslint only pre-existing warnings.

## 2026-09-07T10:30:00+07:00 — macOS Compatibility Phase 1

- **Files:** `src-tauri/src/main.rs`, `src/app/api/setup/detect/route.ts`,
  `src-tauri/tauri.conf.json`, `src-tauri/entitlements.plist` (new),
  `src-tauri/binaries/node-x64-apple-darwin` (new),
  `src-tauri/binaries/node-arm64-apple-darwin` (new),
  `.github/workflows/macos.yml` (new), `MACOS_COMPATIBILITY_PLAN.md` (new)
- **Reason:** Port the Tauri desktop app to macOS. Single-codebase approach
  with platform-conditional gates (no separate folder).
- **Changes:**
  1. `killProcessTreeByPid` in `main.rs`: Added macOS branch using `pkill -P`/`kill`
     (BSD `kill` has no `-p` flag; Linux `-p` syntax crashes on macOS).
  2. Port cleanup guard in `main.rs` (line 313): Extended from Windows-only
     to `windows || macos` so orphaned sidecar processes are cleaned on macOS.
  3. `detect/route.ts`: Fixed Chromium browser path detection. Was hardcoded
     to `%LOCALAPPDATA%\ms-playwright` (Windows). Now platform-specific:
     macOS → `~/Library/Caches/ms-playwright`, Linux → `~/.cache/ms-playwright`.
  4. `tauri.conf.json`: Added `"macOS"` bundle section with entitlements.plist
     path + `minimumSystemVersion: "13.0"`.
  5. `entitlements.plist`: New hardened runtime entitlements with
     `allow-unsigned-executable-memory` (required for Playwright Chromium).
  6. `binaries/`: Added Node.js v22.11.0 standalone binaries for `x64-apple-darwin`
     (Intel) and `arm64-apple-darwin` (Apple Silicon).
  7. `.github/workflows/macos.yml`: New CI workflow with build matrix for both
     architectures, code signing + notarization via Apple secrets.
- **Status:** PROVEN — `cargo check` passes, `tsc` 0 errors, `eslint` 0 errors,
  `vitest` 134/134, `verify_baseline` 168/168, `next build` succeeds.
  Phase 2 (actual macOS `.app` build) blocked: requires macOS build host.
  Phase 3 (notarization) blocked: requires Apple Developer account ($99/yr).

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
