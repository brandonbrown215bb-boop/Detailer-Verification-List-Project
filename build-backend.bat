@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - .NET Backend Build
echo ======================================================================
echo.

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)

echo [1/3] Building AHUVerification.Core...
dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.Core build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Building AHUVerification.App (Desktop Host)...
dotnet build src/backend/AHUVerification.App/AHUVerification.App.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.App build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Building AHUVerification.RuleEditor (Studio Host)...
dotnet build src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.RuleEditor build failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] All .NET backend projects built successfully!
echo ======================================================================
pause
