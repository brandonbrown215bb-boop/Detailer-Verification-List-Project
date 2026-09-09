@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ======================================================================
echo  AHU Detailing Verification - Production Release Publisher
echo ======================================================================
echo.

REM Automation must supply the release version explicitly. The workflow may derive
REM it from a tag, but this local publisher must never silently choose a version.
set "VERSION=%~1"
if not defined VERSION (
    echo [ERROR] An explicit release version is required.
    echo         Usage: publish-release.bat 1.2.3
    exit /b 2
)

if /i "!VERSION:~0,1!"=="v" set "VERSION=!VERSION:~1!"
powershell -NoProfile -Command "if ('!VERSION!' -match '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$') { exit 0 } else { exit 1 }"
if errorlevel 1 (
    echo [ERROR] Invalid release version '!VERSION!'. Expected SemVer such as 1.2.3 or 1.2.3-rc1.
    exit /b 2
)

where vpk >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Velopack CLI vpk 1.2.0 is required before release work begins. Install the pinned tool with: dotnet tool install --global vpk --version 1.2.0
    exit /b 1
)
for /f "tokens=2" %%I in ('dotnet tool list --global ^| findstr /r /c:"^vpk " 2^>nul') do if not defined VPK_VER set "VPK_VER=%%I"
if not "!VPK_VER!"=="1.2.0" (
    echo [ERROR] Velopack CLI 1.2.0 is required; found !VPK_VER!.
    echo         Install the pinned tool with: dotnet tool install --global vpk --version 1.2.0
    exit /b 1
)

call "%~dp0scripts\init_env.bat"
if errorlevel 1 exit /b 1

echo [INFO] Configuring release build for version !VERSION!
node scripts/verify_version.mjs --expected "!VERSION!"
if errorlevel 1 (
    echo [ERROR] Release version does not match the authoritative version metadata.
    exit /b 1
)

echo.
echo [1/10] Installing locked frontend dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo [ERROR] npm ci failed.
    exit /b 1
)

echo.
echo [2/10] Building production frontend into dist\...
set "VITE_APP_VERSION=!VERSION!"
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    exit /b 1
)
node scripts/verify_version.mjs --expected "!VERSION!"
if errorlevel 1 exit /b 1
node scripts/verify_dist_assets.mjs
if errorlevel 1 exit /b 1
node scripts/verify_bundle_budget.mjs
if errorlevel 1 exit /b 1

echo.
echo [3/10] Verifying deterministic Rule Pack output...
node scripts/build_rulepack.mjs
if errorlevel 1 (
    echo [ERROR] Rule Pack generation failed.
    exit /b 1
)
git diff --exit-code -- resources/rulepack
if errorlevel 1 (
    echo [ERROR] Rule Pack generation changed tracked files. Commit the canonical manifest before packaging.
    exit /b 1
)

echo.
echo [4/10] Running locked frontend verification suite...
call npm test
if errorlevel 1 (
    echo [ERROR] Frontend verification suite failed.
    exit /b 1
)

echo.
echo [5/10] Running .NET verification suite and Core coverage gate...
call npm run test:coverage
if errorlevel 1 (
    echo [ERROR] .NET verification suite or Core coverage gate failed.
    exit /b 1
)

echo.
echo [6/10] Publishing AHU Verification Desktop Application (self-contained win-x64)...
dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -o publish\AHUVerification /p:Version=!VERSION!
if errorlevel 1 (
    echo [ERROR] Publishing AHUVerification.App failed.
    exit /b 1
)

echo.
echo [7/10] Publishing Rule ^& Logic Editor Studio (self-contained win-x64)...
dotnet publish src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release -r win-x64 --self-contained true -o publish\RuleEditor /p:Version=!VERSION!
if errorlevel 1 (
    echo [ERROR] Publishing RuleEditor failed.
    exit /b 1
)

