@echo off
REM Deterministic prerequisite check for the AHU Verification build scripts.
REM If a project-local Node 22.18.x has been provisioned by setup.bat, prioritize it.
if exist "%~dp0..\.tools\node-v22.18.0-win-x64\node.exe" (
    set "PATH=%~dp0..\.tools\node-v22.18.0-win-x64;%PATH%"
) else if exist "%~dp0.tools\node-v22.18.0-win-x64\node.exe" (
    set "PATH=%~dp0.tools\node-v22.18.0-win-x64;%PATH%"
)

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET 8 SDK was not found on PATH.
    echo         Install the .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
    exit /b 1
)

set "DOTNET_VER="
for /f "tokens=1" %%i in ('dotnet --version 2^>nul') do if not defined DOTNET_VER set "DOTNET_VER=%%i"
if not defined DOTNET_VER (
    echo [ERROR] dotnet could not report an SDK version.
    echo         Install the .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
    exit /b 1
)
for /f "tokens=1 delims=." %%i in ("%DOTNET_VER%") do set "DOTNET_MAJOR=%%i"
if not "%DOTNET_MAJOR%"=="8" (
    echo [ERROR] .NET SDK 8.x is required; found %DOTNET_VER%.
    echo         Install the .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0
    exit /b 1
)
echo [OK] .NET SDK %DOTNET_VER%

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js 22.18.x was not found on PATH.
    echo         Install Node.js 22.18.0 from https://nodejs.org/download/release/v22.18.0/
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found on PATH. Reinstall Node.js 22.18.0 or repair PATH.
    exit /b 1
)

set "NODE_VER="
for /f "tokens=1" %%i in ('node --version 2^>nul') do if not defined NODE_VER set "NODE_VER=%%i"
if not defined NODE_VER (
    echo [ERROR] node could not report a version.
    exit /b 1
)
set "NODE_VER=%NODE_VER:v=%"
for /f "tokens=1,2,3 delims=." %%a in ("%NODE_VER%") do (
    set "NODE_MAJOR=%%a"
    set "NODE_MINOR=%%b"
    set "NODE_PATCH=%%c"
)
if not "%NODE_MAJOR%"=="22" (
    echo [ERROR] Node.js 22.18.x is required; found v%NODE_VER%.
    echo         Run setup.bat to automatically install Node.js 22.18.0, or install from https://nodejs.org/download/release/v22.18.0/
    exit /b 1
)
if %NODE_MINOR% LSS 18 (
    echo [ERROR] Node.js 22.18.x or newer within Node 22 is required; found v%NODE_VER%.
    echo         Run setup.bat to automatically install Node.js 22.18.0, or install from https://nodejs.org/download/release/v22.18.0/
    exit /b 1
)
echo [OK] Node.js v%NODE_VER%
set "NPM_VER="
for /f "tokens=1" %%i in ('npm --version 2^>nul') do if not defined NPM_VER set "NPM_VER=%%i"
if not defined NPM_VER (
    echo [ERROR] npm could not report a version.
    exit /b 1
)
echo [OK] npm %NPM_VER%
exit /b 0

