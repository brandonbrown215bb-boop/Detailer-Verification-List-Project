@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Desktop Application Launcher
echo ======================================================================
echo.

REM 1. Locate and Check 64-bit .NET SDK
if defined ProgramW6432 (
    set "DOTNET_DIR=%ProgramW6432%\dotnet"
) else (
    set "DOTNET_DIR=%ProgramFiles%\dotnet"
)

if exist "!DOTNET_DIR!\dotnet.exe" (
    set "PATH=!DOTNET_DIR!;!PATH!"
    if not defined DOTNET_ROOT set "DOTNET_ROOT=!DOTNET_DIR!"
)

set "DOTNET_VER="
for /f "tokens=1" %%i in ('dotnet --version 2^>nul') do (
    if not defined DOTNET_VER set "DOTNET_VER=%%i"
)

if not defined DOTNET_VER (
    echo [ERROR] .NET SDK is not installed, not in PATH, or not functional.
    echo Please install the 64-bit .NET SDK [v8.0 or later]: https://dotnet.microsoft.com/download
    pause
    exit /b 1
)

REM 2. Ensure frontend assets are built for WebView2
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

REM 3. Launch AHU Verification Desktop Application
echo [INFO] Starting AHU Verification Desktop Application...
echo.
dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application exited with error code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
