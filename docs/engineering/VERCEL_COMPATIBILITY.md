# Vercel Compatibility Matrix

**Last updated:** 2026-09-13T16:30:00+07:00  
**Scope:** rotherweb.vercel.app (Vercel deployment) vs localhost (Tauri/desktop)  
**Context:** Vercel runs serverless Next.js — no Python, no Playwright, no writable filesystem.

---

## Architecture Summary

| Environment | Runtime | Data Source | Scraper | Config Writes |
|---|---|---|---|---|
| **Local / Tauri** | Node.js + Python | Local filesystem | Playwright (local) | ✅ Read/write |
| **Vercel** | Serverless Node.js | GitHub `data` branch (raw.githubusercontent.com) | GitHub Actions (remote) | ❌ Read-only |

When `VERCEL=1` env var is set, `data-source.ts` switches all read functions to `remote-data.ts`, which fetches from `raw.githubusercontent.com/pennoungen0-arch/Rother/data/gbp-monitor/...`.

---

## Feature Compatibility

### ✅ WORKS on Vercel (18 routes)

All read-only dashboard features work:

| Feature | Route | Notes |
|---|---|---|
| KPI Dashboard | `GET /api/overview` | Review counts, ratings, run status |
| All Reviews | `GET /api/reviews` | Searchable, filterable, paginated |
| Reviews over Time | `GET /api/reviews-over-time` | Timeline + heatmap |
| Review Lengths | `GET /api/review-lengths` | Text length distribution |
| Run History | `GET /api/history` | Run timeline |
| History Export | `GET /api/history/export` | CSV/JSON download |
| Run Comparison | `GET /api/history/compare` | Side-by-side snapshots |
| New Reviews | `GET /api/new-reviews` | Full review content for alerts |
| Alerts | `GET /api/alerts` | Competitor alerts |
| Export Competitors | `GET /api/export/competitors` | CSV/JSON |
| Export Branches | `GET /api/export/branches` | CSV/JSON |
| Reviews Export | `GET /api/reviews/export` | CSV/JSON download |
| Run Logs | `GET /api/logs` | Fetched from data branch |
| Branches | `GET /api/branches` | Branch overview |
| Competitor Correlation | `GET /api/competitor-correlation` | Cosine similarity matrix |
| Selectors Config | `GET /api/config/selectors` | Read-only |
| Geo Grid | `GET /api/geo-grid` | Coordinates (no business point) |
| Places Geocoding | `GET /api/places` | HTTP geocoding (disk cache silently fails) |

### ⚠️ DEGRADED on Vercel (3 routes)

These return empty/default data instead of crashing:

| Feature | Route | What's Missing |
|---|---|---|
| Scraper Health | `GET /api/health` | `pythonScraperAvailable: false`, `browserAvailable: false` — always reports unhealthy |
| Health Trend | `GET /api/health-trend` | Empty trend data (no `run.log` on disk) |
| Competitive Health | `GET /api/competitive-health` | No health level from `run.log` (core metrics still work) |

### ❌ BROKEN on Vercel (8 routes)

These require Python, filesystem writes, or in-memory state:

| Feature | Route | Why Broken | Client Impact |
|---|---|---|---|
| **Trigger Scrape** | `POST /api/scrape/trigger` | Spawns Python process | "Failed to start scrape" |
| **Scrape Status** | `GET /api/scrape/status` | In-memory state (no process) | Always shows idle |
| **Stop Scrape** | `DELETE /api/scrape/stop` | No process to kill | "Failed to stop" |
| **Scraper Setup Detect** | `GET /api/setup/detect` | `spawnSync(python)` | "Python not found" |
| **Scraper Setup Install** | `POST /api/setup/install` | `spawn(pip, playwright)` | "Python not found" |
| **Save Config** | `PATCH /api/config/listings` | `fs.writeFile(listings.json)` | "Failed to save" |
| **Save Schedule** | `PATCH /api/schedule` | `fs.writeFile(schedule.json)` | "Failed to save schedule" |
| **Category Scan** | `POST /api/category-scan` | `fs.writeFile` + Python spawn | "Failed to scan" |

### ⏳ PARTIALLY WORKS on Vercel (read only)

| Feature | Route | What Works | What's Broken |
|---|---|---|---|
| Config List | `GET /api/config/listings` | ✅ Shows competitors | ❌ PATCH (save) fails |
| Schedule | `GET /api/schedule` | ✅ Shows schedule status | ❌ PATCH (save) fails |
| Competitor Discovery | `GET /api/competitors/discover` | ✅ Discovery results | ❌ POST (persist) fails |
| Business Config | `GET /api/business` | ✅ Shows business info | ❌ POST (save) fails |

