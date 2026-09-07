using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;
using AHUVerification.RuleEditor.Bridge;
using Xunit;

namespace AHUVerification.Tests
{
    public class RuleEditorBridgeTests : IDisposable
    {
        private readonly string _rulePackPath;
        private readonly string _tempDirectory;

        public RuleEditorBridgeTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
            _tempDirectory = Path.Combine(Path.GetTempPath(), "RuleEditorTests_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(_tempDirectory);
        }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(_tempDirectory))
                {
                    Directory.Delete(_tempDirectory, true);
                }
            }
            catch
            {
                // Best effort cleanup
            }
        }

        private RuleEditorBridgeHandler CreateHandler(
            string? rulePackPath = null,
            Func<string?>? savePathSelector = null,
            Func<string?>? openPathSelector = null)
        {
            return new RuleEditorBridgeHandler(
                null,
                rulePackPath ?? _rulePackPath,
                savePathSelector,
                openPathSelector);
        }

        // =========================================================================
        // 1. App Info and Initial Rule Pack
        // =========================================================================

        [Fact]
        public void GetAppInfo_ReturnsDesktopHostInfo()
        {
            var handler = CreateHandler();
            var response = handler.Handle("{\"id\":\"req-info\",\"action\":\"getAppInfo\"}");

            Assert.Equal("req-info", response.Id);
            Assert.True(response.Success, response.Error);
            Assert.NotNull(response.Data);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.True(root.GetProperty("isDesktopHost").GetBoolean());
            Assert.Contains("Rule & Logic Editor", root.GetProperty("appName").GetString());
            Assert.True(root.GetProperty("ruleCount").GetInt32() > 0);
        }

        [Fact]
        public void GetRulePack_LoadsActiveBundleFromResources()
        {
            var handler = CreateHandler();
            var response = handler.Handle("{\"id\":\"req-pack\",\"action\":\"getRulePack\"}");

            Assert.Equal("req-pack", response.Id);
            Assert.True(response.Success, response.Error);
            Assert.NotNull(response.Data);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.True(root.TryGetProperty("rules", out var rules) && rules.GetArrayLength() > 0);
            Assert.True(root.TryGetProperty("templateMap", out _));
            Assert.True(root.TryGetProperty("manifest", out _));
        }

        // =========================================================================
        // 2. Validate Rule Pack & Field-Level Error Mapping
        // =========================================================================

        [Fact]
        public void ValidateRulePack_ValidRules_ReturnsSuccess()
        {
            var handler = CreateHandler();
            // Load base pack to get valid payload
            var packRes = handler.Handle("{\"id\":\"req-1\",\"action\":\"getRulePack\"}");
            var packJson = JsonSerializer.Serialize(packRes.Data);

            var validateReq = $"{{\"id\":\"req-val\",\"action\":\"validateRulePack\",\"payload\":{packJson}}}";
            var response = handler.Handle(validateReq);

            Assert.Equal("req-val", response.Id);
            Assert.True(response.Success, response.Error);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            Assert.True(doc.RootElement.GetProperty("valid").GetBoolean());
            Assert.Equal(0, doc.RootElement.GetProperty("errors").GetArrayLength());
        }

        [Fact]
        public void ValidateRulePack_DuplicateId_ReturnsFieldErrorsTargetingId()
        {
            var handler = CreateHandler();
            var payload = new
            {
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "BASE-01",
                        SemanticKey = "KEY_ONE",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Rule one",
                        ExcelRow = 29,
                        VerificationMode = "ManualCheckbox"
                    },
                    new RuleDefinition
                    {
                        Id = "BASE-01", // duplicate ID
                        SemanticKey = "KEY_TWO",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Rule two",
                        ExcelRow = 30,
                        VerificationMode = "ManualCheckbox"
                    }
                },
                templateMap = new TemplateMap
                {
                    TemplateVersion = "1.0",
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>()
                }
            };

            var reqJson = $"{{\"id\":\"req-dup-id\",\"action\":\"validateRulePack\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-dup-id", response.Id);
            Assert.True(response.Success);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            Assert.False(doc.RootElement.GetProperty("valid").GetBoolean());

            var errors = doc.RootElement.GetProperty("errors");
            Assert.True(errors.GetArrayLength() > 0);

            bool foundIdField = false;
            for (int i = 0; i < errors.GetArrayLength(); i++)
            {
                var err = errors[i];
                if (err.TryGetProperty("field", out var f) && f.GetString() == "id")
                {
                    foundIdField = true;
                    break;
                }
            }
            Assert.True(foundIdField, "Expected field-level error mapping to 'id'");
        }

        [Fact]
        public void ValidateRulePack_DuplicateSemanticKey_ReturnsFieldErrorsTargetingSemanticKey()
        {
            var handler = CreateHandler();
            var payload = new
            {
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "BASE-01",
                        SemanticKey = "DUPLICATE_KEY",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Rule one",
                        ExcelRow = 29,
                        VerificationMode = "ManualCheckbox"
                    },
                    new RuleDefinition
                    {
                        Id = "BASE-02",
                        SemanticKey = "DUPLICATE_KEY", // duplicate semantic key
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Rule two",
                        ExcelRow = 30,
                        VerificationMode = "ManualCheckbox"
                    }
                },
                templateMap = new TemplateMap
                {
                    TemplateVersion = "1.0",
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>()
                }
            };

            var reqJson = $"{{\"id\":\"req-dup-key\",\"action\":\"validateRulePack\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-dup-key", response.Id);
            Assert.True(response.Success);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            Assert.False(doc.RootElement.GetProperty("valid").GetBoolean());

            var errors = doc.RootElement.GetProperty("errors");
            bool foundSemanticKeyField = false;
            for (int i = 0; i < errors.GetArrayLength(); i++)
            {
                var err = errors[i];
                if (err.TryGetProperty("field", out var f) && f.GetString() == "semanticKey")
                {
                    foundSemanticKeyField = true;
                    break;
                }
            }
            Assert.True(foundSemanticKeyField, "Expected field-level error mapping to 'semanticKey'");
        }

        // =========================================================================
        // 3. SaveDraft with Dynamic Excel Mappings
        // =========================================================================

        [Fact]
        public void SaveDraft_ValidPayload_SavesAndSynchronizesDynamicExcelMappings()
        {
            string draftPath = Path.Combine(_tempDirectory, "test_draft.json");
            var handler = CreateHandler(savePathSelector: () => draftPath);

            var payload = new
            {
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "BASE-01",
                        SemanticKey = "BASE_CHECK_ONE",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Verify base lifting lugs",
                        ExcelRow = 42,
                        VerificationMode = "ManualCheckbox",
                        AllowNA = true
                    },
                    new RuleDefinition
                    {
                        Id = "HOUS-01",
                        SemanticKey = "HOUSING_CHECK_TWO",
                        Category = "Housing",
                        Scope = RuleScope.Skid,
                        Text = "Verify roof standing seam",
                        ExcelRow = 55,
                        VerificationMode = "ManualCheckbox",
                        AllowNA = false
                    }
                },
                templateMap = new TemplateMap
                {
                    TemplateVersion = "1.0",
                    // Stale orphan mapping that should be pruned
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>
                    {
                        ["OLD_ORPHAN_KEY"] = new RuleCellMapping { RuleId = "OLD-99", Row = 99 }
                    }
                },
                manifest = new RulePackManifest { Name = "Draft Pack", Version = "2.0.0" }
            };

            var reqJson = $"{{\"id\":\"req-save\",\"action\":\"saveDraft\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-save", response.Id);
            Assert.True(response.Success, response.Error);
            Assert.True(File.Exists(draftPath), "Draft file must be created on disk");

            // Inspect the saved file
            string savedContent = File.ReadAllText(draftPath);
            using var doc = JsonDocument.Parse(savedContent);
            var root = doc.RootElement;

            Assert.True(root.TryGetProperty("templateMap", out var tm));
            var mappings = tm.GetProperty("ruleCellMappings");

            // Orphan mapping must be pruned
            Assert.False(mappings.TryGetProperty("OLD_ORPHAN_KEY", out _));

            // Dynamic cell coordinates must be computed from ExcelRow
            Assert.True(mappings.TryGetProperty("BASE_CHECK_ONE", out var m1));
            Assert.Equal(42, m1.GetProperty("row").GetInt32());
            Assert.Equal("S42", m1.GetProperty("naCell").GetString());
            Assert.Equal("T42", m1.GetProperty("detailerCell").GetString());
            Assert.Equal("V42", m1.GetProperty("checkerCell").GetString());
            Assert.Equal("Y42", m1.GetProperty("commentsCell").GetString());
            Assert.Equal("Z42", m1.GetProperty("initialsCell").GetString());

            Assert.True(mappings.TryGetProperty("HOUSING_CHECK_TWO", out var m2));
            Assert.Equal(55, m2.GetProperty("row").GetInt32());
            Assert.Equal("S55", m2.GetProperty("naCell").GetString());
            Assert.Equal("T55", m2.GetProperty("detailerCell").GetString());
            Assert.Equal("V55", m2.GetProperty("checkerCell").GetString());
            Assert.Equal("Y55", m2.GetProperty("commentsCell").GetString());
            Assert.Equal("Z55", m2.GetProperty("initialsCell").GetString());
        }

        [Fact]
        public void SaveDraft_ValidationFailure_RejectsSaveWithoutWritingFile()
        {
            string draftPath = Path.Combine(_tempDirectory, "rejected_draft.json");
            var handler = CreateHandler(savePathSelector: () => draftPath);

            var payload = new
            {
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "BAD-01",
                        SemanticKey = "BAD_CHECK",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Invalid row rule",
                        ExcelRow = -5, // Invalid negative row!
                        VerificationMode = "ManualCheckbox"
                    }
                },
                templateMap = new TemplateMap
                {
                    TemplateVersion = "1.0",
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>()
                }
            };

            var reqJson = $"{{\"id\":\"req-bad-save\",\"action\":\"saveDraft\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-bad-save", response.Id);
            Assert.True(response.Success);
            Assert.False(File.Exists(draftPath), "Rejected draft must NOT write any file to disk");

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
            Assert.True(doc.RootElement.GetProperty("errors").GetArrayLength() > 0);
        }

        [Fact]
        public void SaveDraft_UserCancelled_ReturnsCancelledStatus()
        {
            // Selector returns null when user cancels native dialog
            var handler = CreateHandler(savePathSelector: () => null);

            var payload = new
            {
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "BASE-01",
                        SemanticKey = "BASE_CHECK",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Rule",
                        ExcelRow = 30,
                        VerificationMode = "ManualCheckbox"
                    }
                }
            };

            var reqJson = $"{{\"id\":\"req-cancel\",\"action\":\"saveDraft\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-cancel", response.Id);
            Assert.True(response.Success);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            Assert.True(doc.RootElement.GetProperty("cancelled").GetBoolean());
        }

        // =========================================================================
        // 4. OpenDraft
        // =========================================================================

        [Fact]
        public void OpenDraft_ValidFile_LoadsRulesAndMetadata()
        {
            string draftPath = Path.Combine(_tempDirectory, "valid_draft.json");
            var draftContent = new
            {
                manifest = new { name = "Opened Pack", version = "3.1.4" },
                rules = new[]
                {
                    new
                    {
                        id = "OPEN-01",
                        semanticKey = "OPENED_CHECK",
                        scope = "Unit",
                        category = "Base",
                        text = "Opened from disk",
                        excelRow = 33,
                        requiredFacts = new string[0],
                        allowNA = true,
                        verificationMode = "ManualCheckbox"
                    }
                },
                templateMap = new
                {
                    templateVersion = "1.0",
                    generalFields = new { },
                    sqRange = new { sheet = "Skid 1", startRow = 1, endRow = 50 },
                    ruleCellMappings = new
                    {
                        OPENED_CHECK = new
                        {
                            ruleId = "OPEN-01",
                            row = 33,
                            naCell = "S33",
                            detailerCell = "T33",
                            checkerCell = "V33",
                            commentsCell = "Y33",
                            initialsCell = "Z33"
                        }
                    }
                }
            };
            File.WriteAllText(draftPath, JsonSerializer.Serialize(draftContent));

            var handler = CreateHandler(openPathSelector: () => draftPath);
            var response = handler.Handle("{\"id\":\"req-open\",\"action\":\"openDraft\"}");

            Assert.Equal("req-open", response.Id);
            Assert.True(response.Success, response.Error);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.True(root.GetProperty("success").GetBoolean());
            Assert.Equal("valid_draft.json", root.GetProperty("fileName").GetString());
            var rules = root.GetProperty("rules");
            Assert.Equal(1, rules.GetArrayLength());
            Assert.Equal("OPEN-01", rules[0].GetProperty("id").GetString());
        }

        [Fact]
        public void OpenDraft_InvalidContractFile_RejectsDraftWithErrors()
        {
            string badDraftPath = Path.Combine(_tempDirectory, "invalid_draft.json");
            // Missing semanticKey and invalid scope
            var badContent = new
            {
                rules = new[]
                {
                    new
                    {
                        id = "BAD-01",
                        scope = "InvalidScope",
                        category = "UnknownCategory",
                        text = "Bad rule"
                    }
                },
                templateMap = new { templateVersion = "1.0" }
            };
            File.WriteAllText(badDraftPath, JsonSerializer.Serialize(badContent));

            var handler = CreateHandler(openPathSelector: () => badDraftPath);
            var response = handler.Handle("{\"id\":\"req-open-bad\",\"action\":\"openDraft\"}");

            Assert.Equal("req-open-bad", response.Id);
            Assert.True(response.Success);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.False(root.GetProperty("success").GetBoolean());
            Assert.True(root.GetProperty("errors").GetArrayLength() > 0);
        }

        // =========================================================================
        // 5. EvaluateRuleSandbox (AST Execution in C# Backend)
        // =========================================================================

        [Fact]
        public void EvaluateRuleSandbox_ValidPredicate_ReturnsEvaluatedResult()
        {
            var handler = CreateHandler();
            var payload = new
            {
                rule = new RuleDefinition
                {
                    Id = "TEST-AST-01",
                    SemanticKey = "TEST_HOUSING_STYLE",
                    Scope = RuleScope.Unit,
                    Category = "Housing",
                    Text = "Check housing style",
                    RequiredFacts = new List<string> { "unit.housingStyle" },
                    VerificationMode = "ManualCheckbox",
                    AllowNA = true
                },
                predicate = new Dictionary<string, object>
                {
                    ["=="] = new object[]
                    {
                        new Dictionary<string, string> { ["var"] = "unit.housingStyle" },
                        "Standard"
                    }
                },
                context = new Dictionary<string, object>
                {
                    ["unit.housingStyle"] = "Standard"
                }
            };

            var reqJson = $"{{\"id\":\"req-sandbox\",\"action\":\"evaluateRuleSandbox\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-sandbox", response.Id);
            Assert.True(response.Success, response.Error);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            Assert.True(root.GetProperty("isValid").GetBoolean(), "Valid predicate syntax must have isValid = true");
            Assert.True(root.GetProperty("isApplicable").GetBoolean(), "housingStyle 'Standard' must match predicate");
        }

        [Fact]
        public void EvaluateRuleSandbox_IncompleteOrInvalidPredicate_FlagsInvalidRuleLogic()
        {
            var handler = CreateHandler();
            var payload = new
            {
                rule = new RuleDefinition
                {
                    Id = "TEST-AST-02",
                    SemanticKey = "TEST_INCOMPLETE_AST",
                    Scope = RuleScope.Unit,
                    Category = "Housing",
                    Text = "Incomplete rule logic",
                    RequiredFacts = new List<string>(),
                    VerificationMode = "ManualCheckbox"
                },
                // Operator with unsupported/incomplete syntax
                predicate = new Dictionary<string, object>
                {
                    ["!unsupported_operator!"] = new object[] { "xyz" }
                },
                context = new Dictionary<string, object>()
            };

            var reqJson = $"{{\"id\":\"req-sandbox-bad\",\"action\":\"evaluateRuleSandbox\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-sandbox-bad", response.Id);
            Assert.True(response.Success, response.Error);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // When AST logic is incomplete/invalid, simulation pauses with isValid = false
            Assert.False(root.GetProperty("isValid").GetBoolean(), "Incomplete predicate syntax must have isValid = false");
            Assert.False(root.GetProperty("isApplicable").GetBoolean());
            Assert.False(string.IsNullOrEmpty(root.GetProperty("error").GetString()));
        }

        // =========================================================================
        // 6. PublishRulePack with Dynamic Synchronized Mappings
        // =========================================================================

        [Fact]
        public void PublishRulePack_StagesAndPromotesWithDynamicMappings()
        {
            // Create an isolated copy of the rulepack directory so tests do not mutate source repo
            string isolatedRulePack = Path.Combine(_tempDirectory, "isolated_pack");
            Directory.CreateDirectory(isolatedRulePack);
            foreach (var file in Directory.GetFiles(_rulePackPath))
            {
                File.Copy(file, Path.Combine(isolatedRulePack, Path.GetFileName(file)));
            }

            var handler = CreateHandler(rulePackPath: isolatedRulePack);

            var payload = new
            {
                version = "1.5.0",
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "NEW-01",
                        SemanticKey = "PUBLISHED_DYNAMIC_CHECK",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Published dynamic test",
                        ExcelRow = 35,
                        VerificationMode = "ManualCheckbox",
                        AllowNA = true
                    }
                },
                templateMap = new TemplateMap
                {
                    TemplateVersion = "1.0",
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>()
                },
                releaseNotes = "Automated test release"
            };

            var reqJson = $"{{\"id\":\"req-publish\",\"action\":\"publishRulePack\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-publish", response.Id);
            Assert.True(response.Success, response.Error);

            // Verify the published template_map.json on disk
            string promotedMapPath = Path.Combine(isolatedRulePack, "template_map.json");
            Assert.True(File.Exists(promotedMapPath));

            string promotedMapJson = File.ReadAllText(promotedMapPath);
            using var doc = JsonDocument.Parse(promotedMapJson);
            var mappings = doc.RootElement.GetProperty("ruleCellMappings");

            Assert.True(mappings.TryGetProperty("PUBLISHED_DYNAMIC_CHECK", out var m));
            Assert.Equal(35, m.GetProperty("row").GetInt32());
            Assert.Equal("S35", m.GetProperty("naCell").GetString());
            Assert.Equal("T35", m.GetProperty("detailerCell").GetString());
            Assert.Equal("V35", m.GetProperty("checkerCell").GetString());
            Assert.Equal("Y35", m.GetProperty("commentsCell").GetString());
            Assert.Equal("Z35", m.GetProperty("initialsCell").GetString());
        }

        [Fact]
        public void ValidateRulePack_NormalizesRuleAliasesAndPredicates()
        {
            var handler = CreateHandler();
            var payload = new
            {
                rules = new[]
                {
                    new RuleDefinition
                    {
                        Id = "ALIAS-01",
                        SemanticKey = "ALIAS_CHECK",
                        Category = "Base",
                        Scope = RuleScope.Unit,
                        Text = "Check wall thickness alias",
                        ExcelRow = 30,
                        RequiredFacts = new List<string> { "unit.wallThickness" },
                        VerificationMode = "ManualCheckbox",
                        Predicate = new Dictionary<string, JsonElement>
                        {
                            ["==="] = JsonDocument.Parse("[{\"var\": \"unit.wallThickness\"}, 2]").RootElement
                        }
                    }
                },
                templateMap = new TemplateMap
                {
                    TemplateVersion = "1.0",
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>()
                }
            };

            var reqJson = $"{{\"id\":\"req-alias-val\",\"action\":\"validateRulePack\",\"payload\":{JsonSerializer.Serialize(payload)}}}";
            var response = handler.Handle(reqJson);

            Assert.Equal("req-alias-val", response.Id);
            Assert.True(response.Success, response.Error);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            Assert.True(doc.RootElement.GetProperty("valid").GetBoolean());

            var rules = doc.RootElement.GetProperty("rules");
            var reqFacts = rules[0].GetProperty("requiredFacts");
            Assert.Equal("casing.thicknessFront", reqFacts[0].GetString());
        }

        [Fact]
        public void OpenDraft_NormalizesRuleAliasesAndPredicates()
        {
            string draftPath = Path.Combine(_tempDirectory, "alias_draft.json");
            var draftContent = new
            {
                manifest = new { name = "Alias Pack", version = "1.0.0" },
                rules = new[]
                {
                    new
                    {
                        id = "OPEN-ALIAS-01",
                        semanticKey = "OPEN_ALIAS_CHECK",
                        scope = "Unit",
                        category = "Base",
                        text = "Opened alias check",
                        excelRow = 30,
                        requiredFacts = new[] { "unit.roofPeak" },
                        verificationMode = "ManualCheckbox"
                    }
                },
                templateMap = new
                {
                    templateVersion = "1.0",
                    ruleCellMappings = new
                    {
                        OPEN_ALIAS_CHECK = new { ruleId = "OPEN-ALIAS-01", row = 30 }
                    }
                }
            };
            File.WriteAllText(draftPath, JsonSerializer.Serialize(draftContent));

            var handler = CreateHandler(openPathSelector: () => draftPath);
            var response = handler.Handle("{\"id\":\"req-open-alias\",\"action\":\"openDraft\"}");

            Assert.Equal("req-open-alias", response.Id);
            Assert.True(response.Success, response.Error);

            var json = JsonSerializer.Serialize(response.Data);
            using var doc = JsonDocument.Parse(json);
            var rules = doc.RootElement.GetProperty("rules");
            var reqFacts = rules[0].GetProperty("requiredFacts");
            Assert.Equal("roof.roofPeak", reqFacts[0].GetString());
        }
    }
}
