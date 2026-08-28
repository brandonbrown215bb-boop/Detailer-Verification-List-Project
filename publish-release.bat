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
