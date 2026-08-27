@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Full Architecture Build
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

REM 2. Check Node.js and npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    pause
    exit /b 1
)

REM 3. Frontend Web Assets Build
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

REM 4. Rule Pack Validation & Manifest Generation
echo.
echo [2/4] Validating Rule Pack ^& Updating Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Backend Core Build
echo.
echo [3/4] Building C# .NET Core Engine...
dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.Core build failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Backend Desktop Hosts Build
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
