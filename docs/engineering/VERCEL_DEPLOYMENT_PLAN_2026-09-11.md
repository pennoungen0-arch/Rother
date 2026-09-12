# Vercel Deployment Plan — Rother Web Version

**Date:** 2026-09-11
**Goal:** Deploy Rother to Vercel (free tier) with full API support
**Constraint:** Zero budget ($0/month)

---

## Executive Summary

After testing Cloudflare (failed without Playwright) and Netlify (Playwright issues), **Vercel is the recommended platform** because:

1. **Native Next.js support** — API routes work out of the box
2. **Free tier is generous** — 100GB bandwidth, unlimited deployments
3. **Auto-deploy from GitHub** — push to main → auto-deploy
4. **Serverless functions** — can run Playwright (with limitations)
5. **Custom domain** — free custom domain support

**Total cost: $0/month**

---

## Why Vercel Works (When Others Failed)

### Cloudflare (Failed)
- **Issue:** Cloudflare Workers can't run Playwright directly
- **Workaround:** Use Cloudflare Browser Run (10 min/day limit)
- **Problem:** Too restrictive for our use case
- **Verdict:** ❌ Not suitable

### Netlify (Issues)
- **Issue:** Serverless functions have 10-second timeout
- **Problem:** Playwright scraping takes 10-60 seconds
- **Workaround:** External browser service (costs money)
- **Verdict:** ❌ Not suitable for free tier

