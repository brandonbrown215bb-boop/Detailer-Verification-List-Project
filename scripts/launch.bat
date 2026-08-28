@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=app"

if /i "%TARGET%"=="rule-editor" (
    set "APP_TITLE=AHU Rule & Logic Editor Studio"
    set "PROJECT_PATH=src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj"
    set "HTML_TARGET=dist\rule-editor.html"
) else (
    set "APP_TITLE=AHU Detailing Verification Desktop Application"
    set "PROJECT_PATH=src/backend/AHUVerification.App/AHUVerification.App.csproj"
    set "HTML_TARGET=dist\index.html"
)

echo ======================================================================
echo  %APP_TITLE% - Launcher
echo ======================================================================
echo.

call "%~dp0init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

if not exist "%HTML_TARGET%" (
    echo [INFO] Built web UI assets not found: %HTML_TARGET%. Building frontend...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo [INFO] Starting %APP_TITLE%...
echo.
dotnet run --project "%PROJECT_PATH%"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application exited with code %ERRORLEVEL%.
    pause
)
