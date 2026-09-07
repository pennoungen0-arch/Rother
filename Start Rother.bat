@echo off
setlocal EnableDelayedExpansion

:: ================================================================
:: Start Rother — one-click launcher for Windows
:: Double-click this file to start Rother's web dashboard.
:: No terminal knowledge required.
::
:: If the window closes too fast to read, open a Command Prompt
:: and run this file manually instead:
::   cmd /k "Start Rother.bat"
:: ================================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo ================================================
echo   Rother — Competitor Review Monitor
echo   Starting up...
echo ================================================
echo.

:: --- 1. Check for Node.js ---
echo [1/5] Checking Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Node.js is not installed.
    echo        Rother needs Node.js to run the dashboard.
    echo.
    echo Please download Node.js from:
    echo   https://nodejs.org
    echo.
    echo Install it (use default settings), then double-click this file again.
    echo.
    echo Press any key to open nodejs.org...
    pause >nul
    start "" "https://nodejs.org"
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
echo   Found: !NODE_VERSION!

:: --- 2. Check for Python ---
echo.
echo [2/5] Checking Python...
set "PYTHON_CMD="
py --version >nul 2>nul
if !ERRORLEVEL! equ 0 (
    set "PYTHON_CMD=py"
) else (
    python --version >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_CMD=python"
    )
)
if "!PYTHON_CMD!"=="" (
    echo.
    echo ERROR: Python is not installed.
    echo        Rother needs Python 3.11+ to run the review scraper.
    echo.
    echo Please download Python from:
    echo   https://python.org
    echo.
    echo Install it (check "Add to PATH" during install), then double-click again.
    echo.
    echo Press any key to open python.org...
    pause >nul
    start "" "https://python.org"
    exit /b 1
)
for /f "tokens=*" %%v in ('!PYTHON_CMD! --version') do set PY_VERSION=%%v
echo   Found: !PY_VERSION!

:: --- 3. Install npm dependencies (if needed) ---
echo.
echo [3/5] Checking npm dependencies...
if not exist "node_modules" (
    echo   Installing npm packages (first-time setup, may take 1-2 min)...
    call npm install 2>&1
    if !ERRORLEVEL! neq 0 (
        echo.
        echo ERROR: npm install failed. Check the error above.
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
) else (
    echo   Dependencies already installed.
)

:: --- 4. Install Python dependencies + Chromium (if needed) ---
echo.
echo [4/5] Checking Python dependencies...
cd /d "%SCRIPT_DIR%gbp-monitor"
!PYTHON_CMD! -c "import playwright" 2>nul
if !ERRORLEVEL! neq 0 (
    echo   Installing Python packages...
    !PYTHON_CMD! -m pip install -r requirements.txt 2>&1
    if !ERRORLEVEL! neq 0 (
        echo.
        echo ERROR: pip install failed.
        echo.
        echo Press any key to exit...
        pause >nul
        cd /d "%SCRIPT_DIR%"
        exit /b 1
    )
)
!PYTHON_CMD! -c "from playwright.sync_api import sync_playwright" 2>nul
if !ERRORLEVEL! neq 0 (
    echo   Installing Playwright browsers (Chromium download, ~150MB)...
    !PYTHON_CMD! -m playwright install chromium 2>&1
    if !ERRORLEVEL! neq 0 (
        echo.
        echo WARNING: Chromium installation failed. Scrapes will not work.
        echo           You can retry later via: python -m pip install playwright ^& python -m playwright install chromium
        echo.
    )
) else (
    echo   Python dependencies OK.
)
cd /d "%SCRIPT_DIR%"

:: --- 5. Build dashboard (if needed) ---
echo.
echo [5/5] Preparing dashboard build...
if exist ".next\standalone\server.js" if exist ".tauri-cache\standalone-server\server.js" (
    echo   Build already exists. Starting server...
) else (
    echo   Building Rother dashboard (first-time, ~1-2 min)...
    call npm run build 2>&1
    if !ERRORLEVEL! neq 0 (
        echo.
        echo ERROR: Build failed. Check the error above.
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
)

:: --- Start the server ---
echo.
echo ================================================
echo   Rother is starting!
echo   Dashboard will open at: http://localhost:3000
echo.
echo   DO NOT close this window while using Rother.
echo   To stop Rother, simply close this window.
echo ================================================
echo.

:: Open browser to the dashboard
start "" "http://localhost:3000"

:: Start the server (this blocks until the server exits)
node ".next\standalone\server.js"
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Server exited with code !ERRORLEVEL!
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

:: If the server exits normally
echo.
echo Rother has stopped.
echo Press any key to close this window...
pause >nul
