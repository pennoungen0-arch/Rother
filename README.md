# Rother â€” Competitor Review Monitor

Automated monitoring of competitor Google Business Profile reviews. Two subsystems:

- **gbp-monitor/** â€” Python scraper (Playwright + Parsel)
- **src/** â€” Next.js dashboard (App Router, shadcn/ui, Recharts)

> **Status:** All productization milestones complete. See
> `gbp-monitor/docs/engineering/PROJECT_SUMMARY.md` for the full "everything
> done so far" report, and `AGENTS.md` for the agent-facing state summary.

---

## What's been built

Rother is a self-hosted, zero-cost Google Business Profile review monitor. It
uses a real browser session (`NID` cookie) to capture the **full** review list
of every configured competitor (hundreds of cards â€” not the 3 embedded on the
initial page), tracks per-competitor deltas, and surfaces everything in the
dashboard with proactive alerts.

| Capability | Where |
|---|---|
| Live FULL-variant review capture (incremental harvest, 200â€“580 cards/listing) | `gbp-monitor/harness/` + `scroll.py` |
| Structured `Review` parsing (text, rating, reviewer, relative+approximated dates, like counts) | `gbp-monitor/parser/` |
| Business metadata sidecars (name, rating, address, category, phone, website, weekly opening hours, star breakdown) | `gbp-monitor/storage/` + `{ts}.metadata.json` |
| Stale-NID guard â€” detects + recovers from a stale session jar automatically | `orchestration/run_all.py` |
| New-review delta tracking + full content in the dashboard | `gbp-monitor/storage/delta_store.py` + "New Reviews" tab |
| Proactive alerts â€” webhook (Slack/Discord/ntfy) + SMTP email after every run | `gbp-monitor/notifications/notifier.py` |
| Live verification mode with selector-health + screenshot evidence | `python -m orchestration.run_all --verify` |
| Dashboard: Overview, Branches, Compare, Review Explorer, New Reviews, Alerts, Config | `src/` |
| First-run onboarding â€” `--init-config`, `--validate-config`, guarded config loading | `orchestration/run_all.py` |

Latest verified state (2026-08-20): all test suites green
(verify_baseline 159/159, verify_notifications 25/25, vitest 119/119),
production snapshot set of 12 competitors / 5,021 reviews intact, **live scraping verified for 3 Indonesian businesses (Crate Cafe Canggu, Revolver Seminyak, Seniman Coffee Studio) â€” 930 reviews captured**, and all 8 roadmap milestones complete + convergence hardening.

---

## Prerequisites

| Requirement | Version (verified) | Notes |
|---|---|---|
| **Node.js** | >= 18 (v22.11.0) | `node --version` |
| **npm** | >= 9 (10.9.0) | `npm --version` |
| **Bun** | Not required | Optional; see matrix below |
| **Python** | 3.12+ (3.14.4) | Needed only for scraper (`gbp-monitor/`) |
| **Playwright** | 1.61.0 | `playwright install chromium` from `gbp-monitor/` |

---

## Quickstart (Windows â€” verified)

```powershell
# 1. Install Node dependencies
npm install

# 2. Push Prisma schema to SQLite
npx prisma db push

# 3. Start the development server
npm run dev
```

Open http://localhost:3000 in your browser.

### First-boot evidence

| Check | Result |
|---|---|
| `npm install` | 669 packages, 447ms |
| `npx prisma db push` | Database already in sync, client generated (567ms) |
| `npm run dev` | Next.js 16.2.11, Turbopack, ready in 512ms |
| `curl http://localhost:3000` | HTTP 200, 40 KB HTML, `<title>Rother â€” Dashboard</title>` |
| `npm run lint` | 24 pre-existing warnings (no startup blockers) |

---

## Startup Matrix

| Command | npm | Bun | Windows | Linux | Notes |
|---|---|---|---|---|---|
| `npm install` / `bun install` | âœ“ | âœ“ | âœ“ | âœ“ | Works on both |
| `npx prisma db push` | âœ“ | âœ“ | âœ“ | âœ“ | Use `npx` or `bun run db:push` |
| `npm run dev` / `bun run dev` | âœ“ | âœ“ | âœ“ | âœ“ | Fixed: removed `tee` dependency |
| `npm run build` | âœ“ | âœ“ | âœ“ | âœ“ | Cross-platform via `.zscripts/build.mjs` |
| `npm run start` | âœ“ | âœ“ | âœ“ | âœ“ | Uses Node.js; production uses `start.sh` |
| `npm run lint` | âœ“ | âœ“ | âœ“ | âœ“ | ESLint â€” passes on both |

### Production deployment scripts (`.zscripts/*.sh`)

The shell scripts under `.zscripts/` require a **Unix shell** (bash/sh) and are
used for production deployment only. They are not needed for local development
on Windows. Use the npm scripts above instead.

| Script | Requires | Purpose |
|---|---|---|
| `dev.sh` | bash, bun, curl | Full dev environment (Linux/macOS) |
| `build.sh` | bash, bun, perl, tar | Production build with self-healing |
| `start.sh` | sh, bun, Caddy | Production service start |
| `mini-services-*.sh` | bash/sh, bun | Mini-service lifecycle |

---

## Runtime Prerequisites Detail

### Node.js â€” Required
- **Minimum version:** 18
- **Verified version:** 22.11.0
- **Engine:** Any (npm, yarn, pnpm, bun all work for installing)

### npm â€” Required (for Windows dev)
- **Minimum version:** 9
- **Verified version:** 10.9.0
- Bundled with Node.js

### Bun â€” Optional
- **Required for:** `.zscripts/*.sh` scripts (production deployment)
- **Not required for:** Local development on Windows
- `bun-types` in devDependencies is only for type checking
- All npm scripts work without Bun

### Prisma â€” Required
- **Installed via:** `npm install` (included in dependencies)
- **Schema:** `prisma/schema.prisma`
- **Database:** SQLite at `db/custom.db` (auto-created by `db:push`)
- **Not used** by the dashboard runtime â€” scaffold only

---

## Environment Variables

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `file:../db/custom.db` | Yes | Prisma SQLite path (relative to `prisma/`) |

Copy `.env` from the repository â€” the default path works for both Windows and Linux.

---

## Scripts Reference (npm)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 3000` | Start development server (port 3000) |
| `build` | `node .zscripts/build.mjs` | Production build (cross-platform) |
| `start` | `node .next/standalone/server.js` | Start production server (set `NODE_ENV=production` first) |
| `lint` | `eslint .` | Run ESLint |
| `db:push` | `prisma db push` | Push schema to SQLite database |
| `db:generate` | `prisma generate` | Regenerate Prisma client |
| `db:migrate` | `prisma migrate dev` | Create/apply Prisma migrations |
| `db:reset` | `prisma migrate reset` | Reset database (destructive) |

---

## Project Structure

```
.
â”œâ”€â”€ .env                   # DATABASE_URL (SQLite)
â”œâ”€â”€ .zscripts/             # Dev/build/start shell scripts + build.mjs
â”œâ”€â”€ Caddyfile              # Reverse proxy config (port 81)
â”œâ”€â”€ gbp-monitor/           # Python scraper subsystem
â”œâ”€â”€ src/                   # Next.js dashboard
â”œâ”€â”€ prisma/                # Database schema (scaffold only)
â”œâ”€â”€ db/                    # SQLite database file
â”œâ”€â”€ public/                # Static assets
â””â”€â”€ docs/                  # Engineering docs, audit reports, research
```

---

## Features (M3)

| Feature | Description | API | UI |
|---------|-------------|-----|-----|
| **Overview** | KPIs, rating distribution, review trends, run history | `GET /api/overview` | Overview tab |
| **Branches** | Branches Ã— competitors with per-competitor intelligence | `GET /api/branches` | Branches tab |
| **Compare** | Side-by-side branch comparison + historical snapshot diff | `GET /api/branches`, `GET /api/history/compare` | Compare tab |
| **Review Explorer** | Searchable, filterable, paginated review table with export | `GET /api/reviews`, `GET /api/reviews/export` | Reviews tab |
| **New Reviews** | Full content of every review captured in each delta run | `GET /api/new-reviews` | New Reviews tab |
| **Alerts** | Dashboard alerts for scrapes, new reviews, selector issues | `GET /api/alerts` | Alerts tab |
| **Configuration** | Edit branches/competitors via inline JSON editor | `GET/PATCH /api/config/listings` | Config tab |
| **Export** | CSV/JSON export for reviews, competitors, branches, history | `GET /api/reviews/export`, `GET /api/export/competitors`, `GET /api/export/branches`, `GET /api/history/export` | Export dialog |

---

## Configuration (monitoring your own businesses)

Copy the generic template and fill in the listings you want to monitor:

```powershell
Copy-Item gbp-monitor\config\listings.example.json gbp-monitor\config\listings.json
```

Each branch is one of **your** locations; each competitor is a Google Business
Profile you want to watch in that area. The scraper is fully generic â€” branch
names follow the `Chain - Location` convention, and the dashboard
automatically strips the chain prefix in charts and derives brand/location
words for the word cloud from the listings you configure. For live scraping,
each competitor needs a real Google Maps `place_id` (starts with `ChIJ`); see
the guide in the example file.

## Troubleshooting Live Scraping (0 reviews)

If a live scrape returns 0 reviews, the **selectors in `gbp-monitor/config/selectors.json` don't match your Google Maps variant**. Google Maps serves different DOM by region/language.

**Symptoms:** `REVIEWS_TAB` timeouts, scroll height ~100px, 0 cards, all parser tiers fail.

**Fix:**
```powershell
cd gbp-monitor
python -m orchestration.run_all --verify   # captures evidence
# Inspect data/verify/<ts>/comp-*/01-business-loaded.png for actual DOM
# Update config/selectors.json with working reviews_tab_button selector
python -m orchestration.run_all --validate-config
python -m orchestration.run_all
```
See `gbp-monitor/README.md` and `docs/engineering/SELECTOR_CERTIFICATION.md` for full workflow.

> **Note (2026-08-20):** The Indonesian variant now works with **certified selectors** using real `place_id`s. The root cause of 0 reviews for Crate Cafe Canggu, Revolver Seminyak, and Seniman Coffee Studio was **placeholder `place_id`s** (`ChIJREPLACEWITHAREALPLACEID...`), not selector mismatch. Real `place_id`s extracted from `maps.app.goo.gl/` short links resolved it.

---

## Testing

All test suites must stay green (Rule 1).

### Scraper tests (run from `gbp-monitor/`)

| Command | Count | Notes |
|---|---|---|
| `python -m tests.verify_baseline` | 159/159 | **WIPES `data/`** — back up first, restore after |
| `python -m tests.verify_notifications` | 25/25 | Local HTTP server + stubbed SMTP |
| `python -m tests.verify_variant_framework` | 32/32 | Offline variant classifier |

> **Backup discipline:** `verify_baseline` deletes `data/`. Production data (12 competitors / 5,021 reviews in committed Aug-13 snapshots) has been lost once this way. ALWAYS back up first:
> ```powershell
> Copy-Item data C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup -Recurse
> # restore: Remove-Item -Recurse data; Copy-Item <backup> data -Recurse
> ```

### Dashboard tests (run from repo root)

| Command | Count | Notes |
|---|---|---|
| `npx vitest run` | 119/119 | 9 files (src/lib/gbp + lib, incl. self-target); archive + e2e excluded |
| `npx tsc --noEmit` | 0 errors | `rother02-archive/` excluded via tsconfig |
| `npx eslint src` | exit 0 | 0 errors, 0 warnings |
| `npx playwright test` | 16/16 | Smoke (10) + Scheduler (2) + Discovery-persistence (4) â€” **needs `npm run dev` running** |

### Full local gate (what CI runs)

```powershell
npx vitest run; npx tsc --noEmit; npx eslint src; npm run build
```

---

## Discovery-First Usage

1. **Paste a Google Maps business link** on the landing page (short links
   `maps.app.goo.gl/â€¦`, full place URLs, or `query_place_id=` share links all work)
2. **Validate â†’ Continue** â€” onboarding prefills your business
3. **Add competitors** by pasting their Google Maps links (Step 3) â†’ **Start Monitoring**
4. Keep data fresh with either:
   - **Scheduler** â€” Tools â€º Configuration â€º toggle + interval (6/12/24/48h);
     pairs with `python -m orchestration.run_all --schedule` in cron/Task Scheduler
   - **Refresh buttons** (âŸ³) on Leaderboard/Branches cards â€” partial scrape of
     just that competitor (`--competitors` passthrough)

Per-business runtime data is isolated under `gbp-monitor/data/users/{businessId}/`.

---

## Troubleshooting

See **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for the 14 catalogued problems
and fixes: short-link resolution, "Python exited with code 2", missing reviews
after scrape, Turbopack EBUSY on Windows, orphaned localhost ports, and more.

---

## Scraper (gbp-monitor/)

See `gbp-monitor/README.md` for scraper-specific setup:

```powershell
cd gbp-monitor
pip install -r requirements.txt
playwright install chromium
python -m orchestration.run_all --fixtures
```
