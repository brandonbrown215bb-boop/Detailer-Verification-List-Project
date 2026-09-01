# E2E & Live Validation Infra: AHU Detailing Verification UI/UX

## Test Philosophy
- Multi-tier validation combining requirement-driven opaque-box testing, live Node.js automated test runners, TypeScript compile verification, rulepack hash/manifest integrity, and backend C# xUnit test execution.
- Fast, reproducible, self-contained verification without heavy third-party CI dependencies.

---

## Feature Inventory & Test Coverage Mapping
| # | Feature | Requirement | Tier 1 (Unit/Logic) | Tier 2 (Boundary/Edge) | Tier 3 (Integration) | Tier 4 (Workload) |
|---|---------|-------------|:-------------------:|:----------------------:|:--------------------:|:-----------------:|
| 1 | Readiness & Facts Synchronization | R1 | `test_readiness.mjs` (5+ tests) | All facts confirmed vs 15 weights missing | Header/Sidebar/Preflight parity | Multi-skid UPZ project verification |
| 2 | Dialog Accessibility & Focus Trap | R2 | Focus trap hook unit test | Empty dialogs, rapid Open/Escape | OmniSearch instant typing + restore | Modal navigation workflow |
| 3 | File Ingestion & Action Feedback | R3 | Ingestion state machine tests | Corrupted XML, non-existent files | Loading spinner + Error banner | Native bridge fallback |
| 4 | Copy, LaTeX & Enum Sanitization | R4 | `test_copy_linter.mjs` (5+ regexes) | Edge-case strings ($N \ge 1$, PascalCase) | Zero LaTeX across all source files | Production bundle scan |
| 5 | Responsive Columns & Theme Contrast | R5 | Contrast ratio math validator | Subdued text in Light & Dark | Table header reflow at 1086px | Standard 1426x893 resolution test |

---

## Automated Validation Test Suites
1. **Frontend Type Safety & Bundle Compilation**:
   - Command: `npm run build`
   - Validates 0 TypeScript compile errors, valid CSS bundle generation, and bundle size sanity.
2. **Readiness Predicate Live Test Runner**:
   - Command: `node scripts/test_readiness.mjs`
   - Validates that `computeUnitReadiness` yields identical counts across Header, Sidebar, Resolution Center, and Preflight Modal under diverse fact configurations (empty, missing weights, confirmed, unconfirmed, overrides).
3. **Copy & Terminology Linter**:
   - Command: `node scripts/test_copy_linter.mjs`
   - Scans all `src/` files for forbidden strings (`$N \ge 1$`, `Download .dvl`, raw unformatted enums, leaked implementation jargon).
4. **AST Converter & Rulepack Manifest Validator**:
   - Command: `node scripts/build_rulepack.mjs && node scripts/test_ast_converter.mjs`
   - Validates that all 104 rules compile, SHA-256 hashes match, and AST evaluator operators execute correctly.
5. **Backend xUnit Test Suite**:
   - Command: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`
   - Validates 29/29 C# tests across XML parsing, UPZ extraction, DVL serialization, rule pack integrity, and OpenXML spreadsheet deliverables.

---

## Unified Test Runner Command
All automated test suites are integrated into `run-tests.bat` and can be executed via:
```cmd
npm run build && node scripts/build_rulepack.mjs && node scripts/test_ast_converter.mjs && node scripts/test_readiness.mjs && node scripts/test_copy_linter.mjs && dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
```
