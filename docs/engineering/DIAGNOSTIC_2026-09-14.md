# Diagnostic Report — Vercel + GitHub Actions Web Version

**Last updated:** 2026-09-14T12:00:00+07:00  
**Scope:** Current state of the zero-cost web architecture (Vercel + GitHub Actions + Playwright)  
**Status:** ⚠️ **Partially working** — some pieces are deployed, others need fixing

---

## TL;DR

The Phase 4 paste-link flow is **implemented but not deployed correctly**. Two issues prevent it from working:

1. **`GITHUB_PAT` env var is set in Vercel but the deployment didn't pick it up**
   - Need to trigger a new Vercel deployment after adding env vars
2. **The `data` branch `listings.json` is malformed JSON**
   - User tried to clear it but the closing brackets are wrong

After fixing both, the paste-link flow should work end-to-end.

---

## 1. Current Architecture (what's deployed)

```
┌─────────────────┐
│  Vercel Web      │  → rotherweb.vercel.app (Next.js, deployed)
│  (auto-deploy)  │
└────────┬────────┘
         │
         ├─ /api/add-competitor (new route, deployed but missing GITHUB_PAT)
         ├─ /api/places (existing, works)
         ├─ /api/overview (existing, works)
         └─ ... other read routes (all work)
         
         │
         ▼
┌─────────────────┐
│  GitHub Actions  │  → Runs Playwright scraper daily 02:00 UTC + manual
│  (scraper.yml)   │
└────────┬────────┘
         │
         ▼ (commits scraped data)
┌─────────────────┐
│  data branch     │  → gbp-monitor/data/ (snapshots, run_summary)
│  (GitHub)        │  → gbp-monitor/config/listings.json (CURRENTLY BROKEN JSON)
└─────────────────┘
```

**Code status:**
- ✅ `/api/add-competitor` route deployed (returns 500 due to missing env var)
- ✅ Workflow reads config from data branch (after overlay step)
- ✅ Onboarding UI calls new route on Vercel
- ✅ Config page calls new route on Vercel

**Config status:**
- ❌ `GITHUB_PAT` env var not in deployment
- ❌ Data branch listings.json malformed

---

## 2. Diagnostic — What's broken

### Issue 1: `/api/add-competitor` returns 500

```
POST /api/add-competitor
Content-Type: application/json
Body: {"url":"https://maps.app.goo.gl/test"}

→ HTTP 500
{"error":"Server not configured: GITHUB_PAT missing"}
```

**Root cause:** Vercel env vars only apply to **new** deployments. The deployment that included the `/api/add-competitor` route was built before `GITHUB_PAT` was added to the project settings.

**Fix:**
1. Go to Vercel → `rotherweb` → Deployments
2. Click "..." on the latest deployment → "Redeploy"
3. OR push any commit to `main` (triggers auto-deploy with env vars)

### Issue 2: Data branch listings.json is malformed

```
https://raw.githubusercontent.com/pennoungen0-arch/Rother/data/gbp-monitor/config/listings.json

{
  "_comment": "Minimal test config for 3 competitors with real place_ids",
  "branches": []
    {                                    ← INVALID JSON (should be in [])
      "branch_id": "test-canggu",
      ...
```

**Root cause:** User manually cleared `branches: []` but the old data and closing `}` are still there. JSON parsing fails silently → dashboard shows 0 branches.

**Fix:**
1. Go to https://github.com/pennoungen0-arch/Rother/blob/data/gbp-monitor/config/listings.json
2. Edit the file
3. Replace entire content with:
```json
{
  "_comment": "Monitored businesses (added via web dashboard)",
  "branches": []
}
```
4. Commit changes

### Issue 3: Browser cache shows old UI

```
Config page shows "Run scan again" button + "Failed to start scrape" toast
```

**Root cause:** Browser is serving cached JavaScript. The new UI (with "Trigger manually →" link) is deployed but browser hasn't fetched it.

**Fix:**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or open in incognito/private window

---

## 3. What should happen after fixes

1. User adds `GITHUB_PAT` to Vercel (already done)
2. User triggers Vercel redeploy (not done yet — needs to be done)
3. User fixes data branch listings.json (currently broken)
4. User hard-refreshes browser
5. User pastes Google Maps link on dashboard
6. Frontend calls `POST /api/add-competitor`
7. Route resolves URL → place_id
8. Route calls GitHub API to update listings.json on data branch
9. Route calls GitHub API to trigger workflow
10. Workflow reads config from data branch (with new competitor)
11. Scraper runs (5-10 min)
12. Data commits to data branch
13. Dashboard refreshes, shows new business

**Expected total time:** 10-15 minutes from paste to data visible.

---

## 4. What's working (verified)

