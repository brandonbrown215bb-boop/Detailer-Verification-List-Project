using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
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
                appVersion = ApplicationVersion.Current,
                rulePackVersion = _activeRulePack?.Manifest.Version ?? "Unavailable",
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
            string version = BridgeValidation.RequireStringProperty(payload, "publishRulePack", "version").Trim();
            if (version.StartsWith("v", StringComparison.OrdinalIgnoreCase)) version = version[1..];
            if (!Regex.IsMatch(version, @"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$"))
                throw new InvalidOperationException($"Invalid Rule Pack version '{version}'. Use SemVer such as 1.2.3 or 1.2.3-rc1.");
            var rulesEl = BridgeValidation.RequireArrayProperty(payload, "publishRulePack", "rules");
            var tmEl = BridgeValidation.RequireObjectProperty(payload, "publishRulePack", "templateMap");

            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rulesEl.GetRawText(), JsonOptions) ?? new();
            var templateMap = JsonSerializer.Deserialize<TemplateMap>(tmEl.GetRawText(), JsonOptions) ?? new();

            JsonElement approvedMappings;
            if (payload.TryGetProperty("approvedMappings", out var amEl) &&
                amEl.ValueKind != JsonValueKind.Undefined &&
                amEl.ValueKind != JsonValueKind.Null)
            {
                if (amEl.ValueKind != JsonValueKind.Object)
                    throw new InvalidOperationException("publishRulePack.approvedMappings must be an object.");
                approvedMappings = amEl;
            }
            else if (_activeRulePack != null && _activeRulePack.ApprovedMappings.ValueKind != JsonValueKind.Undefined && _activeRulePack.ApprovedMappings.ValueKind != JsonValueKind.Null)
            {
                approvedMappings = _activeRulePack.ApprovedMappings.Clone();
            }
            else
            {
                using var emptyDoc = JsonDocument.Parse("{}");
                approvedMappings = emptyDoc.RootElement.Clone();
            }

            string contractPath = Path.Combine(_rulePackPath, "fact_contract.json");
            if (!File.Exists(contractPath))
            {
                string repoRoot = PathUtils.FindRepoRoot();
                string fallbackContract = Path.Combine(repoRoot, "resources", "rulepack", "fact_contract.json");
                if (File.Exists(fallbackContract)) contractPath = fallbackContract;
            }
            if (!File.Exists(contractPath))
                throw new FileNotFoundException($"Rule pack fact_contract.json not found at: {contractPath}");
            using (var contractDoc = JsonDocument.Parse(File.ReadAllText(contractPath)))
            using (var rulesDoc = JsonDocument.Parse(rulesEl.GetRawText()))
            using (var tmDoc = JsonDocument.Parse(tmEl.GetRawText()))
            {
                FactContractValidator.Validate(contractDoc.RootElement, rulesDoc.RootElement, tmDoc.RootElement);
            }

            string templatePath = Path.Combine(_rulePackPath, "template.xlsx");
            if (!File.Exists(templatePath))
            {
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

            string activePath = Path.GetFullPath(_rulePackPath);
            string? targetDir = null;
            if (payload.TryGetProperty("targetPath", out var targetProp) &&
                targetProp.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(targetProp.GetString()))
            {
                targetDir = Path.GetFullPath(targetProp.GetString()!);
                if (!Path.IsPathRooted(targetDir))
                    throw new InvalidOperationException("publishRulePack.targetPath must be an absolute path.");
                if (string.Equals(targetDir, activePath, StringComparison.OrdinalIgnoreCase) ||
                    targetDir.StartsWith(activePath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) ||
                    activePath.StartsWith(targetDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("publishRulePack.targetPath must be separate from the active Rule Pack directory.");
            }

            string transactionRoot = Path.Combine(Path.GetTempPath(), $"rulepack_{Guid.NewGuid():N}");
            string activeStage = Path.Combine(transactionRoot, "active");
            RulePackBundle published;
            DirectoryPromotion? activePromotion = null;
            DirectoryPromotion? targetPromotion = null;
            try
            {
                Directory.CreateDirectory(transactionRoot);
                published = _rulePackManager.PublishToDirectory(
                    activeStage,
                    version,
                    rules,
                    templateMap,
                    approvedMappings,
                    templatePath
                );

                // Validate every output before changing either destination. The
                // target distribution copy is staged independently so a failed
                // share write cannot leave the active pack half-published.
                if (targetDir != null)
                {
                    string targetStage = Path.Combine(transactionRoot, "target");
                    _rulePackManager.PublishToDirectory(targetStage, version, rules, templateMap, approvedMappings, templatePath);
                    _ = _rulePackManager.LoadFromDirectory(targetStage);
                    targetPromotion = PromoteDirectory(targetStage, targetDir);
                }

                activePromotion = PromoteDirectory(activeStage, activePath);
                // Load the promoted directory rather than retaining the staging
                // object. This is the publish -> reload proof used by the UI.
                published = _rulePackManager.LoadFromDirectory(activePath);
                FinalizePromotion(targetPromotion);
                FinalizePromotion(activePromotion);
            }
            catch
            {
                RollbackPromotion(activePromotion);
                RollbackPromotion(targetPromotion);
                throw;
            }
            finally
            {
                if (Directory.Exists(transactionRoot))
                {
                    try { Directory.Delete(transactionRoot, true); } catch { }
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

        private sealed class DirectoryPromotion
        {
            public required string Destination { get; init; }
            public string? Backup { get; init; }
        }

        private static DirectoryPromotion PromoteDirectory(string staged, string destination)
        {
            if (File.Exists(destination))
                throw new IOException($"Rule Pack destination is a file, not a directory: {destination}");
            string? parent = Path.GetDirectoryName(destination);
            if (string.IsNullOrWhiteSpace(parent))
                throw new IOException($"Rule Pack destination has no parent directory: {destination}");
            Directory.CreateDirectory(parent);

            string? backup = null;
            if (Directory.Exists(destination))
            {
                backup = destination + ".backup_" + Guid.NewGuid().ToString("N");
                Directory.Move(destination, backup);
            }

            try
            {
                Directory.Move(staged, destination);
                return new DirectoryPromotion { Destination = destination, Backup = backup };
            }
            catch
            {
                if (Directory.Exists(destination)) Directory.Delete(destination, true);
                if (backup != null && Directory.Exists(backup)) Directory.Move(backup, destination);
                throw;
            }
        }

        private static void FinalizePromotion(DirectoryPromotion? promotion)
        {
            if (promotion?.Backup == null || !Directory.Exists(promotion.Backup)) return;
            try { Directory.Delete(promotion.Backup, true); } catch { /* cleanup is best effort after promotion */ }
        }

        private static void RollbackPromotion(DirectoryPromotion? promotion)
        {
            if (promotion == null) return;
            try
            {
                if (Directory.Exists(promotion.Destination)) Directory.Delete(promotion.Destination, true);
                if (promotion.Backup != null && Directory.Exists(promotion.Backup))
                    Directory.Move(promotion.Backup, promotion.Destination);
            }
            catch
            {
                // Preserve the original publish error. The backup remains for
                // operator recovery if Windows has a file lock during rollback.
            }
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
