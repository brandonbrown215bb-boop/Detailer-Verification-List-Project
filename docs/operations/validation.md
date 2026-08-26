# Validation

## Automated Verification

- **Automated C# Test Suite (20 Tests)**:
  ```powershell
  dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj
  ```
  Test suites cover:
  - `AstEvaluatorTests`: Predicate logic, truth tables, and strict weight semantics.
  - `DvlProjectTests`: Roundtrip persistence serialization, atomic file replacement, and relative path rejection.
  - `FactRegistryTests`: Provenance audit trail, confidence gates, and fact overrides.
  - `OpenXmlPatcherTests`: Dynamic category scratchpad pruning, formula adaptation, and skid row rendering.
  - `RulePackManagerTests`: Missing/tampered member rejection, line ending normalization, and bundle SHA validation.
  - `UpzExtractorTests`: Native UPZ container decompression, XML extraction, and order metadata parsing.
  - `XmlParserTests`: Structural graph extraction from `Config.xml`.

- **Frontend TypeScript / Rollup Build Validation**:
  ```powershell
  npm run build
  ```

- **Rule Pack Bundle Regeneration & Integrity Verification**:
  ```powershell
  node scripts/build_rulepack.mjs
  ```

- **OpenXML Schema & Package Roundtrip Spike**:
  ```powershell
  dotnet run --project spike/OpenXmlSpike
  ```

## Agent Ground Freshness & Rules
- **Check Ground Status**:
  ```powershell
  python "$env:PLUGIN_ROOT\scripts\agent_ground.py" status .
  ```
- **Verify Architecture Context**:
  ```powershell
  python "$env:PLUGIN_ROOT\scripts\agent_ground.py" verify . --yes
  ```


