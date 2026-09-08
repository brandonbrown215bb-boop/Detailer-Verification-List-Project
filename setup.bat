@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification System - Full Architecture Setup ^& Test
echo ======================================================================

REM ------------------------------------------------------------------
REM Verify or Automatically Install Required Node.js 22.18.x
REM ------------------------------------------------------------------
set "REQUIRED_NODE_VERSION=22.18.0"
set "TOOLS_NODE_DIR=%~dp0.tools\node-v%REQUIRED_NODE_VERSION%-win-x64"

REM Prioritize project-local Node if already installed
if exist "%TOOLS_NODE_DIR%\node.exe" (
    set "PATH=%TOOLS_NODE_DIR%;!PATH!"
)

REM Check whether current Node.js meets >=22.18.0 <23
set "NEED_NODE_INSTALL=0"
where node >nul 2>&1
if errorlevel 1 (
    set "NEED_NODE_INSTALL=1"
) else (
    set "CURRENT_NODE_VER="
    for /f "tokens=1" %%i in ('node --version 2^>nul') do if not defined CURRENT_NODE_VER set "CURRENT_NODE_VER=%%i"
    if not defined CURRENT_NODE_VER (
        set "NEED_NODE_INSTALL=1"
    ) else (
        set "CLEAN_NODE_VER=!CURRENT_NODE_VER:v=!"
        for /f "tokens=1,2 delims=." %%a in ("!CLEAN_NODE_VER!") do (
            set "CURR_MAJOR=%%a"
            set "CURR_MINOR=%%b"
        )
        if not "!CURR_MAJOR!"=="22" (
            set "NEED_NODE_INSTALL=1"
        ) else if !CURR_MINOR! LSS 18 (
            set "NEED_NODE_INSTALL=1"
        )
    )
)

if "!NEED_NODE_INSTALL!"=="1" (
    echo.
    if defined CURRENT_NODE_VER (
        echo [INFO] Node.js 22.18.x is required ^(found: !CURRENT_NODE_VER!^).
    ) else (
        echo [INFO] Node.js 22.18.x is required ^(not found on PATH^).
    )
    echo [INFO] Automatically installing Node.js %REQUIRED_NODE_VERSION%...
    
    set "NODE_PROVISIONED=0"
    
    REM 1. Try nvm if available
    where nvm >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Attempting install via nvm...
        call nvm install %REQUIRED_NODE_VERSION% >nul 2>&1
        call nvm use %REQUIRED_NODE_VERSION% >nul 2>&1
        for /f "tokens=1" %%i in ('node --version 2^>nul') do (
            if "%%i"=="v%REQUIRED_NODE_VERSION%" set "NODE_PROVISIONED=1"
        )
    )
    
    REM 2. Try fnm if available and not yet provisioned
    if "!NODE_PROVISIONED!"=="0" (
        where fnm >nul 2>&1
        if not errorlevel 1 (
            echo [INFO] Attempting install via fnm...
            call fnm install %REQUIRED_NODE_VERSION% >nul 2>&1
            call fnm use %REQUIRED_NODE_VERSION% >nul 2>&1
            for /f "tokens=1" %%i in ('node --version 2^>nul') do (
                if "%%i"=="v%REQUIRED_NODE_VERSION%" set "NODE_PROVISIONED=1"
            )
        )
    )
    
    REM 3. Standalone official portable distribution (.tools\node-v22.18.0-win-x64)
    if "!NODE_PROVISIONED!"=="0" (
        if not exist "%~dp0.tools" mkdir "%~dp0.tools"
        set "NODE_ZIP=%~dp0.tools\node-v%REQUIRED_NODE_VERSION%-win-x64.zip"
        set "NODE_URL=https://nodejs.org/dist/v%REQUIRED_NODE_VERSION%/node-v%REQUIRED_NODE_VERSION%-win-x64.zip"
        
        echo [INFO] Downloading official Node.js %REQUIRED_NODE_VERSION% package...
        where curl.exe >nul 2>&1
        if not errorlevel 1 (
            curl.exe -L --fail --retry 3 --silent --show-error -o "!NODE_ZIP!" "!NODE_URL!"
        ) else (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('!NODE_URL!', '!NODE_ZIP!')"
        )
        
        if not exist "!NODE_ZIP!" (
            echo [ERROR] Failed to download Node.js package from !NODE_URL!.
            pause
            exit /b 1
        )
        
        echo [INFO] Extracting Node.js %REQUIRED_NODE_VERSION% into .tools...
        where tar.exe >nul 2>&1
        if not errorlevel 1 (
            tar.exe -xf "!NODE_ZIP!" -C "%~dp0.tools"
        ) else (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '!NODE_ZIP!' -DestinationPath '%~dp0.tools' -Force"
        )
        
        if exist "!NODE_ZIP!" del /f /q "!NODE_ZIP!" >nul 2>&1
        
        if not exist "%TOOLS_NODE_DIR%\node.exe" (
            echo [ERROR] Node.js binary was not found after extraction in "%TOOLS_NODE_DIR%".
            pause
            exit /b 1
        )
        
        set "PATH=%TOOLS_NODE_DIR%;!PATH!"
        set "NODE_PROVISIONED=1"
    )
    
    echo [OK] Node.js %REQUIRED_NODE_VERSION% is now installed and active for this session.
    echo.
)

