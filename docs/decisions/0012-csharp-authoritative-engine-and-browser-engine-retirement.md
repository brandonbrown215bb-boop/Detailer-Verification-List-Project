# 12. C# Authoritative Engine and Browser Engine Retirement

Date: 2026-09-06
Status: Accepted (supersedes ADR 0011's dual-engine requirement and browser-processing obligation)

## Context

[ADR 0011](0011-certified-processing-authority.md) designated `AHUVerification.Core` as the authority for certified processing while preserving a parallel TypeScript/browser engine for previews, manual projects, and drafts. Maintaining two separate domain engines (parsers, fact extractors, rule evaluators, readiness calculators, DVL serializers, and Excel exporters) created a permanent cross-runtime parity testing burden, introduced subtle discrepancies in edge-case evaluations, and left draft workflows dependent on client-side JavaScript execution.

Under the [C# Authoritative Engine Plan](../operations/csharp-authoritative-engine-plan.md), the system moves to a unified architecture where C#/.NET 8 is the sole engine for all project processing—including imported and manual projects, verification, persistence/recovery, Rule Editor testing/validation, and Excel generation. The React/TypeScript application inside WebView2 is strictly a presentation and interaction layer.

## Decisions

1. **C# `AHUVerification.Core` is the sole authoritative domain engine.**
   All unit parsing, relational graph construction, fact/provenance extraction, rule evaluation, checklist state transitions, Special Quote management, readiness computation, project serialization (.dvl), crash recovery, and Excel deliverable generation (.xlsx) are implemented and executed exclusively in C#.

2. **Retire standalone browser processing.**
   The parallel TypeScript engine components (`browserPreviewIngestion.ts`, `xmlParser.ts`, domain logic in `factRegistry.ts`/`factContract.ts`, `ruleEvaluator.ts`, `manualUnitFactory.ts`, `projectStorage.ts`, `excelExporter.ts`, and business decision logic in `readiness.ts`) will be systematically retired and deleted. Production will no longer offer a browser-side processing fallback.

3. **Both Draft and Final exports are owned by C# OpenXML.**
   "Draft" is a project eligibility mode (for manual or uncertified projects), not a runtime indicator. Both draft and certified deliverables are generated natively by C# OpenXML with identical formatting and layout integrity guarantees.

4. **React and WebView2 are strictly presentation and buffer layers.**
   The frontend collects user inputs, renders views, manages local focus/accessibility, and buffers pending typing. Domain state mutations are dispatched as typed commands to the C# project session, which returns authoritative snapshots. If the desktop host bridge is absent or unavailable, the application displays a desktop-host-required screen rather than falling back to browser processing.

5. **Single active session lifecycle and monotonic revision tracking.**
   The host manages one active `ProjectSession` at a time. All session mutations carry an expected revision number. Stale writes are rejected with conflict diagnostics and the current authoritative snapshot to prevent race conditions and ensure UI state consistency.

6. **Manual projects synthesize through C# Core.**
   Manual unit creation configures skids and segments via the existing React wizard, but the structural graph, facts, and checklists are synthesized and validated in C# Core under existing certification policies.

## Consequences

- The cross-runtime parity testing burden between TypeScript and C# is permanently eliminated.
- Domain assertion tests reside in xUnit `.NET` test suites. Frontend tests focus on presentation, accessibility, form validation, and component interaction using fixed host snapshot fixtures.
- Browser-only dependencies (such as `xlsx` and `file-saver` on the frontend) can be removed once migration slices complete, reducing bundle size and security attack surface.
- Offline and packaging verification requires the native Windows WebView2 host.
