# Paid Alternatives — Comparison for Rother Web

**Last updated:** 2026-09-14T12:00:00+07:00  
**Scope:** All paid options for reliable Google Maps review scraping  
**Audience:** Decision-maker choosing between zero-cost and paid approaches

---

## Quick Decision Matrix

| Option | Monthly Cost | Reliability | Build Time | Browser Compatibility | Best For |
|---|---|---|---|---|---|
| **Current (Vercel + GitHub Actions)** | $0 | ⚠️ Partial | Done | All browsers | Demo / single client |
| **Google Places API** | $0-200 | ⭐⭐⭐⭐⭐ | 2 days | All browsers | Production / multiple clients |
| **Hetzner VPS** | $4.70 | ⭐⭐⭐⭐ | 1 day | All browsers | Full control / self-hosted |
| **Apify** | $0-5 | ⭐⭐⭐ | 1 day | All browsers | Quick prototype |
| **Outscraper** | $0.04/1k records | ⭐⭐⭐ | 1 day | All browsers | Pay-per-use |

---

## Option 1: Google Places API (Recommended for Production)

### What it is
Official Google API that returns business reviews as structured JSON. No scraping needed.

### Cost
- **Free tier:** $200/month credit (covers ~28,000 API calls)
- **After free tier:** ~$0.017 per call
- **For 10 businesses, daily scrape:** ~300 calls/month = $0 (within free tier)

### Pros
- ✅ Official API — never breaks, no bot detection
- ✅ Returns structured JSON (no HTML parsing)
- ✅ Works on Vercel (serverless API calls)
- ✅ Works in any browser (server-side)
- ✅ Multi-tenant ready
- ✅ Real-time data (no 5-10 min scrape delay)

### Cons
- ❌ Requires Google Cloud account + billing setup
- ❌ ToS restricts some use cases (check before building)
- ❌ Limited review data (may not include all reviews)
- ❌ Costs money after free tier

### Implementation Plan
1. Create Google Cloud project
2. Enable Places API
3. Create API key (restrict to Places API only)
4. Store in Vercel env var: `GOOGLE_PLACES_API_KEY`
5. Create new route: `GET /api/places-reviews?place_id=ChIJ...`
6. Replace Playwright scraper with API calls
7. Remove GitHub Actions dependency

### Architecture
```
Client pastes Google Maps link
        ↓
Vercel API: resolve URL → place_id (existing /api/places)
        ↓
Vercel API: call Google Places API → get reviews as JSON
        ↓
Store in database (Supabase/Vercel KV)
        ↓
Dashboard reads from database
```

---

## Option 2: Hetzner VPS ($4.70/month)

### What it is
A cheap Linux virtual private server that runs the existing Playwright scraper 24/7.

### Cost
- **Hetzner CPX11:** €4.35/month (~$4.70)
  - 2 vCPU, 2GB RAM, 40GB SSD
  - Enough for Playwright + Python
- **Alternative: DigitalOcean Basic Droplet:** $6/month
  - 1 vCPU, 1GB RAM, 25GB SSD

### Pros
- ✅ Full control — own the server
- ✅ Existing Playwright code works as-is
- ✅ No GitHub Actions limits (2,000 min/month)
- ✅ Can run cron jobs directly
- ✅ Can host both scraper AND dashboard

### Cons
- ❌ Requires Linux server admin skills
- ❌ Still scraping (Google could rate-limit)
- ❌ Need to maintain the server

### Implementation Plan
1. Create Hetzner account + CPX11 instance
2. Install Docker
3. Create Dockerfile with Python + Playwright + Node.js
4. Deploy with docker-compose
5. Set up cron: `0 2 * * * python -m orchestration.run_all`
6. Point domain to server IP
7. Serve dashboard via Next.js on the same server

### Architecture
```
Hetzner VPS (always running)
├── Playwright scraper (cron: daily 02:00 UTC)
├── Next.js dashboard (serves web app)
├── SQLite/Postgres (stores data)
└── nginx (reverse proxy)
```

---

## Option 3: Apify ($5/month free tier)

### What it is
Cloud scraping service that handles anti-bot detection for you.

### Cost
- **Free tier:** $5/month credit (~2,000 scrapes)
- **After free tier:** $0.25 per 1,000 pages
- **For 10 businesses, daily scrape:** ~300 scrapes/month = $0 (within free tier)

### Pros
- ✅ They handle anti-bot detection
- ✅ Pre-built Google Maps scraper
- ✅ Webhook integration (data comes to you)
- ✅ No server to maintain

### Cons
- ❌ Still scraping (can break when Google changes)
- ❌ Less reliable than official API
- ❌ Limited customization

### Implementation Plan
1. Create Apify account
2. Use "Google Maps Reviews Scraper" actor
3. Configure webhook to POST results to Vercel API
4. Create `POST /api/apify-webhook` route to receive data
5. Store in database
6. Dashboard reads from database

---

## Option 4: Outscraper ($0.04/1000 records)

### What it is
Pay-per-use scraping API for Google Maps data.

### Cost
- **No monthly fee**
- **$0.04 per 1,000 records**
- **For 10 businesses, 100 reviews each:** $0.04

### Pros
- ✅ Cheapest per-use
- ✅ No monthly commitment
- ✅ Simple REST API

### Cons
- ❌ Less reliable than Google Places API
- ❌ Limited documentation
- ❌ Can break when Google changes

---

## Browser Compatibility (ALL options)

**Every option works in any modern browser** because scraping happens server-side.

| Browser | Works? | Notes |
|---|---|---|
| Chrome | ✅ | Standard web app |
| Firefox | ✅ | Standard web app |
| Safari (macOS/iOS) | ✅ | Standard web app |
| Edge | ✅ | Standard web app |
| Mobile browsers | ✅ | Responsive design |

**No browser extension needed.** No Chrome-only APIs. No Safari limitations.

---

## Recommendation

**For "absolutely works":** Google Places API  
**For "cheapest + reliable":** Hetzner VPS ($4.70/month)  
**For "quick prototype":** Apify free tier  

**My recommendation:** Start with Hetzner VPS. It's $4.70/month, you keep your existing Playwright code, and you get full control. If that works, consider Google Places API later for production.
