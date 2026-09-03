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
echo [3/5] Publishing AHU Verification Desktop Application (Self-Contained win-x64)...
dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -o publish\AHUVerification
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Publishing AHUVerification.App failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Publish Rule Editor Studio
echo.
echo [4/5] Publishing Rule ^& Logic Editor Studio (Self-Contained win-x64)...
dotnet publish src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release -r win-x64 --self-contained true -o publish\RuleEditor
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Publishing RuleEditor failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 7. Package Velopack 1-Click Installer
echo.
echo [5/5] Packaging Velopack 1-Click Installer...
where vpk >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    if not exist "Releases\" mkdir Releases
    call vpk pack --packId AHUVerification --packVersion 1.0.0 --packDir publish\AHUVerification --mainExename AHUVerification.App.exe -o Releases
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Velopack packaging encountered an issue. Raw publish folder is still available.
    ) else (
        echo [OK] 1-Click Installer created at Releases\AHUVerification-Setup.exe
    )
) else (
    echo [INFO] Velopack CLI (vpk) not found in PATH.
    echo [INFO] To generate 1-click Setup.exe locally, run: dotnet tool install -g vpk
)

echo.
echo ======================================================================
echo  [SUCCESS] Production release packages published successfully!
echo.
echo  Published Artifacts:
echo    - Main App Folder:    publish\AHUVerification\AHUVerification.App.exe
echo    - Rule Editor Folder: publish\RuleEditor\RuleEditor.exe
if exist "Releases\AHUVerification-Setup.exe" (
echo    - 1-Click Installer:  Releases\AHUVerification-Setup.exe
)
echo ======================================================================
pause
