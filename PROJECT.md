# Project: Detailer Verification List Project Remediation

## Architecture
The repository is an AHU (Air Handling Unit) Detailing Verification desktop and web application built with a dual architecture:
- **Frontend**: TypeScript, React 18, Tailwind CSS, Vite. Located in `src/`. Provides interactive checklist verification, skid visualization, fact overrides, manual unit creation, and a rule editor.
- **Backend Core**: .NET 8 C# Class Library in `src/backend/AHUVerification.Core/`. Provides authoritative XML parsing (`NormalizedXmlParser`), fact extraction (`FactExtractor`), AST predicate rule evaluation (`AstRuleEvaluator`), OpenXML Excel deliverable synthesis (`OpenXmlTemplatePatcher`), UPZ archive decompression (`UpzBundleExtractor`), and atomic project persistence (`DvlProjectManager`).
- **Backend Host Applications**: Windows Forms + Microsoft Edge WebView2 hosts in `src/backend/AHUVerification.App/` and `src/backend/AHUVerification.RuleEditor/`. Bridge messages via `BridgeHandler.cs` and `RuleEditorBridgeHandler.cs`.
- **Rule Pack Subsystem**: JSON-based rule pack in `resources/rulepack/` managed and fingerprinted via SHA-256 by `scripts/build_rulepack.mjs` and verified at runtime by `RulePackManager.cs`.
- **Testing Pyramid**:
  - Backend xUnit tests in `tests/AHUVerification.Tests/`.
  - Frontend Node unit and property/adversarial test scripts in `scripts/`.
  - Playwright E2E and axe-core accessibility smoke test suite in `tests/e2e/`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | .gitignore Test Artifact Exclusions | Exclude `TestResults/`, `playwright-report/`, `test-results/`, `.playwright/` to prevent dirty git status after tests | M1 | Survey (Explorer 1) |
| 2 | Idempotent Rule Pack Generator | Make `scripts/build_rulepack.mjs` preserve `generatedAt` when `bundleSha256` is unchanged to avoid git diff churn | M1 | Survey (Explorer 1) |
| 3 | Package.json Toolchain Dependencies | Add `@playwright/test` and `@axe-core/playwright` to `devDependencies` in `package.json` | M1 | Survey (Explorer 1) |
| 4 | Clean CI Workflow Verification | Verify `.github/workflows/codex-verification.yml` across Windows and Linux runners | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Single Authoritative XML Defaults | Eliminate hardcoded sample values (`31376`, `6.26`, `411`, `110`, `194`) in `src/services/xmlParser.ts`, strictly default to `0` | M2 | Survey (Explorer 2) |
| 6 | ThermalBreak Semantic Alignment | Align `thermalBreak` logic in `xmlParser.ts` with C# `NormalizedXmlParser.cs` (`rawStyle.Contains("ThermalBreak") || !rawStyle.Equals("Standard")`) | M2 | Survey (Explorer 2) |
| 7 | Decoupled Browser Preview Mode | Explicit `INativeBridge` abstraction separating `WebView2DesktopBridge` from `BrowserPreviewBridge`, with clear watermarking on browser export | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Cross-Engine Parity Verification | Ensure zero silent divergence between TS and C# fact derivation and rule evaluations | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Frontend Unit Test Expansion | Implement truthful unit tests for state reducers, formatters, readiness validators, and AST converters | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Rendered Component & Axe Tests | Implement real rendered DOM component tests and dialog focus trap / axe-core accessibility verification | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Local Automation Script Parity | Update `build-all.bat` and `run-tests.bat` to mirror CI validation gates and include all test suites | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Bridge IPC Schema Validation | Enforce runtime validation on all IPC request/response payloads between WebView2 frontend and C# `BridgeHandler` | M4 | ORIGINAL_REQUEST §R4 |
| 13 | Bridge Error Propagation & Request ID Preservation | Ensure failed deserialization and execution preserves `id` in `BridgeResponse` to prevent frontend promise hangs | M4 | Survey (Explorer 3) |
| 14 | Bridge Action Catalog Parity & xUnit Tests | Align action catalogs across `BridgeHandler`, `RuleEditorBridgeHandler`, and `desktopBridge.ts`; add xUnit tests in `tests/AHUVerification.Tests/` | M4 | ORIGINAL_REQUEST §R4 |
| 15 | Test Fixture Directory Isolation | Move `Config.xml` and `UPZ_Unit_Examples/` into `tests/fixtures/` and update all path helpers | M5 | ORIGINAL_REQUEST §R5 |
| 16 | UPZ Sanitization & Portable Paths | Ensure test fixtures contain no proprietary data and remove hardcoded developer paths in `UpzBundleExtractor.cs` | M5 | ORIGINAL_REQUEST §R5 |
| 17 | Architecture & Context Manifest Refresh | Update `docs/context-manifest.json`, `docs/architecture/README.md`, and ADRs to match verified repository state | M5 | ORIGINAL_REQUEST §R5 |
| 18 | Acceptance Gate 1 & 2 Validation | Full validation of Gate 1 (CI & workflow integrity) and Gate 2 (Architecture & contract verification) | M6 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Phase 1: Unblock & Harden Codex Verification Loop | Features 1, 2, 3, 4 (.gitignore, build_rulepack.mjs, package.json, CI workflow) | none | DONE |
| M2 | Phase 2: Eliminate Dual-Engine Divergence & Align Business Logic | Features 5, 6, 7, 8 (TS parser defaults, thermalBreak parity, bridge abstraction, parity verification) | M1 | DONE |
| M3 | Phase 3: Establish Truthful Frontend Test Pyramid & Quality Gates | Features 9, 10, 11 (Unit tests, rendered component axe/focus tests, script parity) | M1, M2 | DONE |
| M4 | Phase 4: Harden Typed Bridge Protocol & Host Integration | Features 12, 13, 14 (IPC schema validation, error propagation, catalog parity, xUnit bridge tests) | M1, M2 | DONE |
| M5 | Phase 5: Repository Fixture Sanitization, Boundaries & Ground Refresh | Features 15, 16, 17 (tests/fixtures/ isolation, path portability, docs & manifest refresh) | M1, M2, M3, M4 | IN_PROGRESS |
| M6 | Phase 6: Acceptance Gate & Dual Track Verification | Feature 18 (Full Gate 1 & Gate 2 validation, clean worktree verification) | M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts

### TypeScript Frontend <-> C# BridgeHandler IPC Contract
- Request wire envelope:
  ```typescript
  interface BridgeRequest<T = any> {
    id: string;        // UUIDv4
    action: string;    // Action identifier
    payload?: T;       // Action-specific payload
  }
  ```
- Response wire envelope:
  ```typescript
  interface BridgeResponse<T = any> {
    id: string;        // Echoes BridgeRequest.id (MUST NEVER be empty, even on deserialization error)
    success: boolean;  // True if executed successfully
    data?: T;          // Action-specific response payload
    error?: string;    // Error message if success === false
  }
  ```
- Supported Actions:
  - `getAppInfo`: Returns host version and platform metadata.
  - `getRulePack`: Returns active rule pack contents and hash.
  - `openFileDialog`: Opens native file picker (`filter`, `title`).
  - `saveFileDialog`: Opens native save picker (`defaultName`, `filter`, `title`).
  - `extractUpz`: Extracts UPZ archive to temp workspace.
  - `saveDvl`: Persists `.dvl` project bundle atomically.
  - `exportExcelDeliverable`: Generates OpenXML deliverable from `template.xlsx`.
  - `openFile`: Opens file with default system handler.
  - `showInExplorer`: Selects file in Windows File Explorer.
  - `checkRulePackUpdate`: Checks remote UNC/SharePoint staged rule pack.
  - `syncRulePack`: Atomic sync with LKG rollback.
  - `selectFolderDialog`: Opens folder browser dialog.
  - `launchRuleEditor`: Spawns RuleEditor executable.
  - `publishRulePack` (RuleEditor only): Publishes edited rule pack with integrity verification.

### XML Parser & Fact Registry Semantic Contract
- Missing numeric fields (`cabLength`, `cabHeight`, `cabWidth`, `unitWeight`, `totalStaticPressure`) strictly default to `0`.
- `thermalBreak` boolean rule: `rawStyle.Contains("ThermalBreak") || !rawStyle.Equals("Standard")` (case-insensitive).
- Override provenance: User overrides maintain timestamp, author, previous value, and audit trail across both engines.

## Code Layout
- Frontend: `src/` (Components, Services, Utils, RuleEditor)
- Backend Core: `src/backend/AHUVerification.Core/` (Parsers, Services, Models)
- Backend Hosts: `src/backend/AHUVerification.App/` (WinForms + WebView2), `src/backend/AHUVerification.RuleEditor/`
- Tests:
  - C# xUnit tests: `tests/AHUVerification.Tests/`
  - Playwright E2E & Accessibility: `tests/e2e/`
  - Isolated test fixtures: `tests/fixtures/`
- Scripts & Toolchain: `scripts/`, `build-all.bat`, `run-tests.bat`, `.github/workflows/codex-verification.yml`
- Documentation: `docs/`, `docs/architecture/`, `docs/decisions/`, `docs/context-manifest.json`
