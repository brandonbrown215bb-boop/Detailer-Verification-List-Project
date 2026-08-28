# Handoff Report: Explorer 1 Documentation Gap Audit (Group 1)

**Working Directory**: `.agents/teamwork_preview_explorer_g1/`  
**Handoff Type**: Hard (Task Complete)  
**Deliverables**: `analysis.md`, `handoff.md`, `progress.md`, `BRIEFING.md`

---

## 1. Observation

Direct observations and ground-truth verifications across repository source files, project configs, scripts, and documentation:

1. **Target Documents Inspected**:
   - `README.md` (159 lines)
   - `PROJECT.md` (59 lines)
   - `AGENTS.md` (12 lines)
   - `GEMINI.md` (6 lines)
   - `docs/architecture/README.md` (136 lines)
   - `docs/decisions/README.md` (15 lines)
   - `docs/decisions/0001-ahu-verification-desktop-architecture.md` (47 lines)
   - `docs/decisions/0002-ui-ux-design-specification.md` (56 lines)
   - `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md` (46 lines)

2. **Phantom Path `src/rulepack/` in `README.md`**:
   - `README.md:65-70` lists:
     ```text
     │   ├── rulepack/                     # Baseline Rule Pack definitions & manifests
     │   │   ├── rules.json                # Semantic verification rules & JSON-AST predicates
     │   │   ├── template_map.json         # Physical cell mappings for Excel output
     │   │   ├── approved_mappings.json    # Confirmed equipment & component code mappings
     │   │   ├── template.xlsx             # Official baseline Excel template
     │   │   └── manifest.json             # SHA-256 integrity hash bundle manifest
     ```
   - Tool `list_dir` on `c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\src\rulepack` returned: `directory ... does not exist`. Canonical files exist exclusively in `resources/rulepack/`.

3. **Target Framework Version Discrepancies**:
   - `README.md:98`: `.NET SDK: .NET 10 SDK (or later)`
   - `PROJECT.md:5`: `C# .NET 10 Core Engine`
   - `docs/architecture/README.md:17`: `Windows desktop application (.NET 10 + WebView2)`
   - `docs/decisions/0001-ahu-verification-desktop-architecture.md:43`: `Standardized on .NET 10 (net10.0-windows / net10.0)`
   - Direct inspection of all four project files:
     - `src/backend/AHUVerification.App/AHUVerification.App.csproj:21`: `<TargetFramework>net8.0-windows</TargetFramework>`
     - `src/backend/AHUVerification.Core/AHUVerification.Core.csproj:4`: `<TargetFramework>net8.0</TargetFramework>`
     - `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj:13`: `<TargetFramework>net8.0-windows</TargetFramework>`
     - `tests/AHUVerification.Tests/AHUVerification.Tests.csproj:4`: `<TargetFramework>net8.0</TargetFramework>`
     - `scripts/init_env.bat:23`: `Please install the .NET SDK v8.0 or later`

4. **Stale Project Identity in `PROJECT.md`**:
   - `PROJECT.md:1`: `# Project: Code Duplication Audit & DRY Remediation`
   - `PROJECT.md:13-40`: Feature Inventory lists 24 code duplication clusters from previous code duplication audit.
   - `PROJECT.md:41-48`: Milestones list M0 Survey to M3 Review for duplication audit, completely displacing AHU Detailing Verification system specs.

5. **Ghost Paths in Architecture Scope**:
   - `docs/architecture/README.md:4-10`: Frontmatter lists `implementation_plan.md` and `spike/**`.
   - Tool `find_by_name` for `*implementation_plan*` and `*spike*` returned 0 results across the repository.

