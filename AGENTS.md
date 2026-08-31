<!-- AGENT_GROUND_START -->
## Repository Ground

- Read `docs/architecture/README.md` and relevant ADRs before substantial changes. `.agents/state/current.md` is an optional, ignored runtime checkpoint; when absent, continue without it.
- Run the Agent Ground status script/skill before trusting architecture notes. Stale notes are orientation only; current source and tests win.
- If `.codegraph/` exists, use CodeGraph before source exploration. It is optional; otherwise use `rg` and direct source inspection.
- Keep boundaries cohesive and testable. Split by responsibility, not ceremony.
- Preserve unrelated work and generated/source boundaries.
- Update documentation when shipped behavior changes. State limitations plainly.
- Record durable project decisions in ADRs. Keep transient task state out of durable documentation.

## Quick Verification

- Frontend: `npm run build`
- Rule-pack manifest after rule-pack edits: `node scripts/build_rulepack.mjs`
- Backend/tests: `dotnet test tests/AHUVerification.Tests/AHUVerification.Tests.csproj`
- Full local workflow: `build-all.bat` and `run-tests.bat`
<!-- AGENT_GROUND_END -->
