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
        private readonly AstRuleEvaluator _astEvaluator = new();
        private readonly string _rulePackPath;
        private readonly Func<string?>? _draftSavePathSelector;
        private readonly Func<string?>? _draftOpenPathSelector;
        private readonly string? _defaultPublishPath;
        private RulePackBundle? _activeRulePack;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };

        public RuleEditorBridgeHandler(string rulePackPath) : this(null, rulePackPath, null, null, null)
        {
        }

        public RuleEditorBridgeHandler(
            Form? parentForm,
            string rulePackPath,
            Func<string?>? draftSavePathSelector = null,
            Func<string?>? draftOpenPathSelector = null,
            string? defaultPublishPath = null)
        {
            _parentForm = parentForm;
            _rulePackPath = rulePackPath;
            _draftSavePathSelector = draftSavePathSelector;
            _draftOpenPathSelector = draftOpenPathSelector;
            _defaultPublishPath = defaultPublishPath;
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
                    "validateRulePack" => ValidateRulePack(req.Payload),
                    "saveDraft" => SaveDraft(req.Payload),
                    "openDraft" => OpenDraft(req.Payload),
                    "evaluateRuleSandbox" => EvaluateRuleSandbox(req.Payload),
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
                isDesktopHost = true,
                defaultPublishPath = _defaultPublishPath
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

        public class StructuredValidationError
        {
            [JsonPropertyName("ruleId")]
            public string? RuleId { get; set; }

            [JsonPropertyName("field")]
            public string? Field { get; set; }

            [JsonPropertyName("message")]
            public string Message { get; set; } = "";
        }

        public static TemplateMap SynchronizeTemplateMap(List<RuleDefinition> rules, TemplateMap? existingTemplateMap)
        {
            var tm = existingTemplateMap != null
                ? JsonSerializer.Deserialize<TemplateMap>(JsonSerializer.Serialize(existingTemplateMap, JsonOptions), JsonOptions) ?? new TemplateMap()
                : new TemplateMap();

            if (string.IsNullOrWhiteSpace(tm.TemplateVersion))
                tm.TemplateVersion = "1.0";

            tm.GeneralFields ??= new Dictionary<string, CellCoordinate>(StringComparer.Ordinal);
            tm.SqRange ??= new SqRangeMapping { Sheet = "Skid 1", StartRow = 1, EndRow = 50 };
            tm.RuleCellMappings ??= new Dictionary<string, RuleCellMapping>(StringComparer.Ordinal);

            var liveSemanticKeys = new HashSet<string>(rules.Where(r => !string.IsNullOrWhiteSpace(r.SemanticKey)).Select(r => r.SemanticKey), StringComparer.Ordinal);

            // Prune orphan semantic keys that no longer exist in rules
            var orphanKeys = tm.RuleCellMappings.Keys.Where(k => !liveSemanticKeys.Contains(k)).ToList();
            foreach (var key in orphanKeys)
            {
                tm.RuleCellMappings.Remove(key);
            }

            // Synchronize/generate cell mappings dynamically from excelRow
            foreach (var r in rules)
            {
                if (string.IsNullOrWhiteSpace(r.SemanticKey)) continue;

                if (tm.RuleCellMappings.TryGetValue(r.SemanticKey, out var existingMapping) && existingMapping != null && (!r.ExcelRow.HasValue || r.ExcelRow.Value <= 0))
                {
                    if (r.ExcelRow.HasValue && r.ExcelRow.Value <= 0)
                    {
                        existingMapping.RuleId = r.Id;
                        existingMapping.Row = r.ExcelRow.Value;
                        existingMapping.NaCell = $"S{r.ExcelRow.Value}";
                        existingMapping.DetailerCell = $"T{r.ExcelRow.Value}";
                        existingMapping.CheckerCell = $"V{r.ExcelRow.Value}";
                        existingMapping.CommentsCell = $"Y{r.ExcelRow.Value}";
                        existingMapping.InitialsCell = $"Z{r.ExcelRow.Value}";
                    }
                    else
                    {
                        existingMapping.RuleId = r.Id;
                    }
                }
                else
                {
                    int row = r.ExcelRow ?? 0;
                    tm.RuleCellMappings[r.SemanticKey] = new RuleCellMapping
                    {
                        RuleId = r.Id,
                        Row = row,
                        NaCell = $"S{row}",
                        DetailerCell = $"T{row}",
                        CheckerCell = $"V{row}",
                        CommentsCell = $"Y{row}",
                        InitialsCell = $"Z{row}"
                    };
                }
            }

            return tm;
        }

        private static List<StructuredValidationError> MapStructuredErrors(List<string> errorStrings, List<RuleDefinition>? rules)
        {
            var result = new List<StructuredValidationError>();
            foreach (var err in errorStrings)
            {
                string? ruleId = null;
                string? field = null;

                var ruleIndexMatch = Regex.Match(err, @"^rules\[(\d+)\]");
                if (ruleIndexMatch.Success && int.TryParse(ruleIndexMatch.Groups[1].Value, out int idx) && rules != null && idx >= 0 && idx < rules.Count)
                {
                    ruleId = rules[idx].Id;
                }

                if (err.Contains(".predicate"))
                {
                    field = "predicate";
                }
                else if (err.Contains(".requiredFacts"))
                {
                    field = "requiredFacts";
                }
                else if (err.Contains("duplicate or missing id"))
                {
                    field = "id";
                    var idMatch = Regex.Match(err, @"missing id '([^']*)'");
                    if (idMatch.Success && !string.IsNullOrEmpty(idMatch.Groups[1].Value)) ruleId = idMatch.Groups[1].Value;
                }
                else if (err.Contains("duplicate or missing semanticKey"))
                {
                    field = "semanticKey";
                }
                else if (err.Contains("unsupported scope"))
                {
                    field = "scope";
                }
                else if (err.Contains("unsupported verificationMode"))
                {
                    field = "verificationMode";
                }
                else if (err.Contains("unsupported category"))
                {
                    field = "category";
                }
                else if (err.StartsWith("template_map.ruleCellMappings", StringComparison.Ordinal))
                {
                    field = "excelRow";
                    var semKeyMatch = Regex.Match(err, @"ruleCellMappings\.([A-Za-z0-9_]+)");
                    if (semKeyMatch.Success && rules != null)
                    {
                        var matchingRule = rules.FirstOrDefault(r => r.SemanticKey == semKeyMatch.Groups[1].Value);
                        if (matchingRule != null) ruleId = matchingRule.Id;
                    }
                    else
                    {
                        var orphanMatch = Regex.Match(err, @"orphan semantic key '([^']*)'");
                        if (orphanMatch.Success) field = "semanticKey";
                        var missingMatch = Regex.Match(err, @"is missing '([^']*)'");
                        if (missingMatch.Success && rules != null)
                        {
                            var matchingRule = rules.FirstOrDefault(r => r.SemanticKey == missingMatch.Groups[1].Value);
                            if (matchingRule != null) ruleId = matchingRule.Id;
                        }
                    }
                }

                result.Add(new StructuredValidationError
                {
                    RuleId = ruleId,
                    Field = field,
                    Message = err
                });
            }
            return result;
        }

        private string GetFactContractPath()
        {
            string contractPath = Path.Combine(_rulePackPath, "fact_contract.json");
            if (!File.Exists(contractPath))
            {
                string repoRoot = PathUtils.FindRepoRoot();
                string fallbackContract = Path.Combine(repoRoot, "resources", "rulepack", "fact_contract.json");
                if (File.Exists(fallbackContract)) contractPath = fallbackContract;
            }
            if (!File.Exists(contractPath))
                throw new FileNotFoundException($"Rule pack fact_contract.json not found at: {contractPath}");
            return contractPath;
        }

        private static void NormalizeRules(List<RuleDefinition> rules, JsonElement contract)
        {
            foreach (var r in rules)
            {
                if (r.RequiredFacts != null)
                {
                    r.RequiredFacts = r.RequiredFacts.Select(f => FactContractValidator.CanonicalizeKey(f, contract)).ToList();
                }
                r.Predicate = FactContractValidator.NormalizePredicate(r.Predicate, contract);
            }
        }

        private object ValidateRulePack(JsonElement payload)
        {
            var rulesEl = BridgeValidation.RequireArrayProperty(payload, "validateRulePack", "rules");
            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rulesEl.GetRawText(), JsonOptions) ?? new();

            TemplateMap? templateMap = null;
            if (payload.TryGetProperty("templateMap", out var tmEl) && tmEl.ValueKind == JsonValueKind.Object)
            {
                templateMap = JsonSerializer.Deserialize<TemplateMap>(tmEl.GetRawText(), JsonOptions);
            }

            var updatedTemplateMap = SynchronizeTemplateMap(rules, templateMap);

            string contractPath = GetFactContractPath();
            using var contractDoc = JsonDocument.Parse(File.ReadAllText(contractPath));
            NormalizeRules(rules, contractDoc.RootElement);
            using var rulesDoc = JsonDocument.Parse(JsonSerializer.Serialize(rules, JsonOptions));
            using var tmDoc = JsonDocument.Parse(JsonSerializer.Serialize(updatedTemplateMap, JsonOptions));

            var errors = FactContractValidator.GetValidationErrors(contractDoc.RootElement, rulesDoc.RootElement, tmDoc.RootElement);
            var structuredErrors = MapStructuredErrors(errors, rules);

            return new
            {
                valid = structuredErrors.Count == 0,
                isValid = structuredErrors.Count == 0,
                errors = structuredErrors,
                templateMap = updatedTemplateMap,
                rules
            };
        }

        private object SaveDraft(JsonElement payload)
        {
            string? filePath = null;
            if (payload.TryGetProperty("filePath", out var fpEl) && fpEl.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(fpEl.GetString()))
            {
                filePath = fpEl.GetString();
            }

            var rulesEl = BridgeValidation.RequireArrayProperty(payload, "saveDraft", "rules");
            var rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rulesEl.GetRawText(), JsonOptions) ?? new();

            TemplateMap? templateMap = null;
            if (payload.TryGetProperty("templateMap", out var tmEl) && tmEl.ValueKind == JsonValueKind.Object)
            {
                templateMap = JsonSerializer.Deserialize<TemplateMap>(tmEl.GetRawText(), JsonOptions);
            }

            JsonElement approvedMappings;
            if (payload.TryGetProperty("approvedMappings", out var amEl) && amEl.ValueKind == JsonValueKind.Object)
            {
                approvedMappings = amEl.Clone();
            }
            else if (_activeRulePack != null && _activeRulePack.ApprovedMappings.ValueKind == JsonValueKind.Object)
            {
                approvedMappings = _activeRulePack.ApprovedMappings.Clone();
            }
            else
            {
                using var emptyDoc = JsonDocument.Parse("{}");
                approvedMappings = emptyDoc.RootElement.Clone();
            }

            RulePackManifest? manifest = null;
            if (payload.TryGetProperty("manifest", out var manEl) && manEl.ValueKind == JsonValueKind.Object)
            {
                manifest = JsonSerializer.Deserialize<RulePackManifest>(manEl.GetRawText(), JsonOptions);
            }
            manifest ??= _activeRulePack?.Manifest ?? new RulePackManifest { Name = "AHU Detailing Verification Rules", Version = "1.0.0" };

            // 1. Synchronize Excel cell mappings dynamically from rules
            var updatedTemplateMap = SynchronizeTemplateMap(rules, templateMap);

            // 2. Strict validation against fact contract before saving
            string contractPath = GetFactContractPath();
            using var contractDoc = JsonDocument.Parse(File.ReadAllText(contractPath));
            NormalizeRules(rules, contractDoc.RootElement);
            using var rulesDoc = JsonDocument.Parse(JsonSerializer.Serialize(rules, JsonOptions));
            using var tmDoc = JsonDocument.Parse(JsonSerializer.Serialize(updatedTemplateMap, JsonOptions));

            var validationErrors = FactContractValidator.GetValidationErrors(contractDoc.RootElement, rulesDoc.RootElement, tmDoc.RootElement);
            var structuredErrors = MapStructuredErrors(validationErrors, rules);

            if (structuredErrors.Count > 0)
            {
                return new
                {
                    success = false,
                    error = "Rule draft validation failed: " + string.Join("; ", validationErrors.Take(3)),
                    errors = structuredErrors
                };
            }

            // 3. Resolve destination file path
            string? destinationPath = filePath;
            if (string.IsNullOrWhiteSpace(destinationPath))
            {
                if (_draftSavePathSelector != null)
                {
                    destinationPath = _draftSavePathSelector();
                }
                else if (_parentForm != null)
                {
                    _parentForm.Invoke(new Action(() =>
                    {
                        using var dialog = new SaveFileDialog
                        {
                            Title = "Save Rule Pack Draft",
                            Filter = "JSON Files (*.json)|*.json|All Files (*.*)|*.*",
                            DefaultExt = "json",
                            FileName = $"rules_draft_v{manifest.Version}.json"
                        };

                        if (dialog.ShowDialog(_parentForm) == DialogResult.OK)
                        {
                            destinationPath = dialog.FileName;
                        }
                    }));
                }
            }

            if (string.IsNullOrWhiteSpace(destinationPath))
            {
                return new { success = false, cancelled = true, error = "Save cancelled by user" };
            }

            // 4. Write atomic draft
            destinationPath = Path.GetFullPath(destinationPath);
            string? dir = Path.GetDirectoryName(destinationPath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

            var draftPayload = new
            {
                manifest,
                rules,
                templateMap = updatedTemplateMap,
                approvedMappings
            };

            string jsonContent = JsonSerializer.Serialize(draftPayload, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                Converters = { new JsonStringEnumConverter() }
            });

            string tempFile = destinationPath + ".tmp_" + Guid.NewGuid().ToString("N");
            try
            {
                File.WriteAllText(tempFile, jsonContent);
                File.Move(tempFile, destinationPath, overwrite: true);
            }
            finally
            {
                if (File.Exists(tempFile))
                {
                    try { File.Delete(tempFile); } catch { }
                }
            }

            return new
            {
                success = true,
                filePath = destinationPath,
                fileName = Path.GetFileName(destinationPath),
                templateMap = updatedTemplateMap,
                manifest,
                rules
            };
        }

        private object OpenDraft(JsonElement payload)
        {
            string? sourcePath = null;
            if (payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("filePath", out var fpEl) && fpEl.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(fpEl.GetString()))
            {
                sourcePath = fpEl.GetString();
            }

            if (string.IsNullOrWhiteSpace(sourcePath))
            {
                if (_draftOpenPathSelector != null)
                {
                    sourcePath = _draftOpenPathSelector();
                }
                else if (_parentForm != null)
                {
                    _parentForm.Invoke(new Action(() =>
                    {
                        using var dialog = new OpenFileDialog
                        {
                            Title = "Open Rule Pack Draft",
                            Filter = "JSON Files (*.json)|*.json|All Files (*.*)|*.*"
                        };

                        if (dialog.ShowDialog(_parentForm) == DialogResult.OK)
                        {
                            sourcePath = dialog.FileName;
                        }
                    }));
                }
            }

            if (string.IsNullOrWhiteSpace(sourcePath))
            {
                return new { success = false, cancelled = true, error = "Open cancelled by user" };
            }

            sourcePath = Path.GetFullPath(sourcePath);
            if (!File.Exists(sourcePath))
            {
                throw new FileNotFoundException($"Draft file not found: {sourcePath}", sourcePath);
            }

            try
            {
                string rawText = File.ReadAllText(sourcePath);
                using var doc = JsonDocument.Parse(rawText);
                var root = doc.RootElement;

                List<RuleDefinition> rules;
                TemplateMap? templateMap = null;
                JsonElement approvedMappings = default;
                RulePackManifest? manifest = null;

                if (root.ValueKind == JsonValueKind.Array)
                {
                    rules = JsonSerializer.Deserialize<List<RuleDefinition>>(root.GetRawText(), JsonOptions) ?? new();
                }
                else if (root.ValueKind == JsonValueKind.Object)
                {
                    if (root.TryGetProperty("rules", out var rEl) && rEl.ValueKind == JsonValueKind.Array)
                    {
                        rules = JsonSerializer.Deserialize<List<RuleDefinition>>(rEl.GetRawText(), JsonOptions) ?? new();
                    }
                    else
                    {
                        throw new InvalidOperationException("Draft JSON must contain a 'rules' array.");
                    }

                    if (root.TryGetProperty("templateMap", out var tmEl) && tmEl.ValueKind == JsonValueKind.Object)
                    {
                        templateMap = JsonSerializer.Deserialize<TemplateMap>(tmEl.GetRawText(), JsonOptions);
                    }

                    if (root.TryGetProperty("approvedMappings", out var amEl) && amEl.ValueKind == JsonValueKind.Object)
                    {
                        approvedMappings = amEl.Clone();
                    }

                    if (root.TryGetProperty("manifest", out var manEl) && manEl.ValueKind == JsonValueKind.Object)
                    {
                        manifest = JsonSerializer.Deserialize<RulePackManifest>(manEl.GetRawText(), JsonOptions);
                    }
                }
                else
                {
                    throw new InvalidOperationException("Invalid draft JSON: must be an array or object.");
                }

                manifest ??= _activeRulePack?.Manifest ?? new RulePackManifest { Name = "AHU Detailing Verification Rules", Version = "1.0.0" };
                if (approvedMappings.ValueKind == JsonValueKind.Undefined || approvedMappings.ValueKind == JsonValueKind.Null)
                {
                    approvedMappings = _activeRulePack?.ApprovedMappings.Clone() ?? JsonDocument.Parse("{}").RootElement.Clone();
                }

                var updatedTemplateMap = SynchronizeTemplateMap(rules, templateMap);

                string contractPath = GetFactContractPath();
                using var contractDoc = JsonDocument.Parse(File.ReadAllText(contractPath));
                NormalizeRules(rules, contractDoc.RootElement);
                using var rulesDoc = JsonDocument.Parse(JsonSerializer.Serialize(rules, JsonOptions));
                using var tmDoc = JsonDocument.Parse(JsonSerializer.Serialize(updatedTemplateMap, JsonOptions));

                var validationErrors = FactContractValidator.GetValidationErrors(contractDoc.RootElement, rulesDoc.RootElement, tmDoc.RootElement);
                var structuredErrors = MapStructuredErrors(validationErrors, rules);

                if (structuredErrors.Count > 0)
                {
                    return new
                    {
                        success = false,
                        error = "Loaded draft has validation errors: " + string.Join("; ", validationErrors.Take(3)),
                        errors = structuredErrors
                    };
                }

                return new
                {
                    success = true,
                    filePath = sourcePath,
                    fileName = Path.GetFileName(sourcePath),
                    rules,
                    templateMap = updatedTemplateMap,
                    approvedMappings,
                    manifest
                };
            }
            catch (Exception ex)
            {
                return new
                {
                    success = false,
                    error = "Failed to open draft: " + ex.Message,
                    errors = new[]
                    {
                        new StructuredValidationError
                        {
                            RuleId = null,
                            Field = null,
                            Message = ex.Message
                        }
                    }
                };
            }
        }

        private object EvaluateRuleSandbox(JsonElement payload)
        {
            var ruleEl = BridgeValidation.RequireObjectProperty(payload, "evaluateRuleSandbox", "rule");
            var rule = JsonSerializer.Deserialize<RuleDefinition>(ruleEl.GetRawText(), JsonOptions)
                ?? throw new InvalidOperationException("Invalid rule payload");

            if (payload.TryGetProperty("predicate", out var predEl) && predEl.ValueKind == JsonValueKind.Object)
            {
                string rawPred = predEl.GetRawText();
                rawPred = Regex.Replace(rawPred, @"""=="":", @"""==="":");
                rule.Predicate = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(rawPred, JsonOptions) ?? new();
            }
            else if (rule.Predicate != null)
            {
                string rawPred = JsonSerializer.Serialize(rule.Predicate, JsonOptions);
                rawPred = Regex.Replace(rawPred, @"""=="":", @"""==="":");
                rule.Predicate = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(rawPred, JsonOptions) ?? new();
            }

            var simulatedValues = new Dictionary<string, object?>(StringComparer.Ordinal);
            var simProps = payload.TryGetProperty("simulatedValues", out var sEl) && sEl.ValueKind == JsonValueKind.Object
                ? sEl
                : (payload.TryGetProperty("context", out var cEl) && cEl.ValueKind == JsonValueKind.Object ? cEl : default);

            if (simProps.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in simProps.EnumerateObject())
                {
                    simulatedValues[prop.Name] = prop.Value.ValueKind switch
                    {
                        JsonValueKind.True => true,
                        JsonValueKind.False => false,
                        JsonValueKind.Number when prop.Value.TryGetInt32(out var i) => i,
                        JsonValueKind.Number when prop.Value.TryGetDouble(out var d) => d,
                        JsonValueKind.String => prop.Value.GetString(),
                        JsonValueKind.Null => null,
                        _ => prop.Value.ToString()
                    };
                }
            }

            // Validate rule condition / predicate syntax
            string contractPath = GetFactContractPath();
            using var contractDoc = JsonDocument.Parse(File.ReadAllText(contractPath));

            // Create dynamic contract with any simulated facts included so sandbox can evaluate ad-hoc facts
            var contractObj = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(contractDoc.RootElement.GetRawText()) ?? new();
            if (contractObj.TryGetValue("facts", out var factsEl) && factsEl.ValueKind == JsonValueKind.Array)
            {
                var existingFacts = JsonSerializer.Deserialize<List<Dictionary<string, string>>>(factsEl.GetRawText()) ?? new();
                var existingKeys = new HashSet<string>(existingFacts.Select(f => f.GetValueOrDefault("key", "")), StringComparer.Ordinal);

                bool addedAny = false;
                foreach (var kvp in simulatedValues)
                {
                    if (!existingKeys.Contains(kvp.Key))
                    {
                        string inferredType = kvp.Value switch
                        {
                            bool => "boolean",
                            int or double or float or long or decimal => "number",
                            _ => "string"
                        };
                        existingFacts.Add(new Dictionary<string, string>
                        {
                            ["key"] = kvp.Key,
                            ["type"] = inferredType,
                            ["scope"] = "Unit"
                        });
                        addedAny = true;
                    }
                }
                if (addedAny)
                {
                    contractObj["facts"] = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(existingFacts));
                }
            }
            using var dynamicContractDoc = JsonDocument.Parse(JsonSerializer.Serialize(contractObj));

            // Build temporary rule array to validate syntax
            using var tempRulesDoc = JsonDocument.Parse(JsonSerializer.Serialize(new[] { rule }, JsonOptions));
            var dummyTemplateMap = SynchronizeTemplateMap(new List<RuleDefinition> { rule }, null);
            using var dummyTmDoc = JsonDocument.Parse(JsonSerializer.Serialize(dummyTemplateMap, JsonOptions));

            var validationErrors = FactContractValidator.GetValidationErrors(dynamicContractDoc.RootElement, tempRulesDoc.RootElement, dummyTmDoc.RootElement);
            var predicateErrors = validationErrors.Where(e => e.Contains(".predicate") || e.Contains(".requiredFacts")).ToList();

            if (predicateErrors.Count > 0)
            {
                return new
                {
                    isValid = false,
                    isApplicable = false,
                    result = false,
                    needsInput = true,
                    trace = "The rule logic is currently incomplete or contains errors.",
                    error = string.Join("; ", predicateErrors)
                };
            }

            // Build mock registry and context
            var mockRegistry = new Dictionary<string, Fact>(StringComparer.Ordinal);
            var context = new Dictionary<string, object?>(simulatedValues, StringComparer.Ordinal);

            foreach (var fKey in rule.RequiredFacts ?? new List<string>())
            {
                string canonicalKey = FactContractValidator.CanonicalizeKey(fKey, contractDoc.RootElement);
                object? val = null;
                if (!simulatedValues.TryGetValue(fKey, out val) && !simulatedValues.TryGetValue(canonicalKey, out val))
                {
                    val = null;
                }

                mockRegistry[canonicalKey] = new Fact
                {
                    Key = canonicalKey,
                    Category = "Simulation",
                    Value = val,
                    Status = val != null ? FactStatus.Known : FactStatus.Unknown,
                    Confidence = FactConfidence.Authoritative
                };

                if (!context.ContainsKey(canonicalKey) && val != null)
                {
                    context[canonicalKey] = val;
                }
            }

            var evalResult = _astEvaluator.EvaluatePredicate(rule.Predicate, context, rule.RequiredFacts ?? new List<string>(), mockRegistry);

            return new
            {
                isValid = true,
                isApplicable = evalResult.Result,
                result = evalResult.Result,
                needsInput = evalResult.NeedsInput,
                trace = evalResult.Trace
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

            // Synchronize Excel cell mappings dynamically from rules
            var updatedTemplateMap = SynchronizeTemplateMap(rules, templateMap);

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

            string contractPath = GetFactContractPath();
            using (var contractDoc = JsonDocument.Parse(File.ReadAllText(contractPath)))
            {
                NormalizeRules(rules, contractDoc.RootElement);
                using (var rulesDoc = JsonDocument.Parse(JsonSerializer.Serialize(rules, JsonOptions)))
                using (var tmDoc = JsonDocument.Parse(JsonSerializer.Serialize(updatedTemplateMap, JsonOptions)))
                {
                    var validationErrors = FactContractValidator.GetValidationErrors(contractDoc.RootElement, rulesDoc.RootElement, tmDoc.RootElement);
                    if (validationErrors.Count > 0)
                    {
                        throw new InvalidOperationException("Rule pack validation failed:\n" + string.Join("\n", validationErrors));
                    }
                }
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
            else if (!string.IsNullOrWhiteSpace(_defaultPublishPath))
            {
                bool userExplicitlyCleared = payload.TryGetProperty("targetPath", out var tp) &&
                                             tp.ValueKind == JsonValueKind.String &&
                                             string.IsNullOrWhiteSpace(tp.GetString());
                if (!userExplicitlyCleared)
                {
                    string candidate = Path.GetFullPath(_defaultPublishPath);
                    if (Path.IsPathRooted(candidate) &&
                        !string.Equals(candidate, activePath, StringComparison.OrdinalIgnoreCase) &&
                        !candidate.StartsWith(activePath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) &&
                        !activePath.StartsWith(candidate + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    {
                        targetDir = candidate;
                    }
                }
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
                    updatedTemplateMap,
                    approvedMappings,
                    templatePath
                );

                // Validate every output before changing either destination. The
                // target distribution copy is staged independently so a failed
                // share write cannot leave the active pack half-published.
                if (targetDir != null)
                {
                    string targetStage = Path.Combine(transactionRoot, "target");
                    _rulePackManager.PublishToDirectory(targetStage, version, rules, updatedTemplateMap, approvedMappings, templatePath);
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

        private static void MoveDirectorySafe(string sourceDir, string destDir)
        {
            string srcRoot = Path.GetPathRoot(Path.GetFullPath(sourceDir)) ?? "";
            string dstRoot = Path.GetPathRoot(Path.GetFullPath(destDir)) ?? "";
            if (string.Equals(srcRoot, dstRoot, StringComparison.OrdinalIgnoreCase))
            {
                Directory.Move(sourceDir, destDir);
            }
            else
            {
                CopyDirectoryRecursively(sourceDir, destDir);
                Directory.Delete(sourceDir, true);
            }
        }

        private static void CopyDirectoryRecursively(string sourceDir, string destinationDir)
        {
            Directory.CreateDirectory(destinationDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string destFile = Path.Combine(destinationDir, Path.GetFileName(file));
                File.Copy(file, destFile, true);
            }
            foreach (string subDir in Directory.GetDirectories(sourceDir))
            {
                string destSubDir = Path.Combine(destinationDir, Path.GetFileName(subDir));
                CopyDirectoryRecursively(subDir, destSubDir);
            }
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
                MoveDirectorySafe(staged, destination);
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
