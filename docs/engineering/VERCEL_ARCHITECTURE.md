# Rother Web Architecture — Zero Budget

**Last updated:** 2026-09-14T09:00:00+07:00  
**Audience:** Developers, technical clients, future maintainers  
**Scope:** How Rother works as a web app on zero budget, and why every constraint exists.

---

## TL;DR

Rother uses **Playwright** to scrape Google Maps reviews. Playwright needs a full browser (Chromium ~300MB + Python + 200-500MB RAM). Serverless platforms (Vercel, Netlify, Cloudflare) **cannot run this**. So we split the system:

| Component | Where it runs | Why |
|---|---|---|
| **Dashboard** (Next.js) | Vercel | Free, fast, global CDN |
| **Scraper** (Python + Playwright) | GitHub Actions | Free 2,000 min/month, can install Python |
| **Data** (snapshots, reviews) | GitHub `data` branch | Free, versioned, public-readable |
| **Client config** (which businesses to monitor) | GitHub `data` branch | Same as data — single source of truth |

**Total cost: $0/month.**

---

## Why can't Vercel just run the scraper?

Serverless platforms have hard limits that make Playwright impossible:

| Platform | Python | Browser | Long process | Writable FS |
|---|---|---|---|---|
| Vercel Hobby | ❌ | ❌ | 10s timeout | ❌ ephemeral |
| Vercel Pro | ❌ | ❌ | 60s timeout | ❌ ephemeral |
| Netlify | ❌ | ❌ | 10s timeout | ❌ |
| Cloudflare Workers | ❌ | ❌ | 30s (paid: 15min) | ❌ |
| AWS Lambda | ✅ (layer) | ❌ (no Chromium) | 15min | ✅ (tmp) |
| Render Free | ✅ | ✅ | 750 hrs/mo | ✅ |
| Fly.io Free | ✅ | ✅ | 3 VMs, 256MB each | ✅ |
| Oracle Cloud Always Free | ✅ | ✅ | unlimited (4 ARM, 24GB) | ✅ |

Only **Oracle Cloud Always Free** can run Playwright with no time limits. Everything else is constrained.

So we use **GitHub Actions** — it has free Linux runners with Python + can install Chromium via Playwright. The trade-off is 2,000 min/month (~200-400 scrapes depending on duration).

---

## The data flow (end-to-end)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Client Browser │     │  Vercel Dashboard │     │  GitHub Actions  │
│  (rotherweb.app) │     │  (Next.js)        │     │  (Python+Playwright) │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                      │                       │
         │ 1. Open dashboard    │                       │
         │─────────────────────>│                       │
         │                      │                       │
         │ 2. Dashboard reads   │                       │
         │    from data branch  │                       │
         │<─────────────────────│                       │
         │                      │                       │
         │ 3. Paste GMaps link  │                       │
         │─────────────────────>│                       │
         │                      │ 4. (Future) Update    │
         │                      │    config via GH API   │
         │                      │──────────────────────>│
         │                      │                       │
         │                      │                       │ 5. Scrape runs
         │                      │                       │    (manual/cron)
         │                      │                       │ 6. Commit data
         │                      │                       │    to data branch
         │                      │<──────────────────────│
         │                      │                       │
         │ 7. Next refresh     │                       │
         │    shows new data    │                       │
         │<─────────────────────│                       │
         │                      │                       │