REM ------------------------------------------------------------------
REM Verify or Automatically Install Required .NET 8 SDK
REM ------------------------------------------------------------------
set "TOOLS_DOTNET_DIR=%~dp0.tools\dotnet"

REM Prioritize project-local or user-local .NET if available
if exist "%TOOLS_DOTNET_DIR%\dotnet.exe" (
    set "PATH=%TOOLS_DOTNET_DIR%;!PATH!"
    set "DOTNET_ROOT=%TOOLS_DOTNET_DIR%"
) else if exist "%LocalAppData%\Microsoft\dotnet\dotnet.exe" (
    set "PATH=%LocalAppData%\Microsoft\dotnet;!PATH!"
    set "DOTNET_ROOT=%LocalAppData%\Microsoft\dotnet"
)

REM Ensure global.json is present at repo root to pin .NET 8 SDK
if not exist "%~dp0global.json" (
    echo [INFO] Creating global.json to pin .NET SDK to 8.0...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllText('%~dp0global.json', '{`n  `"sdk`": {`n    `"version`": `"8.0.100`",`n    `"rollForward`": `"latestFeature`"`n  }`n}`n', [System.Text.Encoding]::UTF8)"
)

REM Check whether .NET 8 SDK is installed
set "NEED_DOTNET_INSTALL=0"
where dotnet >nul 2>&1
if errorlevel 1 (
    set "NEED_DOTNET_INSTALL=1"
) else (
    set "FOUND_DOTNET_8=0"
    for /f "tokens=1" %%s in ('dotnet --list-sdks 2^>nul') do (
        for /f "tokens=1 delims=." %%v in ("%%s") do (
            if "%%v"=="8" set "FOUND_DOTNET_8=1"
        )
    )
    if "!FOUND_DOTNET_8!"=="0" (
        set "NEED_DOTNET_INSTALL=1"
    )
)

