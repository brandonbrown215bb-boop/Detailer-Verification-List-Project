# Original User Request

## 2026-09-02T12:46:17Z

Execute a phase-gated, hardened remediation plan to resolve CI/action failures on `ci/codex-verification-loop`, merge default-branch quality gates, eliminate dual-engine divergence, and establish durable engineering ground across the repository.

Working directory: c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project
Integrity mode: development

## Requirements

### R1. Phase 1 — Unblock & Harden Codex Verification Loop (CI & Smoke Tests)
- Resolve the failing Playwright UI/accessibility smoke suite and .NET test execution on `origin/ci/codex-verification-loop`.
- Update `.gitignore` to exclude test artifacts (`TestResults/`, `playwright-report/`, `test-results/`) so that post-test dirty worktree checks pass reliably.
- Verify end-to-end CI workflow (`.github/workflows/codex-verification.yml`) on clean runners across Windows (`windows-2022`) and Linux (`ubuntu-latest`).
- Merge or fast-forward verified CI workflow to `master`.

### R2. Phase 2 — Eliminate Dual-Engine Divergence & Align Authoritative Business Logic
- Establish a single authoritative calculation and parsing path (C# core engine) for fact extraction, AST evaluation, and Excel export.
- Cleanly decouple browser preview mode from production engine execution; ensure browser fallback mechanisms are either strictly parity-tested or transparently delegated to the native host bridge.
- Remove duplicate or competing business logic implementations across TypeScript and C#.

### R3. Phase 3 — Establish Truthful Frontend Test Pyramid & Quality Gates
- Implement robust unit tests for state reducers, formatters, readiness validators, and AST converters.
- Implement rendered component and dialog interaction tests with focus management and axe-core accessibility guarantees.
- Ensure all local automation scripts (`build-all.bat`, `run-tests.bat`) mirror CI validation gates exactly.

### R4. Phase 4 — Harden Typed Bridge Protocol & Host Integration
- Enforce schema validation on all IPC messages between WebView2 frontend and C# `BridgeHandler`.
- Ensure complete bidirectional error propagation, graceful timeout handling, and catalog parity across all bridge actions.

### R5. Phase 5 — Repository Fixture Sanitization, Boundaries & Ground Refresh
- Isolate UPZ/XML test data under `tests/fixtures/` and ensure public fixtures contain no sensitive or proprietary data.
- Prune transient agent artifacts and update architecture documentation and `context-manifest.json` to reflect the final verified state.

## Acceptance Criteria

### Gate 1: CI & Workflow Integrity
- [ ] `npm ci && npm run build` completes with zero TypeScript or packaging errors.
- [ ] `node scripts/build_rulepack.mjs` succeeds with valid bundle SHA-256 and zero uncommitted manifest churn.
- [ ] `dotnet build` and `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release` pass 100% cleanly on Windows runners.
- [ ] Playwright E2E and Axe accessibility smoke tests execute cleanly with zero critical or serious violations.
- [ ] `git status --porcelain` is strictly empty after running the complete test and build matrix.

### Gate 2: Architecture & Contract Verification
- [ ] Core business logic has one authoritative implementation without silent divergence between desktop and browser modes.
- [ ] All desktop bridge methods have corresponding integration/unit tests validating typed message payloads.
- [ ] All existing verification scripts (readiness, AST converter, copy linter, responsive/contrast audits) pass 100%.
- [ ] Repository documentation and `docs/context-manifest.json` accurately match the codebase state.
