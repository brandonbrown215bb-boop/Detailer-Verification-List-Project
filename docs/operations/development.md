# Development

## Prerequisites

- **Windows 10/11 (64-bit)**. The desktop hosts are Windows Forms/WebView2 applications and the release script targets `win-x64`.
- **.NET 8 SDK**. The projects target `net8.0` and `net8.0-windows`; a newer SDK can build those targets, but an older runtime cannot run the published framework-dependent applications.
- **Node.js 18+ and npm**. `scripts/init_env.bat` checks only that `npm` is on `PATH`; `start-dev.bat` documents Node 18+.
- **Microsoft Edge WebView2 Runtime** for either desktop host. Browser/Vite mode does not exercise the native bridge.

## Standard Windows Workflows

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `setup.bat` | Checks the SDK and npm, installs npm dependencies, builds the frontend and rule pack, builds both desktop hosts, then runs the C# tests. It does **not** run the Node AST converter tests. |
| `build-all.bat` | Builds the Vite assets, validates the rule pack, and builds Core, the main host, and the Rule Editor. |
| `run-tests.bat` | Runs the C# xUnit command, then `node scripts/test_ast_converter.mjs`. |
| `launch-app.bat` | Builds `dist/index.html` if needed and starts the main desktop host. |
| `launch-rule-editor.bat` | Builds `dist/rule-editor.html` if needed and starts the Rule Editor desktop host. |
| `start-dev.bat` | Starts Vite at port 5173. |
| `publish-release.bat` | Builds production assets and publishes both desktop applications to `publish/`. |
| `menu.bat` | Interactive wrapper for the workflows above. The Rule Editor is option **2**. |

## Run the Hosts

### Desktop hosts

Build the frontend first, or use the launchers, which do that check for you.

```powershell
npm run build
dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj
dotnet run --project src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj
```

In a Debug build, either host uses Vite when its local route responds; otherwise it loads the adjacent `dist/` bundle. The main application needs `dist/index.html`; the Rule Editor needs `dist/rule-editor.html`.

### Vite/browser development

```powershell
npm run dev
```

- Main UI: `http://localhost:5173/`
- Rule Editor: `http://localhost:5173/rule-editor.html`

Browser mode is a UI/development fallback. It has no WebView2 bridge, native file dialogs, `.dvl` saving, `.upz` extraction, or official OpenXML export. For the Rule Editor, use **Export Draft JSON** to transfer an in-browser draft; its Publish action does not write a rule-pack bundle without the desktop bridge.

## Build and Test Commands

```powershell
dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj
dotnet build src/backend/AHUVerification.App/AHUVerification.App.csproj
dotnet build src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj

npm run build
node scripts/build_rulepack.mjs
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
node scripts/test_ast_converter.mjs
```

`node scripts/build_rulepack.mjs` rewrites the baseline manifest when the pack is valid. It is therefore a source-tree mutation; inspect its diff before committing it. The test and build details, including the current native-UPZ limitation, live in [validation.md](validation.md).

## Publish a Release

Use the repository workflow rather than a hand-assembled publish command:

```powershell
.\publish-release.bat
```

It builds Vite, validates/hashes `resources/rulepack`, then runs these framework-dependent publishes:

```powershell
dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained false -o publish\AHUVerification
dotnet publish src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release -r win-x64 --self-contained false -o publish\RuleEditor
```

The outputs are deployable folders, not standalone executables:

- `publish\AHUVerification\AHUVerification.App.exe` needs `dist\index.html`, `resources\rulepack\` (the five baseline members), and `resources\bin\unpack32.exe` plus `ywunpack.dll` for `.upz` extraction.
- `publish\RuleEditor\RuleEditor.exe` needs `dist\rule-editor.html` and `resources\rulepack\` (the five baseline members).

`src/backend/Directory.Build.targets` copies `dist/` and `resources/rulepack/` to every Windows-host output and blocks publishing if any baseline rule-pack member is missing. The main App project separately blocks publishing when its local `resources/bin/unpack32.exe` or `ywunpack.dll` is missing. Those native files are absent from this checkout as of 2026-08-28, so the main-App publish and native-UPZ path are intentionally blocked until the licensed binaries are restored to `src/backend/AHUVerification.App/resources/bin/`.

Close both desktop applications before rebuilding or publishing: Windows can lock the executable and output files. Likewise, close an exported workbook in Excel before overwriting it; the OpenXML exporter reports an `IOException` telling the user to close the locked file and retry.
