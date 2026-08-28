# Handoff Report: Operations, Guides, and Historical Audits / Reports

**Auditor:** Explorer 3  
**Date:** 2026-08-28  
**Working Directory:** `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\teamwork_preview_explorer_g3`  
**Detailed Report:** `.agents/teamwork_preview_explorer_g3/analysis.md`  

---

## 1. Observation

Direct observations and evidence across all 8 audited documents and repository source code:

1. **Target Framework Mismatch**:
   - `docs/operations/development.md:4` requires `.NET 10 SDK`.
   - `docs/documentation_staleness_report.md:22` claims code is standardized on `.NET 10 (net10.0 / net10.0-windows)`.
   - `audits/code_duplication_audit.md:36` cites `.NET 10 Desktop Engine`.
   - In reality, `src/backend/AHUVerification.App/AHUVerification.App.csproj:21` specifies `<TargetFramework>net8.0-windows</TargetFramework>`, `src/backend/AHUVerification.Core/AHUVerification.Core.csproj:4` specifies `<TargetFramework>net8.0</TargetFramework>`, `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj:13` specifies `<TargetFramework>net8.0-windows</TargetFramework>`, and `tests/AHUVerification.Tests/AHUVerification.Tests.csproj:4` specifies `<TargetFramework>net8.0</TargetFramework>`.

2. **Publish Command and Output Divergence**:
   - `docs/operations/development.md:42` specifies `dotnet publish src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o artifacts/publish/win-x64`.
   - `publish-release.bat:47,57` specifies publishing `AHUVerification.App` to `publish\AHUVerification` and `AHUVerification.RuleEditor` to `publish\RuleEditor` with `--self-contained false`.

3. **Dead Project Reference in Validation Runbook**:
   - `docs/operations/validation.md:30` specifies `dotnet run --project spike/OpenXmlSpike`.
   - File search for `spike` returned 0 results. Executing this command fails with `MSB1009: Project file does not exist`.

4. **Test Suite Count Discrepancy**:
   - `docs/operations/validation.md:5` cites `Automated C# Test Suite (20 Tests)`.
   - `audits/code_duplication_audit.md:1228` cites `15 passed`.
   - `docs/documentation_staleness_report.md:89` cites `20 Passed`.
   - Running `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` executed `28 Passed, 0 Failed, 0 Skipped, Total: 28`.

5. **Fact Confidence Rating Contradiction**:
   - `docs/field_derivation_report.md:164-165` states `skid.weight` has `status: Derived`, `confidence: RequiresConfirmation`.
   - `docs/AHU_Verification_E2E_Workflow_Audit.md:198-200` states `skid.<id>.weight` has `confidence: RequiresConfirmation` and causes `BASE-01` to evaluate to `NeedsInput`.
   - In code, `src/backend/AHUVerification.Core/Services/FactExtractor.cs:698` and `src/services/factRegistry.ts:568` assign `FactConfidence.Authoritative` (`'Authoritative'`).

6. **Historical Document Drift and Obsolete Directories**:
   - `docs/documentation_staleness_report.md:44-45` heavily references `docs/roolz/template.xlsx` and `docs/roolz/manifest.json`.
   - Searching for `roolz` in the repository returned 0 matches; `scripts/build_rulepack.mjs:9` only interacts with `resources/rulepack`.

7. **Context Manifest Scoping Restriction**:
   - `docs/context-manifest.json:5` only lists `docs/architecture/README.md` and references `verified_at_commit: 7a8ff4489f01b6891c1e32721737176353fb976b`.
   - Git log shows HEAD is at `7cd24b5` (7 commits ahead), and 0 operational guides or audit reports are tracked.

---

## 2. Logic Chain

1. **Prerequisite & Toolchain Confusion**:
   - *Observation 1* shows documentation states .NET 10 is required, but code targets .NET 8.
   - *Inference*: A fresh AI agent will attempt to validate or build using .NET 10 flags/runtimes and report false version drift or fail in environments where only .NET 8 is installed.

2. **Broken Release Automation**:
   - *Observation 2* demonstrates that `development.md` directs output to `artifacts/publish/win-x64` and omits the Rule Editor, while the repo batch script uses `publish\AHUVerification` and `publish\RuleEditor`.
   - *Inference*: Relying on `development.md` produces an incomplete, broken release package missing the secondary desktop studio and misplacing binaries.

3. **CI / Test Pipeline Failures**:
   - *Observation 3 & 4* show that `validation.md` points to non-existent projects (`spike/OpenXmlSpike`) and reports 20 tests instead of 28.
   - *Inference*: Running validation commands literally will throw build errors, and validating test metrics will fail verification gates.

4. **Safety & Gating Misunderstanding**:
   - *Observation 5* proves that documentation asserts calculated skid weights require manual confirmation before `BASE-01` can pass, whereas actual runtime code immediately marks calculated weight as Authoritative.
   - *Inference*: Agents auditing verification behavior will falsely flag `BASE-01` auto-evaluation as a bug or misinterpret the user interaction requirements.

5. **Stale Ground Context**:
   - *Observation 7* shows `context-manifest.json` is 7 commits behind and ignores 7 of the 8 audited files.
   - *Inference*: Agent Ground freshness tooling cannot guarantee architectural alignment across operations and guides without expanding its scope.

---

## 3. Caveats

- **No Caveats**: All 8 assigned documents were read in full and compared directly against live source code, tests, batch scripts, and project files in the working directory.
- No source code was modified during this investigation in accordance with the read-only exploration constraint.

---

## 4. Conclusion

The documentation set across Operations, Guides, and Historical Audits suffers from 31 distinct gaps categorized into **7 Blockers**, **16 Slowdowns**, and **8 Minor Issues**.
The most critical issues stem from:
1. Pervasive documentation-first claims of .NET 10 migration while all projects target .NET 8 (`net8.0` / `net8.0-windows`).
2. Contradictory publish paths and missing Rule Editor operational guidance.
3. Dead CLI commands targeting non-existent directories (`spike/OpenXmlSpike`).
4. Fact provenance divergence on calculated skid weights (`RequiresConfirmation` in docs vs `Authoritative` in code).
5. A restricted and stale `context-manifest.json` tracking only a single file at an older commit.

All findings have been formatted with actionable 1-sentence fix notes in `.agents/teamwork_preview_explorer_g3/analysis.md`.

---

## 5. Verification Method

To independently verify the observations and findings:

1. **Verify Target Frameworks in Projects**:
   ```powershell
   Select-String -Path "src/backend/*/*.csproj", "tests/*/*.csproj" -Pattern "<TargetFramework>"
   ```
   *Expected*: Shows `net8.0` and `net8.0-windows`, proving .NET 8 targeting.

2. **Verify Automated Test Suite Pass and Count**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
   ```
   *Expected*: 28 passed tests (not 20).

3. **Verify Non-Existence of Spike Directory**:
   ```powershell
   Test-Path spike
   ```
   *Expected*: Returns `False`.

4. **Verify Fact Extractor Skid Weight Confidence in Code**:
   ```powershell
   Select-String -Path "src/backend/AHUVerification.Core/Services/FactExtractor.cs" -Pattern 'skid\..*\.weight' -Context 0,7
   Select-String -Path "src/services/factRegistry.ts" -Pattern 'skid\..*\.weight' -Context 0,7
   ```
   *Expected*: Shows `FactConfidence.Authoritative` and `'Authoritative'`.

5. **Verify Context Manifest Commit Delta**:
   ```powershell
   git rev-parse HEAD
   Get-Content docs/context-manifest.json
   ```
   *Expected*: HEAD is `7cd24b5...`, while manifest specifies `7a8ff44...`.
