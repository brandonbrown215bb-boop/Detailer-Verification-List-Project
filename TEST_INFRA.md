# E2E Test Infra: Detailer Verification List Project

## Test Philosophy
- Opaque-box and requirement-driven test verification derived directly from `ORIGINAL_REQUEST.md`.
- Comprehensive multi-tier test pyramid:
  - **Tier 1: Feature Coverage (Isolation)**: Direct verification of core functions (XML parsing, AST evaluation, rule pack hashing, bridge serialization, readiness computation).
  - **Tier 2: Boundary & Corner Cases**: Empty inputs, malformed XML, missing properties, invalid schemas, zero/negative values, extreme file sizes, timeout conditions.
  - **Tier 3: Cross-Feature Combinations**: Ingestion -> Fact Extraction -> Rule Evaluation -> Override -> Deliverable Generation -> Clean Worktree.
  - **Tier 4: Real-World Application Workloads**: Full end-to-end user workflows (e2e smoke tests, manual unit creation, search dialog, modal accessibility, rule editor condition conversion).
  - **Tier 5: Adversarial Hardening**: Stress testing fact resolution matrices, edge cases in formula zeroing, schema fuzzing.

## Feature Inventory & Test Mapping
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|---------------------|:------:|:------:|:------:|:------:|
| 1 | .gitignore & Worktree Cleanliness | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Rulepack Generator Idempotence | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Package.json Toolchain | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Single-Path XML Parser & Defaults | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | ThermalBreak Logic Alignment | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 6 | Browser Preview Decoupling | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 7 | Frontend Unit Test Pyramid | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 8 | Rendered Component & Axe Tests | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 9 | Local Automation Scripts Parity | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 10 | Typed Bridge Schema Validation | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 11 | Bridge Error & ID Preservation | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 12 | Fixture Isolation & Sanitization | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| 13 | Documentation & Manifest Parity | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Backend Test Runner**: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release`
- **Frontend Test Runner**: `npm test` (running all node unit/property test suites in `scripts/`)
- **E2E & Accessibility Runner**: `npx playwright test`
- **Verification Scripts**: `node scripts/test_ast_converter.mjs`, `node scripts/test_readiness.mjs`, `node scripts/stress_test_readiness_adversarial.mjs`, `node scripts/test_modal_accessibility.mjs`, `node scripts/test_ingestion_feedback.mjs`, `node scripts/test_copy_linter.mjs`, `node scripts/test_responsive_contrast.mjs`
- **Pass/Fail Semantics**: All test suites must exit with code `0`. Worktree must remain strictly clean (`git status --porcelain` is empty).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Clean CI Verification Loop | F1, F2, F3, F9 | High |
| 2 | XML Ingest to Fact Extraction to Deliverable Export | F4, F5, F6, F10, F11 | High |
| 3 | Accessible Modal Dialog Navigation (Escape, Tab Trap, Axe) | F8, F7 | Medium |
| 4 | OmniSearch & Keyboard Shortcut Activation | F8, F7 | Medium |
| 5 | Manual Unit Synthesis & Custom Inspection | F4, F6, F7 | High |
