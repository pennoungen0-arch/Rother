# Starting Rother on Linux

## Overview

This guide explains the **one-time setup** and **daily usage** for running Rother's web dashboard on Linux (Ubuntu/Debian, Fedora/RHEL, or other distributions). Rother is a zero-cost competitor review monitor for Google Business Profile reviews. It uses a live Python scraper (Playwright + Chromium) behind a Next.js dashboard.

**No terminal knowledge is required.** Everything is automated, but you will interact with a terminal window.

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| Linux distribution | Ubuntu 20.04+, Fedora 35+, or similar | Any modern distro works |
| Disk space | 500 MB + | For Python, Chromium, and npm packages |
| Internet | Yes | First-run downloads are ~200MB total |

**System Python** (3.8+) is *optional* — the launcher auto-downloads a portable Python if your system doesn't have one.

**Node.js** (18+) is **required** and must be installed by you. The launcher checks for it and opens nodejs.org if missing.

---

## One-Time Setup

### Step 1: Download or Copy Rother

Get Rother onto your Linux machine:

- **From ZIP/TAR**: Extract the archive. The extracted folder contains `Start Rother.sh`.
- **From USB**: Copy the entire Rother folder to your home directory (e.g., `/home/yourname/Rother`).
- **From Git clone**: `git clone <repo-url> Rother` then proceed.

> ⚠️ **Important**: Move the *entire folder* — don't drag individual files. All scripts, the `gbp-monitor/` subdirectory, and `package.json` must stay together.

### Step 2: Install Node.js (If Not Already Installed)

The launcher checks for Node.js automatically. If it's not found:

1. Visit [https://nodejs.org](https://nodejs.org).
2. Download and install Node.js (LTS version recommended, v18 or newer).
3. Or use your package manager:

**Ubuntu/Debian:**
```sh
sudo apt update
sudo apt install nodejs npm
```

**Fedora/RHEL:**
```sh
sudo dnf install nodejs npm
```

Verify installation: `node --version` should output `v18.x.x` or newer.

### Step 3: Make the Script Executable (One-Time)

Linux requires scripts to have the executable bit set. If you transferred the folder via USB or ZIP from another OS, this permission is lost.

Open a **Terminal** and run:

```sh
cd /path/to/Rother
chmod +x "Start Rother.sh"
```

### Step 4: Double-Click to Launch (Optional)

You can double-click `Start Rother.sh` in your file manager. If it complains about an "executable file" prompt:

1. Right-click `Start Rother.sh`.
2. Select **Properties** → **Permissions** tab.
3. Check **Allow executing file as program** (or set "Execute" permission).
4. Double-click again.

Alternatively, run it from the terminal (recommended for visibility):

```sh
cd /path/to/Rother
./Start Rother.sh
```

### Step 5: Watch the Startup Process

The Terminal will show the startup process:

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

If a browser doesn't open automatically, manually navigate to `http://localhost:3000`.

### Step 6: Complete First-Time Onboarding in the Browser

1. The browser opens `http://localhost:3000` automatically.
2. Complete the onboarding: paste your Google Maps link for your business.
3. Add competitors (or skip — you can add them later in the Config page).
4. Click **Start Monitoring**. Rother will scrape Google Maps reviews using Chromium.

---

## Daily Usage

| Action | How |
|--------|-----|
| Start Rother | Run `./Start Rother.sh` in Terminal, or double-click the file |
| Open Dashboard | Browser opens automatically at `http://localhost:3000` |
| Stop Rother | In the Terminal, press **Ctrl+C**, then close the Terminal tab |
| Re-run a scrape | Use the "Start Monitoring" or "Refresh" button in the dashboard UI |
| Find your data | Look in the Terminal output for the `ROTHER_DATA_DIR` path — it's typically at `/path/to/Rother/gbp-monitor/data/` |

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

## Troubleshooting (Linux)

### "Failed to download Python"

- Check your internet connection.
- The download URL is architecture-dependent. The script auto-detects using `uname -m`:
  - `x86_64`/`amd64`: `https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz`
  - `aarch64`/`arm64`: `https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-aarch64-unknown-linux-gnu-install_only_stripped.tar.gz`

### "Permission denied" when running the script

Run `chmod +x "Start Rother.sh"` again.

### Dashboard won't open

- Wait 1–2 minutes for the first build to complete.
- Or manually open `http://localhost:3000` in your browser.

### Chromium installation failed

Some Linux distros need extra system libraries for Chromium:

**Ubuntu/Debian:**
```sh
sudo apt install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 libxcb1 libxkbcommon0 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2
```

**Fedora:**
```sh
sudo dnf install -y nss nspr atk cups dbus-libXrandr libX11-X composite damage ext fixes xrandr gbm pango cairo alsa-lib
```

### Playwright requires additional system dependencies

Run: `python/bin/python3.11 -m playwright install-deps chromium`

---

## AI Agent Instructions

If assisting a Linux user:

1. **Verify the script exists** at `/path/to/Rother/Start Rother.sh`.
2. **Check executable bit**: Run `ls -la Start\ Rother.sh` — the output should start with `-rwxr-xr-x`. If not, run `chmod +x "Start Rother.sh"`.
3. **Check architecture**: Run `uname -m` to confirm `x86_64` or `aarch64`. The script should pick the right download URL.
4. **Check if `portable-python/` exists** — if so, Python was already downloaded.
5. **Check if `node_modules/` exists** — if so, npm packages were installed.
6. **Check if `.next/standalone/server.js` exists** — if so, the dashboard was built.
7. **Run the script directly**: `./Start Rother.sh` from Terminal for real-time output.

**Key directories to mention to users:**

- `portable-python/` — portable Python (created on first launch)
- `node_modules/` — npm packages (created on first launch)
- `.next/standalone/` — built dashboard server (created on first launch)
- `gbp-monitor/data/` — scraped reviews and snapshots (created on first scrape)