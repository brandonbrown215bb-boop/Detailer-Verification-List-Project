# Development

## Prerequisites

- **Windows 10/11 (64-bit)**. The desktop hosts are Windows Forms/WebView2 applications and the release script targets `win-x64`.
- **.NET 8 SDK**. The projects target `net8.0` and `net8.0-windows`; release publishes are self-contained `win-x64` folders.
- **Node.js 22.18.x and npm**. `scripts/init_env.bat` checks the pinned Node major/minor and never installs software. Install Node.js 22.18.0, open a new terminal so PATH is refreshed, then retry if the check fails.
- **Microsoft Edge WebView2 Runtime** for either desktop host. Browser/Vite mode does not exercise the native bridge.

## Standard Windows Workflows

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `setup.bat` | Checks the SDK and npm, installs npm dependencies, builds the frontend and rule pack, builds both desktop hosts, then runs the C# tests. It does **not** run the Node AST converter tests. |
| `build-all.bat` | Builds the Vite assets, validates the rule pack, and builds Core, the main host, and the Rule Editor. |
| `run-tests.bat` | Runs the C# xUnit suite through the Core coverage gate and the focused Node suites. The CI clean-checkout gate runs as a separate final job step after build and test outputs settle. |
| `launch-app.bat` | Builds `dist/index.html` if needed and starts the main desktop host. |
| `launch-rule-editor.bat` | Builds `dist/rule-editor.html` if needed and starts the Rule Editor desktop host. |
| `start-dev.bat` | Starts Vite at port 5173. |
| `publish-release.bat <SemVer>` | Deterministically builds and publishes both desktop applications, validates the rule pack and dist assets, and packages with the pinned Velopack CLI. An explicit SemVer argument is required. |
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
node scripts/test_ast_converter.mjs
node scripts/verify_version.mjs
node scripts/verify_dist_assets.mjs
node scripts/verify_bundle_budget.mjs
node scripts/measure_bundle_graph.mjs
npm run test:coverage
```

`node scripts/build_rulepack.mjs` rewrites the baseline manifest when the pack is valid. It is therefore a source-tree mutation; inspect its diff before committing it. The test and build details, including the current native-UPZ limitation, live in [validation.md](validation.md).

## Publish a Release

Use the repository workflow rather than a hand-assembled publish command. The version is intentionally explicit so an automation run cannot silently publish an unexpected build:

```powershell
.\publish-release.bat 1.0.0
```

The checked-in [version metadata](../../version.json) is the authoritative application identity. It keeps the application version, DVL format version, document schema version, and Rule Pack version separate. `node scripts/verify_version.mjs` fails when package metadata drifts from that source. Release jobs may inject the explicitly requested SemVer into the frontend diagnostics build while retaining the same metadata contract.

The release workflow pins Velopack CLI `vpk` 1.2.0 and emits SHA-256 checksums plus CycloneDX/npm and .NET package SBOMs. The local publisher and CI job require an empty `Releases\` directory before packaging and verify the expected setup/archive/metadata/SBOM/checksum outputs afterward. Code signing is not prescribed by this repository; signing and certificate custody remain an external deployment decision.

The local publisher runs the locked frontend checks and the full .NET/Core coverage gate before it reaches either `dotnet publish` or Velopack packaging. A failing verification result therefore stops local release preparation before package output is produced.

It builds Vite, validates/hashes `resources/rulepack`, then runs these self-contained publishes:

```powershell
dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -o publish\AHUVerification
dotnet publish src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release -r win-x64 --self-contained true -o publish\RuleEditor
```

The outputs are self-contained deployable folders:

- `publish\AHUVerification\AHUVerification.App.exe` needs `dist\index.html`, `resources\rulepack\` (the five baseline members), and `resources\bin\unpack32.exe` plus `ywunpack.dll` for `.upz` extraction.
- `publish\RuleEditor\RuleEditor.exe` needs `dist\rule-editor.html` and `resources\rulepack\` (the five baseline members).

`src/backend/Directory.Build.targets` copies `dist/`, `resources/rulepack/`, and `version.json` to every Windows-host output and blocks publishing if any baseline rule-pack member is missing. The main App project separately blocks publishing when its local `resources/bin/unpack32.exe` or `ywunpack.dll` is missing. Both licensed native files are present in this checkout and are required for the main-App publish and native-UPZ path; their presence still does not replace the target-host lifecycle run.

The bundle-budget and startup-graph measurements are documented in [bundle-budget.md](bundle-budget.md). `vite.config.ts` uses relative asset URLs so file-based WebView launches resolve the same assets as hosted previews; `node scripts/verify_dist_assets.mjs` checks both HTML entries, `node scripts/verify_bundle_budget.mjs` enforces the checked-in uncompressed/gzip ceilings, and `node scripts/measure_bundle_graph.mjs` reports startup versus on-demand assets. A real installer first-launch/uninstall smoke and native WebView2 host run remain Windows release-environment gates.

Close both desktop applications before rebuilding or publishing: Windows can lock the executable and output files. Likewise, close an exported workbook in Excel before overwriting it; the OpenXML exporter reports an `IOException` telling the user to close the locked file and retry.
