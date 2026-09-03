# DISPATCH — explorer_survey_1

## 2026-09-02T12:47:23Z

Investigate the CI workflow, test execution, toolchains, and dirty worktree causes:
1. Check `.github/workflows/codex-verification.yml`, `.gitignore`, `package.json`, `build-all.bat`, `run-tests.bat`, `scripts/build_rulepack.mjs`, playwright config, Playwright test suite, axe-core setup.
2. Investigate why Playwright UI/accessibility tests and .NET tests fail on CI or clean environments (`windows-2022` and `ubuntu-latest`).
3. Identify all generated test artifacts (e.g. `TestResults/`, `playwright-report/`, `test-results/`, rule-pack manifest churn, build output) causing dirty worktree after test runs.
4. Check local automation scripts (`build-all.bat`, `run-tests.bat`) for parity with CI validation gates.
