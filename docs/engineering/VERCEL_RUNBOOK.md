# Vercel Deployment Runbook

**Last updated:** 2026-09-14T09:00:00+07:00  
**Audience:** Developer deploying or troubleshooting Rother on Vercel  
**Scope:** Step-by-step deployment + troubleshooting for `rotherweb.vercel.app`

---

## Prerequisites

1. **GitHub account** with `pennoungen0-arch` username
2. **Vercel account** (free Hobby tier) connected to GitHub
3. **Node.js v22+** locally (for testing builds)
4. **Python 3.11+** locally (for scraper testing)

---

## Initial Deployment (one-time)

### 1. Create Vercel project

1. Go to https://vercel.com/new
2. Import `pennoungen0-arch/Rother`
3. Project name: `rotherweb`
4. Framework: Next.js (auto-detected)
5. Root directory: `./` (default)
6. **Do NOT deploy yet** — first add environment variables

### 2. Configure environment variables

In Vercel project settings → Environment Variables:

| Variable | Value | Scope |
|---|---|---|
| `NEXT_TELEMETRY_DISABLED` | `1` | All |
| `NEXT_PUBLIC_VERCEL` | `1` | All |
| `GITHUB_PAT` | `<your-pat>` | Production, Preview, Development |

**To create the GitHub PAT:**
1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token" (Fine-grained)
3. Name: `rotherweb-vercel`
4. Repository access: `pennoungen0-arch/Rother` (only)
5. Permissions: `Contents` = Read and write
6. Generate token, copy immediately (you won't see it again)

### 3. Configure build settings

In Vercel project settings → General:

- **Build Command:** `npx next build` (overrides `npm run build` to skip Tauri wrapper)
- **Output Directory:** `.next` (default)
- **Install Command:** `npm ci` (default)
- **Node.js Version:** 22.x

### 4. Deploy

Click "Deploy" — Vercel will:
1. Clone the repo
2. Run `npm ci` (install deps)
3. Run `npx next build` (build Next.js)
4. Deploy to `https://rotherweb.vercel.app`

**Expected time:** 3-5 minutes for first build.

---

## Ongoing Maintenance

### Triggering a scrape manually

1. Go to https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml
2. Click "Run workflow"
3. Confirm:
   - Branch: `main`
   - Competitor IDs: (empty = all)
   - Mode: `manual`
4. Click green "Run workflow" button
5. **Wait 5-10 minutes** for scrape to complete
6. Refresh `https://rotherweb.vercel.app` — new data appears within 2-5 min

### Updating competitor list

The list of monitored businesses lives in `gbp-monitor/config/listings.json` on the `main` branch.

**To add a new business:**

1. Edit `gbp-monitor/config/listings.json`:
   ```json
   {
     "branches": [
       {
         "branch_id": "shady-shack-canggu",
         "branch_name": "Shady Shack Canggu",
         "competitors": [
           {
             "competitor_id": "comp-shady-01",
             "name": "Shady Shack",
             "gmaps_url": "https://maps.app.goo.gl/XXXXX",
             "place_id": "ChIJ..."
           }
         ]
       }
     ]
   }
   ```
2. Commit + push to `main`:
   ```bash
   git add gbp-monitor/config/listings.json
   git commit -m "feat: add Shady Shack competitor"
   git push origin main
   ```
3. Trigger scraper workflow manually (see above)
4. Data syncs to `data` branch → Vercel dashboard updates

**To remove a business:**
- Delete the competitor from the JSON, commit, push, trigger workflow.

### Updating Vercel deployment

Any push to `main` triggers a Vercel redeploy:
1. Vercel detects push via GitHub webhook
2. Runs `npx next build`
3. Deploys to production
4. **Takes 2-3 minutes**

To check deployment status: Vercel dashboard → `rotherweb` → Deployments tab.

---

## Troubleshooting

### "Everything still the same after I deployed" (browser cache)

**Symptom:** You pushed new code, Vercel says it's deployed, but the dashboard still looks old.

**Cause:** Browser is serving cached JavaScript.

**Fix:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or open in incognito/private window
3. Or clear browser cache for `rotherweb.vercel.app`

### "Data not updating after scrape"

**Symptom:** Workflow completed successfully, but dashboard still shows old data.

**Cause:** `raw.githubusercontent.com` has a CDN cache (5-10 min).

**Fix:**
1. Wait 5-10 minutes
2. Hard refresh the dashboard
3. Check the `data` branch on GitHub — if it's updated there, the dashboard will eventually sync

### "Scraper workflow fails with Python error"

**Symptom:** GitHub Actions run shows Python traceback.

**Fix:**
1. Check the error log in GitHub Actions
2. Common causes:
   - Invalid `place_id` in listings.json
   - Google rate-limited the IP (wait 1 hour, try again)
   - Playwright version mismatch (re-run, cache will rebuild)
3. Re-trigger the workflow

### "Scraper workflow fails with git error"

**Symptom:** `fatal: pathspec ... did not match any file(s)` or similar.

**Fix:**
1. Check if `data/` directory exists in the runner
2. The workflow uses `git add -f` to force-add ignored files — should work
3. If `data` branch doesn't exist yet, the workflow creates it

### "Vercel build fails"

**Symptom:** Deployment shows red error in Vercel dashboard.

**Fix:**
1. Click the failed deployment → "Build Logs"
2. Common causes:
   - `npx next build` fails (check `@types/node` is installed)
   - TypeScript errors (run `npx tsc --noEmit` locally)
   - Missing dependencies (check `package.json`)

### "Health API shows version 0.2.0"

**This is correct.** The health API has a hardcoded version string that was never updated. It's cosmetic. The actual deployed code is at v0.4.7.

### "Refresh button doesn't work"

**This is by design on Vercel.** Vercel cannot run Python. Use the "Trigger Scrape" link in the TopBar instead, which opens GitHub Actions.

### "Add competitor form does nothing"

**This is by design on Vercel.** The form is read-only on Vercel (no writable filesystem). To add competitors:
1. Edit `gbp-monitor/config/listings.json` on `main` branch
2. Commit + push
3. Trigger workflow manually

**OR (future):** Use the planned `/api/add-competitor` route with GitHub PAT.

---

## Cost breakdown

| Service | Tier | Cost | Limits |
|---|---|---|---|
| Vercel | Hobby | $0 | 100GB bandwidth/mo, 6,000 build min/mo |
| GitHub Actions | Free | $0 | 2,000 min/mo, 500MB storage, 6hr max job |
| GitHub API | Free | $0 | 5,000 req/hr (authenticated) |
| GitHub Storage | Free | $0 | 1GB repo (public) |
| **Total** | | **$0** | |

---

## Monitoring

### Vercel
- Dashboard: https://vercel.com/dashboard
- Function logs: Vercel → `rotherweb` → Logs tab
- Bandwidth: Vercel → `rotherweb` → Analytics tab

### GitHub Actions
- Runs: https://github.com/pennoungen0-arch/Rother/actions
- Minutes used: Settings → Billing → Plans and usage
- Storage: Settings → Billing → Plans and usage

### Data branch
- Branch: https://github.com/pennoungen0-arch/Rother/tree/data
- Latest snapshot: `https://github.com/pennoungen0-arch/Rother/blob/data/gbp-monitor/data/snapshots/`
- Raw access: `https://raw.githubusercontent.com/pennoungen0-arch/Rother/data/gbp-monitor/...`

---

## Quick reference

| Task | Where |
|---|---|
| View dashboard | https://rotherweb.vercel.app |
| Trigger scrape | https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml |
| Add competitor | Edit `gbp-monitor/config/listings.json` on `main` |
| View raw data | `https://raw.githubusercontent.com/pennoungen0-arch/Rother/data/gbp-monitor/data/` |
| Check Vercel build | Vercel → `rotherweb` → Deployments |
| Check scraper runs | GitHub → Actions |
| View run logs | GitHub → Actions → click run → scroll to bottom |
