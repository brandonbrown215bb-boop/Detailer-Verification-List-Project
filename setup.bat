@echo off
setlocal enabledelayedexpansion

echo ======================================================================
echo  AHU Detailing Verification System - Full Architecture Setup & Test
echo ======================================================================

:: 1. Check .NET SDK
where dotnet >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] .NET SDK is not installed or not in PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('dotnet --version') do set DOTNET_VER=%%i
echo [OK] .NET SDK Found: %DOTNET_VER%

:: 2. Check Node.js and npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
echo [OK] Node.js %NODE_VER% and npm %NPM_VER% Found.

:: 3. Install NPM Dependencies & Build Frontend
echo.
echo [1/4] Installing NPM dependencies and building Vite frontend...
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b %ERRORLEVEL%
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Vite production build failed.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Frontend build complete.

:: 4. Build Rule Pack Manifest
echo.
echo [2/4] Verifying and hashing Rule Pack Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

:: 5. Build C# .NET Backend and App
echo.
echo [3/4] Building C# .NET Backend and WebView2 Host...
dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.Core build failed.
    pause
    exit /b %ERRORLEVEL%
)

dotnet build src/backend/AHUVerification.App/AHUVerification.App.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.App build failed.
    pause
    exit /b %ERRORLEVEL%
)

:: 6. Run C# Automated Tests
echo.
echo [4/4] Running xUnit Automated Verification Tests...
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Test suite failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] All components built and all verification tests passed!
echo  Launch Desktop Application with:
echo    dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj
echo  Launch Web Dev Server with:
echo    npm run dev
echo ======================================================================
