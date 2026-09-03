# Remediation Plan: Detailer Verification List Project

## Overview
A phase-gated execution plan across 5 core remediation phases and comprehensive acceptance validation.

## Phase 0: Survey & Scope Mapping
- Dispatch 3 parallel Explorers:
  1. Explorer 1 (CI, Scripts & Toolchain): Investigate `.github/workflows/codex-verification.yml`, playwright tests, `build-all.bat`, `run-tests.bat`, `.gitignore`, test runners.
  2. Explorer 2 (Business Logic & Dual Engine): Investigate C# parsing / AST / calculation / export vs TypeScript browser preview implementations.
  3. Explorer 3 (Frontend Test Pyramid, Bridge & Fixtures): Investigate frontend unit/interaction tests, IPC bridge (`BridgeHandler` vs WebView2), and test fixtures.
- Synthesize findings into `PROJECT.md` (Feature Inventory, Architecture, Milestones, Code Layout, Interface Contracts) and `TEST_INFRA.md`.

## Phase 1: Unblock & Harden Codex Verification Loop (R1)
- Sub-orchestration / iteration for CI workflow, Playwright accessibility smoke test, .NET tests, `.gitignore` exclusions, and clean worktree guarantees.

## Phase 2: Eliminate Dual-Engine Divergence & Align Authoritative Business Logic (R2)
- Sub-orchestration / iteration for single authoritative C# calculation/parsing engine, decoupling browser preview fallback cleanly, and eliminating TS duplicate logic.

## Phase 3: Establish Truthful Frontend Test Pyramid & Quality Gates (R3)
- Sub-orchestration / iteration for reducer/formatter/validator unit tests, rendered component axe/focus tests, and build script validation parity.

## Phase 4: Harden Typed Bridge Protocol & Host Integration (R4)
- Sub-orchestration / iteration for IPC message schema validation, bidirectional error propagation, timeout handling, and catalog parity.

## Phase 5: Repository Fixture Sanitization, Boundaries & Ground Refresh (R5)
- Sub-orchestration / iteration for fixture isolation (`tests/fixtures/`), sanitization of proprietary data, pruning transient artifacts, and updating docs / `context-manifest.json`.

## Phase 6: Acceptance Gate & Dual Track Verification
- Run Gate 1 (CI & Workflow Integrity) & Gate 2 (Architecture & Contract Verification).
- Comprehensive verification and report back to parent.
