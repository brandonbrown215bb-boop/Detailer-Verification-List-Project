using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using System.Windows.Forms;
using AHUVerification.App.Services;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Manual;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;
using AHUVerification.Core.Session;
using AHUVerification.Core.Utils;

namespace AHUVerification.App.Bridge
{
    public class BridgeHandler
    {
        private readonly Form? _parentForm;
        private readonly DvlProjectManager _projectManager = new();
        private readonly OpenXmlTemplatePatcher _patcher = new();
        private readonly RulePackManager _rulePackManager = new();
        private readonly UpzBundleExtractor _upzExtractor = new();
        private readonly UpdateService _updateService = new();
        private readonly ProjectSessionService _sessionService = new();
        private readonly ConcurrentDictionary<string, string> _authorizedSourceHandles = new(StringComparer.Ordinal);
        private readonly HashSet<string> _authorizedPickerPaths = new(StringComparer.OrdinalIgnoreCase);

        private RulePackBundle? _activeRulePack;
        private string? _rulePackError;
        private int _rulePackGeneration = 1;
        private readonly string _rulePackPath;
        private readonly Func<string?>? _exportPathSelector;
        private readonly Action<ProcessStartInfo> _processLauncher;

        public BridgeHandler(string rulePackPath) : this(null, rulePackPath)
        {
        }

        public BridgeHandler(Form? parentForm, string rulePackPath, Func<string?>? exportPathSelector = null, Action<ProcessStartInfo>? processLauncher = null)
        {
            _parentForm = parentForm;
            _rulePackPath = rulePackPath;
            _exportPathSelector = exportPathSelector;
            _processLauncher = processLauncher ?? (psi => Process.Start(psi));
            LoadActiveRulePack();
        }