if "!NEED_DOTNET_INSTALL!"=="1" (
    echo.
    echo [INFO] .NET 8 SDK is required ^(not found on machine^).
    echo [INFO] Automatically installing .NET 8 SDK...
    
    set "DOTNET_PROVISIONED=0"
    
    REM 1. Try winget if available
    where winget >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Attempting install via winget...
        winget install --id Microsoft.DotNet.SDK.8 --exact --source winget --accept-package-agreements --accept-source-agreements --silent >nul 2>&1
        if exist "%ProgramFiles%\dotnet\dotnet.exe" (
            set "PATH=%ProgramFiles%\dotnet;!PATH!"
        )
        for /f "tokens=1" %%s in ('dotnet --list-sdks 2^>nul') do (
            for /f "tokens=1 delims=." %%v in ("%%s") do (
                if "%%v"=="8" set "DOTNET_PROVISIONED=1"
            )
        )
    )
    
    REM 2. Standalone official Microsoft dotnet-install script (.tools\dotnet)
    if "!DOTNET_PROVISIONED!"=="0" (
        if not exist "%~dp0.tools" mkdir "%~dp0.tools"
        set "DOTNET_INSTALL_SCRIPT=%~dp0.tools\dotnet-install.ps1"
        set "DOTNET_INSTALL_URL=https://dot.net/v1/dotnet-install.ps1"
        
        echo [INFO] Downloading official Microsoft dotnet-install script...
        where curl.exe >nul 2>&1
        if not errorlevel 1 (
            curl.exe -L --fail --retry 3 --silent --show-error -o "!DOTNET_INSTALL_SCRIPT!" "!DOTNET_INSTALL_URL!"
        ) else (
            powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('!DOTNET_INSTALL_URL!', '!DOTNET_INSTALL_SCRIPT!')"
        )
        
        if not exist "!DOTNET_INSTALL_SCRIPT!" (
            echo [ERROR] Failed to download dotnet-install script from !DOTNET_INSTALL_URL!.
            pause
            exit /b 1
        )
        
        echo [INFO] Installing .NET 8 SDK into .tools\dotnet...
        powershell -NoProfile -ExecutionPolicy Bypass -File "!DOTNET_INSTALL_SCRIPT!" -Channel 8.0 -Quality GA -InstallDir "!TOOLS_DOTNET_DIR!"
        
        if exist "!DOTNET_INSTALL_SCRIPT!" del /f /q "!DOTNET_INSTALL_SCRIPT!" >nul 2>&1
        
        if not exist "!TOOLS_DOTNET_DIR!\dotnet.exe" (
            echo [ERROR] .NET SDK binary was not found after installation in "!TOOLS_DOTNET_DIR!".
            pause
            exit /b 1
        )
        
        set "PATH=!TOOLS_DOTNET_DIR!;!PATH!"
        set "DOTNET_ROOT=!TOOLS_DOTNET_DIR!"
        set "DOTNET_PROVISIONED=1"
    )
    
    echo [OK] .NET 8 SDK is now installed and active for this session.
    echo.
)

call "%~dp0scripts\init_env.bat"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Environment verified (.NET SDK and Node.js/npm ready).

REM 3. Install NPM Dependencies & Build Frontend
echo.
echo [1/4] Installing locked NPM dependencies and building Vite frontend...
call npm ci --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install npm dependencies.
    pause
    exit /b %ERRORLEVEL%
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Vite production build failed.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Frontend build complete.

REM 4. Build Rule Pack Manifest
echo.
echo [2/4] Verifying and hashing Rule Pack Manifest...
node scripts/build_rulepack.mjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Rule pack verification failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 5. Build C# .NET Backend and App
echo.
echo [3/4] Building C# .NET Backend and Desktop Hosts...
dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.Core build failed.
    pause
    exit /b %ERRORLEVEL%
)

dotnet build src/backend/AHUVerification.App/AHUVerification.App.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.App build failed.
    pause
    exit /b %ERRORLEVEL%
)

dotnet build src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] AHUVerification.RuleEditor build failed.
    pause
    exit /b %ERRORLEVEL%
)

REM 6. Run C# Automated Tests and the measured Core coverage gate
echo.
echo [4/4] Running xUnit Automated Verification Tests and Core coverage gate...
call npm run test:coverage
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Test suite or Core coverage gate failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] All components built and all verification tests passed!
echo  Launch Desktop Application with:
echo    dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj
echo  Launch Web Dev Server with:
echo    npm run dev
echo ======================================================================
