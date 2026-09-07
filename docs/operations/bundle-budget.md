# Frontend bundle budget

The two packaged entry pages are measured after `npm run build` by
`node scripts/verify_bundle_budget.mjs`. The check walks each page's local JavaScript,
CSS, module-preload, dynamic-import, and CSS URL dependencies, records both raw and deterministic gzip sizes, and
fails CI when a checked-in ceiling is exceeded. Baselines and ceilings live in
[`bundle-budget.json`](bundle-budget.json); update them only with a reviewed change
to the shipped entry surface.

Reference baseline (captured from the built output at the Wave 1 starting point):

| Entry | Uncompressed | Gzip | Ceiling |
| --- | ---: | ---: | --- |
| `index.html` | 1,252,597 bytes | 264,278 bytes | 1,400,000 / 450,000 |
| `rule-editor.html` | 708,651 bytes | 207,335 bytes | 800,000 / 300,000 |

The largest historical optional dependency was the `xlsx`/SheetJS path used by prototype browser draft
export. In CE5, `xlsx`, `file-saver`, and all 8 duplicate TypeScript domain engine modules were completely deleted from the codebase. All Excel deliverables (both draft and final) are generated authoritatively by C# OpenXML in the desktop host.

Post-CE5/CE6 measurements (desktop-only authoritative engine architecture):

| Entry | Startup Files | Uncompressed | Gzip | On-demand Chunks | Ceiling |
| --- | :---: | ---: | ---: | :---: | --- |
| `index.html` | 3 | 901,686 bytes | 148,438 bytes | 0 files (0 bytes) | 1,400,000 / 450,000 |
| `rule-editor.html` | 3 | 396,041 bytes | 99,517 bytes | 0 files (0 bytes) | 800,000 / 300,000 |

Net Reduction from Phase 4:
- `index.html`: **-458,463 bytes** raw (~33.7% reduction), **-141,657 bytes** gzip (~48.8% reduction).
- `rule-editor.html`: **-353,033 bytes** raw (~47.1% reduction), **-116,583 bytes** gzip (~54.0% reduction).
- On-demand chunks: completely eliminated (0 bytes). All presentation assets load cleanly at startup with zero lazy chunks.

Bundle size is not a proxy for installer readiness. First-launch/uninstall
verification and real WebView2 host smoke remain Windows release-environment gates.
