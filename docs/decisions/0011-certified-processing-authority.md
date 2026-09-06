# 11. Certified processing authority and noncertifying drafts

Date: 2026-09-05
Status: Accepted (authority decision; implementation acceptance remains pending)

## Context

Issues #2, #4, #11, #15, and #17 require one authority for certified processing. TypeScript and C# currently retain separate parsers, extractors, and evaluators. Their outputs disagree on some provenance metadata. A complete-state hash detects payload changes but does not by itself establish source authenticity, artifact availability, or final-export readiness.

This decision records the direction authorized by Phase 0 of the [remediation plan](../operations/remediation-plan.md). It supplements [ADR 0003](0003-rulepack-persistence-and-desktop-delivery.md), [ADR 0006](0006-manual-unit-graph-synthesis.md), and [ADR 0007](0007-typed-ipc-bridge-protocol.md). Where earlier records imply renderer processing or saving alone confers certification, this decision supersedes that implication; other decisions remain unchanged.

## Decisions

1. **Certified desktop processing belongs to `AHUVerification.Core`.** The Windows host supplies captured native source and a validated active Rule Pack to the Core parsing, normalization, fact/provenance extraction, applicability, and readiness pipeline. The host owns source binding, privileged actions, file selection, and final-export authorization. `VerificationHostService` is the application-service entry point; its existence does not establish that every call path is accepted.

2. **The renderer supplies user intent, not certified derived state.** It may submit typed overrides, checklist work, comments, and SQs under the validated contract. The host recomputes the resulting facts, applicability, and readiness. Renderer-provided XML, rule objects, facts, readiness flags, or output paths cannot independently authorize final output. Verification results must be correlated with the current session and active pack version/hash/generation before the UI accepts them.

3. **Browser processing remains an explicit noncertifying fallback.** TypeScript parsing/extraction/evaluation supports preview and interaction workflows. Retained common semantics must be tested against shared fixtures, including provenance and applicability, with any intentional preview differences documented individually. Browser exports remain visibly identified as previews. The Rule Editor must validate against the same supported rule contract and must not invent unsupported certified evaluator semantics.

4. **Manual and untrusted projects remain usable drafts.** Manual graph creation, editing, saving, and draft output must remain usable without raw source. They do not become certified merely because the UI is hosted on Windows, every checkbox is complete, or a file has been saved. The current remediation's certified path requires host-bound native source. A future certified manual workflow would require an explicit host-validated manual-source contract and acceptance evidence; this decision does not silently implement one. A failed source-binding check must not silently downgrade an attempted final export into a successful draft export.

5. **Persistence and certification are separate decisions.** A valid draft envelope can be saved while remaining noncertifying; malformed arbitrary JSON is not a valid draft. Saving/reopening must preserve verification-relevant state, source metadata, audit history, and actual pack identity. Tampered, legacy, mismatched, or artifact-unavailable state cannot become certified through rehashing or saving alone. Recovery requires the defined recomputation/migration and review path.

6. **Historical pack availability needs artifact evidence.** A manifest hash or boolean availability flag is not a retrievable template. Embed verified required bytes or resolve the exact immutable artifacts and verify their identity. Missing artifacts preserve noncertifying status. Successful local active-pack export alone does not prove historical project reproducibility.

7. **Authority and completion rules remain explicit.** Missing/malformed source is Unknown/RequiresConfirmation unless an approved derivation applies. Calculated weight is diagnostic and cannot clear weight readiness; authored/approved weight is distinct. Seismic/NOA/Knockdown confirmation remains a separate policy. Final readiness includes applicability, permitted N/A, checklist completion, and SQ completion. Native export validates a sibling temporary workbook before replacement.

## Consequences and verification

- The UI keeps its current workflows and stack, but no longer owns certified business decisions. Adapters and DTOs should remain small and explicit; this does not authorize a generalized orchestration framework.
- Retaining browser evaluation incurs a deliberate parity-testing obligation. Removing it is not part of Phase 0.
- Existing fixtures that depend on calculated-weight authority, arbitrary JSON saves, unsupported rule modes, or renderer-selected privileged paths must be reconciled with the contract and paired with rejection tests. Test assertions must not be weakened to obscure product defects.
- Current source partially implements this direction in `BridgeHandler`, `VerificationHostService`, and the DVL services. Renderer pack-response correlation, historical artifact proof, extraction parity, and complete workflow acceptance remain open. See the handoff and plan for volatile test results; this ADR is not a statement that the current tree is green.
- Acceptance requires the native import → override/revert → checklist/SQ completion → save/reopen → final Excel journey, negative trust/tamper cases, and retained-engine parity. Separate service and IPC smoke tests remain useful but do not alone prove that journey.
