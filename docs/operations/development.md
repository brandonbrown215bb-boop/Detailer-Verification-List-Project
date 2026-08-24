# Development

## Prerequisites
- **.NET 8 SDK** (C# 12)
- **Node.js 20+** & **npm** (for WebView2 TypeScript/Vite frontend bundle)
- **Windows 10/11 (64-bit)**

## Build Commands
- **OpenXML Compatibility Spike**:
  ```powershell
  dotnet run --project spike/OpenXmlSpike
  ```
- **Main Solution Build**:
  ```powershell
  dotnet build
  ```
- **Single-File Executable Publish**:
  ```powershell
  dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
  ```

