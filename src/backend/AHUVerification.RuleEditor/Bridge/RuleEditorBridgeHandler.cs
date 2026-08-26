using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Forms;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.RuleEditor.Bridge
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

    public class RuleEditorBridgeHandler
    {
        private readonly Form _parentForm;
        private readonly RulePackManager _rulePackManager = new();
        private readonly NormalizedXmlParser _xmlParser = new();
        private readonly FactExtractor _factExtractor = new();
        private readonly string _rulePackPath;
        private RulePackBundle? _activeRulePack;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        public RuleEditorBridgeHandler(Form parentForm, string rulePackPath)
        {
            _parentForm = parentForm;
            _rulePackPath = rulePackPath;
            LoadRulePack();
        }

        private void LoadRulePack()
        {
            if (Directory.Exists(_rulePackPath))
            {
                _activeRulePack = _rulePackManager.LoadFromDirectory(_rulePackPath);
            }
        }

        public BridgeResponse Handle(string jsonMessage)
        {
            BridgeRequest? req;
            try
            {
                req = JsonSerializer.Deserialize<BridgeRequest>(jsonMessage, JsonOptions);
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
                    "publishRulePack" => PublishRulePack(req.Payload),
                    "parseSampleXml" => ParseSampleXml(req.Payload),
                    "openFileDialog" => ShowOpenFileDialog(),
                    "selectFolderDialog" => ShowSelectFolderDialog(),
                    _ => throw new NotSupportedException($"Unsupported Rule Editor bridge action: {req.Action}")
                };

                return new BridgeResponse
                {
                    Id = req.Id,
                    Success = true,
                    Data = result
                };
            }
            catch (Exception ex)
            {
                return new BridgeResponse
                {
                    Id = req.Id,
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        private object GetAppInfo()
        {
            return new
            {
                AppName = "AHU Verification • Rule & Logic Editor",
                AppVersion = "1.0.0",
                RulePackVersion = _activeRulePack?.Manifest.Version ?? "14.0.0",
                RuleCount = _activeRulePack?.Rules.Count ?? 0,
                IsDesktopHost = true
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
            string version = payload.GetProperty("version").GetString() ?? "14.0.0";
            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(payload.GetProperty("rules").GetRawText(), JsonOptions) ?? new();
            var templateMap = JsonSerializer.Deserialize<TemplateMap>(payload.GetProperty("templateMap").GetRawText(), JsonOptions) ?? new();
            var approvedMappings = payload.GetProperty("approvedMappings");

            string templatePath = Path.Combine(_rulePackPath, "template.xlsx");
            if (!File.Exists(templatePath))
            {
                // Look for repository fallback
                string repoRoot = FindRepoRoot();
                string fallback = Path.Combine(repoRoot, "resources", "rulepack", "template.xlsx");
                if (File.Exists(fallback)) templatePath = fallback;
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

            // 2. Also publish to src/rulepack and resources/rulepack in repository root if available
            string repoDir = FindRepoRoot();
            string srcRulepack = Path.Combine(repoDir, "src", "rulepack");
            string resRulepack = Path.Combine(repoDir, "resources", "rulepack");

            if (Directory.Exists(srcRulepack) && !string.Equals(Path.GetFullPath(srcRulepack), Path.GetFullPath(_rulePackPath), StringComparison.OrdinalIgnoreCase))
            {
                _rulePackManager.PublishToDirectory(srcRulepack, version, rules, templateMap, approvedMappings, templatePath);
            }
            if (Directory.Exists(resRulepack) && !string.Equals(Path.GetFullPath(resRulepack), Path.GetFullPath(_rulePackPath), StringComparison.OrdinalIgnoreCase))
            {
                _rulePackManager.PublishToDirectory(resRulepack, version, rules, templateMap, approvedMappings, templatePath);
            }

            // 3. If target distribution path was specified (e.g. remote share / OneDrive folder)
            if (payload.TryGetProperty("targetPath", out var targetProp) && !string.IsNullOrWhiteSpace(targetProp.GetString()))
            {
                string targetDir = targetProp.GetString()!;
                if (Directory.Exists(targetDir))
                {
                    _rulePackManager.PublishToDirectory(targetDir, version, rules, templateMap, approvedMappings, templatePath);
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

        private object ParseSampleXml(JsonElement payload)
        {
            string rawXml = payload.GetProperty("xmlContent").GetString() ?? "";
            var graph = _xmlParser.Parse(rawXml);
            var facts = _factExtractor.ExtractFacts(graph);

            return new
            {
                graph,
                facts
            };
        }

        private object? ShowOpenFileDialog()
        {
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

        private static string FindRepoRoot()
        {
            string current = AppContext.BaseDirectory;
            for (int i = 0; i < 10; i++)
            {
                if (File.Exists(Path.Combine(current, "Detailing Verification List.xlsx")) ||
                    File.Exists(Path.Combine(current, "package.json")))
                {
                    return current;
                }
                var parent = Directory.GetParent(current);
                if (parent == null) break;
                current = parent.FullName;
            }
            return Directory.GetCurrentDirectory();
        }
    }
}
