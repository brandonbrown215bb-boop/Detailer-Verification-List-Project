# Validation

## Automated Checks

Run all commands from the repository root.

```powershell
dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj --logger "console;verbosity=normal"
node scripts/test_ast_converter.mjs
npm run build
node scripts/build_rulepack.mjs
```

The C# suite currently discovers **29** tests. It covers AST predicates, `.dvl` serialization and atomic replacement, fact provenance, OpenXML patching, rule-pack integrity, XML parsing, and UPZ extraction. `node scripts/test_ast_converter.mjs` separately checks visual-tree-to-AST conversion, round-tripping, and required-fact extraction. The removed `spike/OpenXmlSpike` project is not a validation target; OpenXML coverage lives in `OpenXmlPatcherTests`.

### Current native-UPZ boundary

`UpzExtractorTests.Extract_ValidUpz_ExtractsXmlsAndParsesMetadata` and `XmlParserTests.Parse_All18UpzExamples_ExtractsWithoutExceptions` require `unpack32.exe` under the test process's `resources/bin` directory. The test project does not stage that executable, and this checkout also lacks `src/backend/AHUVerification.App/resources/bin/`. On this checkout, expect 27 passes and these two failures with `FileNotFoundException: unpack32.exe not found in tools directory`.

This is a code/package-layout defect, not a test success condition. Do not mark native UPZ validation green until the binary is supplied under the App project and copied into the test output (or the extractor is given an explicit test tools directory).

### Common failures

| Symptom | Meaning and next action |
| --- | --- |
| `unpack32.exe not found in tools directory` | See the native-UPZ boundary above. Restore the licensed native assets and repair test staging before treating those tests as required-green. |
| `dist\\index.html is missing` or `dist\\rule-editor.html is missing` during publish | Run `npm run build`; the two hosts require different Vite entry pages. |
| Baseline rule-pack manifest/member error during publish | Run `node scripts/build_rulepack.mjs`, then inspect any changed manifest before continuing. |
| `IOException` naming an `.xlsx` file in use | Close the workbook in Excel (and any viewer holding it) and export again. |
| Vite/esbuild cannot read a directory or load `vite.config.ts` | This can be an execution-sandbox or filesystem-permission problem. Re-run in a normal local developer shell before treating it as a source failure. |

## Publish-package checks

After a successful `publish-release.bat`, inspect both folders. The main host must contain `AHUVerification.App.exe`, `dist/index.html`, all five `resources/rulepack` members, and `resources/bin/unpack32.exe` plus `ywunpack.dll`. The Rule Editor must contain `RuleEditor.exe`, `dist/rule-editor.html`, and the five `resources/rulepack` members. Both are framework-dependent `win-x64` publishes, so validate on a Windows x64 machine with the .NET 8 runtime and WebView2 Runtime installed.

## Agent Ground Freshness and Rules

Run `status` before trusting architecture documentation. `verify` is an assertion after reading and correcting the scoped notes; it is not a substitute for source inspection.

If the environment has `PLUGIN_ROOT`, use:

```powershell
python "$env:PLUGIN_ROOT\scripts\agent_ground.py" status .
python "$env:PLUGIN_ROOT\scripts\agent_ground.py" verify . --yes
```

If `PLUGIN_ROOT` is not set, locate the installed `agent_ground.py` and pass its literal path instead. In this Codex installation it is under the Agent Ground plugin cache; do not copy that machine-specific path into repository automation. If Python or the plugin is unavailable, record that the freshness check could not run and use current source/tests as the authority.


