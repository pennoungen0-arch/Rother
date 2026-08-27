# Rother — Production Setup Guide

**Last updated**: 2026-08-27
**Scope**: Deploying Rother with real-world credentials (not test services)

---

## 1. Notifications (Webhook + SMTP)

The notifier (`gbp-monitor/notifications/notifier.py`) is proven with test
services (webhook.site + Ethereal). To go to production:

### 1.1 Webhook (Slack / Discord / ntfy / generic)

```powershell
# 1. Copy the example config
cd gbp-monitor
Copy-Item config/notifications.example.json config/notifications.json

# 2. Edit config/notifications.json:
#    - Set "enabled": true
#    - For each webhook: set "enabled": true and paste your webhook URL
```

| Service | Webhook URL Source |
|---------|-------------------|
| **Slack** | Create an Incoming Webhook at `https://api.slack.com/mapps/A0F7XDUAZ-incoming-webhooks` → paste URL |
| **Discord** | Server Settings → Integrations → Webhooks → New Webhook → Copy URL |
| **ntfy** | Subscribe to a topic at `https://ntfy.sh` → use `https://ntfy.sh/your-topic` |
| **Mattermost** | Integrations → Incoming Webhooks → Add → Copy URL |
| **Generic** | Any endpoint that accepts JSON POST |

The payload is generic JSON:
```json
{
  "text": "Rother run live: 3 new reviews, 11 ok / 1 failed\n\n...",
  "subject": "Rother run live: 3 new reviews, 11 ok / 1 failed",
  "summary": { "...full run summary..." }
}
```

### 1.2 SMTP Email (Gmail example)

```powershell
# Edit config/notifications.json:
#    - Set "email.enabled": true
#    - Set "email.host": "smtp.gmail.com"
#    - Set "email.port": 587
#    - Set "email.starttls": true
#    - Set "email.username": "your-monitor@gmail.com"
#    - Set "email.password": "your-app-password"  (NOT your login password)
#    - Set "email.to": ["ops@example.com"]
```

**Gmail requires an App Password** (not your login password):
1. Enable 2-Step Verification on the Google account
2. Go to `https://myaccount.google.com/apppasswords`
3. Generate an app password for "Mail" on "Other (Custom name)"
4. Use the 16-character password in `notifications.json`

| Provider | Host | Port | Notes |
|----------|------|------|-------|
| Gmail | smtp.gmail.com | 587 | App Password required |
| Outlook | smtp.office365.com | 587 | App Password if 2FA enabled |
| Yahoo | smtp.mail.yahoo.com | 587 | App Password required |
| Custom | your-smtp-host | 587/465 | Check with provider |

### 1.3 Verify Production Delivery

```powershell
cd gbp-monitor
python -m orchestration.run_all --fixtures
```

Check:
- Webhook: your channel receives the message
- Email: recipient inbox receives the message
- Logs: `gbp-monitor/data/run.log` shows `notifications: webhook 'xxx' sent`

---

## 2. GitHub Actions (CI/CD)

**Status**: DEFERRED — no git remote configured.

The workflows are verified by construction (documented in `.github/workflows/`)
but cannot execute until a git remote is set. Until then, testing is manual:

```powershell
# Run locally before commit
npx tsc --noEmit
npx vitest run
npx eslint src
npm run build

# Python scraper
cd gbp-monitor
python -m tests.verify_baseline
python -m tests.verify_notifications
python -m tests.verify_variant_framework
```

When a remote is added, create `.github/workflows/dashboard.yml`:

```yaml
name: dashboard
on: [push, pull_request]
jobs:
  dashboard:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx vitest run
      - run: npx eslint src
      - run: npm run build
```

---

## 3. Known Limitations

### 3.1 hours_status Coverage

**Status**: Known limitation — not a bug.

The `hours_status` field (e.g. "Open now · Closes 11:00 PM") renders for only
~5/12 businesses in the certified competitor set. The selector
(`[jsaction*="pane.openhours.wfvdle24.dropdown"] .ZDu9vd`) depends on Google
rendering a specific dropdown element that is absent for some businesses.

**Canonical source**: The weekly `opening_hours` table (`table.eK4R0e`) renders
for 9/12 businesses and is the authoritative hours source. Use this field for
reliable hours data; treat `hours_status` as best-effort enrichment.

**Impact**: Dashboard shows hours data for ~75% of businesses via the weekly
table. The `hours_status` field is a convenience indicator when available.

---

## 4. Production Deployment Checklist

```powershell
# 1. Configure notifications
cd gbp-monitor
Copy-Item config/notifications.example.json config/notifications.json
# Edit notifications.json with real webhook/SMTP credentials

# 2. Verify tests pass (back up data first!)
Copy-Item data C:\Users\HP\AppData\Local\Temp\kilo\rother_data_backup -Recurse
python -m tests.verify_baseline
python -m tests.verify_notifications
python -m tests.verify_variant_framework

# 3. Run dashboard tests
cd ..
npx tsc --noEmit
npx vitest run
npx eslint src
npm run build

# 4. Verify live delivery
cd gbp-monitor
python -m orchestration.run_all --fixtures
# Confirm webhook channel + email inbox receive the notification

# 5. Restore production data
Remove-Item data -Recurse -Force
Copy-Item C:\Users\HP\AppData\Local\Temp\kilo\rother_data_backup data -Recurse
```

---

*End of guide.*
