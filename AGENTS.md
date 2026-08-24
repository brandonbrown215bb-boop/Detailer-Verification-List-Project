<!-- AGENT_GROUND_START -->
## Repository Ground

- Read `docs/architecture/README.md`, relevant ADRs under `docs/decisions/`, and `.agents/state/current.md` when present before substantial changes.
- Run Agent Ground `status` before trusting architecture notes. Stale notes are orientation only; current source and tests win.
- If `.codegraph/` exists, use CodeGraph before grep or manual source wandering for code structure and call paths.
- Keep boundaries cohesive and testable. Split by responsibility, not ceremony.
- Preserve unrelated work and generated/source boundaries.
- Update documentation when shipped behavior changes. State limitations plainly.
- Record durable project decisions in ADRs. Keep transient task state out of durable documentation.
<!-- AGENT_GROUND_END -->
