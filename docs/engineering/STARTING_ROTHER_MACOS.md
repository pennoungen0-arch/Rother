# Starting Rother on macOS

## Overview

This guide explains the **one-time setup** and **daily usage** for running Rother's web dashboard on macOS. Rother is a zero-cost competitor review monitor for Google Business Profile reviews. It uses a live Python scraper (Playwright + Chromium) behind a Next.js dashboard.

**No terminal knowledge is required.** Everything is automated.

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| macOS | 10.15 (Catalina) | Any modern macOS version works |
| Disk space | 500 MB + | For Python, Chromium, and npm packages |
| Internet | Yes | First-run downloads are ~200MB total |

**System Python** (3.8+) is *optional* — the launcher auto-downloads a portable Python if your Mac doesn't have one.

**Xcode Command Line Tools** are *optional* — the launcher tries to install them but will proceed if you skip.

---

## One-Time Setup

### Step 1: Download or Copy Rother

Get Rother onto your Mac:

- **From ZIP**: Extract the ZIP file. The extracted folder contains `Start Rother.command`.
- **From USB/Salesperson**: Copy the entire Rother folder to your desired location (e.g., `Applications` or your `Documents` folder).
- **From Git clone**: `git clone <repo-url> Rother` then proceed.

> ⚠️ **Important**: Move the *entire folder* — don't drag individual files. All scripts, the `gbp-monitor/` subdirectory, and `package.json` must stay together.

### Step 2: Make the Script Executable (One-Time)

macOS requires scripts to have the executable bit set. If you transferred the folder via USB or ZIP from a Windows PC, this permission can be lost.

Open **Terminal** (Finder → Applications → Utilities → Terminal) and run:

```sh
cd /path/to/Rother
chmod +x "Start Rother.command"
```

> If you cloned via Git or downloaded a `.tar.gz`, the permission is usually already set. You can skip this step, but running `chmod +x` again is harmless.

### Step 3: Double-Click to Launch

Double-click `Start Rother.command`. A Terminal window will open and show the startup process:

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

### Step 4: Grant Accessibility Permission (If Prompted)

macOS may display a dialog:

> **"Terminal"** wants to access files and folders — **OK** to allow so Rother can manage the scraper.

Click **OK**. If you accidentally deny, go to **System Settings → Privacy & Security → Files and Folders** and enable Terminal.

### Step 5: First Scrape (Optional)

After the dashboard opens:

1. The browser opens `http://localhost:3000` automatically.
2. Complete the onboarding: paste your Google Maps link for your business.
3. Add competitors (or skip — you can add them later in the Config page).
4. Click **Start Monitoring**. Rother will scrape Google Maps reviews using Chromium.

---

## Daily Usage

| Action | How |
|--------|-----|
| Start Rother | Double-click `Start Rother.command` |
| Open Dashboard | Browser opens automatically at `http://localhost:3000` |
| Stop Rother | In the Terminal window, press **Ctrl+C**, then close the Terminal tab |
| Re-run a scrape | Use the "Start Monitoring" or "Refresh" button in the dashboard UI |
| Find your data | Look in the Terminal output for the `ROTHER_DATA_DIR` path — it's typically under your user Library folder |

---

## What Happens During First Run

| Step | What It Does | Why |
|------|-------------|-----|
| Node.js check | Verifies Node.js is installed | Required to run the Next.js dashboard server |
| Python download | Downloads a self-contained Python 3.11.6 to `portable-python/` | No system Python required; portable copy keeps things isolated |
| pip install | Installs `playwright`, `parsel`, `requests` into the portable Python | Python dependencies for the scraper |
| Chromium install | Downloads headless Chromium browser | Playwright needs a real browser to scrape Google Maps |
| npm install | Installs all dashboard packages | React, Next.js, Tailwind CSS, etc. |
| npm run build | Builds the Next.js standalone server | Creates `.next/standalone/server.js` for production serving |

Subsequent launches skip steps 2–5 and start the server immediately.

---

## Troubleshooting (macOS)

### "Failed to download Python"

