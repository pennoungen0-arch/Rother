# Rother Web Deployment Guide

## Universal Web Access

Rother is now accessible via any browser on any device — no installation required.

## Deployment Options

### Option 1: Vercel (Recommended)

**Zero-config deployment for Next.js apps.**

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Vercel auto-detects Next.js — click Deploy
4. Your app is live at `https://your-app.vercel.app`

**Auto-deploy on data updates:**
The GitHub Actions workflow (`scrape.yml`) commits scraped data daily. To trigger redeployment:

```yaml
# Add to scrape.yml after the "Commit results" step:
      - name: Trigger Vercel Deploy
        run: |
          curl -X POST "https://api.vercel.com/v1/projects/${{ secrets.VERCEL_PROJECT_ID }}/deployments" \
            -H "Authorization: Bearer ${{ secrets.VERCEL_TOKEN }}"
```

### Option 2: Netlify

1. Go to [netlify.com](https://netlify.com)
2. Import your GitHub repository
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. Click Deploy

### Option 3: GitHub Pages (Static)

For zero-cost static hosting, use the static export mode:

```bash
npm run build:static
```

This generates static HTML + JSON files in `out/` directory.

**Note:** Static export requires pre-generating API data. Use the scraper workflow to commit data, then build.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Repository                        │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │  Scraper (cron)  │    │  Next.js Dashboard           │  │
│  │                  │    │                              │  │
│  │  - Runs daily    │───▶│  - Reads data from repo      │  │
│  │  - Commits data  │    │  - Serves via API routes     │  │
│  └──────────────────┘    └──────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Vercel/Netlify│
                    │  (Auto-deploy) │
                    └───────────────┘
                            │
                            ▼
                    ───────────────┐
                    │  User Browser  │
                    │  (Any device)  │
                    └───────────────┘
```

## Local Development

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Build for production
npm run build:static # Build static export (for GitHub Pages)
```

## Data Flow

1. **Scraper** runs on GitHub Actions (daily at 05:00 WITA)
2. **Data** committed to `gbp-monitor/data/` in the repo
3. **Dashboard** reads data via API routes (`/api/overview`, `/api/branches`, etc.)
4. **Users** access the deployed URL

## Cost

- **GitHub Actions:** Free (2,000 min/month for public repos)
- **Vercel:** Free tier (100 GB bandwidth/month)
- **Netlify:** Free tier (100 GB bandwidth/month)
- **GitHub Pages:** Free (100 GB/month)

Total: **$0/month** for typical usage.

## Custom Domain

Both Vercel and Netlify support custom domains:

1. Add domain in Vercel/Netlify dashboard
2. Update DNS records (CNAME or A record)
3. SSL certificate auto-provisioned

## Environment Variables

For production deployment, set these in your hosting platform:

```
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

## Troubleshooting

**Build fails:**
- Check Node.js version (requires 22+)
- Run `npm ci` locally to verify dependencies

**Data not showing:**
- Verify scraper workflow ran successfully
- Check `gbp-monitor/data/` has snapshot files

**API routes 404:**
- Ensure deployment platform supports Next.js API routes
- Vercel/Netlify: supported out of the box
- GitHub Pages: requires static export mode
