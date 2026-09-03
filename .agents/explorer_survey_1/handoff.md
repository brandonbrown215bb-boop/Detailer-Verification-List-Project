# Explorer Survey Report: CI Workflow, Test Toolchains, and Dirty Worktree Causes

## 1. Observation

### 1.1 Git Branch & Workflow Architecture
* Branch `origin/ci/codex-verification-loop` (commit `f03a23f`) introduces `.github/workflows/codex-verification.yml`, `playwright.config.mjs`, and `tests/e2e/smoke.spec.mjs`.
* `.github/workflows/codex-verification.yml` defines 3 jobs:
  1. `verify` (lines 35-128, `runs-on: windows-2022`):
     - Executes `npm ci`, `npm run build`
     - Validates rule-pack integrity (lines 66-83)
     - Restores & builds 3 .NET targets: `AHUVerification.Core.csproj`, `AHUVerification.App.csproj`, `AHUVerification.RuleEditor.csproj`
     - Runs `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release --no-restore --logger "trx;LogFileName=ahu-verification.trx" --results-directory TestResults` (lines 92-93)
     - Executes 7 Node test scripts: `test_ast_converter.mjs`, `test_readiness.mjs`, `stress_test_readiness_adversarial.mjs`, `test_modal_accessibility.mjs`, `test_ingestion_feedback.mjs`, `test_copy_linter.mjs`, `test_responsive_contrast.mjs` (lines 95-108)
     - Validates worktree cleanliness (lines 104-112):
       ```powershell
       $dirty = git status --porcelain
       if ($dirty) {
         Write-Host $dirty
         Write-Error 'Verification modified tracked repository files.'
         exit 1
       }
       ```
     - Uploads `TestResults/` (lines 114-121) and `dist/` (lines 123-128).
  2. `browser` (lines 130-170, `runs-on: ubuntu-latest`):
     - `npm ci --no-audit --no-fund` (line 141)
     - `npm install --no-save --package-lock=false @playwright/test@1.55.0 @axe-core/playwright@4.10.2` (lines 143-144)
     - `npx playwright install --with-deps chromium` (line 146)
     - `npm run build` (line 148)
     - `npx playwright test` (line 151)
     - Uploads `playwright-report/` (lines 153-160) and `test-results/` (lines 162-169).
  3. `publish` (lines 172-228, `runs-on: windows-2022`):
     - Triggered on `workflow_dispatch` when `inputs.publish_artifacts` is true.
     - Runs `dotnet publish` for `AHUVerification.App` and `AHUVerification.RuleEditor` into `publish/AHUVerification` and `publish/RuleEditor`.
     - Validates presence of 6 critical binaries and assets (lines 208-221).

### 1.2 `.gitignore` Status & Missing Exclusions
* Path: `.gitignore` (lines 1-45):
  ```gitignore
  # Node / Web
  node_modules/
  dist/
  dist-ssr/
  *.local
  .npm
  *.tsbuildinfo

  # .NET / C#
  bin/
  obj/
  publish/
  [Dd]ebug/
  [Rr]elease/
  *.user
  *.userosscache
  *.sln.docstates
  *.suo
  .vs/
  ```
* Observations:
  - `TestResults/` is **NOT** present in `.gitignore`.
  - `playwright-report/` is **NOT** present in `.gitignore`.
  - `test-results/` is **NOT** present in `.gitignore`.
  - `.playwright/` is **NOT** present in `.gitignore`.
  - Running `dotnet test ... --results-directory TestResults` creates untracked files: `TestResults/ahu-verification.trx`.
  - `git status --porcelain` immediately outputs: `?? TestResults/`.

### 1.3 Rule Pack Manifest Generation & Timestamp Churn
* Path: `scripts/build_rulepack.mjs` (lines 108-135):
  ```javascript
  const bundleIdentity = REQUIRED_FILES.map(name => `${name}:${files[name].sha256}`).join('\n');
  const bundleSha256 = sha256(Buffer.from(bundleIdentity, 'utf8'));
  ...
  const manifest = {
    name,
    version,
    generatedAt: new Date().toISOString(),
    bundleSha256,
    files
  };
  const formattedManifest = normalizeLf(JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(manifestPath, formattedManifest, 'utf8');
  ```
* Observations:
  - `scripts/build_rulepack.mjs` writes a new `generatedAt` timestamp to `resources/rulepack/manifest.json` on **every single invocation**, even if rule definitions and template hashes (`bundleSha256`) are identical.
  - Direct diff after running `node scripts/build_rulepack.mjs`:
    ```diff
    --- a/resources/rulepack/manifest.json
    +++ b/resources/rulepack/manifest.json
    @@ -3,3 +3,3 @@
       "version": "14.0.0",
    -  "generatedAt": "2026-09-01T01:52:30.584Z",
    +  "generatedAt": "2026-09-02T12:25:50.644Z",
       "bundleSha256": "cdecf315b8dc55ed3eaed96c043dff8c8a03cdc73ef905764a25c39822ccaf0e"
    ```
  - In `codex-verification.yml` (line 83), CI explicitly performs `git restore -- resources/rulepack` to suppress this modification.
  - In `build-all.bat` (line 37), running `node scripts/build_rulepack.mjs` leaves `resources/rulepack/manifest.json` modified in the local developer's working tree.

