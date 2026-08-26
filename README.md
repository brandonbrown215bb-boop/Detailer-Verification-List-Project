# AHU Detailing Verification System

A high-performance Windows desktop application and engineering rule studio built for Air Handling Unit (AHU) detailers and engineering leads. 

The system ingests engineering unit configurations (`Config.xml` or `.upz` unit package bundles), processes facts through a 4-state provenance-aware registry, evaluates scoped verification checklists against declarative AST rules, enables detailers to manage Special Quotes (SQs) and component checks, and generates official `Detailing Verification List.xlsx` workbooks for checkers via OpenXML.

---

## ⚡ Quick Start (1-Click Launchers)

The root directory contains pre-configured Windows batch files for instant launching and common operations without needing to remember CLI arguments:

| Launcher / Script | Purpose | Quick Action |
| :--- | :--- | :--- |
| 🎛️ **[`menu.bat`](menu.bat)** | **Command Center** — Interactive numeric menu for all operations | Double-click to launch menu |
| 🚀 **[`launch-app.bat`](launch-app.bat)** | **Detailing Verification Desktop App** (.NET 10 + WebView2) | Direct app launch |
| 🛠️ **[`launch-rule-editor.bat`](launch-rule-editor.bat)** | **Rule & Logic Editor Studio** (`RuleEditor.exe`) | Direct editor launch |
| 🌐 **[`start-dev.bat`](start-dev.bat)** | **Vite Web Dev Server** (Fast HMR on `localhost:5173`) | Launch dev web server |
| 🏗️ **[`build-all.bat`](build-all.bat)** | **Full Build** (Frontend + Rule Pack + All .NET Projects) | Rebuild entire solution |
| 🧪 **[`run-tests.bat`](run-tests.bat)** | **Run Automated Tests** (xUnit + AST Converter tests) | Execute test suites |
| 📦 **[`publish-release.bat`](publish-release.bat)** | **Publish Production Releases** to `publish\` | Build release packages |
| ⚙️ **[`setup.bat`](setup.bat)** | **Environment Setup & Verification** | Validate environment |

---

## 📋 Batch Files Reference

| Script | Description | Underlying Command |
| :--- | :--- | :--- |
| [`menu.bat`](menu.bat) | Interactive terminal hub to launch apps, trigger builds, run tests, or publish with single keypresses. | Multi-action interactive menu |
| [`launch-app.bat`](launch-app.bat) | Starts the main AHU Detailing Verification desktop host. Automatically compiles web assets into `dist\` if missing. | `dotnet run --project src/backend/AHUVerification.App/AHUVerification.App.csproj` |
| [`launch-rule-editor.bat`](launch-rule-editor.bat) | Starts the Rule & Logic Editor Desktop Studio. Automatically compiles web assets into `dist\` if missing. | `dotnet run --project src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj` |
| [`start-dev.bat`](start-dev.bat) | Starts the Vite dev server with Hot Module Reloading for live frontend development. | `npm run dev` |
| [`build-all.bat`](build-all.bat) | Compiles TypeScript frontend, regenerates Rule Pack manifest, and builds all C# .NET projects. | `npm run build` + `node scripts/build_rulepack.mjs` + `dotnet build` |
| [`build-frontend.bat`](build-frontend.bat) | Compiles TypeScript and packages frontend single-page application into `dist\`. | `npm run build` |
| [`build-backend.bat`](build-backend.bat) | Builds all C# .NET projects (`Core`, `App`, and `RuleEditor`). | `dotnet build` |
| [`build-rulepack.bat`](build-rulepack.bat) | Validates rule definitions and regenerates canonical LF-normalized SHA-256 integrity hashes in `manifest.json`. | `node scripts/build_rulepack.mjs` |
| [`run-tests.bat`](run-tests.bat) | Executes xUnit automated verification tests and Node.js AST converter test suite. | `dotnet test` + `node scripts/test_ast_converter.mjs` |
| [`publish-release.bat`](publish-release.bat) | Generates production release distributions in `publish\AHUVerification` and `publish\RuleEditor`. | `dotnet publish -c Release -r win-x64` |
| [`setup.bat`](setup.bat) | Verifies .NET 10 SDK & Node.js prerequisites, installs dependencies, builds all binaries, and runs verification tests. | Comprehensive validation |

---

## 📂 Repository Structure

```text
Detailer-Verification-List-Project/
├── menu.bat                          # Interactive Command Center
├── launch-app.bat                    # 1-Click Desktop App Launcher
├── launch-rule-editor.bat            # 1-Click Rule Editor Launcher
├── start-dev.bat                     # 1-Click Vite Dev Server
├── build-all.bat                     # Complete Solution Build
├── build-frontend.bat                # Vite + TypeScript Web Build
├── build-backend.bat                 # .NET Core/App/Editor Build
├── build-rulepack.bat                # Rulepack Validation & Hashing
├── run-tests.bat                     # xUnit & AST Test Suite Runner
├── publish-release.bat               # Production Release Publisher
├── setup.bat                         # Full Environment Setup
│
├── src/
│   ├── App.tsx                       # Main Detailing Verification SPA interface
│   ├── ruleEditor/                   # Rule & Logic Editor visual interface
│   ├── components/                   # Reusable React UI components
│   ├── services/                     # IPC Bridge, Rulepack API, and Fact resolvers
│   ├── rulepack/                     # Baseline Rule Pack definitions & manifests
│   │   ├── rules.json                # Semantic verification rules & JSON-AST predicates
│   │   ├── template_map.json         # Physical cell mappings for Excel output
│   │   ├── approved_mappings.json    # Confirmed equipment & component code mappings
│   │   ├── template.xlsx             # Official baseline Excel template
│   │   └── manifest.json             # SHA-256 integrity hash bundle manifest
│   │
│   └── backend/
│       ├── AHUVerification.Core/     # Domain Engine: XML parsing, Fact Registry, AST Evaluator, OpenXML Patcher
│       ├── AHUVerification.App/      # Main Desktop Host (.NET 10 + WebView2 Form + Typed IPC Bridge)
│       └── AHUVerification.RuleEditor/ # Rule Studio Host (.NET 10 + WebView2 Form + Rule Sync Bridge)
│
├── tests/
│   └── AHUVerification.Tests/        # xUnit Test Suite (XML Parser, Rulepack, OpenXML, Persistence)
│
├── scripts/
│   ├── build_rulepack.mjs            # Manifest generator and SHA-256 canonical hasher
│   └── test_ast_converter.mjs        # AST converter unit test runner
│
├── resources/
│   ├── bin/                          # Native decompressor binaries (unpack32.exe, ywunpack.dll)
│   └── rulepack/                     # Packaged baseline rulepack distribution bundle
│
├── docs/
│   └── architecture/                 # Technical architecture documentation & diagrams
└── publish/                          # Built release distributions (generated by publish-release.bat)
```

---

## 🛠️ Prerequisites & Requirements

- **Operating System**: Windows 10 (Build 19041+) or Windows 11 x64
- **.NET SDK**: [.NET 10 SDK](https://dotnet.microsoft.com/download) (or later)
- **Node.js**: [Node.js v18+](https://nodejs.org/) and `npm`
- **WebView2 Runtime**: Included by default in Windows 10/11 (or install the Evergreen WebView2 Runtime)

---

## 💻 Development Workflows

### 1. Developing Frontend Interfaces (Live Reload)
1. Double-click [`start-dev.bat`](start-dev.bat) to launch the Vite development server.
2. In your browser or WebView2 host, open:
   - **Detailing Verification UI**: `http://localhost:5173/`
   - **Rule & Logic Editor Studio**: `http://localhost:5173/rule-editor.html`