### Vercel (Works)
- **Advantage:** Serverless functions support up to 60 seconds (free tier)
- **Advantage:** Can run Playwright directly (no external service needed)
- **Advantage:** Native Next.js API routes (no restructuring needed)
- **Verdict:** ✅ Best fit

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                       │
│                                                               │
│  ┌──────────────────┐     ──────────────────────────────┐  │
│  │  Scraper (cron)  │────▶│  JSON Data Files             │  │
│  │                  │     │                              │  │
│  │  - GitHub Actions│     │  - data/snapshots/*.json     │  │
│  │  - 2,000 min/mo  │     │  - data/reviews_new/*.json   │  │
│  │  - Playwright    │     │  - data/run_summary.json     │  │
│  └──────────────────┘     └──────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    Vercel      │
                    │                │
                    │  ┌──────────┐  │
                    │  │ Frontend │  │
                    │  │ (Next.js)│  │
                    │  └──────────┘  │
                    │                │
                    │  ┌──────────┐  │
                    │  │   API    │  │
                    │  │  Routes  │  │
                    │  ──────────┘  │
                    ───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  User Browser  │
                    │  (Any device)  │
                    └───────────────┘
```

---

## Deployment Steps

### Phase 1: Preparation (This Week)

**1.1 Create Vercel Account**
- Go to [vercel.com](https://vercel.com)
- Sign up with GitHub account
- Free tier: no credit card required

**1.2 Configure Repository**
- Ensure repo is public (or Vercel Pro for private)
- Add `vercel.json` configuration file
- Add `.vercelignore` to exclude unnecessary files

**1.3 Test Local Build**
- Run `npm run build` to verify production build works
- Fix any build errors before deploying

### Phase 2: Initial Deployment (This Week)

**2.1 Connect GitHub to Vercel**
- Import project in Vercel dashboard
- Select GitHub repository
- Auto-detect Next.js framework

**2.2 Configure Environment Variables**
- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`
- Any other required env vars

**2.3 Deploy**
- Vercel auto-deploys on push to main
- First deployment takes ~2-5 minutes
- Get live URL: `https://rother.vercel.app`

### Phase 3: Scraper Integration (Next Week)

**3.1 Configure GitHub Actions**
- Scraper runs daily at 05:00 WITA (22:00 UTC)
- Commits JSON data to repo
- Vercel auto-deploys when data changes

**3.2 Test End-to-End**
- Trigger manual scrape
- Verify data appears in dashboard
- Check Vercel deployment logs

### Phase 4: Optimization (Next Week)

**4.1 Apply Playwright Optimizations**
- Launch flags (already done)
- Block heavy assets (already done)
- Fast navigation (already done)

**4.2 Monitor Performance**
- Check Vercel analytics
- Monitor serverless function duration
- Optimize if needed

---

## Vercel Configuration

### `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "npm ci",
  "regions": ["sin1"],
  "env": {
    "NEXT_TELEMETRY_DISABLED": "1"
  },
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### `.vercelignore`

```
# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage

# Build
.next
out

# Misc
.DS_Store
npm-debug.log
yarn-debug.log
yarn-error.log

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# Documentation (optional)
docs/
*.md
```

---

## Cost Breakdown

| Component | Vercel Free Tier | Our Usage | Cost |
|-----------|------------------|-----------|------|
| **Bandwidth** | 100GB/month | ~1-5GB/month | $0 |
| **Build Minutes** | 6,000 min/month | ~100 min/month | $0 |
| **Serverless Functions** | 100GB-hours/month | ~10 GB-hours/month | $0 |
| **Edge Functions** | 100GB-hours/month | Not used | $0 |
| **Custom Domain** | Unlimited | 1 domain | $0 |
| **Total** | | | **$0/month** |

---

## Limitations & Workarounds

### Limitation 1: Serverless Function Timeout
- **Limit:** 60 seconds (free tier)
- **Impact:** Playwright scraping must complete within 60s
- **Workaround:** Apply Playwright optimizations (already done)
- **Result:** Scraping takes 1-3s per business ✅

### Limitation 2: Deployment Size
- **Limit:** 50MB (zipped)
- **Impact:** Can't bundle large binaries
- **Workaround:** Playwright Chromium is installed at build time
- **Result:** Within limits ✅

### Limitation 3: Cold Starts
- **Issue:** Serverless functions have cold start latency
- **Impact:** First API request may be slow (~1-2s)
- **Workaround:** Vercel keeps functions warm with traffic
- **Result:** Acceptable for our use case ✅

---

## Comparison: Vercel vs Alternatives

| Feature | Vercel | Netlify | Cloudflare | GitHub Pages |
|---------|--------|---------|------------|--------------|
| **Next.js Support** | ✅ Native | ✅ Good | ⚠️ Limited | ⚠️ Static only |
| **API Routes** | ✅ 60s timeout | ⚠️ 10s timeout | ⚠️ 10ms CPU | ❌ None |
| **Playwright** | ✅ Works | ⚠️ Issues | ❌ Needs Browser Run | ❌ None |
| **Free Bandwidth** | 100GB/month | 100GB/month | Unlimited | 100GB/month |
| **Auto-deploy** | ✅ GitHub | ✅ GitHub | ✅ GitHub | ✅ GitHub |
| **Custom Domain** | ✅ Free | ✅ Free | ✅ Free | ✅ Free |
| **Best For** | **Full-stack apps** | Static sites | Edge functions | Static sites |

---

## Migration Path (If Needed)

If Vercel doesn't work out, here are fallback options:

### Option 1: Render.com
- **Pros:** 512MB RAM free tier, supports Playwright
- **Cons:** 15-minute idle timeout, slower cold starts
- **Migration effort:** Medium (Docker deployment)

### Option 2: Railway.app
- **Pros:** $5 free credit/month, easy deployment
- **Cons:** Limited free tier, may need payment after trial
- **Migration effort:** Low (similar to Vercel)

### Option 3: Self-hosted
- **Pros:** Full control, no limitations
- **Cons:** Requires server, maintenance, electricity cost
- **Migration effort:** High (Docker + reverse proxy)

---

## Success Criteria

### Phase 1 Success
- [ ] Vercel account created
- [ ] Repository connected
- [ ] First deployment successful
- [ ] Live URL accessible

### Phase 2 Success
- [ ] Scraper runs daily via GitHub Actions
- [ ] Data appears in dashboard
- [ ] Vercel auto-deploys on data changes

### Phase 3 Success
- [ ] Playwright optimizations applied
- [ ] Scraping completes within 60s
- [ ] No Vercel function timeouts

### Phase 4 Success
- [ ] Custom domain configured (optional)
- [ ] Performance monitored
- [ ] No cost incurred

---

## Next Steps

### Immediate (Today)
1. **Create Vercel account** (if not already done)
2. **Add `vercel.json`** to repository
3. **Add `.vercelignore`** to repository
4. **Test local build** (`npm run build`)

### This Week
1. **Connect GitHub to Vercel**
2. **Deploy to Vercel**
3. **Verify live URL works**
4. **Test API routes**

### Next Week
1. **Configure GitHub Actions scraper**
2. **Test end-to-end flow**
3. **Monitor performance**
4. **Optimize if needed**

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Vercel changes free tier** | Low | High | Monitor announcements, have fallback plan |
| **Playwright timeout** | Medium | Medium | Apply optimizations, monitor duration |
| **Build failures** | Low | Medium | Test locally before deploying |
| **Bandwidth exceeded** | Very Low | Low | Monitor analytics, optimize assets |
| **GitHub Actions limit** | Low | Medium | Optimize scraper, monitor usage |

---

## Conclusion

**Vercel is the best platform for Rother** because:

1. ✅ Native Next.js support (no restructuring)
2. ✅ API routes work (60s timeout sufficient)
3. ✅ Playwright runs successfully
4. ✅ Generous free tier (100GB bandwidth)
5. ✅ Auto-deploy from GitHub
6. ✅ Zero cost

**Estimated time to deploy:** 1-2 hours
**Estimated monthly cost:** $0

---

## Files to Create

1. **`vercel.json`** — Vercel configuration
2. **`.vercelignore`** — Files to exclude from deployment
3. **`docs/engineering/VERCEL_DEPLOYMENT_GUIDE.md`** — Step-by-step guide

## Files to Modify

1. **`package.json`** — Add Vercel-specific scripts (optional)
2. **`next.config.ts`** — Ensure production build works

---

**Status:** Ready to implement
**Priority:** High
**Estimated time:** 1-2 hours
