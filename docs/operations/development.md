# Development

## Prerequisites
- **.NET 10 SDK**
- **Node.js 20+** & **npm** (for WebView2 TypeScript/Vite frontend bundle)
- **Windows 10/11 (64-bit)** with Microsoft Edge WebView2 runtime

## Quickstart Setup
New developers can automatically verify prerequisites, install dependencies, build the frontend, and run all unit tests by running:
```powershell
.\setup.bat
```
Or double-clicking `setup.bat` from Windows File Explorer.

## Running the Application
- **Desktop WebView2 Host**:
  ```powershell
  dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj
  ```
- **Vite Web Development Server** (with browser fallback):
  ```powershell
  npm run dev
  ```

## Build & Test Commands
- **Run C# Backend Automated Tests** (validates OpenXML schema, 0 errors, formula preservation, AST evaluation, 4-state fact provenance):
  ```powershell
  dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
  ```
- **Build TypeScript / Vite Frontend**:
  ```powershell
  npm run build
  ```
- **Re-build & Hash Rule Pack Manifest**:
  ```powershell
  node scripts/build_rulepack.mjs
  ```
- **Publish Self-Contained Desktop Folder** (includes `dist/`, `resources/rulepack/`, and `resources/bin/`):
  ```powershell
  npm run build
  node scripts/build_rulepack.mjs
  dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o artifacts/publish/win-x64
  ```

The publish directory is the deployable unit; do not distribute the `.exe` by itself. Confirm that `dist/index.html`, `resources/rulepack/manifest.json`, all four manifest-declared Rule Pack members, and `resources/bin/unpack32.exe` / `ywunpack.dll` (for native `.upz` bundle extraction) are present before release.

The browser development build can generate a SheetJS workbook for workflow preview. Only the desktop OpenXML export is the official verification deliverable. Native `.upz` archive decompression requires the desktop host application.
