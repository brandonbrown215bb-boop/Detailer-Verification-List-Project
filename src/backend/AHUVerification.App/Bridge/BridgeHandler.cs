using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Forms;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;
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

        private RulePackBundle? _activeRulePack;
        private readonly string _rulePackPath;

        public BridgeHandler(string rulePackPath) : this(null, rulePackPath)
        {
        }

        public BridgeHandler(Form? parentForm, string rulePackPath)
        {
            _parentForm = parentForm;
            _rulePackPath = rulePackPath;
            LoadActiveRulePack();
        }

        private void LoadActiveRulePack()
        {
            if (!Directory.Exists(_rulePackPath))
                throw new DirectoryNotFoundException($"Rule pack directory not found: {_rulePackPath}");

            _activeRulePack = _rulePackManager.LoadFromDirectory(_rulePackPath);
        }

        public BridgeResponse Handle(string jsonMessage)
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
                    "exportExcelDeliverable" => ExportExcelDeliverable(req.Payload),
                    "openFile" => OpenFile(req.Payload),
                    "showInExplorer" => ShowInExplorer(req.Payload),
                    "checkRulePackUpdate" => CheckRulePackUpdate(req.Payload),
                    "syncRulePack" => SyncRulePack(req.Payload),
                    "selectFolderDialog" => ShowSelectFolderDialog(),
                    "launchRuleEditor" => LaunchRuleEditor(),
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
                appVersion = "1.0.0",
                rulePackVersion = _activeRulePack?.Manifest.Version ?? "Unavailable",
                ruleCount = _activeRulePack?.Rules.Count(rule => rule.IsArchived != true) ?? 0,
                isDesktopHost = true
            };
        }

        private object GetRulePack()
        {
            if (_activeRulePack == null) LoadActiveRulePack();
            return new
            {
                manifest = _activeRulePack?.Manifest,
                rules = _activeRulePack?.Rules,
                templateMap = _activeRulePack?.TemplateMap,
                approvedMappings = _activeRulePack?.ApprovedMappings
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
                    if (ofd.FileName.EndsWith(".upz", StringComparison.OrdinalIgnoreCase))
                    {
                        var bundle = _upzExtractor.Extract(ofd.FileName);
                        result = new
                        {
                            fileName = Path.GetFileName(ofd.FileName),
                            filePath = ofd.FileName,
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

        private object ExportExcelDeliverable(JsonElement payload)
        {
            var factsEl = BridgeValidation.RequireObjectProperty(payload, "exportExcelDeliverable", "facts");
            var sqEl = BridgeValidation.RequireArrayProperty(payload, "exportExcelDeliverable", "sqItems");
            var clEl = BridgeValidation.RequireArrayProperty(payload, "exportExcelDeliverable", "checklists");

            if (_activeRulePack == null) LoadActiveRulePack();
            if (_activeRulePack == null)
                throw new InvalidOperationException("Active rule pack bundle not loaded.");

            string templatePath = _activeRulePack.TemplatePath;
            if (!File.Exists(templatePath))
            {
                string fallback = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources", "rulepack", "template.xlsx");
                if (File.Exists(fallback))
                {
                    templatePath = fallback;
                }
                else
                {
                    string repoFallback = Path.Combine(PathUtils.FindRepoRoot(), "resources", "rulepack", "template.xlsx");
                    if (File.Exists(repoFallback))
                    {
                        templatePath = repoFallback;
                    }
                    else
                    {
                        string repoRootTemplate = Path.Combine(PathUtils.FindRepoRoot(), "Detailing Verification List.xlsx");
                        if (File.Exists(repoRootTemplate))
                        {
                            templatePath = repoRootTemplate;
                        }
                    }
                }
            }

            if (!File.Exists(templatePath))
            {
                throw new FileNotFoundException($"Excel template file 'template.xlsx' or 'Detailing Verification List.xlsx' could not be found in active rule pack or repository locations.", templatePath);
            }

            var options = JsonDefaults.CreateFlexibleOptions();
            var facts = JsonSerializer.Deserialize<Dictionary<string, Fact>>(factsEl.GetRawText(), options) ?? new();
            var sqItems = JsonSerializer.Deserialize<List<SpecialQuote>>(sqEl.GetRawText(), options) ?? new();
            var checklists = JsonSerializer.Deserialize<List<ChecklistInstance>>(clEl.GetRawText(), options) ?? new();
            string generalComments = BridgeValidation.GetStringPropertyOrDefault(payload, "generalComments", "");
            string defaultName = BridgeValidation.GetStringPropertyOrDefault(payload, "defaultName", "Detailing_Verification_List.xlsx");
            bool isDraft = BridgeValidation.GetBooleanPropertyOrDefault(payload, "isDraft", false);

            List<RuleDefinition> rules = _activeRulePack.Rules;
            if (payload.TryGetProperty("rules", out var rEl) && rEl.ValueKind == JsonValueKind.Array)
            {
                var customRules = JsonSerializer.Deserialize<List<RuleDefinition>>(rEl.GetRawText(), options);
                if (customRules != null && customRules.Count > 0)
                {
                    rules = customRules;
                }
            }

            string? chosenPath = null;
            if (payload.TryGetProperty("outputPath", out var opEl) &&
                opEl.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(opEl.GetString()))
            {
                chosenPath = opEl.GetString();
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

            NormalizedXmlGraph? graph = null;
            if (payload.TryGetProperty("graph", out var gEl) && gEl.ValueKind == JsonValueKind.Object)
            {
                graph = JsonSerializer.Deserialize<NormalizedXmlGraph>(gEl.GetRawText(), options);
            }

            _patcher.PatchTemplate(
                templatePath,
                chosenPath,
                _activeRulePack.TemplateMap,
                facts,
                sqItems,
                checklists,
                rules,
                generalComments,
                isDraft,
                graph
            );

            return new
            {
                exported = true,
                filePath = chosenPath,
                fileName = Path.GetFileName(chosenPath)
            };
        }

        private object OpenFile(JsonElement payload)
        {
            string path = BridgeValidation.RequireStringProperty(payload, "openFile", "filePath");
            if (!File.Exists(path)) throw new FileNotFoundException("File not found to open.", path);

            Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
            return new { opened = true };
        }

        private object ShowInExplorer(JsonElement payload)
        {
            string path = BridgeValidation.RequireStringProperty(payload, "showInExplorer", "filePath");
            if (!File.Exists(path) && !Directory.Exists(path))
                throw new FileNotFoundException("Target path not found.", path);

            string argument = $"/select,\"{path}\"";
            Process.Start("explorer.exe", argument);
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
            if (success)
            {
                _activeRulePack = _rulePackManager.LoadFromDirectory(active);
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
                manifest = _activeRulePack?.Manifest
            };
        }

        private object LaunchRuleEditor()
        {
            try
            {
                string distEditor = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist", "rule-editor.html");
                if (File.Exists(distEditor))
                {
                    Process.Start(new ProcessStartInfo(distEditor) { UseShellExecute = true });
                    return new { success = true, path = distEditor };
                }

                string repoRoot = PathUtils.FindRepoRoot();
                string repoEditor = Path.Combine(repoRoot, "dist", "rule-editor.html");
                if (File.Exists(repoEditor))
                {
                    Process.Start(new ProcessStartInfo(repoEditor) { UseShellExecute = true });
                    return new { success = true, path = repoEditor };
                }

                string devUrl = "http://localhost:5173/rule-editor.html";
                Process.Start(new ProcessStartInfo(devUrl) { UseShellExecute = true });
                return new { success = true, url = devUrl };
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Could not launch Rule & Logic Editor: {ex.Message}", ex);
            }
        }
    }
}
