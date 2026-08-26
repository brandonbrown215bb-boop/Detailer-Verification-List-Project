@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

:menu
cls
echo ======================================================================
echo  AHU Detailing Verification System - Command Center
echo ======================================================================
echo.
echo  [1] Launch AHU Verification Desktop Application
echo  [2] Launch Rule ^& Logic Editor Desktop Studio
echo  [3] Start Vite Web Dev Server (Live Reload)
echo.
echo  [4] Build All Components (Frontend + Backend + Rules)
echo  [5] Build Frontend Web Assets (dist\)
echo  [6] Build .NET Backend Projects
echo  [7] Rebuild ^& Validate Rule Pack Manifest
echo.
echo  [8] Run Automated Test Suite (xUnit + AST Tests)
echo  [9] Publish Release Packages (publish\)
echo  [S] Full Environment Setup ^& Verification (setup.bat)
echo.
echo  [0] Exit
echo ======================================================================
set /p choice="Enter your choice (0-9, S): "

if /i "%choice%"=="1" (
    call "%~dp0launch-app.bat"
    goto menu
)
if /i "%choice%"=="2" (
    call "%~dp0launch-rule-editor.bat"
    goto menu
)
if /i "%choice%"=="3" (
    call "%~dp0start-dev.bat"
    goto menu
)
if /i "%choice%"=="4" (
    call "%~dp0build-all.bat"
    goto menu
)
if /i "%choice%"=="5" (
    call "%~dp0build-frontend.bat"
    goto menu
)
if /i "%choice%"=="6" (
    call "%~dp0build-backend.bat"
    goto menu
)
if /i "%choice%"=="7" (
    call "%~dp0build-rulepack.bat"
    goto menu
)
if /i "%choice%"=="8" (
    call "%~dp0run-tests.bat"
    goto menu
)
if /i "%choice%"=="9" (
    call "%~dp0publish-release.bat"
    goto menu
)
if /i "%choice%"=="S" (
    call "%~dp0setup.bat"
    goto menu
)
if "%choice%"=="0" (
    exit /b 0
)

echo.
echo [ERROR] Invalid choice '%choice%'. Please select an option from the menu.
timeout /t 2 >nul
goto menu
