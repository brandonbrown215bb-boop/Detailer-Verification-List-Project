# Distribution Guide

## Purpose

This is the short operational checklist for the first distribution of the AHU
Detailing Verification desktop app. It is intentionally limited to the things
that affect detailers: a working installer, a valid shared rule pack, reliable
project/output locations, and a real workstation check. It is not a deployment
runbook for an enterprise service.

## Set these locations before the pilot

Choose the bracketed values once with the owner of the shared detailing files.
Do not point the rule-pack location at a developer checkout or at the app's
installed `resources\\rulepack` folder.

| Use | Recommended location | Where it is set | Notes |
| --- | --- | --- | --- |
| Central, author-managed Rule Pack | `\\<file-server>\\<share>\\UNIT DETAILING VERIFICATION LIST\\RulePack` | **Settings > Central Rule Pack Network Share / Folder** on each pilot PC, or deploy `DVL_RULEPACK_PATH` with this exact folder | The folder must contain a valid `manifest.json` and its five referenced rule-pack members. Give detailers read access; restrict write access to rule authors. If the SharePoint library is synced locally, use its synced `...\\UNIT DETAILING VERIFICATION LIST\\RulePack` folder instead. |
| Job verification files (`.dvl` and `.xlsx`) | `<approved job-work root>\\<COM number>\\Verification` | Planned default in the native Save/Save As and export dialogs | Keep the working project and its checker workbook together. The app currently follows Windows' last used folder; its Settings field only remembers text and does not yet control either dialog. |
| Rule Editor drafts | `%USERPROFILE%\\Documents\\AHU Verification\\Rule Pack Drafts` | The Rule Editor's save/open dialogs | Keep drafts local until a rule author has reviewed them. Publish first to a temporary copy of the central pack, then to the approved central folder. |
| Installed app, rule-pack cache, crash recovery, and WebView data | `%LOCALAPPDATA%\\AHUVerification\\` | Automatic; do not redirect or share this folder | This contains `active_rulepack`, `lkg_rulepack`, `recovery`, and `WebView2Data`. It is per-user working data, not the shared project record. |

The source `.upz` or `Config.xml` is chosen in the normal Open dialog. It does
not need a global default path. Windows normally remembers the last folder used.

## Required release gates

1. **Fix and test default file locations.** The Settings screen currently says
   that the shared export path is used, but the native file dialogs do not read
   it. Make one focused change so an existing, validated directory is passed to
   the native dialog as its starting folder for project saves and Excel exports.
   Do not auto-save to a network share; let the detailer confirm the filename
   and location. Use the approved job-work root in the table, with the current
   project folder and then the source-file folder as sensible fallbacks.
2. Confirm the central Rule Pack path and access rights. Put the approved Rule
   Pack in the central folder and open `manifest.json` to confirm it is the
   intended version.
3. On one normal Windows 10/11 x64 PC with the Evergreen WebView2 Runtime,
   install the generated setup executable. This is the required real-world
   check; automated tests and publish-folder inspection cannot prove installer,
   file-dialog, or WebView behavior.
4. On that PC, exercise one real but non-production unit through the complete
   path: launch, open an offline `.upz`, save a `.dvl`, close and reopen it,
   export the final Excel workbook, and open the workbook in Excel. Confirm the
   saved files are in the locations above.
5. Test the author path separately: unpack the Rule Editor archive on an
   authorized rule-author PC, make a harmless test edit, publish it to a
   temporary copy of the central Rule Pack, then start the main app and verify
   it notices and safely reloads the changed pack. Restore the approved pack
   afterward.
6. Decide who owns the GitHub release/update feed. The installed main app is
   configured to check GitHub Releases for application updates. Do not publish
   the release or expose proprietary assets until that repository's visibility,
   release permissions, and included files are approved.

If any of these fail, stop the pilot and keep distributing the previous known
good build. The baseline packaged rule pack continues to let the app operate
offline; a failed central sync should not replace it.

## When it is time to create the release

1. Start from a clean, committed checkout. Confirm the intended version is
   identical in `version.json`, `package.json`, and `package-lock.json`.
   For a version other than the current `1.0.0`, update those files before
   tagging; the release checks intentionally reject mismatches.
2. With Node 22.18.x, .NET 8, and Velopack CLI `vpk` 1.2.0 available, run:

   ```bat
   publish-release.bat 1.0.0
   ```

   Use the actual approved version in place of `1.0.0`. The script rebuilds,
   tests, packages, creates SBOMs/checksums, and stops if `Releases\\` contains
   stale files.
3. Verify `Releases\\SHA256SUMS.txt` against the release files and retain it
   with the release record. The main installer is the one `*-Setup.exe`; the
   Rule Editor is the separate `RuleEditor-<version>-win-x64.zip` archive for
   rule authors only.
4. Perform the target-PC checklist above using the exact generated setup file.
5. Once the owner authorizes publication, push the matching `v<version>` tag or
   use the repository's **Production Release and Installer Packaging** GitHub
   workflow. It repeats verification and attaches every item in `Releases\\` to
   the GitHub Release, which is the application-update feed. Publishing is an
   external action and is deliberately not part of this guide's preflight.
6. Give detailers only the setup executable and the two shared-folder paths.
   Give rule authors the Rule Editor archive and write access to the central
   Rule Pack. Keep the checksum file and the tested source version with the
   release notes.

## Evidence and limits

The current checkout's frontend tests and .NET test suite passed during the
release review. Earlier clean-checkout evidence established package creation,
asset completeness, checksums, SBOM generation, and executable process smoke,
but this checkout contains later project-session changes. Re-run the release
publisher and the target-PC checklist on the exact commit selected for release.

The release publisher verifies that the self-contained main package carries
`dist/`, the baseline Rule Pack, and the two licensed UPZ extraction files.
Windows still needs the Evergreen WebView2 Runtime. Neither the automated suite
nor this document substitutes for a real install, native UPZ, save/reopen,
Excel-export, update, and uninstall check on a normal user desktop.
