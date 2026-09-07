# Verification infrastructure

Run commands from the repository root. Use the Node version specified by `package.json` and the .NET 8 SDK. `AHUVerification.sln` contains Core, both Windows hosts, and the test project.

## What each check proves

| Check | Classification | Evidence and limits |
| --- | --- | --- |
| `npm run build` | Compilation and bundling | TypeScript compatibility and both Vite entries; does not establish runtime behavior. |
| Node readiness, reducer, AST, and contract tests | Unit/regression | Execute domain functions against fixed and adversarial inputs. |
| Node copy, layout, and source-pattern checks | Structural lint | Inspect source text or color mathematics; do not prove rendered accessibility, IPC, or end-to-end behavior. |
| `dotnet test AHUVerification.sln` | Unit and service integration | Real C# parsing, fact extraction, evaluation, DVL persistence, Rule Pack validation, and OpenXML workbook assertions. Windows is required for host-referencing tests. |
| `CanonicalParityAcceptanceTests` | C# Canonical Specification | Validates canonical JSON formatting, semantic fingerprinting, full-state persistence hash integrity, and sparse source parsing in pure C#. |
| `GoldenProductionPathTests` | Native service integration | UPZ extraction through host processing, persistence, and workbook generation. Calling services directly is not a WebView2 user journey. |
| `npx playwright test` | Rendered browser integration | Keyboard, focus, axe, and modal navigation behavior against built presentation assets. Desktop host is required for live processing. |
| Publish asset checks | Packaging validation | Required files and local asset references are present. File presence does not prove application startup or installation. |
| `npm run test:coverage` | Measured Core regression gate | Runs the full C# suite with coverlet and enforces the named line/branch floors in [`docs/operations/coverage-baseline.json`](docs/operations/coverage-baseline.json). It does not waive failing tests or certify the native desktop lifecycle. |

Tests must fail when a required assertion, fixture, or native tool is absent. A zero exit code without discovered/executed tests is not evidence. Avoid optional assertions that silently skip a required control or workflow.

## Local verification

```powershell
npm run build
npm test
node scripts/test_fact_contract.mjs
node scripts/test_dvl_canonical.mjs
npm run test:coverage
npx playwright test
npm run test:dist
npm run test:bundle
```

After Rule Pack edits, run `node scripts/build_rulepack.mjs` and inspect its changes. A second generation must produce identical bytes. CI additionally requires committed generated output; an intentionally dirty local remediation tree is not a clean-checkout test.

`npm run test:coverage` runs the Release C# suite with `coverlet.collector 6.0.4`, writes Cobertura/TRX output under ignored `TestResults/coverage-core/`, and enforces the observed floors in [`docs/operations/coverage-baseline.json`](docs/operations/coverage-baseline.json). The baseline names the critical Core pipeline classes rather than asserting a whole-repository percentage. Lowering a floor requires a reviewed contract change; coverage never replaces negative-case assertions.

## Release acceptance

Use `build-all.bat`, `run-tests.bat`, and the documented local packaging command after integration. Keep installation, first launch, offline packaged assets, native Rule Editor launch, real WebView2 IPC/export, and uninstall evidence distinct from browser and service tests. Record any unexecuted target-host checks explicitly in the current handoff; passing unit tests do not waive them.

Generated reports, screenshots, coverage files, publish output, and temporary test data belong in ignored output directories. Durable fixtures belong under `tests/fixtures`; retained root UPZ examples are existing native integration inputs and require a separate provenance/sanitization decision before public redistribution.
