# Changelog — Rother

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
