# Deploying Rother — Zero-Command Options

## Overview

This guide covers three deployment options — from easiest to most involved. The client can access Rother at a simple URL with no project folder, no downloads, and no terminal commands required.

---

## Option 1: Fly.io (Recommended — No Commands for Client)

### What the client sees:
- A URL like `https://rother.fly.dev`
- Login to the dashboard (if auth is configured)
- Full Rother dashboard + scraper functionality

### What you do (one-time setup):
1. **Sign up** for [Fly.io](https://fly.io) (free tier available)
2. **Install flyctl** (one command installation):
   - macOS: `brew install superfly/tap/flyctl`
   - Windows: `iwr https://fly.io/install.ps1 -useb | iex`
   - Linux: `curl -L https://fly.io/install.sh | sh`
3. **Deploy** (one command):
   ```sh
   flyctl launch
   ```
   Accept all defaults — this creates the app and deploys it automatically.
4. **Share the URL** with the client — they just bookmark `https://rother.fly.dev`

### Costs:
| Resource | Free Tier | Paid (if needed) |
|----------|-----------|------------------|
| Compute | 3 VMs (256MB RAM each) | $5/month per additional VM |
| Storage | 1GB persistent volume | $0.50/GB/month |
| Bandwidth | 160GB/month | $0.10/GB beyond |

### Notes:
- Free tier includes a 256MB VM — may need 512MB for Playwright Chromium
- The Docker image is ~2GB (includes Next.js + Python + Chromium)
- Data persists in Fly.io volumes automatically

---

## Option 2: Docker Compose (Local — One Command at Startup)

### What the client sees:
- Dashboard at `http://localhost:3000` on their machine
- No project folder needed — just a single `docker-compose up` command

### What you do (one-time):
1. **Install Docker Desktop** for the client (free for individuals)
2. **Create a folder** with only:
   - `Dockerfile`
   - `docker-compose.yml`
   - (The project source is excluded in the Docker build context)
3. **Client runs**: `docker compose up -d`
4. Opens `http://localhost:3000`

### Size:
- Docker image: ~2GB (built once, cached locally)
- Project folder: ~50MB (just Dockerfile + docker-compose.yml)

---

## Option 3: Static Dashboard Only (Simplest)

### What the client sees:
- A static website with review data
- No live scraping (data updated via CI or manual upload)

### What you do:
1. Run the scraper locally (or in Docker)
2. Export snapshots to JSON
3. Host `docs/static/` as a GitHub Page / Netlify site

### Limitations:
- No live scraping
- Dashboard reads from pre-exported JSON files
- Data refresh requires re-exporting

---

## Comparison

| Option | Client Experience | Setup Effort | Monthly Cost | Data Freshness |
|--------|-------------------|--------------|--------------|----------------|
| Fly.io | Visit URL | Low (one deploy) | $0-5 | Real-time |
| Docker Compose | One command | Medium | $0 | Real-time |
| Static Site | Visit URL | Medium | $0 | Manual |
| Current Launcher | 8GB folder + double-click | High | $0 | Real-time |

---

## Recommendation

Use **Fly.io** (Option 1):
- Client gets a URL — no downloads, no commands
- You control the setup (one-time `flyctl deploy`)
- Free tier likely sufficient for a single business
- Data persists in the cloud
- Automatic HTTPS

For production with notifications/webhooks, increase to 512MB VM ($5/month).

## What the Client Needs to Know

**Fly.io (best):**
> "Just open https://rother.fly.dev in your browser. That's it. Bookmark it."

**Docker Compose:**
> "Install Docker Desktop, then double-click the 'Run Rother' shortcut. The dashboard opens automatically."

**Static site:**
> "Visit https://rother-review-monitor.netlify.app. Data updates daily."

---

## GMB Everywhere Reference

GMB Everywhere provides:
1. **Browser extension** — popup panel for quick access (works on macOS/Linux/Windows as long as Chrome/Firefox supports extensions)
2. **Website** — hosted on their domain for detailed documentation + signup
3. The extension communicates with Google Maps directly in the browser; the website provides account management

For Rother, the "website" approach (Fly.io or similar) provides similar convenience — a single URL the client can bookmark without managing any local files or commands.