# AHU Detailing Verification UI/UX Review

This folder records a hands-on review of the running Windows/WebView2 application on 2026-08-31. The review exercised the shipped debug desktop host as a user; it is not a source-only critique and it does not rewrite the frontend.

## Review artifacts

- [Consolidated findings](findings.md) — executive summary, prioritized top ten, accessibility, information design, workflows, responsive behavior, visual system, AI-slop audit, strengths, and recommendations.
- [Interaction matrix](interaction-matrix.md) — what was opened, clicked, typed, resized, and observed, including test limits.
- [Per-screen notes](screen-notes.md) — observations tied to the 17 captured states.
- [Screenshots](screenshots/) — raw review evidence captured from the running product.

## Build and environment

- Host: `src/backend/AHUVerification.App/bin/Debug/net8.0-windows/AHUVerification.App.exe`
- Window title: `AHU Detailing Verification Desktop Application`
- Main observed desktop size: 1426 × 893 application pixels
- Wide/maximized observation: 1920 × 1032 application pixels
- Narrow snapped observation: 1086 × 1032 application pixels
- Rule pack shown by the product: v14.0.0, 99 rules
- Populated autosave session: 4 skids, 11 segments, 158 total checks, 15 inputs needed

The repository's licensed native UPZ tooling was not available in this checkout. Native Config.xml selection was attempted through the real Windows file picker, but the supplied file produced no visible success or error state in this build. The review therefore distinguishes the observed feedback failure from any unproven parser or backend diagnosis.

## Severity scale

- **P0** — product use or data integrity is broadly blocked; none observed.
- **P1** — important workflow, state-trust, or accessibility failure that should precede polish.
- **P2** — material usability or legibility degradation with a workaround.
- **P3** — refinement that improves coherence, clarity, or perceived quality.
