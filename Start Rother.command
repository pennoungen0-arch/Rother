#!/bin/bash
# Start Rother - one-click launcher for macOS
# Double-click this file (or run `open "Start Rother.command"` from Terminal)
# to start Rother's web dashboard.
# No terminal knowledge required.
#
# If the window closes too fast to read:
#   cd /path/to/rother
#   ./Start\ Rother.command

# Don't use `set -e` - we want to handle errors ourselves and show messages
# Don't use `set -u` either - we need to handle unset vars gracefully
set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || {
    echo "ERROR: Cannot change to script directory."
    read -p "Press Enter to exit..."
    exit 1
}

# Track whether we need to auto-install Python
AUTO_INSTALL_PYTHON=0

echo "================================================"
echo "  Rother - Competitor Review Monitor"
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
    echo "Please download Node.js from:"
    echo "  https://nodejs.org"
    echo
    echo "Press Enter to open nodejs.org..."
    read -p ""
    open "https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node --version 2>&1)
echo "  Found: $NODE_VERSION"

# --- 2. Check for Python (auto-download if missing) ---
echo
echo "[2/5] Checking Python..."
PYTHON_CMD=""
PYTHON_DIR="$SCRIPT_DIR/portable-python"

# First check: is there a portable Python in our directory?
if [ -f "$PYTHON_DIR/bin/python3.11" ] || [ -f "$PYTHON_DIR/python" ]; then
    if [ -f "$PYTHON_DIR/bin/python3.11" ]; then
        PYTHON_CMD="$PYTHON_DIR/bin/python3.11"
    else
        PYTHON_CMD="$PYTHON_DIR/python"
    fi
    echo "  Found: bundled portable Python at $PYTHON_DIR"
    PY_VERSION=$("$PYTHON_CMD" --version 2>&1)
    echo "  Version: $PY_VERSION"
else
    # Check system Python
    if command -v python3 &>/dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &>/dev/null; then
        PYTHON_CMD="python"
    fi

    if [ -z "$PYTHON_CMD" ]; then
        echo
        echo "  Python not found on system. Auto-downloading portable Python..."
        echo "  (This is a one-time download of ~25MB)"
        echo

        # Download portable Python for macOS
        PYTHON_URL="https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-x86_64-apple-darwin-install_only_stripped.tar.gz"
        PYTHON_TAR="$TMPDIR/python-standalone-mac.tar.gz"
        PYTHON_TMP="$TMPDIR/python-standalone-mac-extract"

        mkdir -p "$PYTHON_DIR"
        rm -rf "$PYTHON_TMP"
        mkdir -p "$PYTHON_TMP"

        echo "  Downloading portable Python..."
        if curl -L -o "$PYTHON_TAR" "$PYTHON_URL" 2>/dev/null; then
            echo "  Extracting portable Python..."
            tar -xzf "$PYTHON_TAR" -C "$PYTHON_TMP" --strip-components=1 2>/dev/null
            if [ -f "$PYTHON_TMP/bin/python3.11" ]; then
                cp -R "$PYTHON_TMP/bin" "$PYTHON_DIR/bin"
                cp -R "$PYTHON_TMP/lib" "$PYTHON_DIR/lib"
                if [ -d "$PYTHON_TMP/include" ]; then cp -R "$PYTHON_TMP/include" "$PYTHON_DIR/include"; fi
                # Create a symlink for convenience
                ln -sf "$PYTHON_DIR/bin/python3.11" "$PYTHON_DIR/python"
                PYTHON_CMD="$PYTHON_DIR/bin/python3.11"
                AUTOINSTALL_PYTHON=1
                echo "  Portable Python installed successfully!"
            else
                echo
                echo "ERROR: Could not find python3.11 in the downloaded archive."
                echo
                echo "Press Enter to open python.org for manual installation..."
                read -p ""
                open "https://python.org"
                exit 1
            fi
        else
            echo
            echo "ERROR: Failed to download Python."
            echo "       Download Node.js from: https://nodejs.org"
            echo "       Manual install: Download Python from: https://python.org"
            echo
            echo "Press Enter to open python.org for manual installation..."
            read -p ""
            open "https://python.org"
            exit 1
        fi
    else
        PY_VERSION=$("$PYTHON_CMD" --version 2>&1)
        echo "  Found: $PY_VERSION"
    fi
fi

# --- 3. Install npm dependencies (if needed) ---
echo
echo "[3/5] Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  Installing npm packages (first-time setup, may take 1-2 min)..."
    npm install 2>&1
    if [ $? -ne 0 ]; then
        echo
        echo "ERROR: npm install failed. Check the error above."
        echo
        read -p "Press Enter to exit..."
        exit 1
    fi
else
    echo "  Dependencies already installed."
fi

# --- 4. Install Python dependencies + Chromium (if needed) ---
echo
echo "[4/5] Checking Python dependencies..."
cd "$SCRIPT_DIR/gbp-monitor" || {
    echo "ERROR: gbp-monitor directory not found!"
    read -p "Press Enter to exit..."
    cd "$SCRIPT_DIR"
    exit 1
}

# If we auto-installed Python, also initialize pip
if [ "$AUTOINSTALL_PYTHON" = "1" ]; then
    echo "  Initializing pip for portable Python..."
    "$PYTHON_CMD" -m ensurepip --upgrade 2>/dev/null
    "$PYTHON_CMD" -m pip install --upgrade pip 2>/dev/null
fi

if ! "$PYTHON_CMD" -c "import playwright" 2>/dev/null; then
    echo "  Installing Python packages (playwright, parsel, requests)..."
    "$PYTHON_CMD" -m pip install -r requirements.txt 2>&1
    if [ $? -ne 0 ]; then
        echo
        echo "ERROR: pip install failed."
        echo
        read -p "Press Enter to exit..."
        cd "$SCRIPT_DIR"
        exit 1
    fi
fi

if ! "$PYTHON_CMD" -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    echo "  Installing Playwright browsers (Chromium download, ~150MB)..."
    "$PYTHON_CMD" -m playwright install chromium 2>&1
    if [ $? -ne 0 ]; then
        echo
        echo "WARNING: Chromium installation failed. Scrapes will not work."
        echo "         You can retry later via the Setup Wizard in Rother's Tools menu."
        echo
    fi
else
    echo "  Python dependencies OK."
fi

cd "$SCRIPT_DIR"

# --- 5. Build dashboard (if needed) ---
echo
echo "[5/5] Preparing dashboard build..."
if [ -f ".next/standalone/server.js" ] && [ -f ".tauri-cache/standalone-server/server.js" ]; then
    echo "  Build already exists. Starting server..."
else
    echo "  Building Rother dashboard (first-time, ~1-2 min)..."
    npm run build 2>&1
    if [ $? -ne 0 ]; then
        echo
        echo "ERROR: Build failed. Check the error above."
        echo
        read -p "Press Enter to exit..."
        exit 1
    fi
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

# Open browser to the dashboard
open "http://localhost:3000" 2>/dev/null || true
sleep 3

# Start the server (this blocks until the server exits or Ctrl+C is pressed)
if [ -f ".next/standalone/server.js" ]; then
    node .next/standalone/server.js
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -ne 0 ]; then
        echo
        echo "ERROR: Server exited with code $EXIT_CODE"
        echo
        read -p "Press Enter to exit..."
        exit "$EXIT_CODE"
    fi
else
    echo "ERROR: Standalone server.js not found. Build may have failed."
    echo
    read -p "Press Enter to exit..."
    exit 1
fi

echo
echo "================================================"
echo "  Rother has stopped."
echo "================================================"
read -p "Press Enter to close this window..."