### 1.4 `package.json` Dependencies & Test Scripts
* Path: `package.json` (lines 6-36):
  ```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "node scripts/test_readiness.mjs && node scripts/test_modal_accessibility.mjs && node scripts/test_ingestion_feedback.mjs && node scripts/test_copy_linter.mjs && node scripts/test_responsive_contrast.mjs",
    "test:readiness": "node scripts/test_readiness.mjs",
    "test:accessibility": "node scripts/test_modal_accessibility.mjs",
    "test:ingestion": "node scripts/test_ingestion_feedback.mjs",
    "test:copy": "node scripts/test_copy_linter.mjs",
    "test:contrast": "node scripts/test_responsive_contrast.mjs"
  }
  ```
* Observations:
  - `@playwright/test` and `@axe-core/playwright` are **omitted** from `devDependencies`.
  - `npm test` script omits `scripts/test_ast_converter.mjs` and `scripts/stress_test_readiness_adversarial.mjs`.
  - Local developers running `npm test` cannot run the E2E browser tests without manually installing Playwright.

### 1.5 Local Script Parity (`build-all.bat` & `run-tests.bat`)
* `build-all.bat`:
  - Builds Vite frontend, rule pack, `AHUVerification.Core`, `AHUVerification.App`, and `AHUVerification.RuleEditor`.
  - Leaves `manifest.json` dirty.
* `run-tests.bat`:
  - Runs `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj` (console output).
  - Runs 7 Node scripts (`test_ast_converter`, `test_readiness`, `stress_test_readiness_adversarial`, `test_modal_accessibility`, `test_ingestion_feedback`, `test_copy_linter`, `test_responsive_contrast`).
  - Does **NOT** execute Playwright or axe-core tests.
  - Does **NOT** verify clean worktree post-execution.

### 1.6 .NET Target Frameworks & Cross-Platform Behavior
* `src/backend/AHUVerification.Core/AHUVerification.Core.csproj`: `TargetFramework net8.0` (Cross-platform).
* `tests/AHUVerification.Tests/AHUVerification.Tests.csproj`: `TargetFramework net8.0` (Cross-platform).
* `src/backend/AHUVerification.App/AHUVerification.App.csproj`: `TargetFramework net8.0-windows`, `UseWindowsForms=true` (Windows-only).
* `src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj`: `TargetFramework net8.0-windows`, `UseWindowsForms=true` (Windows-only).
* Result: Running full solution builds on `ubuntu-latest` fails with `NETSDK1100: Windows Desktop is not supported on this platform`. CI correctly splits `verify` to `windows-2022` and `browser` to `ubuntu-latest`.

### 1.7 Playwright Config & Test Suite Analysis
* `playwright.config.mjs`:
  - Starts web server via `npm run dev -- --host 127.0.0.1 --port 4173`.
  - Configures HTML reporter to `playwright-report`.
  - Configures traces/screenshots/videos to `test-results/`.
* `tests/e2e/smoke.spec.mjs`:
  - Seeds localStorage (`dvl_detailer_name: 'CI Detailer'`, `dvl_theme_mode: 'light'`, removes `ahu_dvl_autosave`).
  - Test 1 (`home screen renders core launch options without console errors`): Verifies home heading, 4 buttons, rulepack version, and runs full axe-core scan on `/`.
  - Test 2 (`manual unit modal behaves as a real accessible dialog`): Opens `ManualUnitModal`, checks `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, verifies active element is trapped, scans dialog with axe-core, closes with `Escape`.
  - Test 3 (`Ctrl+K opens search and places focus inside the search dialog`): Clicks 'Load Demo Dataset', presses Ctrl+K, verifies focus on input in `OmniSearchModal`, scans dialog with axe-core.
  - Test 4 (`invalid XML import produces a durable visible error state`): Uploads invalid XML string `<not-an-ahu></not-an-ahu>`, verifies `role="alert"` and error messaging.
  - Test 5 (`narrow viewport remains horizontally contained on the home screen`): Verifies `scrollWidth <= clientWidth + 1`.

---

## 2. Logic Chain

```
[Observation 1.2: .gitignore lacks TestResults/, playwright-report/, test-results/, .playwright/]
   │
   ├──> [dotnet test generates TestResults/ahu-verification.trx]
   │       │
   │       └──> git status --porcelain reports "?? TestResults/"
   │               │
   │               └──> [CI check `$dirty = git status --porcelain; if ($dirty) exit 1`] FAILS on windows-2022
   │
   └──> [Playwright test generates playwright-report/ and test-results/]
           │
           └──> Post-test runs create dirty untracked directories, breaking clean worktree contracts

