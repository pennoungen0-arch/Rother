# Starting Rother on Windows

## Overview

This guide explains the **one-time setup** and **daily usage** for running Rother's web dashboard on Windows 10 or Windows 11. Rother is a zero-cost competitor review monitor for Google Business Profile reviews. It uses a live Python scraper (Playwright + Chromium) behind a Next.js dashboard.

**No terminal knowledge is required.** Everything is automated.

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Windows | 10 or 11 | Any modern Windows build works |
| Disk space | 500 MB + | For Python, Chromium, and npm packages |
| Internet | Yes | First-run downloads are ~200MB total |

**System Python** is *optional* — the launcher auto-downloads a portable Python if your Windows doesn't have one (the `py` launcher or `python` command).

**Node.js** (18+) is **required** and must be installed by you. The launcher checks for it and opens nodejs.org if missing.

---

## One-Time Setup

### Step 1: Download or Copy Rother

Get Rother onto your Windows machine:

- **From ZIP**: Extract the ZIP file using Windows Explorer (right-click → "Extract All..."). The extracted folder contains `Start Rother.bat`.
- **From USB**: Copy the entire Rother folder to your desired location (e.g., `C:\Rother` or your `Documents` folder).
- **From Git clone**: `git clone <repo-url> Rother` then proceed.

> ⚠️ **Important**: Move the *entire folder* — don't drag individual files. All scripts, the `gbp-monitor/` subdirectory, and `package.json` must stay together.

### Step 2: Install Node.js (If Not Already Installed)

The launcher checks for Node.js automatically. If it's not found:

