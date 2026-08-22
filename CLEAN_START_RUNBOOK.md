# Rother Clean-Start Runbook (Manual Procedure)

**For version:** v0.3.1+ · Windows / PowerShell
**Time:** ~10 min first time, ~3 min after warm-up

---

## PHASE A — Clean Slate (do this every "fresh start")

### A1. Kill everything left running
```powershell
taskkill /F /IM node.exe 2>$null
taskkill /F /IM python.exe 2>$null
```
*Expected: "SUCCESS" lines or errors saying process not found — both fine.*

### A2. Free port 3000 (if something still holds it)
```powershell
netstat -ano | findstr ":3000"
# If any LISTENING row appears, note the PID (last column) then:
taskkill /F /PID <pid>
```
*Expected: no LISTENING rows afterwards. TIME_WAIT rows are fine — they self-clear.*

### A3. Clear build cache (fixes Turbopack EBUSY before it happens)
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

### A4. (Optional) Reset your business session
Only if you want onboarding from absolute zero:
```powershell
# In-browser: DevTools → Application → Local Storage → http://localhost:3000 → Clear
# Also: sessionStorage → Clear
```
Server-side tenant config (optional):
```powershell
Remove-Item -Recurse -Force gbp-monitor\data\users\crate-cafe -ErrorAction SilentlyContinue
Remove-Item -Force gbp-monitor\config\user-business.json -ErrorAction SilentlyContinue
```
⚠️ Deleting `user-business.json` returns you to Fixed mode defaults.

---

## PHASE B — Prepare (first time only, or after dependency changes)

### B1. Dashboard dependencies
```powershell
npm install
npx prisma db push
```
*Expected: "up to date" + "database already in sync".*

