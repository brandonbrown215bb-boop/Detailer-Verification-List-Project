@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Vite Development Server
echo ======================================================================
echo.

:: Check the pinned Node.js/npm prerequisites without installing them.
call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing locked NPM dependencies...
    call npm ci --no-audit --no-fund
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