echo.
echo [8/10] Validating packaged entry pages and native assets...
powershell -NoProfile -Command "$required = @('publish/AHUVerification/AHUVerification.App.exe','publish/AHUVerification/dist/index.html','publish/AHUVerification/dist/rule-editor.html','publish/AHUVerification/version.json','publish/AHUVerification/resources/rulepack/manifest.json','publish/AHUVerification/resources/rulepack/rules.json','publish/AHUVerification/resources/rulepack/template_map.json','publish/AHUVerification/resources/rulepack/approved_mappings.json','publish/AHUVerification/resources/rulepack/fact_contract.json','publish/AHUVerification/resources/rulepack/template.xlsx','publish/AHUVerification/resources/bin/unpack32.exe','publish/AHUVerification/resources/bin/ywunpack.dll','publish/RuleEditor/RuleEditor.exe','publish/RuleEditor/dist/rule-editor.html','publish/RuleEditor/version.json','publish/RuleEditor/resources/rulepack/manifest.json','publish/RuleEditor/resources/rulepack/rules.json','publish/RuleEditor/resources/rulepack/template_map.json','publish/RuleEditor/resources/rulepack/approved_mappings.json','publish/RuleEditor/resources/rulepack/fact_contract.json','publish/RuleEditor/resources/rulepack/template.xlsx'); foreach ($path in $required) { if (-not (Test-Path -LiteralPath $path)) { Write-Error ('Missing required publish asset: ' + $path); exit 1 } }"
if errorlevel 1 exit /b 1

echo.
echo [9/10] Packaging Velopack installer with vpk 1.2.0...
if exist "Releases" (
    powershell -NoProfile -Command "$entries = @(Get-ChildItem -LiteralPath 'Releases' -Force -ErrorAction SilentlyContinue); if ($entries.Count -ne 0) { Write-Error 'Releases directory must be empty before packaging; refusing to reuse stale artifacts.'; exit 1 }"
    if errorlevel 1 exit /b 1
) else (
    mkdir "Releases"
    if errorlevel 1 exit /b 1
)
call vpk pack --packId AHUVerification --packVersion !VERSION! --packDir publish\AHUVerification --mainExe AHUVerification.App.exe --icon resources\app.ico -o Releases
if errorlevel 1 (
    echo [ERROR] Velopack packaging failed.
    exit /b 1
)
powershell -NoProfile -Command "$setup = @(Get-ChildItem -LiteralPath 'Releases' -Filter '*-Setup.exe' -File); $required = @('Releases/RELEASES','Releases/assets.win.json','Releases/releases.win.json'); $missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_) }); $packages = @(Get-ChildItem -LiteralPath 'Releases' -Filter '*.nupkg' -File); if ($setup.Count -ne 1) { Write-Error ('Expected exactly one Setup.exe, found ' + $setup.Count); exit 1 }; if ($packages.Count -lt 1) { Write-Error 'Velopack did not produce a .nupkg package.'; exit 1 }; if ($missing.Count -gt 0) { Write-Error ('Missing Velopack output: ' + ($missing -join ', ')); exit 1 }"
if errorlevel 1 exit /b 1
powershell -NoProfile -Command "Compress-Archive -Path 'publish/RuleEditor/*' -DestinationPath ('Releases/RuleEditor-!VERSION!-win-x64.zip') -Force"
if errorlevel 1 exit /b 1

echo.
echo [10/10] Writing checksums and dependency SBOMs...
dotnet list src/backend/AHUVerification.App/AHUVerification.App.csproj package --include-transitive --format json > "Releases\sbom-dotnet.json"
if errorlevel 1 exit /b 1
call npm sbom --sbom-format cyclonedx > "Releases\sbom-node.cdx.json"
if errorlevel 1 exit /b 1
node scripts/write_release_checksums.mjs Releases
if errorlevel 1 exit /b 1

echo.
echo ======================================================================
echo  [SUCCESS] Production release packages (v!VERSION!) created successfully.
echo  Main App Folder:    publish\AHUVerification\AHUVerification.App.exe
echo  Rule Editor Folder: publish\RuleEditor\RuleEditor.exe
echo  Velopack Output:    Releases\
echo  Checksums:          Releases\SHA256SUMS.txt
echo  SBOMs:              Releases\sbom-dotnet.json and sbom-node.cdx.json
echo ======================================================================
exit /b 0
