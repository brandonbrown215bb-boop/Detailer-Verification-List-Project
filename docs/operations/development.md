# Development

## Prerequisites
- **.NET 8+ SDK** (C# 12 / .NET 8 / 10)
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
- **Publish Standalone Desktop Executable**:
  ```powershell
  dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
  ```
