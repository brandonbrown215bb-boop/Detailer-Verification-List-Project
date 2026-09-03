using System;
using System.Collections.Generic;
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

namespace AHUVerification.RuleEditor.Bridge
{
    public class RuleEditorBridgeHandler
    {
        private readonly Form? _parentForm;
        private readonly RulePackManager _rulePackManager = new();
        private readonly string _rulePackPath;
        private RulePackBundle? _activeRulePack;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        public RuleEditorBridgeHandler(string rulePackPath) : this(null, rulePackPath)
        {
        }

        public RuleEditorBridgeHandler(Form? parentForm, string rulePackPath)
        {
            _parentForm = parentForm;
            _rulePackPath = rulePackPath;
            LoadRulePack();
        }

        private void LoadRulePack()
        {
            if (Directory.Exists(_rulePackPath) && File.Exists(Path.Combine(_rulePackPath, "manifest.json")))
            {
                _activeRulePack = _rulePackManager.LoadFromDirectory(_rulePackPath);
            }
        }

        public BridgeResponse Handle(string jsonMessage)
        {
            string reqId = BridgeRequest.ExtractRequestId(jsonMessage);

            if (string.IsNullOrWhiteSpace(jsonMessage))
            {
                return BridgeResponse.Fail(reqId, "Invalid empty request message");
            }

            BridgeRequest? req;
            try
            {
                req = JsonSerializer.Deserialize<BridgeRequest>(jsonMessage, JsonOptions);
                if (req == null)
                    return BridgeResponse.Fail(reqId, "Invalid null request");
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
                    "publishRulePack" => PublishRulePack(req.Payload),
                    "openFileDialog" => ShowOpenFileDialog(),
                    "selectFolderDialog" => ShowSelectFolderDialog(),
                    _ => throw new NotSupportedException($"Unsupported Rule Editor bridge action: '{req.Action}'")
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
                appName = "AHU Verification • Rule & Logic Editor",
                appVersion = "1.0.0",
                rulePackVersion = _activeRulePack?.Manifest.Version ?? "14.0.0",
                ruleCount = _activeRulePack?.Rules.Count ?? 0,
                isDesktopHost = true
            };
        }

        private object GetRulePack()
        {
            if (_activeRulePack == null)
            {
                LoadRulePack();
            }

            if (_activeRulePack == null)
                throw new InvalidOperationException("Failed to load active rule pack");

            return new
            {
                rules = _activeRulePack.Rules,
                templateMap = _activeRulePack.TemplateMap,
                approvedMappings = _activeRulePack.ApprovedMappings,
                manifest = _activeRulePack.Manifest
            };
        }

        private object PublishRulePack(JsonElement payload)
        {
            string version = BridgeValidation.RequireStringProperty(payload, "publishRulePack", "version");
            var rulesEl = BridgeValidation.RequireArrayProperty(payload, "publishRulePack", "rules");
            var tmEl = BridgeValidation.RequireObjectProperty(payload, "publishRulePack", "templateMap");

            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rulesEl.GetRawText(), JsonOptions) ?? new();
            var templateMap = JsonSerializer.Deserialize<TemplateMap>(tmEl.GetRawText(), JsonOptions) ?? new();

            JsonElement approvedMappings;
            if (payload.TryGetProperty("approvedMappings", out var amEl) &&
                amEl.ValueKind != JsonValueKind.Undefined &&
                amEl.ValueKind != JsonValueKind.Null)
            {
                approvedMappings = amEl;
            }
            else
            {
                using var emptyDoc = JsonDocument.Parse("{}");
                approvedMappings = emptyDoc.RootElement.Clone();
            }

            string templatePath = Path.Combine(_rulePackPath, "template.xlsx");
            if (!File.Exists(templatePath))
            {
                // Look for repository fallback
                string repoRoot = PathUtils.FindRepoRoot();
                string fallbackRes = Path.Combine(repoRoot, "resources", "rulepack", "template.xlsx");
                if (File.Exists(fallbackRes))
                {
                    templatePath = fallbackRes;
                }
                else
                {
                    string rootXlsx = Path.Combine(repoRoot, "Detailing Verification List.xlsx");
                    if (File.Exists(rootXlsx)) templatePath = rootXlsx;
                }
            }

            if (!File.Exists(templatePath))
            {
                throw new FileNotFoundException($"Template Excel file 'template.xlsx' not found at: {templatePath}", templatePath);
            }

            // 1. Publish directly into local packaged rule pack directory
            var published = _rulePackManager.PublishToDirectory(
                _rulePackPath,
                version,
                rules,
                templateMap,
                approvedMappings,
                templatePath
            );

            // 2. If target distribution path was specified (e.g. remote share / OneDrive folder)
            if (payload.TryGetProperty("targetPath", out var targetProp) &&
                targetProp.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(targetProp.GetString()))
            {
                string targetDir = targetProp.GetString()!;
                try
                {
                    Directory.CreateDirectory(targetDir);
                    _rulePackManager.PublishToDirectory(targetDir, version, rules, templateMap, approvedMappings, templatePath);
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException($"Failed to publish to distribution folder '{targetDir}': {ex.Message}", ex);
                }
            }

            _activeRulePack = published;

            return new
            {
                success = true,
                version = published.Manifest.Version,
                bundleSha256 = published.Manifest.BundleSha256,
                totalRules = published.Rules.Count
            };
        }

        private object? ShowOpenFileDialog()
        {
            if (_parentForm == null) return null;

            string? selectedPath = null;
            _parentForm.Invoke(new Action(() =>
            {
                using var dialog = new OpenFileDialog
                {
                    Title = "Open Engineering Unit XML or UPZ Package",
                    Filter = "All Supported (*.xml;*.upz)|*.xml;*.upz|XML Files (*.xml)|*.xml|UPZ Bundles (*.upz)|*.upz"
                };

                if (dialog.ShowDialog(_parentForm) == DialogResult.OK)
                {
                    selectedPath = dialog.FileName;
                }
            }));

            if (string.IsNullOrEmpty(selectedPath)) return null;

            string content = File.ReadAllText(selectedPath);
            return new
            {
                fileName = Path.GetFileName(selectedPath),
                filePath = selectedPath,
                content
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
                    Description = "Select Target Rule Pack Distribution Folder"
                };

                if (dialog.ShowDialog(_parentForm) == DialogResult.OK)
                {
                    selectedPath = dialog.SelectedPath;
                }
            }));

            return selectedPath != null ? new { folderPath = selectedPath } : null;
        }
    }
}