---

## Client-Facing Impact

### What the client CAN do on rotherweb.vercel.app

- View dashboard (KPIs, reviews, analytics)
- Export data (CSV/JSON)
- View competitor configurations
- View run history and logs
- Use Cmd+K palette
- View all 25 feature pages

### What the client CANNOT do on rotherweb.vercel.app

- Trigger a scrape from the UI (Refresh button, "Run scan again")
- Add/remove competitors from the UI
- Enable/disable the scheduler
- Install Python/Playwright from the UI
- Run category scans

### How to trigger scrapes instead

1. **Automatic:** GitHub Actions runs daily at 02:00 UTC
2. **Manual:** Go to GitHub Actions → "Scraper" → "Run workflow"
3. **Future:** Could add a "Refresh" button that calls GitHub Actions API (requires GitHub token)

---

## Data Flow

```
GitHub Actions (cron/manual)
  → Python scraper runs on Ubuntu runner
  → Commits data/ to 'data' branch
  → raw.githubusercontent.com serves files
  → Vercel Next.js fetches via remote-data.ts
  → Dashboard renders
```

**Latency:** ~2-5 minutes from scrape completion to dashboard update (GitHub commit → raw.githubusercontent.com cache invalidation).

---

## Phase 3: UI Polish for Non-Technical Users (2026-09-13)

To prevent confusing error toasts and give clients visibility into scraping status, the following UI changes were made:

### TopBar (every page)
- **Vercel:** Shows "Last scrape: 22m ago" badge with "+N new" + "Trigger Scrape" link to GitHub Actions
- **Local:** Original Refresh button + active scrape indicator (unchanged)
- **Detection:** `isVercel()` from `src/lib/vercel.ts` checks `NEXT_PUBLIC_VERCEL === "1"`

### Today page (main dashboard)
- **Vercel:** New prominent green "Scraping is running automatically · Live" banner
  - Shows last scrape time, competitors scraped, new reviews, next run time
  - "View on GitHub" link for manual trigger
- **Local:** Original StartupBanner (unchanged)

### Config page
- **Vercel:** "Run scan again" button hidden, replaced with "Trigger manually →" link
- **Local:** Original button (unchanged)

### Scraper Setup page
- **Vercel:** Shows "This feature is not available on the web version" + link to GitHub Actions
- **Local:** Original Scraper Setup Wizard (unchanged)

### Scheduler page
- **Vercel:** Shows "GitHub Actions Cron is Active" with link to manual trigger
- **Local:** Original scheduler with toggle (unchanged)

### useScrapeStatus hook
- **Vercel:** Polls `/api/overview` for `runSummary` every 30s
- **Local:** Polls `/api/scrape/status` every 3s (unchanged)
- **Vercel:** If `start()` is called, shows "Scraping runs on GitHub Actions" toast (not an error)

---

## Files

| File | Role |
|---|---|
| `src/lib/gbp/remote-data.ts` | Fetches from GitHub data branch |
| `src/lib/gbp/data-source.ts` | Switches between local/remote based on `VERCEL` env |
| `src/lib/vercel.ts` | Client-side `isVercel()` detector (Phase 3) |
| `src/lib/gbp/run-summary.ts` | Normalizes v1 `run_summary.json` to v2 contract |
| `.github/workflows/scraper.yml` | GitHub Actions scraper workflow (cron + manual) |
| `.vercelignore` | Excludes `gbp-monitor/`, `src-tauri/`, `docs/` |
| `vercel.json` | Build config (`npx next build`) + `NEXT_PUBLIC_VERCEL=1` |
| `next.config.ts` | Conditional `output: "standalone"` (skipped on Vercel) |
| `src/components/shell/app-shell.tsx` | TopBar with Vercel status indicator (Phase 3) |
| `src/features/today.tsx` | Today page with Vercel live banner (Phase 3) |
| `src/features/t-config.tsx` | Config with hidden "Run scan" on Vercel (Phase 3) |
| `src/features/t-setup.tsx` | Setup with "not available" message on Vercel (Phase 3) |
| `src/features/t-scheduler.tsx` | Scheduler with "GitHub Actions Active" on Vercel (Phase 3) |
| `docs/engineering/VERCEL_WEB_GUIDE.md` | Non-technical client guide (Phase 3) |
