@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Full Architecture Build
echo ======================================================================
echo.

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

REM 1. Frontend Web Assets Build
echo [1/4] Building Vite Frontend (dist\)...
if not exist "node_modules\" (
    echo [INFO] Installing npm packages...
    call npm install --no-audit --no-fund
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install npm dependencies.
        pause
        exit /b %ERRORLEVEL%
    )
)
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 2. Rule Pack Validation & Manifest Generation
echo.
echo [2/4] Validating Rule Pack ^& Updating Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 3. Backend Core Build
echo.
echo [3/4] Building C# .NET Core Engine...
dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.Core build failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 4. Backend Desktop Hosts Build
echo.
echo [4/4] Building Desktop Host Applications...
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

echo.
echo ======================================================================
echo  [SUCCESS] All components built successfully!
echo.
echo  Quick Actions:
echo    - Launch Verification App:  launch-app.bat
echo    - Launch Rule Editor:       launch-rule-editor.bat
echo    - Start Vite Dev Server:    start-dev.bat
echo    - Run Verification Tests:   run-tests.bat
echo    - Publish Release:          publish-release.bat
echo ======================================================================
pause
