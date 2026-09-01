@echo off
REM scripts/init_env.bat - Consolidated environment validator & auto-installer for AHU Verification System

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
    echo [WARN] .NET SDK is not installed or not in PATH.
    echo [INFO] Attempting automatic installation of .NET 8 SDK...
    
    where winget >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [INFO] Installing .NET 8 SDK via winget...
        winget install --id Microsoft.DotNet.SDK.8 -e --silent --accept-source-agreements --accept-package-agreements
    ) else (
        echo [INFO] Installing .NET 8 SDK via official installer...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $installer = Join-Path $env:TEMP 'dotnet-sdk-installer.exe'; Write-Host '[INFO] Downloading .NET 8 SDK...'; Invoke-WebRequest -Uri 'https://aka.ms/dotnet/8.0/dotnet-sdk-win-x64.exe' -OutFile $installer; Write-Host '[INFO] Installing .NET 8 SDK...'; Start-Process -FilePath $installer -ArgumentList '/install','/quiet','/norestart' -Wait; Remove-Item $installer -Force -ErrorAction SilentlyContinue }"
    )

    REM Re-check paths after install
    if exist "%DOTNET_DIR%\dotnet.exe" (
        set "PATH=%DOTNET_DIR%;%PATH%"
        if not defined DOTNET_ROOT set "DOTNET_ROOT=%DOTNET_DIR%"
    )
    for /f "tokens=1" %%i in ('dotnet --version 2^>nul') do (
        if not defined DOTNET_VER set "DOTNET_VER=%%i"
    )
    if not defined DOTNET_VER (
        echo [ERROR] .NET SDK installation failed or requires a terminal restart.
        echo Please manually install the .NET SDK v8.0: https://dotnet.microsoft.com/download
        exit /b 1
    )
    echo [OK] .NET SDK installed successfully: %DOTNET_VER%
)

REM 2. Verify Node.js and npm availability
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if defined ProgramW6432 (
    if exist "%ProgramW6432%\nodejs\node.exe" (
        set "PATH=%ProgramW6432%\nodejs;%PATH%"
    )
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Node.js / npm is not installed or not in PATH.
    echo [INFO] Attempting automatic installation of Node.js LTS...

    where winget >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [INFO] Installing Node.js LTS via winget...
        winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
    ) else (
        echo [INFO] Installing Node.js LTS via official MSI...
        powershell -NoProfile -ExecutionPolicy Bypass -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $msi = Join-Path $env:TEMP 'nodejs-lts.msi'; Write-Host '[INFO] Downloading Node.js LTS...'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile $msi; Write-Host '[INFO] Installing Node.js LTS...'; Start-Process -FilePath 'msiexec.exe' -ArgumentList '/i', $msi, '/qn', '/norestart' -Wait; Remove-Item $msi -Force -ErrorAction SilentlyContinue }"
    )

    REM Re-check paths after install
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    )
    if defined ProgramW6432 (
        if exist "%ProgramW6432%\nodejs\node.exe" (
            set "PATH=%ProgramW6432%\nodejs;%PATH%"
        )
    )

    where npm >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Node.js installation failed or requires a terminal restart.
        echo Please manually install Node.js v18 or later: https://nodejs.org/
        exit /b 1
    )
    echo [OK] Node.js / npm installed successfully.
)

exit /b 0

