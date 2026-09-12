# Web Deployment Analysis — Zero-Cost Architecture

**Date:** 2026-09-11
**Goal:** Universal web access for Rother — any browser, any device, any OS
**Constraint:** Zero budget ($0/month)

---

## Executive Summary

After analyzing the discussion history and deployment options, the **recommended architecture** is:

**GitHub Pages (Frontend) + GitHub Actions (Scraper) + File-based Storage**

This leverages what we already have:
- Scraper commits data to repo (JSON files)
- Frontend reads from those JSON files
- GitHub provides free hosting + CI/CD
- No external dependencies, no credit card required

**Total cost: $0/month**

---

## Deployment Platform Comparison

### 1. Vercel

**Pros:**
- Native Next.js support (auto-detects framework)
- Auto-deploy from GitHub (push to main → deploy)
- Free tier: 100GB bandwidth/month, unlimited sites
- Serverless functions (API routes)
- Custom domain support

**Cons:**
- Serverless function timeout: 10 seconds (free tier)
- Deployment size limit: 50MB (zipped)
- **Cannot run Playwright directly** (Chromium binary too large)
- Would need external browser service (Browserless.io, etc.) → costs money

**Best for:** Frontend/dashboard hosting only

**Verdict:** ❌ Not suitable for scraping, but good for frontend

---

### 2. Netlify

**Pros:**
- Free tier: 100GB bandwidth/month
- Auto-deploy from GitHub
- Serverless functions
- Custom domain support

**Cons:**
- Similar limitations to Vercel for serverless functions
- **Cannot run Playwright directly** (size/timeout limits)
- Would need external browser service → costs money

**Best for:** Frontend/dashboard hosting only

**Verdict:** ❌ Not suitable for scraping, but good for frontend

---

### 3. Cloudflare

**Pros:**
- **Workers + Browser Run**: Free 10 minutes of browser execution per day
- **D1 Database**: Free 5M reads/month, 1M writes/month
- **Pages**: Unlimited bandwidth, free static hosting
- **Workers**: 100K requests/day (free tier)
- **Cron Triggers**: Scheduled scraping (free)
- All-in-one ecosystem

**Cons:**
- Browser Run limited to 10 min/day (~40-60 businesses)
- Workers have 10ms CPU time limit (free tier)
- More complex setup (multiple Cloudflare products)

**Best for:** Scraper (Browser Run) + Database (D1) + Frontend (Pages)

**Verdict:** ✅ Good for scraping, but limited to 10 min/day

---

### 4. GitHub (Pages + Actions)

**Pros:**
- **GitHub Pages**: Free static hosting (100GB/month)
- **GitHub Actions**: 2,000 minutes/month (free for public repos)
- **File-based storage**: Commit JSON data to repo
- **Cron scheduling**: Actions can run on schedule
- Already integrated with our workflow

