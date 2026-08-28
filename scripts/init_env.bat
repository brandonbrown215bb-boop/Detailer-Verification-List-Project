@echo off
REM scripts/init_env.bat - Consolidated environment validator for AHU Verification System

REM 1. Locate and configure 64-bit .NET SDK
if defined ProgramW6432 (
    set "DOTNET_DIR=%ProgramW6432%\dotnet"
) else (
    set "DOTNET_DIR=%ProgramFiles%\dotnet"
)

if exist "%DOTNET_DIR%\dotnet.exe" (
    set "PATH=%DOTNET_DIR%;%PATH%"
    if not defined DOTNET_ROOT set "DOTNET_ROOT=%DOTNET_DIR%"
)

set "DOTNET_VER="
for /f "tokens=1" %%i in ('dotnet --version 2^>nul') do (
    if not defined DOTNET_VER set "DOTNET_VER=%%i"
)

if not defined DOTNET_VER (
    echo [ERROR] 64-bit .NET SDK is not installed, not in PATH, or not functional.
    echo Please install the .NET SDK v8.0 or later: https://dotnet.microsoft.com/download
    exit /b 1
)

REM 2. Verify Node.js and npm availability
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo Please install Node.js v18 or later: https://nodejs.org/
    exit /b 1
)

exit /b 0