        public string AuthorizeSourcePath(string filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath)) throw new ArgumentException("File path cannot be empty", nameof(filePath));
            string fullPath = Path.GetFullPath(filePath);
            string handle = Guid.NewGuid().ToString("N");
            _authorizedSourceHandles[handle] = fullPath;
            lock (_authorizedPickerPaths)
            {
                _authorizedPickerPaths.Add(fullPath);
            }
            return handle;
        }

        public bool IsSourcePathAuthorized(string? filePath, string? sourceHandle = null)
        {
            if (string.IsNullOrWhiteSpace(filePath)) return false;
            string fullPath = Path.GetFullPath(filePath);

            if (!string.IsNullOrWhiteSpace(sourceHandle) && _authorizedSourceHandles.TryGetValue(sourceHandle, out var authorizedPath))
            {
                if (string.Equals(fullPath, authorizedPath, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            lock (_authorizedPickerPaths)
            {
                return _authorizedPickerPaths.Contains(fullPath);
            }
        }

        private void LoadActiveRulePack()
        {
            try
            {
                if (!Directory.Exists(_rulePackPath))
                    throw new DirectoryNotFoundException($"Rule pack directory not found: {_rulePackPath}");

                _activeRulePack = _rulePackManager.LoadFromDirectory(_rulePackPath);
                _rulePackError = null;
            }
            catch (Exception ex)
            {
                _activeRulePack = null;
                _rulePackError = $"Failed to load active rule pack from '{_rulePackPath}': {ex.Message}";
            }
        }

        public BridgeResponse Handle(string jsonMessage)
        {
            return HandleAsync(jsonMessage).GetAwaiter().GetResult();
        }

        public async Task<BridgeResponse> HandleAsync(string jsonMessage)
        {
            string reqId = BridgeRequest.ExtractRequestId(jsonMessage);

            if (string.IsNullOrWhiteSpace(jsonMessage))
            {
                return BridgeResponse.Fail(reqId, "Invalid empty request message");
            }

            var options = JsonDefaults.CreateFlexibleOptions();

            BridgeRequest? req;
            try
            {
                req = JsonSerializer.Deserialize<BridgeRequest>(jsonMessage, options);
                if (req == null)
                {
                    return BridgeResponse.Fail(reqId, "Invalid null request");
                }
            }
            catch (Exception ex)
            {
                return BridgeResponse.Fail(reqId, $"Deserialization error: {ex.Message}");
            }

            string effectiveId = !string.IsNullOrEmpty(req.Id) ? req.Id : reqId;

            if (string.IsNullOrWhiteSpace(req.Action))
            {
                return BridgeResponse.Fail(effectiveId, "Missing required 'action' field in bridge request");
            }

            try
            {
                object? result = req.Action switch
                {
                    "getAppInfo" => GetAppInfo(),
                    "getRulePack" => GetRulePack(),
                    "openFileDialog" => ShowOpenFileDialog(),
                    "saveFileDialog" => ShowSaveFileDialog(req.Payload),
                    "extractUpz" => ExtractUpz(req.Payload),
                    "saveDvl" => SaveDvl(req.Payload),
                    "verifySource" => VerifySource(req.Payload),
                    "exportExcelDeliverable" => ExportExcelDeliverable(req.Payload),
                    "openFile" => OpenFile(req.Payload),
                    "showInExplorer" => ShowInExplorer(req.Payload),
                    "resolveRulePackLocation" => ResolveRulePackLocation(req.Payload),
                    "checkRulePackUpdate" => CheckRulePackUpdate(req.Payload),
                    "syncRulePack" => SyncRulePack(req.Payload),
                    "selectFolderDialog" => ShowSelectFolderDialog(),
                    "launchRuleEditor" => LaunchRuleEditor(),
                    "checkAppUpdate" => await CheckAppUpdateAsync(),
                    "downloadAppUpdate" => await DownloadAppUpdateAsync(),
                    "applyAppUpdate" => ApplyAppUpdate(),
                    "projectSession_open" => OpenProjectSession(req.Payload),
                    "projectSession_getSnapshot" => GetProjectSessionSnapshot(),
                    "projectSession_overrideFact" => OverrideProjectSessionFact(req.Payload),
                    "projectSession_batchOverrideFacts" => BatchOverrideProjectSessionFacts(req.Payload),
                    "projectSession_revertFact" => RevertProjectSessionFact(req.Payload),
                    "projectSession_updateChecklist" => UpdateProjectSessionChecklist(req.Payload),
                    "projectSession_updateSpecialQuote" => UpdateProjectSessionSpecialQuote(req.Payload),
                    "projectSession_deleteSpecialQuote" => DeleteProjectSessionSpecialQuote(req.Payload),
                    "projectSession_reorderSpecialQuotes" => ReorderProjectSessionSpecialQuotes(req.Payload),
                    "projectSession_updateGeneralComments" => UpdateProjectSessionGeneralComments(req.Payload),
                    "projectSession_reset" => ResetProjectSession(req.Payload),
                    "projectSession_createManual" => CreateManualProjectSession(req.Payload),
                    "getSegmentTemplates" => GetSegmentTemplates(),
                    _ => throw new InvalidOperationException($"Unknown bridge action: '{req.Action}'")
                };

                return BridgeResponse.Ok(effectiveId, result);
            }
            catch (Exception ex)
            {
                return BridgeResponse.Fail(effectiveId, ex.Message);
            }
        }

        private object GetAppInfo()
        {
            return new
            {
                appName = "AHU Detailing Verification",
                appVersion = ApplicationVersion.Current,
                rulePackVersion = _activeRulePack?.Manifest.Version ?? "Unavailable",
                ruleCount = _activeRulePack?.Rules.Count(rule => rule.IsArchived != true) ?? 0,
                isDesktopHost = true,
                rulePackError = _rulePackError
            };
        }

        private object GetRulePack()
        {
            if (_activeRulePack == null && _rulePackError == null) LoadActiveRulePack();
            return new
            {
                manifest = _activeRulePack?.Manifest,
                rules = _activeRulePack?.Rules,
                templateMap = _activeRulePack?.TemplateMap,
                approvedMappings = _activeRulePack?.ApprovedMappings,
                generation = _rulePackGeneration,
                error = _rulePackError
            };
        }

        private object? ShowOpenFileDialog()
        {
            if (_parentForm == null) return null;

            object? result = null;
            _parentForm.Invoke(() =>
            {
                using var ofd = new OpenFileDialog
                {
                    Title = "Open AHU Engineering File",
                    Filter = "All Supported Files (*.upz;*.xml;*.dvl)|*.upz;*.xml;*.dvl|Unit Package (*.upz)|*.upz|Config XML (*.xml)|*.xml|DVL Project (*.dvl)|*.dvl|All Files (*.*)|*.*"
                };

                if (ofd.ShowDialog(_parentForm) == DialogResult.OK)
                {
                    string sourceHandle = AuthorizeSourcePath(ofd.FileName);
                    if (ofd.FileName.EndsWith(".upz", StringComparison.OrdinalIgnoreCase))
                    {
                        var bundle = _upzExtractor.Extract(ofd.FileName);
                        result = new
                        {
                            fileName = Path.GetFileName(ofd.FileName),
                            filePath = ofd.FileName,
                            sourceHandle,
                            content = bundle.RawConfigXml,
                            isDvl = false,
                            isUpz = true,
                            bundle = new
                            {
                                rawConfigXml = bundle.RawConfigXml,
                                rawOrderRevXml = bundle.RawOrderRevXml,
                                rawManifestXml = bundle.RawManifestXml,
                                orderRevision = bundle.OrderRevision,
                                manifest = bundle.Manifest
                            }
                        };
                    }
                    else
                    {
                        string content = File.ReadAllText(ofd.FileName);
                        result = new
                        {
                            fileName = Path.GetFileName(ofd.FileName),
                            filePath = ofd.FileName,
                            sourceHandle,
                            content,
                            isDvl = ofd.FileName.EndsWith(".dvl", StringComparison.OrdinalIgnoreCase),
                            isUpz = false
                        };
                    }
                }
            });
            return result;
        }

        private object? ShowSaveFileDialog(JsonElement payload)
        {
            string defaultName = BridgeValidation.GetStringPropertyOrDefault(payload, "defaultName", "Project.dvl");
            string filter = BridgeValidation.GetStringPropertyOrDefault(payload, "filter", "DVL Project (*.dvl)|*.dvl");

            if (_parentForm == null) return null;

            object? result = null;
            _parentForm.Invoke(() =>
            {
                using var sfd = new SaveFileDialog
                {
                    Title = "Save Project File",
                    FileName = defaultName,
                    Filter = filter
                };

                if (sfd.ShowDialog(_parentForm) == DialogResult.OK)
                {
                    result = sfd.FileName;
                }
            });
            return result;
        }

        private object ExtractUpz(JsonElement payload)
        {
            string filePath = BridgeValidation.RequireStringProperty(payload, "extractUpz", "filePath");

            if (!File.Exists(filePath))
                throw new FileNotFoundException($"UPZ file not found: {filePath}", filePath);

            var bundle = _upzExtractor.Extract(filePath);
            return new
            {
                fileName = Path.GetFileName(filePath),
                filePath,
                content = bundle.RawConfigXml,
                isDvl = false,
                isUpz = true,
                bundle = new
                {
                    rawConfigXml = bundle.RawConfigXml,
                    rawOrderRevXml = bundle.RawOrderRevXml,
                    rawManifestXml = bundle.RawManifestXml,
                    orderRevision = bundle.OrderRevision,
                    manifest = bundle.Manifest
                }
            };
        }

        private object SaveDvl(JsonElement payload)
        {
            string targetPath = BridgeValidation.RequireStringProperty(payload, "saveDvl", "filePath");
            string dvlJson = BridgeValidation.RequireStringProperty(payload, "saveDvl", "projectJson");

            _projectManager.SaveJsonToFile(dvlJson, targetPath);
            return new { saved = true, path = Path.GetFullPath(targetPath) };
        }

        private object VerifySource(JsonElement payload)
        {
            string configXml = BridgeValidation.RequireStringProperty(payload, "verifySource", "configXml");
            string orderRevXml = BridgeValidation.GetStringPropertyOrDefault(payload, "orderRevXml", "");
            string manifestXml = BridgeValidation.GetStringPropertyOrDefault(payload, "manifestXml", "");

            if (_activeRulePack == null) LoadActiveRulePack();
            if (_activeRulePack == null)
                throw new InvalidOperationException("Active rule pack bundle not loaded.");

            var options = JsonDefaults.CreateFlexibleOptions();
            Dictionary<string, Fact>? manualOverrides = null;
            if (payload.TryGetProperty("manualOverrides", out var overridesEl) && overridesEl.ValueKind == JsonValueKind.Object)
            {
                manualOverrides = JsonSerializer.Deserialize<Dictionary<string, Fact>>(overridesEl.GetRawText(), options);
            }

            List<SpecialQuote>? sqItems = null;
            if (payload.TryGetProperty("sqItems", out var sqEl) && sqEl.ValueKind == JsonValueKind.Array)
            {
                sqItems = JsonSerializer.Deserialize<List<SpecialQuote>>(sqEl.GetRawText(), options);
            }

            List<ChecklistInstance>? existingChecklists = null;
            if (payload.TryGetProperty("existingChecklists", out var clEl) && clEl.ValueKind == JsonValueKind.Array)
            {
                existingChecklists = JsonSerializer.Deserialize<List<ChecklistInstance>>(clEl.GetRawText(), options);
            }

            var hostService = new VerificationHostService();
            return hostService.VerifySource(configXml, orderRevXml, manifestXml, _activeRulePack, manualOverrides, sqItems, existingChecklists);
        }

        private object ExportExcelDeliverable(JsonElement payload)
        {
            string configXml = BridgeValidation.GetStringPropertyOrDefault(payload, "configXml", "");
            string orderRevXml = BridgeValidation.GetStringPropertyOrDefault(payload, "orderRevXml", "");
            string manifestXml = BridgeValidation.GetStringPropertyOrDefault(payload, "manifestXml", "");

            var factsEl = BridgeValidation.RequireObjectProperty(payload, "exportExcelDeliverable", "facts");
            var sqEl = BridgeValidation.RequireArrayProperty(payload, "exportExcelDeliverable", "sqItems");
            var clEl = BridgeValidation.RequireArrayProperty(payload, "exportExcelDeliverable", "checklists");

            if (_activeRulePack == null) LoadActiveRulePack();
            if (_activeRulePack == null)
                throw new InvalidOperationException("Active rule pack bundle not loaded.");

            var options = JsonDefaults.CreateFlexibleOptions();
            var facts = JsonSerializer.Deserialize<Dictionary<string, Fact>>(factsEl.GetRawText(), options) ?? new();
            var sqItems = JsonSerializer.Deserialize<List<SpecialQuote>>(sqEl.GetRawText(), options) ?? new();
            var checklists = JsonSerializer.Deserialize<List<ChecklistInstance>>(clEl.GetRawText(), options) ?? new();
            string generalComments = BridgeValidation.GetStringPropertyOrDefault(payload, "generalComments", "");
            string defaultName = BridgeValidation.GetStringPropertyOrDefault(payload, "defaultName", "Detailing_Verification_List.xlsx");
            bool isDraft = BridgeValidation.GetBooleanPropertyOrDefault(payload, "isDraft", false);

            if (!isDraft && string.IsNullOrWhiteSpace(configXml))
            {
                throw new InvalidOperationException("Final export requires the trusted raw Config.xml source");
            }

            string? chosenPath = null;
            if (_exportPathSelector != null)
            {
                chosenPath = _exportPathSelector();
            }
            else if (_parentForm != null)
            {
                _parentForm.Invoke(() =>
                {
                    using var sfd = new SaveFileDialog
                    {
                        Title = "Export Detailing Verification List (.xlsx)",
                        FileName = defaultName,
                        Filter = "Excel Workbook (*.xlsx)|*.xlsx"
                    };

                    if (sfd.ShowDialog(_parentForm) == DialogResult.OK)
                    {
                        chosenPath = sfd.FileName;
                    }
                });
            }

            if (string.IsNullOrEmpty(chosenPath))
            {
                return new { cancelled = true };
            }

            if (!Path.IsPathRooted(chosenPath) || !chosenPath.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Target path must be an absolute path ending in .xlsx");
            }

            var hostService = new VerificationHostService();
            hostService.RecomputeAndExport(configXml, orderRevXml, manifestXml, _activeRulePack, chosenPath, facts, sqItems, checklists, generalComments, isDraft);

            return new
            {
                exported = true,
                filePath = chosenPath,
                fileName = Path.GetFileName(chosenPath),
                certificationAllowed = !isDraft && !string.IsNullOrWhiteSpace(configXml)
            };
        }

        private object OpenFile(JsonElement payload)
        {
            string path = BridgeValidation.RequireStringProperty(payload, "openFile", "filePath");
            if (!File.Exists(path)) throw new FileNotFoundException("File not found to open.", path);

            _processLauncher(new ProcessStartInfo(path) { UseShellExecute = true });
            return new { opened = true };
        }

        private object ShowInExplorer(JsonElement payload)
        {
            string path = BridgeValidation.RequireStringProperty(payload, "showInExplorer", "filePath");
            if (!File.Exists(path) && !Directory.Exists(path))
                throw new FileNotFoundException("Target path not found.", path);

            string argument = $"/select,\"{path}\"";
            _processLauncher(new ProcessStartInfo("explorer.exe", argument) { UseShellExecute = true });
            return new { shown = true };
        }

        private object CheckRulePackUpdate(JsonElement payload)
        {
            string remotePath = BridgeValidation.RequireStringProperty(payload, "checkRulePackUpdate", "remotePath");
            string currentVersion = _activeRulePack?.Manifest.Version ?? "0.0.0";
            string currentBundleSha = _activeRulePack?.Manifest.BundleSha256 ?? "";

            var result = _rulePackManager.CheckRemoteUpdate(remotePath, currentVersion, currentBundleSha);
            return new
            {
                hasUpdate = result.HasUpdate,
                currentVersion = result.CurrentVersion,
                remoteVersion = result.RemoteVersion,
                remoteBundleSha256 = result.RemoteBundleSha256,
                remoteRuleCount = result.RemoteRuleCount,
                error = result.Error
            };
        }

        private object? ShowSelectFolderDialog()
        {
            if (_parentForm == null) return null;

            string? selectedPath = null;
            _parentForm.Invoke(new Action(() =>
            {
                using var dialog = new FolderBrowserDialog
                {
                    Description = "Select Central Rule Pack Distribution Folder"
                };

                if (dialog.ShowDialog(_parentForm) == DialogResult.OK)
                {
                    selectedPath = dialog.SelectedPath;
                }
            }));

            return selectedPath != null ? new { folderPath = selectedPath } : null;
        }

        private object SyncRulePack(JsonElement payload)
        {
            string remotePath = BridgeValidation.RequireStringProperty(payload, "syncRulePack", "remotePath");
            string localData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AHUVerification");
            string staging = Path.Combine(localData, "staging_rulepack");
            string active = Path.Combine(localData, "active_rulepack");
            string lkg = Path.Combine(localData, "lkg_rulepack");

            bool success = _rulePackManager.SyncFromRemote(remotePath, staging, active, lkg);
            ProjectSessionSnapshot? updatedSnapshot = null;
            if (success)
            {
                _activeRulePack = _rulePackManager.LoadFromDirectory(active);
                _rulePackGeneration++;
                _rulePackError = null;
                updatedSnapshot = _sessionService.UpdateActiveRulePack(_activeRulePack, _rulePackGeneration);
            }

            return new
            {
                success,
                version = _activeRulePack?.Manifest.Version ?? "Unavailable",
                bundleSha256 = _activeRulePack?.Manifest.BundleSha256 ?? "",
                ruleCount = _activeRulePack?.Rules.Count(rule => rule.IsArchived != true) ?? 0,
                rules = _activeRulePack?.Rules,
                templateMap = _activeRulePack?.TemplateMap,
                approvedMappings = _activeRulePack?.ApprovedMappings,
                manifest = _activeRulePack?.Manifest,
                generation = _rulePackGeneration,
                sessionSnapshot = updatedSnapshot
            };
        }

        private object LaunchRuleEditor()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string currentPackPath = Path.GetFullPath(_activeRulePack?.RootPath ?? _rulePackPath);

                // Check packaged or development paths for native RuleEditor.exe
                string[] candidateExePaths =
                {
                    Path.Combine(baseDir, "RuleEditor.exe"),
                    Path.Combine(baseDir, "..", "RuleEditor", "RuleEditor.exe"),
                    Path.Combine(baseDir, "..", "..", "publish", "RuleEditor", "RuleEditor.exe")
                };

                string? foundExe = candidateExePaths.FirstOrDefault(File.Exists);

#if DEBUG
                if (foundExe == null)
                {
                    string repoRoot = PathUtils.FindRepoRoot();
                    string devDebugExe = Path.Combine(repoRoot, "src", "backend", "AHUVerification.RuleEditor", "bin", "Debug", "net8.0-windows", "RuleEditor.exe");
                    string devReleaseExe = Path.Combine(repoRoot, "src", "backend", "AHUVerification.RuleEditor", "bin", "Release", "net8.0-windows", "RuleEditor.exe");
                    if (File.Exists(devDebugExe)) foundExe = devDebugExe;
                    else if (File.Exists(devReleaseExe)) foundExe = devReleaseExe;
                }
#endif

                if (foundExe != null)
                {
                    var startInfo = new ProcessStartInfo(foundExe)
                    {
                        UseShellExecute = true,
                        Arguments = $"--rule-pack \"{currentPackPath}\""
                    };
                    _processLauncher(startInfo);
                    return new { success = true, path = foundExe, rulePack = currentPackPath };
                }

                string distEditor = Path.Combine(baseDir, "dist", "rule-editor.html");
                if (File.Exists(distEditor))
                {
                    _processLauncher(new ProcessStartInfo(distEditor) { UseShellExecute = true });
                    return new { success = true, path = distEditor };
                }

                string repoRootFallback = PathUtils.FindRepoRoot();
                string repoEditor = Path.Combine(repoRootFallback, "dist", "rule-editor.html");
                if (File.Exists(repoEditor))
                {
                    _processLauncher(new ProcessStartInfo(repoEditor) { UseShellExecute = true });
                    return new { success = true, path = repoEditor };
                }

                string devUrl = "http://localhost:5173/rule-editor.html";
                _processLauncher(new ProcessStartInfo(devUrl) { UseShellExecute = true });
                return new { success = true, url = devUrl };
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Could not launch Rule & Logic Editor: {ex.Message}", ex);
            }
        }

        private object ResolveRulePackLocation(JsonElement payload)
        {
            string? configured = null;
            if (payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("configuredPath", out var prop) && prop.ValueKind == JsonValueKind.String)
            {
                configured = prop.GetString();
            }

            var resolved = RulePackLocationResolver.ResolveLocation(configured);
            return new
            {
                path = resolved.Path,
                isAutoDetected = resolved.IsAutoDetected,
                sourceType = resolved.SourceType
            };
        }

        private async Task<object> CheckAppUpdateAsync()
        {
            var res = await _updateService.CheckForUpdatesAsync();
            return new
            {
                isInstalled = res.IsInstalled,
                hasUpdate = res.HasUpdate,
                currentVersion = res.CurrentVersion,
                remoteVersion = res.RemoteVersion,
                error = res.Error
            };
        }

        private async Task<object> DownloadAppUpdateAsync()
        {
            bool success = await _updateService.DownloadUpdatesAsync();
            return new { success, error = _updateService.LastDownloadError };
        }

        private object ApplyAppUpdate()
        {
            _updateService.ApplyUpdatesAndRestart();
            return new { success = true };
        }

        private object OpenProjectSession(JsonElement payload)
        {
            if (_activeRulePack == null) LoadActiveRulePack();
            if (_activeRulePack == null)
                throw new InvalidOperationException("Active rule pack bundle not loaded.");

            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<OpenSourceCommand>(payload.GetRawText(), options)
                ?? new OpenSourceCommand();

            // Enforce CE1 source authenticity: renderer payload cannot assert trust.
            // Source is trusted ONLY if host reads and extracts an authentic file directly from disk
            // that was authorized by native picker or presents a valid host-issued handle.
            cmd.IsTrusted = false;

            string? sourceHandle = !string.IsNullOrWhiteSpace(cmd.SourceHandle)
                ? cmd.SourceHandle
                : BridgeValidation.GetStringPropertyOrDefault(payload, "sourceHandle", "");
            bool isAuthorized = IsSourcePathAuthorized(cmd.FilePath, sourceHandle);

            if (!string.IsNullOrWhiteSpace(cmd.FilePath) && File.Exists(cmd.FilePath))
            {
                if (cmd.FilePath.EndsWith(".upz", StringComparison.OrdinalIgnoreCase))
                {
                    var bundle = _upzExtractor.Extract(cmd.FilePath);
                    cmd.ConfigXml = bundle.RawConfigXml;
                    cmd.OrderRevXml = bundle.RawOrderRevXml;
                    cmd.ManifestXml = bundle.RawManifestXml;
                    cmd.IsUpz = true;
                    cmd.IsTrusted = isAuthorized;
                    if (isAuthorized)
                    {
                        cmd.InitialChecklists = null;
                    }
                }
                else if (cmd.FilePath.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
                {
                    cmd.ConfigXml = File.ReadAllText(cmd.FilePath);
                    cmd.IsUpz = false;
                    // Reading a standalone XML file from disk authenticates only that XML configuration.
                    // It does not authenticate OrderRev or Manifest data, and cannot retain renderer-supplied OrderRev/Manifest data.
                    cmd.OrderRevXml = null;
                    cmd.ManifestXml = null;
                    cmd.IsTrusted = isAuthorized;
                    if (isAuthorized)
                    {
                        cmd.InitialChecklists = null;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(cmd.ConfigXml))
            {
                throw new ArgumentException("Opening a project session requires either a valid filePath on disk or configXml content in payload.");
            }

            return _sessionService.OpenSource(cmd, _activeRulePack, _rulePackGeneration);
        }

        private object GetProjectSessionSnapshot()
        {
            var snapshot = _sessionService.GetCurrentSnapshot();
            if (snapshot == null)
            {
                throw new InvalidOperationException("No active project session exists.");
            }
            return snapshot;
        }

        private object OverrideProjectSessionFact(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<OverrideFactCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid OverrideFactCommand payload");
            return _sessionService.OverrideFact(cmd);
        }

        private object BatchOverrideProjectSessionFacts(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<BatchOverrideFactsCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid BatchOverrideFactsCommand payload");
            return _sessionService.BatchOverrideFacts(cmd);
        }

        private object RevertProjectSessionFact(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<RevertFactCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid RevertFactCommand payload");
            return _sessionService.RevertFact(cmd);
        }

        private object UpdateProjectSessionChecklist(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<UpdateChecklistCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid UpdateChecklistCommand payload");
            return _sessionService.UpdateChecklist(cmd);
        }

        private object UpdateProjectSessionSpecialQuote(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<UpdateSpecialQuoteCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid UpdateSpecialQuoteCommand payload");
            return _sessionService.UpdateSpecialQuote(cmd);
        }

        private object DeleteProjectSessionSpecialQuote(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<DeleteSpecialQuoteCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid DeleteSpecialQuoteCommand payload");
            return _sessionService.DeleteSpecialQuote(cmd);
        }

        private object ReorderProjectSessionSpecialQuotes(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<ReorderSpecialQuotesCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid ReorderSpecialQuotesCommand payload");
            return _sessionService.ReorderSpecialQuotes(cmd);
        }

        private object UpdateProjectSessionGeneralComments(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<UpdateGeneralCommentsCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid UpdateGeneralCommentsCommand payload");
            return _sessionService.UpdateGeneralComments(cmd);
        }

        private object ResetProjectSession(JsonElement payload)
        {
            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<ResetSessionCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid ResetSessionCommand payload");
            return _sessionService.ResetSession(cmd);
        }

        private object CreateManualProjectSession(JsonElement payload)
        {
            if (_activeRulePack == null) LoadActiveRulePack();
            if (_activeRulePack == null)
                throw new InvalidOperationException(_rulePackError ?? "Active rule pack bundle not loaded.");

            var options = JsonDefaults.CreateFlexibleOptions();
            var cmd = JsonSerializer.Deserialize<CreateManualProjectCommand>(payload.GetRawText(), options)
                ?? throw new ArgumentException("Invalid CreateManualProjectCommand payload");

            return _sessionService.CreateManualProject(cmd, _activeRulePack, _rulePackGeneration);
        }

        private object GetSegmentTemplates()
        {
            return ManualUnitFactory.AvailableSegmentTemplates;
        }
    }
}
