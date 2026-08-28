@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification System - Full Architecture Setup ^& Test
echo ======================================================================

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Environment verified (.NET SDK and Node.js/npm ready).

REM 3. Install NPM Dependencies & Build Frontend
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

REM 4. Build Rule Pack Manifest
echo.
echo [2/4] Verifying and hashing Rule Pack Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Build C# .NET Backend and App
echo.
echo [3/4] Building C# .NET Backend and Desktop Hosts...
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

dotnet build src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.RuleEditor build failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Run C# Automated Tests
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