**Cons:**
- Pages only serves static files (no server-side rendering)
- Actions limited to 2,000 min/month (but that's ~33 hours)
- File-based database has size limits (repo size limit: 1GB)

**Best for:** Frontend (Pages) + Scraper (Actions) + Storage (repo files)

**Verdict:** ✅ Best fit for our current architecture

---

## Recommended Architecture: GitHub-Only Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                       │
│                                                               │
│  ┌──────────────────┐     ┌──────────────────────────────┐  │
│  │  Scraper (cron)  │────▶│  JSON Data Files             │  │
│  │                  │     │                              │  │
│  │  - GitHub Actions│     │  - data/snapshots/*.json     │  │
│  │  - 2,000 min/mo  │     │  - data/reviews_new/*.json   │  │
│  │  - Playwright    │     │  - data/run_summary.json     │  │
│  └──────────────────┘     └──────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend (GitHub Pages)                              │   │
│  │                                                       │   │
│  │  - Next.js static export                              │   │
│  │  - Reads JSON files from repo                         │   │
│  │  - No server needed                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  User Browser  │
                    │  (Any device)  │
                    ───────────────┘
```

### How It Works

1. **Scraper** (GitHub Actions cron):
   - Runs daily at 05:00 WITA (22:00 UTC)
   - Uses Playwright to scrape Google Maps
   - Commits JSON data to repo
   - Takes ~2-3 min per scrape (12 competitors = ~30 min total)
   - Uses ~30 min/month (well within 2,000 min limit)

2. **Frontend** (GitHub Pages):
   - Static Next.js export (HTML + JSON)
   - Reads data from repo JSON files
   - No server needed
   - Auto-deploy on push to main

3. **Storage** (File-based):
   - Snapshots: `data/snapshots/{competitor_id}/{timestamp}.json`
   - Reviews: `data/reviews_new/{competitor_id}_{timestamp}.json`
   - Summary: `data/run_summary.json`
   - Total size: ~10-50MB (well within 1GB repo limit)

### Cost Breakdown

| Component | Cost |
|-----------|------|
| GitHub Pages | $0 (100GB/month) |
| GitHub Actions | $0 (2,000 min/month) |
| Storage | $0 (1GB repo limit) |
| **Total** | **$0/month** |

### Advantages

1. **Zero cost** — completely free
2. **Simple** — one ecosystem (GitHub)
3. **Reliable** — GitHub's infrastructure
4. **Scalable** — 2,000 min/month = ~66 hours of scraping
5. **No external dependencies** — no credit card, no third-party services

### Limitations

1. **Static site** — no server-side rendering (but we don't need it)
2. **File-based database** — not suitable for large datasets (but we're fine)
3. **Public repo** — GitHub Pages requires public repo for free tier (or Pro for private)

---

## Alternative: Cloudflare-Only Stack

If you want to avoid GitHub Pages limitations:

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare Ecosystem                    │
│                                                               │
│  ┌──────────────────┐     ┌──────────────────────────────  │
│  │  Scraper (cron)  │────▶│  D1 Database                 │  │
│  │                  │     │                              │  │
│  │  - Workers +     │     │  - 5M reads/month            │  │
│  │    Browser Run   │     │  - 1M writes/month           │  │
│  │  - 10 min/day    │     │                              │  │
│  └──────────────────     └──────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend (Cloudflare Pages)                          │   │
│  │                                                       │   │
│  │  - Next.js static export                              │   │
│  │  - Unlimited bandwidth                                │   │
│  │  - Reads from D1 database                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Cost Breakdown

| Component | Cost |
|-----------|------|
| Cloudflare Pages | $0 (unlimited bandwidth) |
| Cloudflare Workers | $0 (100K requests/day) |
| Browser Run | $0 (10 min/day) |
| D1 Database | $0 (5M reads/month) |
| **Total** | **$0/month** |

### Advantages

1. **Zero cost** — completely free
2. **All-in-one** — single ecosystem
3. **Unlimited bandwidth** — Pages has no bandwidth limit
4. **Structured database** — D1 is SQL database (better than files)

### Limitations

1. **Browser Run limited** — only 10 min/day (~40-60 businesses)
2. **Complex setup** — multiple Cloudflare products to configure
3. **Overkill** — we don't need D1 for our current data size

---

## Hybrid: GitHub + Cloudflare

Best of both worlds:

- **Frontend**: Cloudflare Pages (unlimited bandwidth)
- **Scraper**: GitHub Actions (2,000 min/month)
- **Database**: Cloudflare D1 (structured storage)
- **Scheduled**: GitHub Actions cron OR Cloudflare Cron Triggers

### Cost: $0/month

### Advantages

1. **More scraping time** — 2,000 min/month vs 10 min/day
2. **Unlimited bandwidth** — Cloudflare Pages
3. **Structured database** — D1 for future growth
4. **Flexible** — can scale as needed

### Disadvantages

1. **Two ecosystems** — GitHub + Cloudflare
2. **More complex** — need to integrate both
3. **Overkill** — for current scale, GitHub-only is simpler

---

## My Recommendation

**For your situation (zero budget, universal access, simple setup):**

### Start with: **GitHub-Only Stack**

**Why:**
1. **Simplest** — one ecosystem, easy to understand
2. **Already working** — scraper commits data, frontend reads it
3. **Zero cost** — completely free
4. **Enough capacity** — 2,000 min/month = ~66 hours of scraping
5. **No migration needed** — current architecture already fits

**Implementation:**
1. Enable GitHub Pages in repo settings
2. Add `next.config.ts` static export config (already done)
3. Add `.github/workflows/pages-deploy.yml` (already exists)
4. Deploy!

**URL:** `https://yourusername.github.io/rother`

---

### Migrate to: **GitHub + Cloudflare Hybrid** (when needed)

**When to migrate:**
- When you exceed 2,000 min/month scraping time
- When you need structured database (D1)
- When you want unlimited bandwidth
- When you want to add more features (user accounts, real-time data)

**Why not now:**
- Current scale is small (12 competitors)
- GitHub-only is simpler and sufficient
- Migration adds complexity without immediate benefit

---

## Playwright Optimization (Critical for Any Platform)

From the discussion history, these optimizations reduce Playwright from **1GB+ RAM / 10 minutes** to **~300MB RAM / 10-15 seconds**:

### Must-Implement Optimizations

1. **Launch flags:**
```python
args = [
    '--single-process',         # Force Chrome to 1 process (saves 50% RAM)
    '--no-sandbox',             # Remove security isolation (saves memory)
    '--disable-dev-shm-usage',  # Use /tmp instead of shared memory
    '--disable-gpu',            # Disable graphics (server has no GPU)
    '--js-flags="--max-old-space-size=150"'  # Limit V8 RAM to 150MB
]
```

2. **Block heavy assets:**
```python
await page.route('**/*', lambda route: route.abort() 
    if route.request.resource_type in ['image', 'media', 'font', 'stylesheet']
    else route.continue())