```

**Key insight:** Vercel and the scraper never talk directly. They communicate through the `data` branch on GitHub (which is public-readable via `raw.githubusercontent.com`).

---

## What works on Vercel (zero budget)

✅ **Dashboard (read-only):**
- KPIs, reviews, analytics, exports
- Run history, logs
- All 25 analytics features
- Config viewing (read-only)

✅ **Scraping (automatic):**
- GitHub Actions cron: daily 02:00 UTC
- Manual trigger via GitHub UI
- ~5-7 min per competitor

✅ **Data sync:**
- Scraped data committed to `data` branch
- Vercel reads via `raw.githubusercontent.com`
- 2-5 min latency from scrape to dashboard

---

## What does NOT work on Vercel (and why)

❌ **Scraper controls** (Refresh, Run scan, Scheduler toggle)
- **Why:** Spawns Python process. Vercel has no Python runtime.
- **Workaround:** Click "Trigger Scrape" link → opens GitHub Actions → click "Run workflow"

❌ **Add/remove competitors from web UI**
- **Why:** Writes to local `listings.json`. Vercel filesystem is ephemeral.
- **Current state:** The form works client-side (localStorage) but nothing happens server-side.
- **Planned fix:** Add `/api/add-competitor` that uses GitHub API to update `data/gbp-monitor/config/listings.json` on the data branch. See `VERCEL_ROADMAP.md`.

❌ **Scraper Setup page** (Python install wizard)
- **Why:** No Python on Vercel.
- **Fix:** Page now shows "not available on web version" message.

❌ **Real-time scrape progress**
- **Why:** Scraper runs on GitHub, not in browser. No persistent connection.
- **Workaround:** Click "View on GitHub" link to see live run logs.

---

## Client flow (simplified)

The client's only action is: **paste a Google Maps link**.

```
1. Client opens rotherweb.vercel.app
2. Sees onboarding screen
3. Pastes https://maps.app.goo.gl/... (e.g., Shady Shack)
4. Sees "Added! First scrape runs at 02:00 UTC. Data will appear within 10 minutes."
5. Returns later → sees dashboard with reviews
```

**What happens behind the scenes (developer):**
1. Client's link hits Vercel API
2. Vercel calls GitHub API to commit new config to `data` branch
3. GitHub Actions workflow triggers automatically (push event)
4. Python scraper runs, collects reviews
5. Scraper commits data to `data` branch
6. Vercel dashboard picks up new data on next refresh

---

## The 3 competitors in the data — what are they?

Current `data/gbp-monitor/config/listings.json` contains:
1. **Crate Cafe Canggu** (`comp-canggu-01`)
2. **Revolver Seminyak** (`comp-seminyak-01`)
3. **Seniman Coffee Studio** (`comp-ubud-01`)

These are **test data** from our initial validation (2026-08-20). For a real client deployment, this list should be replaced with the client's actual businesses.

To replace:
1. Edit `gbp-monitor/config/listings.json` on `main` branch
2. Commit + push
3. Run the scraper workflow manually
4. Data syncs to `data` branch
5. Dashboard updates

---

## Limitations of the current architecture

### Single-tenant
- All clients see the same data (the 3 test competitors)
- No client accounts, no login isolation
- Anyone with the URL sees the same dashboard

### No real-time
- Scraping happens on schedule (daily 02:00 UTC) or manual trigger
- Dashboard updates 2-5 min after scrape completes
- No "live" progress (use GitHub Actions UI for that)

### GitHub Actions quotas
- 2,000 min/month free tier
- ~5-7 min per competitor per scrape
- For 3 competitors: ~20 min per daily run = 60 scrapes/month max
- For 10 competitors: ~70 min per run = 28 scrapes/month max
- **Hard limit:** if you exceed, scraping stops until next month

### Public data
- `data` branch is public-readable (if repo is public)
- Anyone can see your scraped reviews
- For private data, use a private repo + Vercel auth

---

## Future improvements (cost still $0)

### Short term: GitHub API bridge (2-3 hours work)
- Add `/api/add-competitor` route on Vercel
- Store `GITHUB_PAT` in Vercel env vars
- Client pastes link → Vercel commits to data branch → workflow triggers
- Still single-tenant, but client can self-serve

### Medium term: Supabase for multi-tenant (1-2 days)
- Free tier: 500MB DB, 50,000 rows, 2GB bandwidth
- Per-client config table
- Per-client data isolation
- Real client accounts (auth)

### Long term: Google Places API (when budget allows)
- $200/month free credit (~28,000 API calls)
- Official, reliable, no scraping
- Works on Vercel perfectly
- Multi-tenant ready
- After free tier: ~$0.017 per call

---

## Files

| File | Role |
|---|---|
| `vercel.json` | Vercel build config |
| `next.config.ts` | Conditional standalone output |
| `.vercelignore` | Excludes Python/Tauri from deployment |
| `.github/workflows/scraper.yml` | GitHub Actions scraper |
| `src/lib/gbp/remote-data.ts` | Fetches from data branch |
| `src/lib/gbp/data-source.ts` | Switches local/remote based on env |
| `src/lib/vercel.ts` | Client-side Vercel detection |
| `src/components/shell/app-shell.tsx` | TopBar with Vercel status |
| `src/features/today.tsx` | Today page with live banner |
| `docs/engineering/VERCEL_COMPATIBILITY.md` | Feature matrix |
| `docs/engineering/VERCEL_WEB_GUIDE.md` | Non-technical client guide |
| `docs/engineering/VERCEL_DEPLOYMENT_PLAN.md` | Original deployment plan |