6. **IPC Action Mismatches in Architecture Docs**:
   - `docs/architecture/README.md:82` claims 11 actions: `getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `parseXml`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `syncRulePack`.
   - Direct inspection of `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs:65-80` and `src/services/desktopBridge.ts`:
     - `parseXml` is NOT an IPC action (handled client-side in `xmlParser.ts`).
     - `checkRulePackUpdate` and `selectFolderDialog` are actively handled in `BridgeHandler.cs:76-78` but missing from `docs/architecture/README.md`.

7. **ADR 0003 MSBuild Claim Contradiction**:
   - `docs/decisions/0003-rulepack-persistence-and-desktop-delivery.md:44-45` states: `ValidatePackagedAssets enforces that dist/index.html, all 5 resources/rulepack/ files, and both resources/bin/ native binaries exist prior to publish.`
   - `src/backend/AHUVerification.App/AHUVerification.App.csproj:28-32` contains:
     ```xml
     <Target Name="ValidatePackagedAssets" BeforeTargets="PrepareForPublish">
       <Error Condition="!Exists('$(MSBuildProjectDirectory)\..\..\..\dist\index.html')" Text="Run 'npm run build' before publishing; dist\index.html is missing." />
       <Error Condition="!Exists('$(MSBuildProjectDirectory)\resources\bin\unpack32.exe')" Text="Native UPZ decompressor unpack32.exe is missing from resources\bin\." />
       <Error Condition="!Exists('$(MSBuildProjectDirectory)\resources\bin\ywunpack.dll')" Text="Native UPZ decompressor ywunpack.dll is missing from resources\bin\." />
     </Target>
     ```
     No `resources/rulepack/` files are checked in the target.

8. **Missing Agent Ground Contracts**:
   - `AGENTS.md:4` commands reading `.agents/state/current.md`, which does not exist.
   - `AGENTS.md:5` commands running `Agent Ground status`, which is not an executable CLI command in PATH.

---

## 2. Logic Chain

1. **Premise 1**: Documentation must accurately reflect repository reality for automated agents and developers to build, test, and navigate the system without runtime failures or misleading paths (supported by Observation 2, 3, 5, 6, 7).
2. **Premise 2**: Referencing `src/rulepack/` (Observation 2) directly causes agents looking for rule definitions to search non-existent paths, as files actually reside in `resources/rulepack/`.
3. **Premise 3**: Claiming `.NET 10` (Observation 3) while `.csproj` files configure `net8.0` causes tooling confusion regarding C# language features, MSBuild targets, and SDK prerequisites.
4. **Premise 4**: Leaving `PROJECT.md` as an audit log of a previous duplication task (Observation 4) violates `AGENTS.md` Rule 10 ("Keep transient task state out of durable documentation") and prevents onboarding agents from understanding current project features and milestones.
5. **Premise 5**: Ghost paths in `docs/architecture/README.md` (Observation 5) and incorrect IPC actions (Observation 6) break automated architectural indexing and IPC extension efforts.
6. **Premise 6**: Claiming MSBuild validates rulepack files when `.csproj` does not (Observation 7) creates a false sense of build safety during releases.
7. **Conclusion**: 31 specific documentation gaps were categorized into 8 Critical Blockers, 15 Moderate Slowdowns, and 8 Minor issues in `analysis.md`, each with concrete impact descriptions and 1-sentence fixes.

---

## 3. Caveats

- **Scope Boundary**: This audit was strictly focused on Group 1 documents (`README.md`, `PROJECT.md`, `AGENTS.md`, `GEMINI.md`, `docs/architecture/README.md`, `docs/decisions/README.md`, and ADRs 0001–0003). ADRs 0004–0009, operations guides (`docs/operations/*`), and historical audit reports (`docs/AHU_Verification_E2E_Workflow_Audit.md`, etc.) are assigned to other explorers.
- **Read-Only Constraint**: In accordance with the Explorer archetype instructions, no source code or primary documentation files were modified; all findings and fix proposals are documented in `analysis.md`.
- **Naming Context**: ADRs 0002 and 0003 were originally queried under working titles `0002-rules-engine-selection.md` and `0003-hybrid-excel-read-strategy.md` in the user prompt; the actual files present in the repo are `0002-ui-ux-design-specification.md` and `0003-rulepack-persistence-and-desktop-delivery.md`. Both the historical context and actual files were thoroughly audited.

---

## 4. Conclusion

The Group 1 documentation audit is complete with 31 validated findings:
- **8 Blockers (Critical)**: `[BLOCKER-01]` to `[BLOCKER-08]` covering non-existent rulepack paths, .NET 8 vs .NET 10 TFM contradictions, corrupted `PROJECT.md` task state, dead architecture frontmatter paths, broken IPC action inventories, conflicting ADR-0001 TFMs, and phantom MSBuild packaging targets.
- **15 Slowdowns (Moderate)**: `[SLOW-01]` to `[SLOW-15]` covering browser preview degraded modes, unstated manifest re-hashing prerequisites for unit tests, missing `Agent Ground` CLI documentation, unstated UPZ 32-bit execution assumptions, missing rule editor sync workflows, ADR lifecycle guidelines, autosave ambiguity, SQ overflow handling, and LKG rollback storage.
- **8 Minor Findings**: `[MINOR-01]` to `[MINOR-08]` covering test helper omissions, layout omissions, subagent build references, `GEMINI.md` passthrough context, frontmatter hash markers, ADR title aliases, default filename fallbacks, and RuleEditor packaging notes.

All 31 findings follow the required 5-field schema and are fully detailed in `analysis.md`.

---

## 5. Verification Method

To independently verify all findings:
1. **Rulepack Directory Verification**:
   ```powershell
   Test-Path "src/rulepack"           # Returns False
   Test-Path "resources/rulepack"     # Returns True
   ```
2. **TargetFramework Verification**:
   ```powershell
   Get-Content "src/backend/AHUVerification.Core/AHUVerification.Core.csproj" | Select-String "TargetFramework"
   # Returns <TargetFramework>net8.0</TargetFramework>
   ```
3. **Build & Test Verification**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
   node scripts/test_ast_converter.mjs
   npm run build
   ```
4. **IPC Bridge Action Inspection**:
   Inspect `src/backend/AHUVerification.App/Bridge/BridgeHandler.cs` (lines 65–80) to confirm `parseXml` is absent and `checkRulePackUpdate` / `selectFolderDialog` are present.
5. **MSBuild Target Inspection**:
   Inspect `src/backend/AHUVerification.App/AHUVerification.App.csproj` (lines 28–32) to confirm absence of `resources/rulepack/` checks.
