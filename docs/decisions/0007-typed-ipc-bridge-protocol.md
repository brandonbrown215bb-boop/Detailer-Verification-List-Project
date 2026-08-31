# 7. Typed Asynchronous IPC Bridge Architecture between WebView2 and .NET 10

Date: 2026-08-26
Status: Accepted

> **Current implementation:** the shipped hosts target `.NET 8` (`net8.0` / `net8.0-windows`). The original title is retained as the accepted ADR's historical wording; the current contract is detailed below and in the addendum.

## Context

The desktop application pairs a modern web frontend (React 18, TypeScript, Tailwind CSS) with a native .NET 8 host (`AHUVerification.App`). The frontend needs access to local filesystem dialogs, native 32-bit UPZ decompression binaries (`unpack32.exe`), OpenXML Excel spreadsheet patching, and external process execution.

A robust, typed, asynchronous Inter-Process Communication (IPC) protocol is required to link WebView2 JavaScript execution with the C# backend without blocking the UI thread or creating security vulnerabilities.

## Decisions

1. **Protocol Transport**:
   - WebView2 `window.chrome.webview.postMessage` (Frontend to Backend) and `window.chrome.webview.addEventListener('message', ...)` (Backend to Frontend).
   - Message payloads are structured JSON envelopes:
     - Request: `{ id: string, action: string, payload: any }`
     - Response: `{ id: string, success: boolean, data?: any, error?: string }`

2. **12-Action Bridge Method Catalog**:

| Action | Direction | Purpose | Payload | Return Data |
| :--- | :---: | :--- | :--- | :--- |
| `getAppInfo` | FE $\to$ BE | Query host runtime version & status | `{}` | `{ appName, appVersion, rulePackVersion, ruleCount, isDesktopHost }` |
| `getRulePack` | FE $\to$ BE | Request active rule pack bundle | `{}` | `{ manifest, rules, templateMap, approvedMappings }` |
| `openFileDialog` | FE $\to$ BE | Open native Windows file picker dialog | `{}` | `{ fileName, filePath, content, isDvl, isUpz, bundle? }` |
| `saveFileDialog` | FE $\to$ BE | Open native Windows save dialog | `{ defaultName, filter }` | `string` (selected target path) |
| `extractUpz` | FE $\to$ BE | Decompress UPZ container via unpack32.exe | `{ filePath }` | `{ fileName, filePath, content, isUpz, bundle }` |
| `saveDvl` | FE $\to$ BE | Atomically write `.dvl` project file | `{ filePath, projectJson }` | `{ saved: true, path }` |
| `exportExcelDeliverable` | FE $\to$ BE | Generate official patched `.xlsx` | `{ facts, sqItems, checklists, rules, graph?, generalComments?, defaultName?, isDraft }` | `{ exported, filePath?, fileName?, cancelled? }` |
| `openFile` | FE $\to$ BE | Open deliverable in associated app (Excel) | `{ filePath }` | `{ opened: true }` |
| `showInExplorer` | FE $\to$ BE | Highlight file in Windows Explorer | `{ filePath }` | `{ shown: true }` |
| `checkRulePackUpdate` | FE $\to$ BE | Compare a remote pack with the active pack | `{ remotePath }` | `{ hasUpdate, currentVersion, remoteVersion, ... }` |
| `syncRulePack` | FE $\to$ BE | Synchronize remote rule pack bundle | `{ remotePath }` | `{ synchronized: true, version, bundleSha256 }` |
| `selectFolderDialog` | FE $\to$ BE | Open a native folder picker | `{}` | `{ folderPath }` or `null` |

3. **Browser Fallback Graceful Degradation**:
   - When running outside WebView2 (e.g. standard browser preview via `vite dev`), `desktopBridge.ts` falls back to client-side DOM parsing (the only `parseXml` path), web-based file input (`<input type="file">`), Blob file downloads (`file-saver`), and in-memory rule catalogs.

## Consequences

- Full access to native Windows desktop capabilities with asynchronous non-blocking UI.
- Strict request-response correlation via unique UUID message identifiers.
- Graceful degradation allows seamless frontend browser testing and standalone desktop deployment.

## Addendum (2026-08-28): current implementation

The shipped C# projects target .NET 8 (`net8.0` / `net8.0-windows`). The main `BridgeHandler` registers `getAppInfo`, `getRulePack`, `openFileDialog`, `saveFileDialog`, `extractUpz`, `saveDvl`, `exportExcelDeliverable`, `openFile`, `showInExplorer`, `checkRulePackUpdate`, `syncRulePack`, and `selectFolderDialog`. It does **not** register `parseXml`; XML parsing is frontend TypeScript work.

The frontend sends `exportExcelDeliverable` `{ facts, sqItems, checklists, rules, graph?, generalComments?, defaultName?, isDraft }`. The host resolves the template from the active rule pack and opens a native save dialog. `desktopBridge.ts` times requests out after 30 seconds. WinForms dialog actions must marshal to the UI thread with `Form.Invoke`. The Rule Editor owns a separate five-action bridge: `getAppInfo`, `getRulePack`, `publishRulePack`, `openFileDialog`, and `selectFolderDialog`.