### B2. Scraper dependencies
```powershell
cd gbp-monitor
pip install -r requirements.txt
python -m playwright install chromium
python -m orchestration.run_all --validate-config
cd ..
```
*Expected: validation prints `Config validation PASSED`.*
*(Note: use `python -m playwright …`, NOT bare `playwright` — see TROUBLESHOOTING #4.)*

---

## PHASE C — Run

### C1. Start the dev server (foreground terminal — keep open)
```powershell
npm run dev
```
*Expected:*
```
▲ Next.js 16.x (Turbopack)
- Local: http://localhost:3000
✓ Ready in Xs
```
If you see `EBUSY` → redo A1+A3 and retry.

### C2. Smoke-check it's alive (second terminal)
```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/schedule
```

---

## PHASE D — Automated Tests

### D1. Fast gates (~2 min, second terminal)
```powershell
npx vitest run          # expect 103 passed
npx tsc --noEmit        # expect silence
npx eslint src          # expect silence (0 problems)
```

### D2. E2E suite (~30 sec, dev server must be running)
```powershell
npx playwright test     # expect 12 passed (smoke 10 + scheduler 2)
```

### D3. Scraper suites (~2 min) ⚠️ wipes gbp-monitor/data/
```powershell
Copy-Item gbp-monitor\data C:\Users\HP\AppData\Local\Temp\opencode\rother_data_backup -Recurse -Force
cd gbp-monitor
python -m tests.verify_baseline          # expect 132 passed, 0 failed
python -m tests.verify_notifications     # expect 25 passed, 0 failed
python -m tests.verify_variant_framework # expect 32 passed, 0 failed
cd ..
git restore gbp-monitor/data/            # put committed data back
```
⚠️ NEVER skip the restore line, and never `git add -A` while deletions show.

---

## PHASE E — Manual Product Walkthrough (the real test)

In browser at **http://localhost:3000**:

1. **Landing** — paste a real Google Maps link:
   ```
   https://maps.app.goo.gl/dCBcNxfk2fDjbDUC9        (Crate Cafe)
   https://maps.app.goo.gl/FEkM7q8dPc8DrPiQ6        (Revolver Seminyak)
   ```
   Click **Validate**.
   *Expected:* toast "Link validated", card shows **Crate Cafe** +
   `gmaps/ChIJ…` place_id (not coords-only).
   *(If "Could not resolve": wait 5s and retry once — redirect chains vary;
   persistent failure = internet/proxy issue, see TROUBLESHOOTING #1.)*

2. **Continue to monitoring** → Onboarding Step 1 shows **Crate Cafe**
   pre-filled → pick category (**Café**) → **Continue**.

3. **Step 2 branches** → **Skip for now** (or add yours).

4. **Step 3 competitors** → paste Revolver's link → **Add**.
   *Expected:* toast "Competitor added", list row with green **Verified** badge.

5. **Start Monitoring**.
   *Expected:* hubs reveal immediately (don't block); within ~3s a progress
   indicator may appear; when the live scrape finishes (≈1–3 min per
   competitor) you get a toast: **"Scrape completed — Found N new reviews."**

6. **Verify data landed**:
   ```powershell
   Get-ChildItem gbp-monitor\data\users\crate-cafe -Recurse -File |
     Select-Object FullName
   Invoke-RestMethod http://localhost:3000/api/overview |
     ConvertTo-Json -Depth 4
   ```
   *Expected:* `run_summary.json`, snapshots under
   `data/users/crate-cafe/…`; overview shows your branch/competitor counts
   and `"dataStatus": "ok"`.

7. **Dashboard tour**: Insights → KPIs (numbers > 0), Competitors →
   Leaderboard (rows ranked), click ⟳ Refresh on a card
   *(expected toast "Scrape completed", summary reflects partial run)*,
   Reputation → Alerts, Tools → Configuration:
   - Competitor list shows Revolver (remove/re-add works)
   - **Scheduler** card: toggle Enabled ↔ Disabled, set interval —
     refresh page: state persists.

8. **Live CLI cross-check** (optional):
   ```powershell
   cd gbp-monitor
   python -m orchestration.run_all --fixtures --competitors comp-seminyak-01
   cd ..
   ```

---

## PHASE F — Clean Shutdown

```powershell
# In the dev-server terminal: Ctrl+C  (wait for exit prompt)
# If port lingers afterwards:
netstat -ano | findstr ":3000"
taskkill /F /PID <pid>
```

---

## Quick Reference

| Symptom | Fix | Doc |
|---|---|---|
| EBUSY on `npm run dev` | A1 + A3, retry | TROUBLESHOOTING #11 |
| localhost alive w/o dev server | A2 netstat→kill | TROUBLESHOOTING #12 |
| Short link unresolved | Retry once; check network | #1 |
| Scrape failed code 2 | Should be fixed — update repo | #9 |
| Reviews missing after scrape | Check `data\users\<id>\` exists | #13 |
| git shows data deletions | `git restore gbp-monitor/data/` | #14 |
| Run button says "Scrape already running…" | Correct v0.3.1 behavior — wait or explore dashboard; auto-rechecks every 5s | Fix C |

**Full catalog:** `TROUBLESHOOTING.md` (15 entries)

---

## v0.3.1 Verification Addendum (seam fixes)

After the Phase E walkthrough, confirm the four v0.3.1 behaviors:

### V1 — Competitors persist through skip-branches (Fix A)
During Step 3, add ≥1 competitor, click **Start Monitoring**, then:
```powershell
Invoke-RestMethod http://localhost:3000/api/business/branches
```
*Expected:* `branches[0].competitors` contains your competitor's id, even
though you skipped Step 2.

### V2 — Scraper targets YOUR competitors (Fix B)
Watch the spawned run's log (or `data/users/<id>/run.log`): only YOUR
competitor ids appear as `listing_start`. Root
`gbp-monitor/config/listings.json` must remain untouched. Also confirm:
```powershell
Test-Path gbp-monitor\data\users\<businessId>\effective_listings.json   # True
```

### V3 — Honest empty-config refusal (Fix B guard)
Temporarily remove all competitors via Tools › Configuration, then press Run:
*Expected:* "No competitors configured — add at least one competitor…"
(HTTP 422), no scrape spawns.

### V4 — Concurrent-run detection (Fix C)
While a live scrape is running, open a second browser tab to
`http://localhost:3000`, sign in, reach the Run gate:
*Expected:* Run button shows **"Scrape already running…"** disabled with
explanatory text; auto-re-enables within ~5s of run completion.