1. Visit [https://nodejs.org](https://nodejs.org).
2. Download and install Node.js (LTS version recommended, v18 or newer).
3. Run the installer and follow the setup wizard.
4. **Restart** your computer if the installer suggests it (required for PATH updates).
5. Verify installation: Open a new Command Prompt (`cmd`) and run `node --version` — it should output `v18.x.x` or newer.

### Step 3: Double-Click to Launch

Double-click `Start Rother.bat`. A Command Prompt window will open and show the startup process:

```
================================================
  Rother — Competitor Review Monitor
  Starting up...
================================================

[1/5] Checking Node.js...
  Found: v20.x.x

[2/5] Checking Python...
  Python not found on system. Auto-downloading portable Python...
  Downloading portable Python...
  Extracting portable Python...
  Portable Python installed successfully!
  ...

[3/5] Checking npm dependencies...
  Installing npm packages (first-time setup, may take 1-2 min)...
  ...

[4/5] Checking Python dependencies...
  Initializing pip for portable Python...
  Installing Python packages (playwright, parsel, requests)...
  Installing Playwright browsers (Chromium download, ~150MB)...
  ...

[5/5] Preparing dashboard build...
  Building Rother dashboard (first-time, ~1-2 min)...
  ...

================================================
  Rother is starting!
  Dashboard will open at: http://localhost:3000
================================================
```

### Step 4: Complete First-Time Onboarding in the Browser

1. The browser opens `http://localhost:3000` automatically (a new tab in your default browser).
2. Complete the onboarding: paste your Google Maps link for your business.
3. Add competitors (or skip — you can add them later in the Config page).
4. Click **Start Monitoring**. Rother will scrape Google Maps reviews using Chromium.

---

## Daily Usage

| Action | How |
|--------|-----|
| Start Rother | Double-click `Start Rother.bat` |
| Open Dashboard | Browser opens automatically at `http://localhost:3000` |
| Stop Rother | Close the Command Prompt window, or press **Ctrl+C** and type `Y` to confirm termination |
| Re-run a scrape | Use the "Start Monitoring" or "Refresh" button in the dashboard UI |
| Find your data | Look in the Command Prompt output for the `GBP_ROOT` path — it's typically under `AppData\Roaming\com.rother.desktop\` for desktop builds, or `D:\...\Rother\gbp-monitor\` for the web version |

---

## What Happens During First Run

| Step | What It Does | Why |
|------|-------------|-----|
| Node.js check | Verifies Node.js is installed | Required to run the Next.js dashboard server |
| Python download | Downloads a self-contained Python 3.11.6 to `portable-python\` | No system Python required; portable copy keeps things isolated |
| pip install | Installs `playwright`, `parsel`, `requests` into the portable Python | Python dependencies for the scraper |
| Chromium install | Downloads headless Chromium browser | Playwright needs a real browser to scrape Google Maps |
| npm install | Installs all dashboard packages | React, Next.js, Tailwind CSS, etc. |
| npm run build | Builds the Next.js standalone server | Creates `.next\standalone\server.js` for production serving |

Subsequent launches skip steps 2–5 and start the server immediately.

---

## Troubleshooting (Windows)

### "ERROR: Node.js is not installed"

1. Download Node.js from [https://nodejs.org](https://nodejs.org).
2. Run the installer (LTS version).
3. **Restart your computer** (Windows needs a reboot to update PATH).
4. Run `Start Rother.bat` again.

### "ERROR: Failed to download Python"

- Check your internet connection.
- The download URL is: `https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`
- If this link is broken (unlikely), manually install Python from [python.org](https://python.org).

### "ERROR: pip install failed"

- The portable Python may not have `pip` initialized. The script runs `python -m ensurepip` automatically, but if it fails:
  1. Open `portable-python\python.exe` manually.
  2. Run: `python -m ensurepip --upgrade && python -m pip install --upgrade pip`
  3. Re-run `Start Rother.bat`.

### Dashboard won't open

- Wait 1–2 minutes for the first build to complete (the Command Prompt window stays open).
- Or manually open `http://localhost:3000` in your browser.

### Chromium installation failed

- Re-run manually: `portable-python\python.exe -m playwright install chromium`
- Or check `https://playwright.dev` for Windows prerequisites.
- Some corporate firewalls/proxy servers block the Chromium download — try from a different network.

### "Server exited with code 1" or port 3000 already in use

A previous instance may still be running:

1. Press **Ctrl+Shift+Esc** to open Task Manager.
2. Find `node.exe` in the Processes tab.
3. Right-click and select **End task**.
4. Re-run `Start Rother.bat`.

### Script closes immediately on double-click (before showing any output)

This was a known issue in earlier versions caused by **non-ASCII characters** (em-dashes `—`) in the batch file. The fix is included in v0.4.3+. If you're still experiencing this:

- **Run from Command Prompt** instead: Open `cmd`, navigate to the Rother folder, and run `Start Rother.bat` directly. This keeps the window open.
- **Use `cmd /k`**: Run `cmd /k "Start Rother.bat"` to prevent the window from closing.
- **Check file encoding**: Open the batch file in Notepad++ — it should be UTF-8-BOM or ASCII. If it shows "UCS-2 LE" or corrupted characters, the file was likely corrupted during download.

### "ERROR: Node.js is not installed" after installing Node.js

- You must **restart your computer** after installing Node.js — Windows needs a reboot to update the system PATH.
- After restarting, verify: Open a new Command Prompt and run `node --version`. You should see something like `v20.x.x`.

---

## Known Issues & Solutions (Windows)

| Symptom | Cause | Solution |
|---------|-------|----------|
| Script closes immediately on double-click | Corrupted batch file (non-ASCII chars) or path issues | Run from `cmd` instead: `cd "C:\path\to\Rother" && Start Rother.bat` |
| `Documents (D)` in path causes "unexpected at this time" | Parentheses in Windows paths break batch `if`/`set` commands | v0.4.3+ uses `pushd` + relative paths to avoid this |
| `ERROR: Failed to download Python` | Network/firewall blocking GitHub | Check connectivity or install Python manually from [python.org](https://python.org) |
| `ERROR: pip install failed` | Portable Python missing pip | Re-run the launcher — it auto-initializes pip with `python -m ensurepip` |
| `WARNING: Chromium installation failed` | Corporate firewall or missing DLLs | Run `portable-python\python.exe -m playwright install chromium` manually |
| Port 3000 in use | Previous instance still running | Kill `node.exe` in Task Manager, then re-run |
| `npm run build` takes too long | First-time build downloads all dependencies | This is expected — leave the window open until it completes |
| `node` works in CMD but not in the launcher | PATH not refreshed | Restart Windows to apply PATH changes |

---

## AI Agent Instructions

If assisting a Windows user:

1. **Verify the file exists** at `C:\path\to\Rother\Start Rother.bat`.
2. **Check Node.js**: Ask the user to open `cmd` and run `node --version`. If it says "'node' is not recognized", they need to install Node.js from nodejs.org and **restart**.
3. **Check if `portable-python\python.exe` exists** — if so, Python was already downloaded.
4. **Check if `node_modules` folder exists** — if so, npm packages were installed.
5. **Check if `.next\standalone\server.js` exists** — if so, the dashboard was built.
6. **Run the script in foreground**: Right-click `Start Rother.bat` → "Edit" to inspect, then run `cmd /k Start Rother.bat` from the Rother directory to keep the window open and see errors.

> 💡 **Tip**: Use `cmd /k` instead of double-clicking to prevent the window from closing immediately on error (the `/k` flag keeps it open).

**Key directories to mention to users:**

- `portable-python\` — portable Python (created on first launch)
- `node_modules\` — npm packages (created on first launch)
- `.next\standalone\` — built dashboard server (created on first launch)
- `gbp-monitor\data\` — scraped reviews and snapshots (created on first scrape)
- `C:\Users\<username>\AppData\Roaming\com.rother.desktop\` — desktop app data (if using Tauri desktop build instead of web version)