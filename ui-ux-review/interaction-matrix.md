# Interaction Matrix

## Method

The application was launched as the native Windows host, then operated through the same visible UI a detailer would use. Findings are based on the rendered result, Windows UI Automation exposure, and repeat interactions. Source and architecture notes were used only to locate intended workflows and interpret environmental limits.

| Area | Interaction | Observed result | Confidence |
| --- | --- | --- | --- |
| Home | Opened the native host | Three clear entry routes appeared: resume autosave, upload a project/config, or manual setup. The older autosave was the most visually prominent object. | High |
| Manual setup | Opened setup and advanced through all four steps | General data, skids, segments, and review were complete and usable. Step 2 rendered `$N \\ge 1$` literally; Step 4 exposed implementation vocabulary. | High |
| Manual setup | Pressed Escape while the wizard was open | Wizard remained open. UI Automation did not expose it as a dialog or move focus into it. | High |
| Config import | Selected the repository `Config.xml` in the real Windows file picker and chose Open | Returned to Home with no loaded-project transition, spinner, success, or error message. Root cause was not diagnosed. | High for missing feedback; low for backend cause |
| Autosave | Resumed previous session | Loaded 4 skids, 11 segments, 158 checks, 15 inputs needed, 0 verified. | High |
| General Unit | Inspected features, facts, materials, and provenance | Dense but task-specific. Materials were presented in a readable table; metadata and icon actions were crowded. | High |
| Search | Pressed Ctrl+K, then typed `seismic` | Search opened but typing did nothing until the input was clicked with the mouse. After clicking, grouped rule/fact results were useful. | High |
| Facts | Opened the Facts resolution center | Modal declared “All Facts Confirmed!” while the shell still showed 15 inputs needed and every skid warned that checks needed fact confirmation. | High |
| Export | Opened Export .xlsx preflight | Clear counts and incomplete-item list appeared; Draft export was available. | High |
| Export | Used the first `Jump` action | Navigated to Skid 2 and the relevant verification table. The first automation-targeted click was inconclusive; a direct user-coordinate click succeeded and the final state was verified. | High for final behavior |
| Skid verification | Inspected rules, filters, keyboard legend, comments, and groups | Strong task density and reference visibility. Long descriptions and columns truncate at normal width. | High |
| Unit verification | Opened Unit Verifications | Mapped segments, filters, summary, groupings, references, and comments formed a coherent review workspace. | High |
| Sidebar | Pressed Ctrl+B | Collapsed to an effective icon rail and reclaimed useful horizontal space. | High |
| Responsive | Snapped the window to 1086 × 1032 with sidebar expanded and collapsed | No catastrophic overlap. Expanded mode clipped title/action labels and forced horizontal grid overflow; collapsed mode was materially better but still dense. | High |
| Zoom | Sent two Ctrl++ commands, then reobserved | WebView rendering did not visibly change. Windows/browser zoom behavior is therefore not certified by this pass. | High for no observed change; not a scaling certification |
| Settings | Opened, scrolled, inspected all sections | Theme, signature, rule pack, shared paths, autosave, and reset were logically grouped, but the tall modal required internal scrolling and its subtitle clipped at wide width. | High |
| Themes | Switched to Light, captured it, then restored Dark | Both modes applied. Dark was restored before handoff. | High |
| Rule editor | Chose “Open Rule & Logic Editor” from Settings twice | No editor window, transition, or error feedback surfaced during the observation period. | Medium; launch environment may be incomplete |
| Project identity | Opened identity editor and pressed Tab | Form was understandable, but UI Automation focus remained on the document after opening and after Tab. Escape closed it. | High |

## State-safety notes

- No checklist item, N/A state, fact value, comment, project identity, autosave record, or destructive setting was intentionally changed.
- Light theme was selected only for inspection and Dark was restored.
- Sidebar was restored to expanded mode.
- No .dvl or .xlsx file was written.
- The supplied Config.xml was selected but did not produce visible project state.

## Limits

- No screen reader software was run; accessibility findings use keyboard behavior and Windows UI Automation exposure.
- Contrast ratios were not instrumented. Low-contrast findings are visual risks that should be verified with token-level measurements.
- System display scaling was not changed. The app did not react visibly to Ctrl++ in this host, so 125%/150% Windows scaling remains a release test.
- The licensed native UPZ toolchain was unavailable, and complete import/export file generation was not certified.
- The secondary Rule Editor did not surface from Settings, so its own screens were not audited.
