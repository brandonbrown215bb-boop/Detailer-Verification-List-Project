# 7. Typed Asynchronous IPC Bridge Architecture between WebView2 and .NET 10

Date: 2026-08-26
Status: Accepted

## Context

The desktop application pairs a modern web frontend (React 18, TypeScript, Tailwind CSS) with a native .NET 10 host (`AHUVerification.App`). The frontend needs access to local filesystem dialogs, native 32-bit UPZ decompression binaries (`unpack32.exe`), OpenXML Excel spreadsheet patching, and external process execution.

A robust, typed, asynchronous Inter-Process Communication (IPC) protocol is required to link WebView2 JavaScript execution with the C# backend without blocking the UI thread or creating security vulnerabilities.

## Decisions

1. **Protocol Transport**:
   - WebView2 `window.chrome.webview.postMessage` (Frontend to Backend) and `window.chrome.webview.addEventListener('message', ...)` (Backend to Frontend).
   - Message payloads are structured JSON envelopes:
     - Request: `{ id: string, action: string, payload: any }`
     - Response: `{ id: string, success: boolean, data?: any, error?: string }`

2. **11-Action Bridge Method Catalog**:

| Action | Direction | Purpose | Payload | Return Data |
| :--- | :---: | :--- | :--- | :--- |
| `getAppInfo` | FE $\to$ BE | Query host runtime version & status | `{}` | `{ appName, appVersion, rulePackVersion, ruleCount, isDesktopHost }` |
| `getRulePack` | FE $\to$ BE | Request active rule pack bundle | `{}` | `{ manifest, rules, templateMap, approvedMappings }` |
| `openFileDialog` | FE $\to$ BE | Open native Windows file picker dialog | `{}` | `{ fileName, filePath, content, isDvl, isUpz, bundle? }` |
| `saveFileDialog` | FE $\to$ BE | Open native Windows save dialog | `{ defaultName, filter }` | `string` (selected target path) |
| `extractUpz` | FE $\to$ BE | Decompress UPZ container via unpack32.exe | `{ filePath }` | `{ fileName, filePath, content, isUpz, bundle }` |
| `parseXml` | FE $\to$ BE | Parse XML/UPZ via C# core parser | `{ xmlContent, orderRevision? }` | `{ normalizedGraph, factRegistry, checklistInstances }` |
| `saveDvl` | FE $\to$ BE | Atomically write `.dvl` project file | `{ filePath, projectJson }` | `{ saved: true, path }` |
| `exportExcelDeliverable` | FE $\to$ BE | Generate official patched `.xlsx` | `{ templatePath, outputPath, facts, sqItems, checklists, ... }` | `{ exported: true, path }` |
| `openFile` | FE $\to$ BE | Open deliverable in associated app (Excel) | `{ filePath }` | `{ opened: true }` |
| `showInExplorer` | FE $\to$ BE | Highlight file in Windows Explorer | `{ filePath }` | `{ shown: true }` |
| `syncRulePack` | FE $\to$ BE | Synchronize remote rule pack bundle | `{ remotePath }` | `{ synchronized: true, version, bundleSha256 }` |

3. **Browser Fallback Graceful Degradation**:
   - When running outside WebView2 (e.g. standard browser preview via `vite dev`), `desktopBridge.ts` falls back to client-side DOM parsing, web-based file input (`<input type="file">`), Blob file downloads (`file-saver`), and in-memory rule catalogs.

## Consequences

- Full access to native Windows desktop capabilities with asynchronous non-blocking UI.
- Strict request-response correlation via unique UUID message identifiers.
- Graceful degradation allows seamless frontend browser testing and standalone desktop deployment.
