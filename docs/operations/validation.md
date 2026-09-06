# Validation

## Automated Checks

Run all commands from the repository root.

```powershell
call scripts\init_env.bat
node scripts/verify_version.mjs
npm run build
node scripts/verify_dist_assets.mjs
node scripts/verify_bundle_budget.mjs
node scripts/measure_bundle_graph.mjs
node scripts/test_fact_contract.mjs
node scripts/test_dvl_canonical.mjs
npm run test:coverage
node scripts/build_rulepack.mjs
npm test
```

The C# suite is discovered by xUnit at runtime; keep the documented command current without pinning a volatile test count. It covers AST predicates, `.dvl` serialization and atomic replacement, fact provenance, OpenXML patching, rule-pack integrity, XML parsing, and UPZ extraction. The Node suites cover the fact contract, canonical DVL format, visual-tree-to-AST conversion, round-tripping, reducers, readiness, accessibility source checks, and bridge parity. `npm test` is the aggregate command for those Node checks.

The Playwright suite under `tests/e2e/` exercises the built Vite pages in a browser and includes rendered accessibility assertions. It is browser coverage of packaged assets; it does not certify the native WebView2 host, installer lifecycle, or target-host file dialogs.

`npm run test:coverage` runs the full Release C# suite with coverlet and enforces the named Core line/branch floors in [`coverage-baseline.json`](coverage-baseline.json). It writes the Cobertura report and TRX log under ignored `TestResults/coverage-core/`. The baseline is a ratchet: a module may improve, but a floor may not be lowered without an explicit contract decision.

### Native-UPZ boundary

The UPZ tests require the licensed `unpack32.exe` and `ywunpack.dll` under the test process's `resources/bin` directory. The App project carries those files and the shared build target stages them for Windows hosts; verify the test output contains both before treating UPZ coverage as green. A missing native binary is a failed prerequisite, not a passing or waived test.

### Common failures

| Symptom | Meaning and next action |
| --- | --- |
| `unpack32.exe not found in tools directory` | Confirm the licensed native assets exist under `src/backend/AHUVerification.App/resources/bin/` and are copied into the test output before rerunning the UPZ tests. |
| `dist\\index.html is missing` or `dist\\rule-editor.html is missing` during publish | Run `npm run build`; the two hosts require different Vite entry pages. |
| Baseline rule-pack manifest/member error during publish | Run `node scripts/build_rulepack.mjs`, then inspect any changed manifest before continuing. |
| `IOException` naming an `.xlsx` file in use | Close the workbook in Excel (and any viewer holding it) and export again. |
| Vite/esbuild cannot read a directory or load `vite.config.ts` | This can be an execution-sandbox or filesystem-permission problem. Re-run in a normal local developer shell before treating it as a source failure. |
| `WebViewHostSmokeTests` times out | The native WebView2 smoke requires an interactive Windows host with the built entries available. Treat a timeout as an environment or host failure to investigate; it is not covered by the browser harness or the Core coverage floors. |

## Publish-package checks

After a successful `publish-release.bat <SemVer>`, inspect both folders and `Releases\`. The main host must contain `AHUVerification.App.exe`, `dist/index.html`, `dist/rule-editor.html`, all five `resources/rulepack` members, `version.json`, and `resources/bin/unpack32.exe` plus `ywunpack.dll`. The Rule Editor must contain `RuleEditor.exe`, `dist/rule-editor.html`, the five `resources/rulepack` members, and `version.json`. Both are self-contained `win-x64` publishes; validate on a Windows x64 machine with WebView2 Runtime installed. `Releases\` should contain exactly one `*-Setup.exe`, the Rule Editor archive, checksums, and dependency SBOMs.

## Agent Ground Freshness and Rules

Run `status` before trusting architecture documentation. `verify` is an assertion after reading and correcting the scoped notes; it is not a substitute for source inspection.

If the environment has `PLUGIN_ROOT`, use:

```powershell
python "$env:PLUGIN_ROOT\scripts\agent_ground.py" status .
python "$env:PLUGIN_ROOT\scripts\agent_ground.py" verify . --yes
```

If `PLUGIN_ROOT` is not set, locate the installed `agent_ground.py` and pass its literal path instead. In this Codex installation it is under the Agent Ground plugin cache; do not copy that machine-specific path into repository automation. If Python or the plugin is unavailable, record that the freshness check could not run and use current source/tests as the authority.


