#!/bin/bash
# Start Rother — one-click launcher for Linux
# Double-click this file (or run `./Start\ Rother.sh` from terminal)
# to start Rother's web dashboard.
# No terminal knowledge required.

cd "$(dirname "$0")" || exit 1

echo "================================================"
echo "  Rother — Competitor Review Monitor"
echo "  Starting up..."
echo "================================================"
echo

# --- 1. Check for Node.js ---
echo "[1/5] Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo
    echo "ERROR: Node.js is not installed."
    echo "       Rother needs Node.js to run the dashboard."
    echo
    echo "Please install Node.js from:"
    echo "  https://nodejs.org"
    echo
    echo "Or on Ubuntu/Debian:"
    echo "  sudo apt install nodejs npm"
    echo
    echo "Install it, then double-click this file again."
    echo
    read -p "Press Enter to open nodejs.org..."
    xdg-open "https://nodejs.org" 2>/dev/null || true
    exit 1
fi
NODE_VERSION=$(node --version)
echo "  Found: $NODE_VERSION"

# --- 2. Check for Python ---
echo
echo "[2/5] Checking Python..."
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo
    echo "ERROR: Python is not installed."
    echo "       Rother needs Python 3.11+ to run the review scraper."
    echo
    echo "Please install Python from:"
    echo "  https://python.org"
    echo
    echo "Or on Ubuntu/Debian:"
    echo "  sudo apt install python3 python3-pip"
    echo
    echo "Install it, then double-click this file again."
    echo
    read -p "Press Enter to open python.org..."
    xdg-open "https://python.org" 2>/dev/null || true
    exit 1
fi
PYTHON_CMD="python3"
if ! command -v python3 &>/dev/null; then
    PYTHON_CMD="python"
fi
PY_VERSION=$($PYTHON_CMD --version 2>&1)
echo "  Found: $PY_VERSION"

# --- 3. Install npm dependencies (if needed) ---
echo
echo "[3/5] Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  Installing npm packages (first-time setup, may take 1-2 min)..."
    npm install
else
    echo "  Dependencies already installed."
fi

# --- 4. Install Python dependencies + Chromium (if needed) ---
echo
echo "[4/5] Checking Python dependencies..."
cd "$(dirname "$0")/gbp-monitor" || exit 1
if ! $PYTHON_CMD -c "import playwright" 2>/dev/null; then
    echo "  Installing Python packages..."
    $PYTHON_CMD -m pip install -r requirements.txt
fi
if ! $PYTHON_CMD -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    echo "  Installing Playwright browsers (Chromium download, ~150MB)..."
    $PYTHON_CMD -m playwright install chromium
else
    echo "  Python dependencies OK."
fi
cd "$(dirname "$0")"

# --- 5. Build dashboard (if needed) ---
echo
echo "[5/5] Preparing dashboard build..."
if [ -f ".next/standalone/server.js" ] && [ -f ".tauri-cache/standalone-server/server.js" ]; then
    echo "  Build already exists. Starting server..."
else
    echo "  Building Rother dashboard (first-time, ~1-2 min)..."
    npm run build
fi

# --- Start the server ---
echo
echo "================================================"
echo "  Rother is starting!"
echo "  Dashboard will open at: http://localhost:3000"
echo
echo "  DO NOT close this window while using Rother."
echo "  To stop Rother, press Ctrl+C, then close this window."
echo "================================================"
echo

# Open browser in background
xdg-open "http://localhost:3000" 2>/dev/null &
sleep 2

# Start server (this blocks until stopped)
node .next/standalone/server.js

echo
echo "================================================"
echo "  Rother has stopped."
echo "================================================"
