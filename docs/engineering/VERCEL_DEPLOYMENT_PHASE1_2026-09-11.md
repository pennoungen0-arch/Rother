# Vercel Deployment — Phase 1 Complete

**Date:** 2026-09-11
**Status:** ✅ Phase 1 Complete

---

## What Was Done

### 1. Created `vercel.json`

Configuration file for Vercel deployment:

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

**Key settings:**
- **Framework:** Next.js (auto-detected)
- **Region:** Singapore (sin1) — closest to Indonesia
- **Function timeout:** 60 seconds (enough for Playwright scraping)
- **Telemetry:** Disabled (privacy + performance)

### 2. Created `.vercelignore`

Excludes unnecessary files from deployment:

- `node_modules/` — installed by Vercel during build
- `gbp-monitor/` — Python scraper (not needed for frontend)
- `src-tauri/` — desktop app (not web)
- `docs/` — documentation (not needed in production)
- `.next/` — build output (regenerated)
- Various OS/dev files

**Result:** Smaller deployment, faster builds

### 3. Tested Local Production Build

```bash
npm run build
```

**Result:** ✅ Build successful

**Output:**
- Static pages: 2 (`/`, `/_not-found`)
- Dynamic API routes: 34 (all `/api/*` routes)
- Build time: ~30 seconds
- Output directory: `.next/standalone`

**Route summary:**
```
○ /                           (Static)
○ /_not-found                 (Static)
ƒ /api/*                      (Dynamic - 34 routes)
```

---

## Build Verification

### Directory Structure

```
.next/
├── build/          # Build metadata
├── cache/          # Build cache
├── server/         # Server-side code
├── standalone/     # Standalone deployment
├── static/         # Static assets
└── types/          # TypeScript types
```

### Key Files

- `.next/standalone/server.js` — Production server
- `.next/static/` — Static assets (JS, CSS, images)
- `vercel.json` — Vercel configuration
- `.vercelignore` — Deployment exclusions

---

## Next Steps: Phase 2 (Deployment)

### Prerequisites

1. **Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub account
   - No credit card required for free tier

2. **GitHub Repository**
   - Ensure repo is public (or Vercel Pro for private)
   - All changes committed and pushed

### Deployment Steps

1. **Import Project in Vercel**
   - Click "New Project"
   - Import from GitHub
   - Select repository

2. **Configure Settings**
   - Framework: Next.js (auto-detected)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
   - Region: Singapore (sin1)

3. **Deploy**
   - Click "Deploy"
   - Wait 2-5 minutes
   - Get live URL: `https://rother.vercel.app`

4. **Verify**
   - Open live URL
   - Test API routes
   - Check dashboard loads

---

## Estimated Time

- **Phase 1 (Preparation):** ✅ Complete (30 minutes)
- **Phase 2 (Deployment):** ~30 minutes
- **Phase 3 (Integration):** ~1 hour
- **Total:** ~2 hours

---

## Cost

| Component | Usage | Cost |
|-----------|-------|------|
| **Bandwidth** | ~1-5GB/month | $0 (100GB free) |
| **Build Minutes** | ~100 min/month | $0 (6,000 min free) |
| **Serverless Functions** | ~10 GB-hours/month | $0 (100 GB-hours free) |
| **Total** | | **$0/month** |

---

## Files Created

1. **`vercel.json`** — Vercel configuration
2. **`.vercelignore`** — Deployment exclusions
3. **`docs/engineering/VERCEL_DEPLOYMENT_PHASE1_2026-09-11.md`** — This document

---

## Status

✅ **Phase 1 Complete** — Ready for deployment

**Next:** Proceed to Phase 2 (Vercel deployment) when ready.
