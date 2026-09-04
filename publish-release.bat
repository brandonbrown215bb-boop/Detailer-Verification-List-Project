@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Production Release Publisher
echo ======================================================================
echo.

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

REM 1. Determine Release Version
set "VERSION=%~1"
if "!VERSION!"=="" (
    set /p "VERSION=Enter release version (e.g. 1.0.0 or 1.1.0): "
)

REM Strip leading 'v' or 'V' if present
if /i "!VERSION:~0,1!"=="v" set "VERSION=!VERSION:~1!"

if "!VERSION!"=="" (
    echo [ERROR] Release version cannot be empty.
    pause
    exit /b 1
)

REM Validate SemVer format
powershell -NoProfile -Command "if ('!VERSION!' -match '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$') { exit 0 } else { exit 1 }"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Invalid version '!VERSION!'. Expected SemVer format like '1.0.0' or '1.2.0-rc1'.
    pause
    exit /b 1
)
echo [INFO] Configuring release build for version: !VERSION!

REM 2. Build Production Frontend Assets
echo.
echo [1/4] Building production frontend into dist\...
if not exist "node_modules" (
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

REM 3. Verify Rule Pack
echo.
echo [2/4] Verifying and hashing Rule Pack Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 4. Publish Main Desktop Application
echo.
echo [3/5] Publishing AHU Verification Desktop Application (Self-Contained win-x64)...
dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -o publish\AHUVerification /p:Version=!VERSION!
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Publishing AHUVerification.App failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Publish Rule Editor Studio
echo.
echo [4/5] Publishing Rule ^& Logic Editor Studio (Self-Contained win-x64)...
dotnet publish src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release -r win-x64 --self-contained true -o publish\RuleEditor /p:Version=!VERSION!
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Publishing RuleEditor failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Package Velopack 1-Click Installer
echo.
echo [5/5] Packaging Velopack 1-Click Installer...
where vpk >nul 2>&1
if %ERRORLEVEL% NEQ 0 goto :no_vpk

if not exist "Releases" mkdir Releases
call vpk pack --packId AHUVerification --packVersion !VERSION! --packDir publish\AHUVerification --mainExe AHUVerification.App.exe -o Releases
if !ERRORLEVEL! NEQ 0 (
    echo [WARNING] Velopack packaging encountered an issue. Raw publish folder is still available.
) else (
    echo [OK] 1-Click Installer created in Releases\
)
goto :vpk_done

:no_vpk
echo [INFO] Velopack CLI (vpk) not found in PATH.
echo [INFO] To generate 1-click Setup.exe locally, run: dotnet tool install -g vpk

:vpk_done

echo.
echo ======================================================================
echo  [SUCCESS] Production release packages (v!VERSION!) published successfully!
echo.
echo  Published Artifacts:
echo    - Main App Folder:    publish\AHUVerification\AHUVerification.App.exe
echo    - Rule Editor Folder: publish\RuleEditor\RuleEditor.exe
if exist "Releases\AHUVerification-win-Setup.exe" (
echo    - 1-Click Installer:  Releases\AHUVerification-win-Setup.exe
) else if exist "Releases\AHUVerification-Setup.exe" (
echo    - 1-Click Installer:  Releases\AHUVerification-Setup.exe
)
echo ======================================================================
pause