```

3. **Fast navigation:**
```python
await page.goto(url, wait_until='commit')  # Not 'networkidle'
```

4. **Memory leak protection:**
```python
try:
    # scraping logic
finally:
    await page.close()
    await context.close()
    await browser.close()
```

5. **Don't scroll for reviews:**
- Just capture visible 3-5 reviews + aggregate data
- Reduces time from minutes to seconds

---

## Next Steps

### Immediate (This Week)

1. **Apply Playwright optimizations** to `gbp-monitor/harness/browser.py`
2. **Test static export** with `npm run build:static`
3. **Deploy to GitHub Pages** (enable in repo settings)
4. **Verify** live URL works

### Short-term (Next 2 Weeks)

1. **Monitor** GitHub Actions usage (ensure < 2,000 min/month)
2. **Optimize** scraper to run faster (target: < 5 min per scrape)
3. **Document** deployment process for future reference

### Medium-term (Next Month)

1. **Evaluate** if GitHub-only is sufficient
2. **Consider** Cloudflare migration if:
   - Need more scraping time
   - Need structured database
   - Need unlimited bandwidth
3. **Plan** migration path (if needed)

---

## Conclusion

**Best option for you: GitHub-Only Stack**

- ✅ Zero cost
- ✅ Simple setup
- ✅ Already working architecture
- ✅ Enough capacity for current scale
- ✅ Universal web access (any browser, any device)

**URL after deployment:** `https://yourusername.github.io/rother`

**Time to deploy:** ~1 hour (if Playwright optimizations are applied)

---

## Files to Create/Modify

1. **Modify:** `gbp-monitor/harness/browser.py` — add launch flags
2. **Modify:** `gbp-monitor/harness/capture.py` — block heavy assets
3. **Modify:** `next.config.ts` — static export config (already done)
4. **Create:** `.github/workflows/pages-deploy.yml` — deployment workflow (already exists)
5. **Create:** `docs/engineering/WEB_DEPLOYMENT_GUIDE.md` — deployment guide (already created)

---

**Status:** Ready to implement
**Estimated time:** 1-2 hours
**Cost:** $0
