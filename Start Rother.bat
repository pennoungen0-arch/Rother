@echo off
setlocal EnableDelayedExpansion
REM ================================================================
REM Start Rother - one-click launcher for Windows
REM Double-click this file to start Rother's web dashboard.
REM No terminal knowledge required.
REM ================================================================

REM Use pushd to handle the script's own directory safely
REM This avoids storing paths with spaces/parentheses in variables
pushd "%~dp0" 2>nul
if errorlevel 1 (
    echo ERROR: Cannot open script directory.
    echo Try moving Rother to a path without special characters like parentheses.
    echo.
    pause
    exit /b 1
)

set "AUTO_INSTALL_PYTHON=0"
set "PYTHON_CMD="
set "PYTHON_DIR=portable-python"

echo ================================================
echo   Rother - Competitor Review Monitor
echo   Starting up...
echo ================================================
echo.

echo [1/5] Checking Node.js...
where node >nul 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo ERROR: Node.js is not installed.
    echo        Rother needs Node.js to run the dashboard.
    echo.
    echo Please download Node.js from:
    echo   https://nodejs.org
    echo.
    echo Press any key to open nodejs.org, then install Node.js and re-run this file...
    pause
    start "" "https://nodejs.org"
    popd
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>NUL') do set "NODE_VERSION=%%v"
echo   Found: !NODE_VERSION!

echo.
echo [2/5] Checking Python...

REM Check for portable Python first
if exist "!PYTHON_DIR!\python.exe" (
    set "PYTHON_CMD=!PYTHON_DIR!\python.exe"
    echo   Found: bundled portable Python in !PYTHON_DIR!
    for /f "tokens=*" %%v in ('"!PYTHON_CMD!" --version 2^>NUL') do set "PY_VERSION=%%v"
    echo   Version: !PY_VERSION!
    goto :python_done
)

REM Check for py launcher (Windows Python launcher)
py --version >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    set "PYTHON_CMD=py"
    for /f "tokens=*" %%v in ('py --version 2^>NUL') do set "PY_VERSION=%%v"
    echo   Found: !PY_VERSION!
    goto :python_done
)

REM Check for python command
python --version >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    set "PYTHON_CMD=python"
    for /f "tokens=*" %%v in ('python --version 2^>NUL') do set "PY_VERSION=%%v"
    echo   Found: !PY_VERSION!
    goto :python_done
)

REM Python not found - auto-download portable Python
echo   Python not found on system. Auto-downloading portable Python...
echo   - This is a one-time download of about 25MB
echo.

set "PYTHON_URL=https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16+20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz"
set "PYTHON_TAR=%TEMP%\python-standalone-win.tar.gz"
set "PYTHON_TMP=%TEMP%\python-standalone-win-extract"

REM Create directories
if not exist "!PYTHON_DIR!" mkdir "!PYTHON_DIR!"
if exist "!PYTHON_TMP!" rmdir /s /q "!PYTHON_TMP!"
mkdir "!PYTHON_TMP!"

echo   Downloading portable Python...
curl -L -o "!PYTHON_TAR!" "!PYTHON_URL!" 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo ERROR: Failed to download Python.
    echo        Manual install: Download Python from: https://python.org
    echo.
    echo Press any key to open python.org for manual installation...
    pause
    start "" "https://python.org"
    popd
    exit /b 1
)

echo   Extracting portable Python...
tar -xzf "!PYTHON_TAR!" -C "!PYTHON_TMP!" --strip-components=1 2>nul

if exist "!PYTHON_TMP!\python\python.exe" (
    copy /y "!PYTHON_TMP!\python\python.exe" "!PYTHON_DIR!\python.exe" >nul 2>nul
    copy /y "!PYTHON_TMP!\python\python3.dll" "!PYTHON_DIR!\" >nul 2>nul
    copy /y "!PYTHON_TMP!\python\python311.dll" "!PYTHON_DIR!\" >nul 2>nul
    xcopy /e /i /y "!PYTHON_TMP!\python\Lib" "!PYTHON_DIR!\Lib" >nul 2>nul
    if exist "!PYTHON_TMP!\python\Scripts" (
        xcopy /e /i /y "!PYTHON_TMP!\python\Scripts" "!PYTHON_DIR!\Scripts" >nul 2>nul
    )
    set "PYTHON_CMD=!PYTHON_DIR!\python.exe"
    set "AUTO_INSTALL_PYTHON=1"
    echo   Portable Python installed successfully!
) else (
    echo.
    echo ERROR: Could not find python.exe in the downloaded archive.
    echo.
    pause
    popd
    exit /b 1
)

:python_done

echo.
echo [3/5] Checking npm dependencies...
if not exist "node_modules" (
    echo   Installing npm packages - first-time setup, may take 1-2 min...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo ERROR: npm install failed. Check the error above.
        echo.
        echo Press any key to exit...
        pause
        popd
        exit /b 1
    )
) else (
    echo   Dependencies already installed.
)

echo.
echo [4/5] Checking Python dependencies...
pushd "gbp-monitor" 2>nul
if errorlevel 1 (
    echo ERROR: gbp-monitor directory not found!
    echo.
    pause
    popd
    popd
    exit /b 1
)

if !AUTO_INSTALL_PYTHON! EQU 1 (
    echo   Initializing pip for portable Python...
    "!PYTHON_CMD!" -m ensurepip --upgrade 2>nul
    "!PYTHON_CMD!" -m pip install --upgrade pip 2>nul
)

"!PYTHON_CMD!" -c "import playwright" 2>nul
if !ERRORLEVEL! NEQ 0 (
    echo   Installing Python packages - playwright, parsel, requests...
    "!PYTHON_CMD!" -m pip install -r requirements.txt
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo ERROR: pip install failed.
        echo.
        echo Press any key to exit...
        pause
        popd
        popd
        exit /b 1
    )
    echo   Installing Playwright browsers - Chromium download, about 150MB...
    "!PYTHON_CMD!" -m playwright install chromium
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo WARNING: Chromium installation failed. Scrapes will not work.
        echo           You can retry later via the Setup Wizard in Rother's Tools menu.
        echo.
    )
) else (
    echo   Python dependencies OK.
)

popd

if exist "!PYTHON_TAR!" del /q "!PYTHON_TAR!" >nul 2>nul
if exist "!PYTHON_TMP!" rmdir /s /q "!PYTHON_TMP!" >nul 2>nul

echo.
echo [5/5] Preparing dashboard build...
if exist ".next\standalone\server.js" (
    echo   Build already exists. Starting server...
) else (
    echo   Building Rother dashboard - first-time, about 1-2 min...
    call npm run build
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo ERROR: Build failed. Check the error above.
        echo.
        echo Press any key to exit...
        pause
        popd
        exit /b 1
    )
)

echo.
echo ================================================
echo   Rother is starting!
echo   Dashboard will open at: http://localhost:3000
echo.
echo   DO NOT close this window while using Rother.
echo   To stop Rother, close this window or press Ctrl+C.
echo ================================================
echo.

start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul 2>nul

if exist ".next\standalone\server.js" (
    node ".next\standalone\server.js"
    set /a EXIT_CODE=!ERRORLEVEL!
) else (
    echo ERROR: Standalone server.js not found. Build may have failed.
    echo.
    pause
    popd
    exit /b 1
)

if !EXIT_CODE! NEQ 0 (
    echo.
    echo ERROR: Server exited with code !EXIT_CODE!
    echo.
    echo Press any key to exit...
    pause
    popd
    exit /b !EXIT_CODE!
)

echo.
echo Rother has stopped.
echo Press any key to close this window...
pause
popd