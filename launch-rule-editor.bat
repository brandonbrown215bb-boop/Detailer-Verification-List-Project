@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Verification - Rule ^& Logic Editor Studio Launcher
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
if not exist "dist\rule-editor.html" (
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

:: 3. Launch Rule Editor Desktop Studio
echo [INFO] Starting Rule ^& Logic Editor Studio...
echo.
dotnet run --project src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Rule Editor exited with error code %ERRORLEVEL%.
    pause
    exit /b %ERRORLEVEL%
)
