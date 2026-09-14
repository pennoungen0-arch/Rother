# Rother Web — Step-by-Step Setup & Test Guide

**Last updated:** 2026-09-14T12:30:00+07:00  
**For:** User setting up the client paste-link flow on Vercel + GitHub Actions  
**Time:** 15 minutes  
**Cost:** $0/month

---

## Overview

You're setting up Rother's web version so that clients can paste Google Maps links directly in the dashboard. The system then:
1. Resolves the link to a business ID
2. Adds it to GitHub's `data` branch
3. Triggers the scraper automatically
4. Shows the data in the dashboard

This guide walks you through every step.

---

## Part 1: Generate GitHub Personal Access Token

You're on the right page. Here's exactly what to do:

### Step 1.1: Confirm token settings

Your current settings (from your screenshot) are correct:
- ✅ **Token name:** `rotherweb vercel`
- ✅ **Expiration:** 90 days (Oct 31, 2026)
- ✅ **Resource owner:** `pennoungen0-arch`
- ✅ **Repository access:** Only select repositories → `pennoungen0-arch/Rother`
- ✅ **Permissions → Repository permissions → Contents:** Read and Write

### Step 1.2: Generate the token

1. **Scroll down** to the bottom of the page
2. **Click "Generate token"** (green button)
3. **Copy the token immediately** — you won't see it again
   - Click the copy icon next to the token
   - Or select all and copy
   - **Save it somewhere safe** (password manager, secure note)

**Example token format:** `github_pat_11ABCDEFG0_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**⚠️ Important:** Don't share this token publicly. It has write access to your repository.

---

## Part 2: Add Token to Vercel

### Step 2.1: Navigate to environment variables

1. Open https://vercel.com/dashboard
2. Click on **`rotherweb`** project
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)

### Step 2.2: Add or update `GITHUB_PAT`

**Check if `GITHUB_PAT` already exists:**

1. Look for `GITHUB_PAT` in the list
2. If it exists:
   - Click the **"..."** menu → **Edit**
   - Paste the new token value
   - Click **Save**
3. If it doesn't exist:
   - Click **"Add Environment Variable"**
   - **Name:** `GITHUB_PAT`
   - **Value:** Paste the token
   - **Environment:** Select all three: Production, Preview, Development
   - Click **Save**

### Step 2.3: Verify the token is saved

1. You should see `GITHUB_PAT` in the list
2. **Value** is hidden (shows "•••")
3. **Environments:** Production, Preview, Development (all three)

---

## Part 3: Trigger Vercel Redeploy

The new token won't be used until Vercel redeploys with it.

### Option A: Push empty commit (recommended)

```powershell
git commit --allow-empty -m "chore: trigger Vercel redeploy for GITHUB_PAT"
git push origin main
```

This triggers an automatic deployment.

### Option B: Manual redeploy in Vercel

1. Go to https://vercel.com/dashboard
2. Click **`rotherweb`** project
3. Click **Deployments** (top navigation)
4. Find the **latest deployment**
5. Click the **"..."** menu (three dots)
6. Click **"Redeploy"**
7. Wait for deployment to complete (1-2 minutes)

### Step 3.2: Verify deployment status

1. In Vercel → Deployments
2. Latest deployment should show:
   - Status: **"Ready"** (green checkmark)
   - Source: latest commit on `main`
3. Click the deployment to see build logs

---

## Part 4: Verify GITHUB_PAT is Working

Before testing the paste-link flow, verify the token is being read.

### Step 4.1: Test the API endpoint

Open PowerShell and run:

```powershell
try {
    $response = Invoke-WebRequest -Uri "https://rotherweb.vercel.app/api/add-competitor" -UseBasicParsing -TimeoutSec 30 -Method POST -ContentType "application/json" -Body '{"url":"https://maps.app.goo.gl/test"}' -ErrorAction SilentlyContinue
    Write-Host "HTTP $($response.StatusCode): $($response.Content)"
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        $reader = [System.IO.StreamReader]::new($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "HTTP $($_.Exception.Response.StatusCode): $body"
    }
}
```

### Expected results:

| Response | Meaning | Next step |
|---|---|---|
| `HTTP 422: {"error":"Could not resolve..."}` | ✅ Token works! URL is just invalid | Continue to Part 5 |
| `HTTP 500: {"error":"Server not configured: GITHUB_PAT missing"}` | ❌ Token not in deployment | Wait for redeploy, retry |
| `HTTP 404` | ❌ Route not deployed | Check Vercel deployment logs |

---

## Part 5: Test the Paste-Link Flow

### Step 5.1: Open the dashboard

1. Open **https://rotherweb.vercel.app** in your browser
2. **Hard refresh:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or open in **incognito/private window** to bypass cache

### Step 5.2: Navigate to Config page

1. Click **"Hubs"** (top right)
2. Click **"Tools"** card
3. Click **"Configuration"** feature

**Expected:** You should see "No competitors added yet. Add your first competitor above."

### Step 5.3: Get a real Google Maps link

1. Open https://maps.google.com in another tab
2. Search for your business (e.g., "Shady Shack Canggu")
3. Click on the business listing
4. Click the **Share** button
5. Click **"Copy link"**

**Example link format:**
- `https://maps.app.goo.gl/AbCdEf123...` (short link)
- `https://www.google.com/maps/place/.../@-8.68,115.16...` (full URL)

