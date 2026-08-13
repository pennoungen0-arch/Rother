# Known Limitations — Rother v0.2.0

## Live Google Maps Scraping Untested

The scraper's live mode has never been exercised against real Google Maps. All competitor URLs in `config/listings.json` are mock values. Live scraping requires:

- Valid `place_id` values in `config/listings.json`
- `playwright install chromium` in `gbp-monitor/`
- Verification against real Google Maps DOM (selectors are UNPROVEN — last verified 2023)

## Log Rotation Warning (Windows)

"Failed to rotate run.log: file in use" appears on Windows when a new run starts while the previous process still holds the file handle. Cosmetic only — log writes continue to the existing file. No data loss.

## Snapshot O(n) Reads

Every API call to `readAllSnapshots()` reads all snapshot files from disk for all competitors. Fine at current scale (~3 competitors). Does not scale to hundreds of competitors without caching.

## Test Coverage

34 tests across 2 test files. Covers date parsing and health-trend JSONLOG parsing. No integration tests for API routes or end-to-end scraper → dashboard data flow.

## No CI Pipeline

The GitHub Actions workflow runs the scraper only. It does not build, test, or lint the dashboard. CI verification is a manual process.

## Dual Lockfile (Historical)

`bun.lock` was removed from the repository in 0.2.0. If you have a local copy, delete it and use `npm install`.
