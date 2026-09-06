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

The largest optional dependency is the `xlsx`/SheetJS path used by browser draft
export. Phase 4 moved that path behind a dynamic import in the browser bridge.
The total entry budget still includes the on-demand chunk, while the startup graph
no longer loads it. The graph measurement is repeatable with `npm run test:graph`.

Phase 4 startup graph measurement:

| Entry | Before startup | After startup | On-demand after |
| --- | ---: | ---: | ---: |
| `index.html` | 1,360,149 / 290,095 gzip | 1,018,719 / 178,760 gzip | 340,459 / 111,643 gzip |
| `rule-editor.html` | 749,074 / 216,100 gzip | 407,556 / 104,727 gzip | 340,459 / 111,643 gzip |

Values are `raw bytes / gzip bytes`. The retained SheetJS chunk is intentional:
browser draft export still works, while certified Excel synthesis remains owned by
the native desktop host.

Bundle size is not a proxy for installer readiness. First-launch/uninstall
verification and real WebView2 host smoke remain Windows release-environment gates.
