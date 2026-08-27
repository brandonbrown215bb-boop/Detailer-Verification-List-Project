@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - .NET Backend Build
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
