using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Forms;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.App.Bridge
{
    public class BridgeRequest
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("action")]
        public string Action { get; set; } = "";

        [JsonPropertyName("payload")]
        public JsonElement Payload { get; set; }
    }

    public class BridgeResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("data")]
        public object? Data { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }

    public class BridgeHandler
    {
        private readonly Form _parentForm;
        private readonly DvlProjectManager _projectManager = new();
        private readonly OpenXmlTemplatePatcher _patcher = new();
        private readonly RulePackManager _rulePackManager = new();
        private readonly UpzBundleExtractor _upzExtractor = new();

        private RulePackBundle? _activeRulePack;
        private readonly string _rulePackPath;

        public BridgeHandler(Form parentForm, string rulePackPath)
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
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new JsonStringEnumConverter() }
            };

            BridgeRequest? req;
            try
            {
                req = JsonSerializer.Deserialize<BridgeRequest>(jsonMessage, options);
                if (req == null)
                    return new BridgeResponse { Success = false, Error = "Invalid null request" };
            }
            catch (Exception ex)
            {
                return new BridgeResponse { Success = false, Error = $"Deserialization error: {ex.Message}" };
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
                    _ => throw new InvalidOperationException($"Unknown bridge action: '{req.Action}'")
                };

                return new BridgeResponse { Id = req.Id, Success = true, Data = result };
            }
            catch (Exception ex)
            {
                return new BridgeResponse { Id = req.Id, Success = false, Error = ex.Message };
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
            string defaultName = payload.TryGetProperty("defaultName", out var n) ? n.GetString() ?? "Project.dvl" : "Project.dvl";
            string filter = payload.TryGetProperty("filter", out var f) ? f.GetString() ?? "DVL Project (*.dvl)|*.dvl" : "DVL Project (*.dvl)|*.dvl";

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
            string filePath = payload.GetProperty("filePath").GetString() ?? "";
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
            string targetPath = payload.GetProperty("filePath").GetString() ?? "";
            string dvlJson = payload.GetProperty("projectJson").GetString() ?? "";
            _projectManager.SaveJsonToFile(dvlJson, targetPath);
            return new { saved = true, path = Path.GetFullPath(targetPath) };
        }

        private object ExportExcelDeliverable(JsonElement payload)
        {
            if (_activeRulePack == null) LoadActiveRulePack();
            if (_activeRulePack == null)
                throw new InvalidOperationException("Active rule pack bundle not loaded.");

            string templatePath = _activeRulePack.TemplatePath;
            if (!File.Exists(templatePath))
            {
                string fallback = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "resources", "rulepack", "template.xlsx");
                if (File.Exists(fallback)) templatePath = fallback;
            }

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true, Converters = { new JsonStringEnumConverter() } };
            var facts = JsonSerializer.Deserialize<Dictionary<string, Fact>>(payload.GetProperty("facts").GetRawText(), options) ?? new();
            var sqItems = JsonSerializer.Deserialize<List<SpecialQuote>>(payload.GetProperty("sqItems").GetRawText(), options) ?? new();
            var checklists = JsonSerializer.Deserialize<List<ChecklistInstance>>(payload.GetProperty("checklists").GetRawText(), options) ?? new();
            string generalComments = payload.TryGetProperty("generalComments", out var gc) ? gc.GetString() ?? "" : "";
            string defaultName = payload.TryGetProperty("defaultName", out var dn) ? dn.GetString() ?? "Detailing_Verification_List.xlsx" : "Detailing_Verification_List.xlsx";
            bool isDraft = payload.TryGetProperty("isDraft", out var idf) && idf.GetBoolean();

            string? chosenPath = null;
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
                _activeRulePack.Rules,
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
            string path = payload.GetProperty("filePath").GetString() ?? "";
            if (!File.Exists(path)) throw new FileNotFoundException("File not found to open.", path);

            Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
            return new { opened = true };
        }

        private object ShowInExplorer(JsonElement payload)
        {
            string path = payload.GetProperty("filePath").GetString() ?? "";
            if (!File.Exists(path) && !Directory.Exists(path))
                throw new FileNotFoundException("Target path not found.", path);

            string argument = $"/select,\"{path}\"";
            Process.Start("explorer.exe", argument);
            return new { shown = true };
        }

        private object CheckRulePackUpdate(JsonElement payload)
        {
            string remotePath = payload.GetProperty("remotePath").GetString() ?? "";
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
            string remotePath = payload.GetProperty("remotePath").GetString() ?? "";
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
    }
}