- Check your internet connection.
- The download URL is: `https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-x86_64-apple-darwin-install_only_stripped.tar.gz`
- If this link is broken (unlikely), manually install Python from [python.org](https://python.org).

### "Permission denied" when double-clicking

Run `chmod +x "Start Rother.command"` again in Terminal.

### Dashboard won't open in browser

- Wait 1–2 minutes for the first build to complete.
- Or manually open `http://localhost:3000` in your browser.

### Chromium installation failed

- Run manually: `python/bin/python3.11 -m playwright install chromium`
- Or check `https://playwright.dev` for system dependencies.

### "command not found" errors or unexpected script termination

The launcher script uses bash features. Ensure you're using **bash** (not zsh or sh):

- macOS ships with zsh as the default shell, but the `.command` script is explicitly bash.
- If you see `command not found` for basic commands like `echo` or `if`, the script may be running under a non-bash shell.
- Fix: Right-click the script → "Open With" → Terminal, or run `bash Start\ Rother.command` manually.

### Non-ASCII characters or garbled output

The launcher script is ASCII-only. If you see garbled characters:

- Ensure your Terminal is using **UTF-8** encoding: Terminal → Preferences → General → "Shell open behavior" → ensure "UTF-8" is selected.
- Or run the script from Terminal directly: `bash "Start Rother.command"`.

### Python version mismatch

- The portable Python is **3.11.6** (CPython from `python-build-standalone`).
- If your system Python is too old (< 3.8), the script auto-downloads the portable version.
- If you see `ModuleNotFoundError: No module named 'playwright'`, run: `"$PYTHON_CMD" -m pip install -r gbp-monitor/requirements.txt`.

---

## Known Issues & Solutions (macOS)

| Symptom | Cause | Solution |
|---------|-------|----------|
| Script closes immediately when double-clicking | Missing executable permission | Run `chmod +x "Start Rother.command"` then double-click again |
| `py: command not found` | Python not installed and download failed | Install Python from [python.org](https://python.org) or run the script again (network issue) |
| `node: command not found` | Node.js not installed | Download from [nodejs.org](https://nodejs.org), install, then re-run the launcher |
| Port 3000 already in use | Another process or previous Rother instance is running | Run `lsof -i :3000` and kill the process, or restart your Mac |
| Dashboard loads but shows "Cannot connect to scraper" | Python dependencies not installed | Re-run the launcher; it will install missing dependencies |
| Chromium not found | Playwright browsers not installed | Run `python/bin/python3.11 -m playwright install chromium` |
| `portable-python/` directory created but script still says "Python not found" | Extraction failed or wrong architecture | Delete `portable-python/` and re-run the launcher. Ensure you have the correct macOS version (Intel vs Apple Silicon) |
| Script says "Dependencies already installed" but Next.js fails to start | Stale `node_modules` or corrupted build | Run `rm -rf node_modules .next` then re-run the launcher |

---

## AI Agent Instructions

If assisting a macOS user:

1. **Verify the script exists** at `/path/to/Rother/Start Rother.command`.
2. **Check executable bit**: Run `ls -la Start\ Rother.command` — the output should start with `-rwxr-xr-x`. If not, run `chmod +x "Start Rother.command"`.
3. **Check if `portable-python/` exists** — if so, Python was already downloaded.
4. **Check if `node_modules/` exists** — if so, npm packages were installed.
5. **Check if `.next/standalone/server.js` exists** — if so, the dashboard was built.
6. **Run the script in verbose mode**: `./Start Rother.command` from Terminal to see real-time output — the script uses `set +e` so it continues past errors and shows helpful messages instead of crashing.
7. **If the script closes immediately**, check that:
   - The file has execute permissions (`chmod +x`)
   - The file uses LF line endings (not CRLF) — run `file Start\ Rother.command`
   - The file is ASCII-only (no em-dashes or non-UTF-8 characters)
8. **Path with spaces/parentheses**: The script handles spaces and special characters in the path to the Rother folder. No special action needed.
9. **If portable Python download fails**: Verify the URL is reachable: `curl -I https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-x86_64-apple-darwin-install_only_stripped.tar.gz`

**Key directories to mention to users:**

- `portable-python/` — portable Python (created on first launch)
- `node_modules/` — npm packages (created on first launch)
- `.next/standalone/` — built dashboard server (created on first launch)
- `gbp-monitor/data/` — scraped reviews and snapshots (created on first scrape)
