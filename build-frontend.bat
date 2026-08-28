@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Frontend Web Build
echo ======================================================================
echo.

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

if not exist "node_modules\" (
    echo [INFO] Installing npm dependencies...
    call npm install --no-audit --no-fund
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo [INFO] Compiling TypeScript and building Vite bundle into dist\...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Frontend build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] Frontend build completed successfully! Output in dist\
echo ======================================================================
pause
