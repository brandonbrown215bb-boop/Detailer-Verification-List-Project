@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Vite Development Server
echo ======================================================================
echo.

:: Check Node.js and npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo Please install Node.js (v18+) to run the Vite dev server.
    pause
    exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing NPM dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo [INFO] Starting Vite development server...
echo.
echo  Available Endpoints:
echo    - Detailing Verification UI: http://localhost:5173/
echo    - Rule & Logic Editor Studio: http://localhost:5173/rule-editor.html
echo.
echo Press Ctrl+C in this window to stop the server.
echo ======================================================================
echo.

call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Vite dev server exited with error code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