3. Any changes saved in `src/` will hot-reload instantly.

### 2. Developing Desktop Hosts & .NET Backend
1. Double-click [`launch-app.bat`](launch-app.bat) to launch the desktop application in Debug mode.
2. When the Vite dev server is running, the desktop app automatically connects to `http://localhost:5173` for live development; otherwise, it serves the packaged assets from `dist\`.
3. To rebuild backend code after modifications, run [`build-backend.bat`](build-backend.bat).

### 3. Editing & Validating Rules
1. Launch the Studio via [`launch-rule-editor.bat`](launch-rule-editor.bat).
2. Edit condition trees, test AST rules in the sandbox against sample configurations, and save.
3. Run [`build-rulepack.bat`](build-rulepack.bat) to verify schema adherence and re-calculate SHA-256 hashes across `manifest.json`.

### 4. Running Automated Tests
Run [`run-tests.bat`](run-tests.bat) before submitting changes. This executes:
- **xUnit Automated Tests**:
  - `XmlParserTests`: Full normalization and structural integrity of `Config.xml`.
  - `UpzExtractorTests`: Native `unpack32.exe` / `ywunpack.dll` bundle extraction and `OrderRev.xml` parsing.
  - `FactRegistryTests`: Provenance tracking, confidence states, and strict weight semantics.
  - `AstEvaluatorTests`: Scoped rule predicate execution across Unit, Skid, Segment, and Component scopes.
  - `RulePackManagerTests`: Tamper detection, LF-normalization, missing artifact rejection, and atomic sync.
  - `DvlProjectTests`: `.dvl` project file roundtrip persistence and atomic file replacement.
  - `OpenXmlPatcherTests`: Dynamic category pruning, dynamic skid row synthesis, and formula adaptation.
- **Node.js AST Converter Tests**:
  - Predicate generation, roundtrip AST conversion, and required fact derivation.

### 5. Packaging & Deploying Releases
1. Run [`publish-release.bat`](publish-release.bat).
2. Standalone release packages will be generated in:
   - `publish\AHUVerification\AHUVerification.App.exe`
   - `publish\RuleEditor\RuleEditor.exe`
3. All dependencies, `dist\` web assets, `resources\rulepack\` files, and native decompression tools are bundled automatically.

---

## 🔒 Key Invariants & Architectural Principles

1. **Local-First & Offline Resilience**: Both applications function 100% offline with local rule packs if network shares are unavailable.
2. **Strict Skid Weight Semantics**: Aggregate skid weight is never guessed or auto-calculated unless authored. Missing weights evaluate dependent rules to `Needs Input`.
3. **No Speculative Code Mappings**: Unrecognized equipment codes are recorded as `RequiresConfirmation` and never silently guessed.
4. **Decoupled Rule Keys**: Verification rules reference abstract semantic keys (e.g. `BASE_LIFTING_LUG_SUPPORT`), never hardcoded Excel cell addresses. `template_map.json` handles cell translation during workbook synthesis.
5. **OpenXML Formula Adaptation**: Category scratchpad sheets with zero applicable checks are pruned, and dependent formulas on `Check Information` are adapted dynamically to prevent `#REF!` errors.

---

## 📖 Further Documentation

For in-depth architectural specifications, sequence diagrams, and schema contracts, see:
- [**Architecture Documentation**](docs/architecture/README.md)
