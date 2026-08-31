# 3. Rule Pack Identity, Project Saves, and Desktop Delivery

Date: 2026-08-25
Status: Accepted

## Context

Rule Pack v14 was generated with LF JSON hashes, while ordinary Windows checkouts could expose CRLF text to the loader. The loader also verified only `rules.json`. Saved `.dvl` projects recorded placeholder Rule Pack and source XML hashes, desktop Save treated a suggested filename as a writable path, and published desktop output did not include the web bundle or baseline Rule Pack.

These failures share one boundary: persisted and distributed artifacts need explicit identities, owners, and locations.

## Decisions

1. **Rule Pack integrity**
   - A valid pack contains `rules.json`, `template_map.json`, `approved_mappings.json`, and `template.xlsx` plus `manifest.json`.
   - JSON hashes use UTF-8 with line endings normalized to LF. Binary files use their exact bytes. `.gitattributes` keeps distributed JSON at LF while the loader remains tolerant of Windows text conversion.
   - `bundleSha256` is the SHA-256 of the ordered `name:fileSha256` entries for all four artifacts. The loader verifies every member and the bundle identity before promotion or use.

2. **`.dvl` identity**
   - New projects pin the current manifest version and full `bundleSha256` and store a full SHA-256 of the embedded source XML.
   - Projects with missing, truncated, placeholder, mismatched, or internally inconsistent hashes may be opened, but are identified to the user as unverified. They are rewritten with current verified metadata on the next save.

3. **Desktop file semantics**
   - First Save prompts for a path. Later Save reuses that path. Save As always prompts.
   - Native writes use a sibling temporary file and replace the destination only after the write is flushed.

4. **Desktop delivery**
   - The supported artifact is a framework-dependent publish folder, not a literal single executable.
   - `dist/` and `resources/rulepack/` are explicit adjacent publish content. Release builds load only those packaged assets; repository and Vite-server probing remain debug conveniences.
   - The main host requires `dist/index.html`; `RuleEditor.exe` requires `dist/rule-editor.html`. Both publish folders need their adjacent rule-pack assets.

5. **Official workbook boundary**
   - The desktop OpenXML path is the official deliverable generator. Browser SheetJS export remains a preview and is not certification evidence.

## Consequences

- A single manifest identity follows a Rule Pack into saved projects and can be audited later.
- Line-ending conversion cannot disable a valid Windows installation, while any substantive content change still fails integrity checks.
- Saving can no longer silently target the process working directory, and interrupted writes do not partially replace a project.
- Published output is a folder whose required runtime assets can be inspected and validated directly.

## Addendum (2026-08-26)

1. **Native UPZ Binary Assets**: In addition to `dist/` and `resources/rulepack/`, the publish distribution includes `resources/bin/` containing native 32-bit `unpack32.exe` and `ywunpack.dll` for UPZ decompression.
2. **MSBuild Packaging Verification**: `src/backend/Directory.Build.targets` supplies the common publish guard for both Windows hosts and requires the five baseline rule-pack members under `resources/rulepack/`. The App project's `ValidatePackagedAssets` additionally checks `dist/index.html`, `resources/bin/unpack32.exe`, and `resources/bin/ywunpack.dll`; the Rule Editor's target checks `dist/rule-editor.html`. `node scripts/build_rulepack.mjs` still verifies that the manifest hashes match their artifacts, which presence checks alone cannot prove.
3. **Sync rollback**: `SyncFromRemote` receives staging, active-store, and LKG directories from its caller. It stages, validates, moves the active store to the caller-provided LKG path, promotes staging, and restores LKG on promotion failure; no fixed LKG storage location is defined by the core service.

