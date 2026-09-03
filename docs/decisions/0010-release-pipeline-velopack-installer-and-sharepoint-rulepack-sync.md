# 10. Release Pipeline, Velopack 1-Click Installer, and Autonomous SharePoint Rule Pack Sync

Date: 2026-09-03
Status: Accepted

## Context

The verification system serves a team of 12 detailers: 10 working in-office with access to a local network share, and 2 working remotely without access to the local shared drive. Previously:
- Releases were framework-dependent loose folders produced by `dotnet publish --self-contained false`, requiring manual runtime installation and file copying.
- There was no installer or desktop shortcut creation.
- Application binary updates were manual.
- Rule pack updates depended on manual path entry in Settings and could not easily reach the 2 remote detailers.

The team requires a one-click install, one-click launch, autonomous application binary updates, and autonomous rule pack updates on launch whenever the central rule pack hash differs from the local copy.

## Decisions

1. **Dual-Channel Distribution**:
   - **Application Binaries**: Distributed and auto-updated via public GitHub Releases (`brandonbrown215bb-boop/Detailer-Verification-List-Project`). Because the repository is public, detailers do not require VPN or credentials to check and pull application updates.
   - **Rule Packs**: Kept under corporate control via Johnson Controls SharePoint document library (`UNIT DETAILING VERIFICATION LIST`), synced to detailers' local machines via OneDrive for Business.

2. **Velopack 1-Click Installer**:
   - The desktop host (`AHUVerification.App`) integrates Velopack 1.2.0.
   - The installer is a single self-contained executable (`AHUVerification-Setup.exe`).
   - Running the installer requires no administrative privileges, extracts to `%LocalAppData%\AHUVerification`, creates Desktop and Start Menu shortcuts, and launches immediately.
   - On application startup, `UpdateService` checks GitHub Releases in the background. When an update is ready, it downloads delta or full packages silently and prompts or applies on restart.

3. **Autonomous SharePoint / OneDrive Rule Pack Sync**:
   - `RulePackLocationResolver` automatically discovers the synced SharePoint folder by probing environment paths (`%OneDriveCommercial%`, `%USERPROFILE%\Johnson Controls`, `%OneDrive%`) for candidate directories containing `manifest.json`.
   - On application launch, `App.tsx` queries the resolver. If a central directory exists and auto-sync is enabled, it compares the remote `bundleSha256` against the local active store (`%LocalAppData%\AHUVerification\active_rulepack`).
   - If a hash mismatch is detected, `RulePackManager.SyncFromRemote` stages, validates all 5 manifest members, rotates active to LKG, promotes staging to active, and immediately reloads rules with an unobtrusive toast notification.

4. **Packaging Separation**:
   - `AHUVerification.App.exe`, `dist/`, baseline `resources/rulepack/`, and native UPZ decompressors (`resources/bin/unpack32.exe`, `resources/bin/ywunpack.dll`) are packaged into the standard 1-click installer.
   - `RuleEditor.exe` is excluded from the standard installer and published as a standalone administrator archive (`RuleEditor-v<version>-win-x64.zip`) for rule authors.

5. **CI/CD Automation**:
   - A GitHub Actions workflow (`.github/workflows/release.yml`) triggers on version tag pushes (`v*`) or manual execution.
   - The pipeline builds web assets, verifies rule-pack integrity, executes the full test suite, publishes self-contained `win-x64` artifacts, packages `AHUVerification-Setup.exe` with Velopack (`vpk pack`), and attaches all deliverables to the GitHub Release.
   - `publish-release.bat` is updated to publish self-contained binaries and package with `vpk` locally when installed.

## Consequences

- All 12 detailers (in-office and remote) have seamless update parity without needing VPN or shared drive permissions.
- Rule authors can publish new rule packs to the synced SharePoint folder from Rule Editor; detailers receive them autonomously on next launch.
- Self-contained packaging eliminates machine-level .NET 8 runtime prerequisites.
- Application updates are delta-compressed and applied without requiring reinstallation.