### Step 5.4: Paste and add

1. **Paste** the link in the input field
2. Click **"Add"** button

**Expected toast:**
```
✅ "Shady Shack added! First scrape will run within 10 minutes."
```

**Possible errors:**

| Error | Cause | Fix |
|---|---|---|
| `"Could not resolve this Google Maps link..."` | Invalid URL or network issue | Try a different link |
| `"Server not configured: GITHUB_PAT missing"` | Token not in deployment | Wait for redeploy, retry |
| `"X is already being monitored"` | Duplicate business | Use a different business |

---

## Part 6: Watch the Scraper Run

### Step 6.1: Check GitHub Actions

1. Open https://github.com/pennoungen0-arch/Rother/actions/workflows/scraper.yml
2. Look for a **new run** (not the old #1 or #2)
3. Status should be:
   - 🟡 **Yellow spinner** (running, 5-10 min)
   - 🟢 **Green check** (success)

### Step 6.2: Click into the run for details

1. Click the run
2. Scroll to the bottom
3. Click **"Run Review Scraper"** to expand logs
4. Look for lines like:
   ```
   PHASE[comp-shady-shack-01] scroll_complete — success
   JSONLOG: {"run_id":"...","stage":"listing_done","reviews":N}
   ROTH RUN COMPLETE
   ```

### Step 6.3: Wait for completion

- **Duration:** 5-10 minutes
- **You'll see:** Scraper opens Google Maps, scrolls reviews, saves data

---

## Part 7: Verify Data in Dashboard

### Step 7.1: Hard refresh dashboard

1. Go back to https://rotherweb.vercel.app
2. **Hard refresh:** `Ctrl+Shift+R`
3. Wait 2-5 minutes for Vercel CDN to fetch new data

### Step 7.2: Check the data

**On the Today page / KPIs:**
- "Last scrape: Xm ago" (should be fresh)
- Branches monitored: 1
- Competitors tracked: 1
- Reviews collected: N (depends on business)

**On the Reviews page:**
- Click "All Reviews" or use Command+K
- Should see reviews from the business you added

---

## Part 8: Troubleshooting

### Issue: "GITHUB_PAT missing" error after redeploy

**Fix:**
1. Vercel → Settings → Environment Variables
2. Verify `GITHUB_PAT` is listed
3. If missing, re-add it
4. Trigger another redeploy

### Issue: "Could not resolve" error

**Possible causes:**
1. Invalid Google Maps link
2. Google Maps API rate limit
3. Network timeout

**Fix:**
1. Try a different Google Maps link
2. Wait 1 minute, try again
3. Check Vercel function logs (Vercel → Logs tab)

### Issue: Workflow doesn't trigger

**Possible causes:**
1. `GITHUB_PAT` doesn't have workflow trigger permission
2. Token has expired

**Fix:**
1. Check token expiration (90 days from creation)
2. Regenerate token if expired
3. Verify token has `Contents: Read and Write`

### Issue: Data doesn't appear in dashboard

**Possible causes:**
1. Scraper hasn't completed yet (wait 10 min)
2. Data commit failed
3. Dashboard cached old data

**Fix:**
1. Wait 10 minutes after scrape completes
2. Hard refresh browser
3. Check `data` branch on GitHub for new commits

---

## Summary Checklist

- [ ] GitHub PAT generated (90 days, Contents: Read/Write)
- [ ] PAT added to Vercel (Production, Preview, Development)
- [ ] Vercel redeployed (after PAT was added)
- [ ] API returns 422 (not 500) for invalid URL
- [ ] Dashboard loads with hard refresh
- [ ] Config page accessible
- [ ] Pasted Google Maps link, clicked Add
- [ ] Saw success toast
- [ ] Workflow run appeared in GitHub Actions
- [ ] Scraper completed (green checkmark)
- [ ] Data appears in dashboard

**All steps complete = paste-link flow working end-to-end!**