| Component | Status | Evidence |
|---|---|---|
| Vercel dashboard accessible | ✅ | HTTP 200 from rotherweb.vercel.app |
| `/api/overview` works | ✅ | Returns run summary data |
| `/api/places` resolves URLs | ✅ | Tested with Google Maps links |
| `/api/add-competitor` route exists | ✅ | Returns 500 (route exists, env var missing) |
| Workflow file on main | ✅ | scrapper.yml deployed, uses run_all (no --schedule) |
| Workflow reads config from data branch | ✅ | Overlay step added |
| Data branch exists | ✅ | Commit `303235e` on data branch |
| Data branch listings.json on Vercel | ✅ | Empty `branches: []` (clean state) |
| Test scrape ran successfully | ✅ | Run #2: 3 competitors, 1460 reviews, 7m32s |
| Vercel env vars set | ✅ | `GITHUB_PAT` added (Production, Preview, Development) |
| Vercel deployments triggered | ✅ | 4 deployments visible (feat Phase 4 + 2 docs + 1 preview) |

---

## 5. What's not working (needs fixing)

| Component | Status | Fix |
|---|---|---|
| `/api/add-competitor` reads `GITHUB_PAT` | ❌ Returns "missing" | Redeploy Vercel after env var was added |
| Data branch listings.json is valid JSON | ❌ Malformed | Edit file, remove trailing data, commit |
| User can paste link on dashboard | ❌ Old UI shows | Hard refresh after Vercel redeploy |
| New workflow run triggers from paste | ❌ Not tested yet | After env var fix, test paste-link flow |

---

## 6. Vercel deployment timeline

| Time | Event | Result |
|---|---|---|
| Sep 13, 18:29 | Scraper workflow #2 ran | ✅ 3 competitors scraped |
| Sep 14, ~08:00 | Vercel env var `GITHUB_PAT` added | ⚠️ Added but not in current deployment |
| Sep 14, ~09:00 | Vercel auto-deployed Phase 4 code | ✅ New routes deployed |
| Sep 14, ~10:00 | Data branch listings.json edited | ❌ Malformed JSON |
| Sep 14, ~11:00 | User tried paste-link flow | ❌ API returns 500 (env var missing) |

**Next steps:**
1. Trigger Vercel redeploy (so env var is read)
2. Fix data branch JSON
3. Hard refresh browser
4. Test paste-link flow

---

## 7. What the user needs to do

### Step 1: Trigger Vercel redeploy

**Option A: Push empty commit**
```bash
git commit --allow-empty -m "chore: trigger Vercel redeploy for GITHUB_PAT"
git push origin main
```

**Option B: Manual redeploy in Vercel dashboard**
1. Go to https://vercel.com/pennoun-hove/rotherweb/deployments
2. Click "..." on the latest deployment
3. Click "Redeploy"

### Step 2: Fix data branch listings.json

1. Go to https://github.com/pennoungen0-arch/Rother/edit/data/gbp-monitor/config/listings.json
2. Select all, delete
3. Paste:
```json
{
  "_comment": "Monitored businesses (added via web dashboard)",
  "branches": []
}
```
4. Commit directly to `data` branch

### Step 3: Hard refresh browser

Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac) on rotherweb.vercel.app

### Step 4: Test paste-link flow

1. Go to Config page
2. Paste a Google Maps link
3. Click "Add"
4. Should see: "Shady Shack added! First scrape will run within 10 minutes."
5. Check https://github.com/pennoungen0-arch/Rother/actions for new workflow run

---

## 8. Long-term: paid alternatives

If the zero-cost approach continues to have issues, consider:

| Option | Cost | Reliability | Build time |
|---|---|---|---|
| Google Places API | $0-200/mo | ⭐⭐⭐⭐⭐ | 2 days |
| Hetzner VPS | $4.70/mo | ⭐⭐⭐⭐ | 1 day |
| Apify | $5+/mo | ⭐⭐⭐ | 1 day |
| Outscraper | $0.04/1k | ⭐⭐⭐ | 1 day |

See `PAID_ALTERNATIVES.md` for detailed comparison.

---

## 9. Current commit history

```
main (Vercel deployment source):
887b718 docs: add paste-link flow + GITHUB_PAT troubleshooting to VERCEL_RUNBOOK.md
804a976 feat: Phase 4 — client paste-link flow via GitHub API bridge
0767cc6 docs: ORIGINAL_PLAN_VS_CURRENT — architecture evolution comparison
11d449d docs: comprehensive zero-budget web architecture documentation
12bfea1 docs: comprehensive Vercel deployment documentation + user guide

data branch (scraped data + listings.json):
303235e Update listings.json (pennoungeno-arch, 4 minutes ago) — BROKEN JSON
```

---

## 10. Files affected

- `src/app/api/add-competitor/route.ts` — new route (deployed, needs env var)
- `src/components/shell/onboarding.tsx` — updated to call new route on Vercel
- `src/features/t-config.tsx` — updated to call new route on Vercel
- `.github/workflows/scraper.yml` — overlay config from data branch
- `vercel.json` — `NEXT_PUBLIC_VERCEL=1` env var
- `data/gbp-monitor/config/listings.json` — currently malformed
