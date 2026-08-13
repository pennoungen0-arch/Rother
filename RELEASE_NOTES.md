# Release Notes — Rother v0.2.0

**Release date:** 2026-07-29

## Overview

Rother is a zero-cost, no-AI competitor review monitoring dashboard. It scrapes Google Maps review data using Playwright and presents insights through a Next.js dashboard.

## What's New in 0.2.0

- **Health monitoring** — New `/api/health-trend` endpoint displays scrape run health over time
- **Graceful shutdown** — SIGTERM/SIGINT handlers cleanly terminate child processes on all platforms
- **Rate limiting** — 20 requests per minute per IP per endpoint (configurable in middleware)
- **Robust race prevention** — Concurrent trigger requests no longer spawn duplicate scraper processes
- **Security hardening** — Competitor_id inputs are validated before filesystem operations
- **Consistent packaging** — Standardized on npm (Bun lockfile removed)

## Breaking Changes

None. All API responses are backwards-compatible with 0.1.0.

## Known Limitations

See `KNOWN_LIMITATIONS.md` for details.

## Installation

```bash
npm install
npm run build
npm start
```

## Verification

```bash
npm test
npx tsc --noEmit
eslint .
```

All three should pass with zero errors.
