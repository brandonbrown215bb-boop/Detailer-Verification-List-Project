@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Production Release Publisher
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

REM 3. Build Production Frontend Assets
echo [1/4] Building production frontend into dist\...
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

REM 4. Verify Rule Pack
echo.
echo [2/4] Verifying and hashing Rule Pack Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Publish Main Desktop Application
echo.
echo [3/4] Publishing AHU Verification Desktop Application (Release win-x64)...
dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained false -o publish\AHUVerification
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Publishing AHUVerification.App failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Publish Rule Editor Studio
echo.
echo [4/4] Publishing Rule ^& Logic Editor Studio (Release win-x64)...
dotnet publish src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release -r win-x64 --self-contained false -o publish\RuleEditor
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Publishing RuleEditor failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] Production release packages published successfully!
echo.
echo  Published Packages:
echo    - Main App:     publish\AHUVerification\AHUVerification.App.exe
echo    - Rule Editor:  publish\RuleEditor\RuleEditor.exe
echo ======================================================================
pause