[Observation 1.3: build_rulepack.mjs stamps new timestamp generatedAt on every run]
   │
   └──> Running build_rulepack.mjs in local scripts (build-all.bat) or CI mutates manifest.json
           │
           └──> Leaves uncommitted changes in git status unless manually reverted or made idempotent

[Observation 1.4: devDependencies in package.json omit @playwright/test & @axe-core/playwright]
   │
   └──> CI uses ephemeral `npm install --no-save` on ubuntu-latest
           │
           ├──> Local test suites (npm test, run-tests.bat) have zero Playwright/axe coverage
           └──> Discrepancy exists between developer machine testing and CI validation gates

[Observation 1.6: AHUVerification.App & RuleEditor require net8.0-windows]
   │
   └──> Linux runners cannot build desktop host applications
           │
           └──> CI split (windows-2022 for .NET build/verify + ubuntu-latest for browser) is architecturally necessary
```

---

## 3. Caveats
- Browser execution in headless Linux environments requires Chromium OS dependencies installed via `npx playwright install --with-deps chromium`.
- In `playwright.config.mjs`, `webServer` executes `npm run dev` rather than `npm run preview`. Because `HomePage.tsx` conditionally hides "Load Demo Dataset" in production (`import.meta.env.PROD`), running against `vite preview` would hide the button and cause Test 3 to fail. The dev server behavior is intentional for demo/smoke access.
- `.agents/` contains both tracked documentation files and transient agent runtimes. Cleanliness checks in CI specifically target tracked repository files, but adding ignore rules for transient agent scratchpads prevents accidental dirty status.

---

## 4. Conclusion

The failures and risks in the CI verification loop and local test toolchains are caused by four specific issues:
1. **Missing `.gitignore` Entries**: Lack of `TestResults/`, `playwright-report/`, `test-results/`, and `.playwright/` directly causes the CI `verify` job on `windows-2022` to fail the `git status --porcelain` cleanliness check after `dotnet test`.
2. **Non-Idempotent Rule Pack Generator**: `scripts/build_rulepack.mjs` overwrites `generatedAt` unconditionally, creating synthetic git modifications upon every build.
3. **Missing Toolchain Dependencies in `package.json`**: `@playwright/test` and `@axe-core/playwright` must be added to `devDependencies` and locked in `package-lock.json` so that both CI and local developers use reproducible, pinned toolchains.
4. **Local Automation Gaps**: `run-tests.bat` and `package.json` test scripts must include all 7 Node scripts and provide optional Playwright execution, with an idempotent post-run clean state.

---

## 5. Verification Method

### 5.1 Independent Verification Commands

1. **Verify `.NET` Test Suite & `TestResults/` Generation**:
   ```powershell
   dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj -c Release --logger "trx;LogFileName=ahu-verification.trx" --results-directory TestResults
   git status --porcelain
   ```
   *Expected Current Failure*: `?? TestResults/` appears in `git status`.
   *Remediation Check*: Adding `TestResults/` to `.gitignore` ensures `git status --porcelain` remains clean.

2. **Verify Rule-Pack Manifest Idempotence**:
   ```powershell
   node scripts/build_rulepack.mjs
   git diff resources/rulepack/manifest.json
   ```
   *Expected Current Failure*: Diff shows updated `generatedAt` timestamp.
   *Remediation Check*: Idempotent build logic preserves timestamp when `bundleSha256` is unchanged.

3. **Verify Node Unit & Verification Scripts**:
   ```powershell
   node scripts/test_ast_converter.mjs
   node scripts/test_readiness.mjs
   node scripts/stress_test_readiness_adversarial.mjs
   node scripts/test_modal_accessibility.mjs
   node scripts/test_ingestion_feedback.mjs
   node scripts/test_copy_linter.mjs
   node scripts/test_responsive_contrast.mjs
   ```
   *Expected Result*: All 7 test scripts pass 100% cleanly.

4. **Verify Playwright E2E and Axe Accessibility**:
   ```powershell
   npm install --no-save @playwright/test@1.55.0 @axe-core/playwright@4.10.2
   npx playwright install --with-deps chromium
   npx playwright test
   ```
   *Expected Result*: 5 smoke specs execute with zero failures across `chromium-desktop` and `chromium-narrow`.

5. **Verify Windows Build Matrix**:
   ```powershell
   npm run build
   dotnet build src/backend/AHUVerification.Core/AHUVerification.Core.csproj -c Release
   dotnet build src/backend/AHUVerification.App/AHUVerification.App.csproj -c Release
   dotnet build src/backend/AHUVerification.RuleEditor/AHUVerification.RuleEditor.csproj -c Release
   ```
   *Expected Result*: 100% clean builds with zero warnings treated as errors.
