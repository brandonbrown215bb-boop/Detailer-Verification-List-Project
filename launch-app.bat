@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Desktop Application Launcher
echo ======================================================================
echo.

:: 1. Check .NET SDK
where dotnet >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] .NET SDK is not installed or not in PATH.
    echo Please install the .NET 10 SDK: https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

:: 2. Ensure frontend assets are built for WebView2
if not exist "dist\index.html" (
    echo [INFO] Built web UI assets not found in dist\. Building frontend...
    where npm >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm is required to build frontend assets but was not found.
        pause
        exit /b 1
    )
    if not exist "node_modules\" (
        echo [INFO] Installing npm dependencies...
        call npm install --no-audit --no-fund
    )
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b %ERRORLEVEL%
    )
)

:: 3. Launch AHU Verification Desktop Application
echo [INFO] Starting AHU Verification Desktop Application...
echo.
dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application exited with error code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
