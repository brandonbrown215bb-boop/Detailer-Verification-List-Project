using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;
using AHUVerification.RuleEditor.Bridge;
using Xunit;

namespace AHUVerification.Tests
{
    public class BridgeHandlerTests
    {
        private readonly string _rulePackPath;

        public BridgeHandlerTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
        }

        private BridgeHandler CreateAppHandler(Func<string?>? exportPathSelector = null, Action<ProcessStartInfo>? processLauncher = null) =>
            new(null, _rulePackPath, exportPathSelector, processLauncher);
        private RuleEditorBridgeHandler CreateRuleEditorHandler() => new(_rulePackPath);

        // =========================================================================
        // 1. Request ID Preservation & Deserialization Resilience
        // =========================================================================

        [Fact]
        public void Handle_MalformedJson_ExtractsRequestIdAndReturnsFailure()
        {
            var handler = CreateAppHandler();
            string brokenJson = "{\"id\":\"req-broken-123\", \"action\":\"extractUpz\", \"payload\": { broken_syntax ";

            var response = handler.Handle(brokenJson);

            Assert.Equal("req-broken-123", response.Id);
            Assert.False(response.Success);
            Assert.NotNull(response.Error);
            Assert.Contains("Deserialization error", response.Error);
        }

        [Fact]
        public void Handle_InvalidJsonType_PreservesRequestIdAndFails()
        {
            var handler = CreateAppHandler();
            string jsonWithBadActionType = "{\"id\":\"req-type-err-456\", \"action\": 12345}";

            var response = handler.Handle(jsonWithBadActionType);

            Assert.Equal("req-type-err-456", response.Id);
            Assert.False(response.Success);
            Assert.NotNull(response.Error);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData(null)]
        public void Handle_NullOrEmptyJson_ReturnsFailureWithoutThrowing(string? emptyInput)
        {
            var handler = CreateAppHandler();

            var response = handler.Handle(emptyInput!);

            Assert.Equal("", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Invalid empty request message", response.Error);
        }

        [Fact]
        public void Handle_MissingAction_PreservesRequestIdAndFails()
        {
            var handler = CreateAppHandler();
            string jsonNoAction = "{\"id\":\"req-no-action-789\"}";

            var response = handler.Handle(jsonNoAction);

            Assert.Equal("req-no-action-789", response.Id);
            Assert.False(response.Success);
            Assert.Contains("action", response.Error, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void ExtractRequestId_VariousFormats_ExtractsExpectedId()
        {
            Assert.Equal("req-1", BridgeRequest.ExtractRequestId("{\"id\":\"req-1\",\"action\":\"getAppInfo\"}"));
            Assert.Equal("req-2", BridgeRequest.ExtractRequestId("{\"Id\":\"req-2\",\"action\":\"getAppInfo\"}"));
            Assert.Equal("req-3", BridgeRequest.ExtractRequestId("{\"id\": \"req-3\" , \"payload\": { broken"));
            Assert.Equal("", BridgeRequest.ExtractRequestId("{\"action\":\"getAppInfo\"}"));
            Assert.Equal("", BridgeRequest.ExtractRequestId(""));
            Assert.Equal("", BridgeRequest.ExtractRequestId(null));
        }

        [Fact]
        public void BridgeResponse_FactoryMethods_ProduceExpectedEnvelopes()
        {
            var okRes = BridgeResponse.Ok("req-ok", new { count = 42 });
            Assert.Equal("req-ok", okRes.Id);
            Assert.True(okRes.Success);
            Assert.NotNull(okRes.Data);
            Assert.Null(okRes.Error);

            var failRes = BridgeResponse.Fail("req-fail", "Something went wrong");
            Assert.Equal("req-fail", failRes.Id);
            Assert.False(failRes.Success);
            Assert.Null(failRes.Data);
            Assert.Equal("Something went wrong", failRes.Error);
        }

        // =========================================================================
        // 2. App Bridge Handler - Happy Path Verification
        // =========================================================================

        [Fact]
        public void Handle_GetAppInfo_ReturnsAppMetadata()
        {
            var handler = CreateAppHandler();
            string msg = "{\"id\":\"req-app-info\",\"action\":\"getAppInfo\"}";

            var response = handler.Handle(msg);

            Assert.Equal("req-app-info", response.Id);
            Assert.True(response.Success);
            Assert.NotNull(response.Data);

            string json = JsonSerializer.Serialize(response.Data);
            Assert.Contains("AHU Detailing Verification", json);
            Assert.Contains("isDesktopHost\":true", json);
            Assert.Contains($"\"appVersion\":\"{ApplicationVersion.Current}\"", json);
        }

        [Fact]
        public void Handle_GetRulePack_ReturnsActiveRulePackBundle()
        {
            var handler = CreateAppHandler();
            string msg = "{\"id\":\"req-rule-pack\",\"action\":\"getRulePack\"}";

            var response = handler.Handle(msg);

            Assert.Equal("req-rule-pack", response.Id);
            Assert.True(response.Success);
            Assert.NotNull(response.Data);

            string json = JsonSerializer.Serialize(response.Data);
            Assert.Contains("manifest", json);
            Assert.Contains("rules", json);
        }

        [Fact]
        public void Handle_SaveDvl_ValidPayload_WritesFileSuccessfully()
        {
            var handler = CreateAppHandler();
            string tempDvl = Path.Combine(Path.GetTempPath(), $"test_project_{Guid.NewGuid():N}.dvl");
            string tempDvlBad = Path.Combine(Path.GetTempPath(), $"test_project_bad_{Guid.NewGuid():N}.dvl");

            try
            {
                var bundle = new RulePackManager().LoadFromDirectory(_rulePackPath);
                var projectManager = new DvlProjectManager();
                var project = projectManager.CreateProject(
                    new NormalizedXmlGraph(),
                    new Dictionary<string, Fact>
                    {
                        ["unit.jobName"] = new Fact { Key = "unit.jobName", Value = "TestHospital" },
                        ["unit.comNumber"] = new Fact { Key = "unit.comNumber", Value = "COM-999" }
                    },
                    new List<SpecialQuote>(),
                    new List<ChecklistInstance>(),
                    "<Config />",
                    bundle,
                    generalComments: "Bridge Save Test");

                string projectJson = JsonSerializer.Serialize(project, JsonDefaults.CreateFlexibleOptions());
                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-save-dvl",
                    action = "saveDvl",
                    payload = new
                    {
                        filePath = tempDvl,
                        projectJson = projectJson
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-save-dvl", response.Id);
                Assert.True(response.Success, response.Error);
                Assert.True(File.Exists(tempDvl));

                string savedContent = File.ReadAllText(tempDvl);
                Assert.Contains("TestHospital", savedContent);
                Assert.Contains("COM-999", savedContent);

                // Malformed payload fails without a partial write
                string malformedRequest = JsonSerializer.Serialize(new
                {
                    id = "req-save-dvl-bad",
                    action = "saveDvl",
                    payload = new
                    {
                        filePath = tempDvlBad,
                        projectJson = "{\"invalid\": \"payload\"}"
                    }
                });
                var badResponse = handler.Handle(malformedRequest);
                Assert.Equal("req-save-dvl-bad", badResponse.Id);
                Assert.False(badResponse.Success);
                Assert.False(File.Exists(tempDvlBad));
            }
            finally
            {
                if (File.Exists(tempDvl)) File.Delete(tempDvl);
                if (File.Exists(tempDvlBad)) File.Delete(tempDvlBad);
            }
        }
        [Fact]
        public void Handle_VerifySource_ValidXml_ReturnsVerifiedModel()
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-verify-source",
                action = "verifySource",
                payload = new
                {
                    configXml = "<?xml version=\"1.0\"?><root></root>"
                }
            });
            var response = handler.Handle(requestJson);
            Assert.Equal("req-verify-source", response.Id);
            Assert.True(response.Success, response.Error);
            Assert.NotNull(response.Data);
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook()
        {
            string tempXlsx = Path.Combine(Path.GetTempPath(), $"test_export_{Guid.NewGuid():N}.xlsx");
            var handler = CreateAppHandler(() => tempXlsx);

            try
            {
                var facts = new Dictionary<string, Fact>
                {
                    ["jobName"] = new Fact { Key = "jobName", Value = "Bridge Test Facility", Category = "General", Status = FactStatus.Known },
                    ["orderNumber"] = new Fact { Key = "orderNumber", Value = "ORD-777123", Category = "General", Status = FactStatus.Known }
                };

                // Demonstrating that renderer-supplied outputPath is untrusted and ignored;
                // destination is governed strictly by the native host selector boundary.
                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-export-excel",
                    action = "exportExcelDeliverable",
                    payload = new
                    {
                        facts = facts,
                        sqItems = new List<SpecialQuote>(),
                        checklists = new List<ChecklistInstance>(),
                        outputPath = "untrusted_renderer_path_ignored.xlsx",
                        isDraft = true,
                        generalComments = "Bridge automated test export"
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-export-excel", response.Id);
                Assert.True(response.Success);
                Assert.NotNull(response.Data);

                string json = JsonSerializer.Serialize(response.Data);
                Assert.Contains("\"exported\":true", json);
                Assert.Contains("\"certificationAllowed\":false", json);
                Assert.True(File.Exists(tempXlsx));
                Assert.True(new FileInfo(tempXlsx).Length > 0);
            }
            finally
            {
                if (File.Exists(tempXlsx)) File.Delete(tempXlsx);
            }
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_WithoutNativeSelector_CancelsAndDoesNotWriteRendererPath()
        {
            var handler = CreateAppHandler(); // No selector, no parent form
            string tempXlsx = Path.Combine(Path.GetTempPath(), $"test_untrusted_{Guid.NewGuid():N}.xlsx");

            try
            {
                var facts = new Dictionary<string, Fact>
                {
                    ["jobName"] = new Fact { Key = "jobName", Value = "Bridge Test Facility", Category = "General", Status = FactStatus.Known }
                };

                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-export-cancel",
                    action = "exportExcelDeliverable",
                    payload = new
                    {
                        facts = facts,
                        sqItems = new List<SpecialQuote>(),
                        checklists = new List<ChecklistInstance>(),
                        outputPath = tempXlsx,
                        isDraft = true
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-export-cancel", response.Id);
                Assert.True(response.Success);
                Assert.NotNull(response.Data);

                string json = JsonSerializer.Serialize(response.Data);
                Assert.Contains("\"cancelled\":true", json);
                Assert.False(File.Exists(tempXlsx));
            }
            finally
            {
                if (File.Exists(tempXlsx)) File.Delete(tempXlsx);
            }
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_InvalidPathFromSelector_ReturnsFailure()
        {
            var handler = CreateAppHandler(() => "not_rooted_path.xlsx");
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-export-invalid",
                action = "exportExcelDeliverable",
                payload = new
                {
                    facts = new Dictionary<string, Fact>(),
                    sqItems = new List<SpecialQuote>(),
                    checklists = new List<ChecklistInstance>(),
                    isDraft = true
                }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-export-invalid", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Target path must be an absolute path ending in .xlsx", response.Error);
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_FinalExportWithoutTrustedSource_FailsClosed()
        {
            string tempXlsx = Path.Combine(Path.GetTempPath(), $"test_final_{Guid.NewGuid():N}.xlsx");
            var handler = CreateAppHandler(() => tempXlsx);

            try
            {
                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-export-final-nobound",
                    action = "exportExcelDeliverable",
                    payload = new
                    {
                        facts = new Dictionary<string, Fact>(),
                        sqItems = new List<SpecialQuote>(),
                        checklists = new List<ChecklistInstance>(),
                        isDraft = false
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-export-final-nobound", response.Id);
                Assert.False(response.Success);
                Assert.Contains("Final export requires the trusted raw Config.xml source", response.Error);
                Assert.False(File.Exists(tempXlsx));
            }
            finally
            {
                if (File.Exists(tempXlsx)) File.Delete(tempXlsx);
            }
        }

        [Fact]
        public void Handle_CheckRulePackUpdate_ValidRemotePath_ReturnsResult()
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-check-update",
                action = "checkRulePackUpdate",
                payload = new
                {
                    remotePath = _rulePackPath
                }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-check-update", response.Id);
            Assert.True(response.Success);
            Assert.NotNull(response.Data);

            string json = JsonSerializer.Serialize(response.Data);
            Assert.Contains("hasUpdate", json);
            Assert.Contains("remoteBundleSha256", json);
        }

        [Fact]
        public void Handle_HeadlessDialogActions_ReturnNullWithoutCrashing()
        {
            var handler = CreateAppHandler(); // Null parentForm

            var openRes = handler.Handle("{\"id\":\"req-ofd\",\"action\":\"openFileDialog\"}");
            Assert.Equal("req-ofd", openRes.Id);
            Assert.True(openRes.Success);
            Assert.Null(openRes.Data);

            var saveRes = handler.Handle("{\"id\":\"req-sfd\",\"action\":\"saveFileDialog\",\"payload\":{\"defaultName\":\"Test.dvl\"}}");
            Assert.Equal("req-sfd", saveRes.Id);
            Assert.True(saveRes.Success);
            Assert.Null(saveRes.Data);

            var folderRes = handler.Handle("{\"id\":\"req-sbd\",\"action\":\"selectFolderDialog\"}");
            Assert.Equal("req-sbd", folderRes.Id);
            Assert.True(folderRes.Success);
            Assert.Null(folderRes.Data);
        }

        // =========================================================================
        // 3. App Bridge Handler - Schema Validation & Error Enforcement
        // =========================================================================

        [Theory]
        [InlineData("extractUpz", "filePath")]
        [InlineData("saveDvl", "filePath")]
        [InlineData("openFile", "filePath")]
        [InlineData("showInExplorer", "filePath")]
        [InlineData("checkRulePackUpdate", "remotePath")]
        [InlineData("syncRulePack", "remotePath")]
        public void Handle_RequiredStringPayloadMissing_ReturnsDescriptiveError(string action, string missingProp)
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = $"req-validate-{action}",
                action = action,
                payload = new { }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal($"req-validate-{action}", response.Id);
            Assert.False(response.Success);
            Assert.NotNull(response.Error);
            Assert.Contains(missingProp, response.Error);
        }

        [Fact]
        public void Handle_SaveDvl_MissingProjectJson_ReturnsDescriptiveError()
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-save-missing-json",
                action = "saveDvl",
                payload = new
                {
                    filePath = "C:\\test\\file.dvl"
                }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-save-missing-json", response.Id);
            Assert.False(response.Success);
            Assert.Contains("projectJson", response.Error);
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_MissingFacts_ReturnsDescriptiveError()
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-export-missing-facts",
                action = "exportExcelDeliverable",
                payload = new
                {
                    sqItems = new List<SpecialQuote>(),
                    checklists = new List<ChecklistInstance>()
                }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-export-missing-facts", response.Id);
            Assert.False(response.Success);
            Assert.Contains("facts", response.Error);
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_MissingSqItems_ReturnsDescriptiveError()
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-export-missing-sq",
                action = "exportExcelDeliverable",
                payload = new
                {
                    facts = new Dictionary<string, Fact>(),
                    checklists = new List<ChecklistInstance>()
                }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-export-missing-sq", response.Id);
            Assert.False(response.Success);
            Assert.Contains("sqItems", response.Error);
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_MissingChecklists_ReturnsDescriptiveError()
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-export-missing-cl",
                action = "exportExcelDeliverable",
                payload = new
                {
                    facts = new Dictionary<string, Fact>(),
                    sqItems = new List<SpecialQuote>()
                }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-export-missing-cl", response.Id);
            Assert.False(response.Success);
            Assert.Contains("checklists", response.Error);
        }

        [Fact]
        public void Handle_OpenFile_NonExistentFile_ReturnsFileNotFoundError()
        {
            var handler = CreateAppHandler();
            string missingPath = Path.Combine(Path.GetTempPath(), $"nonexistent_{Guid.NewGuid():N}.txt");
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-open-missing",
                action = "openFile",
                payload = new { filePath = missingPath }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-open-missing", response.Id);
            Assert.False(response.Success);
            Assert.Contains("not found", response.Error, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Handle_ShowInExplorer_NonExistentPath_ReturnsPathNotFoundError()
        {
            var handler = CreateAppHandler();
            string missingPath = Path.Combine(Path.GetTempPath(), $"nonexistent_dir_{Guid.NewGuid():N}");
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-show-missing",
                action = "showInExplorer",
                payload = new { filePath = missingPath }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-show-missing", response.Id);
            Assert.False(response.Success);
            Assert.Contains("not found", response.Error, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Handle_ExtractUpz_NonExistentFile_ReturnsFileNotFoundError()
        {
            var handler = CreateAppHandler();
            string missingUpz = Path.Combine(Path.GetTempPath(), $"nonexistent_{Guid.NewGuid():N}.upz");
            string requestJson = JsonSerializer.Serialize(new
            {
                id = "req-upz-missing",
                action = "extractUpz",
                payload = new { filePath = missingUpz }
            });

            var response = handler.Handle(requestJson);

            Assert.Equal("req-upz-missing", response.Id);
            Assert.False(response.Success);
            Assert.Contains("not found", response.Error, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Handle_UnknownAction_ReturnsDescriptiveFailure()
        {
            var handler = CreateAppHandler();
            string requestJson = "{\"id\":\"req-unknown-act\",\"action\":\"unsupportedCustomAction\"}";

            var response = handler.Handle(requestJson);

            Assert.Equal("req-unknown-act", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Unknown bridge action: 'unsupportedCustomAction'", response.Error);
        }

        // =========================================================================
        // 4. Rule Editor Bridge Handler Verification
        // =========================================================================

        [Fact]
        public void RuleEditor_MalformedJson_PreservesIdAndFails()
        {
            var handler = CreateRuleEditorHandler();
            string brokenJson = "{\"id\":\"req-re-broken\",\"action\":\"publishRulePack\",\"payload\":{ broken";

            var response = handler.Handle(brokenJson);

            Assert.Equal("req-re-broken", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Deserialization error", response.Error);
        }

        [Fact]
        public void RuleEditor_GetAppInfo_ReturnsRuleEditorMetadata()
        {
            var handler = CreateRuleEditorHandler();
            string requestJson = "{\"id\":\"req-re-info\",\"action\":\"getAppInfo\"}";

            var response = handler.Handle(requestJson);

            Assert.Equal("req-re-info", response.Id);
            Assert.True(response.Success);

            string json = JsonSerializer.Serialize(response.Data);
            Assert.Contains("Rule", json);
            Assert.Contains("Editor", json);
            Assert.Contains("isDesktopHost\":true", json);
        }

        [Fact]
        public void RuleEditor_GetRulePack_ReturnsRulesAndManifest()
        {
            var handler = CreateRuleEditorHandler();
            string requestJson = "{\"id\":\"req-re-pack\",\"action\":\"getRulePack\"}";

            var response = handler.Handle(requestJson);

            Assert.Equal("req-re-pack", response.Id);
            Assert.True(response.Success);

            string json = JsonSerializer.Serialize(response.Data);
            Assert.Contains("rules", json);
            Assert.Contains("manifest", json);
        }

        [Fact]
        public void RuleEditor_PublishRulePack_SchemaValidationEnforcement()
        {
            var handler = CreateRuleEditorHandler();

            // 1. Missing version
            var noVer = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-re-no-ver",
                action = "publishRulePack",
                payload = new { rules = new List<RuleDefinition>(), templateMap = new TemplateMap() }
            }));
            Assert.Equal("req-re-no-ver", noVer.Id);
            Assert.False(noVer.Success);
            Assert.Contains("version", noVer.Error);

            // 2. Missing rules
            var noRules = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-re-no-rules",
                action = "publishRulePack",
                payload = new { version = "14.1.0", templateMap = new TemplateMap() }
            }));
            Assert.Equal("req-re-no-rules", noRules.Id);
            Assert.False(noRules.Success);
            Assert.Contains("rules", noRules.Error);

            // 3. Missing templateMap
            var noTm = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-re-no-tm",
                action = "publishRulePack",
                payload = new { version = "14.1.0", rules = new List<RuleDefinition>() }
            }));
            Assert.Equal("req-re-no-tm", noTm.Id);
            Assert.False(noTm.Success);
            Assert.Contains("templateMap", noTm.Error);
        }

        [Fact]
        public void RuleEditor_PublishRulePack_ValidPayload_PublishesSuccessfully()
        {
            string tempPublishDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_publish_{Guid.NewGuid():N}");
            Directory.CreateDirectory(tempPublishDir);

            try
            {
                var handler = new RuleEditorBridgeHandler(tempPublishDir);
                var rules = new List<RuleDefinition>
                {
                    new()
                    {
                        Id = "TEST-RULE-001",
                        SemanticKey = "testRule",
                        Scope = RuleScope.Unit,
                        Category = "Base",
                        Order = 1,
                        Text = "Automated test rule",
                        VerificationMode = "ManualCheckbox",
                        RequiredFacts = new List<string>()
                    }
                };

                var templateMap = new TemplateMap
                {
                    TemplateVersion = "14.1.0",
                    GeneralFields = new Dictionary<string, CellCoordinate>
                    {
                        ["unit.jobName"] = new CellCoordinate { Sheet = "Verification List", Cell = "B2" }
                    },
                    SqRange = new SqRangeMapping { Sheet = "Verification List", StartRow = 50, EndRow = 71 },
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>
                    {
                        ["testRule"] = new RuleCellMapping
                        {
                            RuleId = "TEST-RULE-001",
                            Row = 15,
                            NaCell = "C15",
                            DetailerCell = "D15",
                            CheckerCell = "E15",
                            CommentsCell = "F15",
                            InitialsCell = "G15"
                        }
                    }
                };

                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-re-publish-ok",
                    action = "publishRulePack",
                    payload = new
                    {
                        version = "14.1.0",
                        rules = rules,
                        templateMap = templateMap
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-re-publish-ok", response.Id);
                Assert.True(response.Success, response.Error);
                Assert.True(File.Exists(Path.Combine(tempPublishDir, "manifest.json")));
                Assert.True(File.Exists(Path.Combine(tempPublishDir, "rules.json")));
                Assert.True(File.Exists(Path.Combine(tempPublishDir, "template_map.json")));

                // Verify publish -> reload behavior in RuleEditorBridgeHandler
                var getPackRes = handler.Handle("{\"id\":\"req-re-reloaded\",\"action\":\"getRulePack\"}");
                Assert.True(getPackRes.Success);
                string packJson = JsonSerializer.Serialize(getPackRes.Data);
                Assert.Contains("\"version\":\"14.1.0\"", packJson);
                Assert.Contains("\"id\":\"TEST-RULE-001\"", packJson);

                var appInfoRes = handler.Handle("{\"id\":\"req-re-info\",\"action\":\"getAppInfo\"}");
                Assert.True(appInfoRes.Success);
                string appInfoJson = JsonSerializer.Serialize(appInfoRes.Data);
                Assert.Contains("\"rulePackVersion\":\"14.1.0\"", appInfoJson);
                Assert.Contains("\"ruleCount\":1", appInfoJson);
            }
            finally
            {
                if (Directory.Exists(tempPublishDir))
                {
                    try { Directory.Delete(tempPublishDir, true); } catch { }
                }
            }
        }

        [Fact]
        public void RuleEditor_PublishRulePack_UnsupportedVerificationMode_FailsValidation()
        {
            string tempPublishDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_publish_invalid_{Guid.NewGuid():N}");
            Directory.CreateDirectory(tempPublishDir);

            try
            {
                var handler = new RuleEditorBridgeHandler(tempPublishDir);
                var rules = new List<RuleDefinition>
                {
                    new()
                    {
                        Id = "TEST-RULE-INVALID",
                        SemanticKey = "testRuleInvalid",
                        Scope = RuleScope.Unit,
                        Category = "Base",
                        Order = 1,
                        Text = "Unsupported mode rule",
                        VerificationMode = "AutoEvaluated",
                        RequiredFacts = new List<string>()
                    }
                };

                var templateMap = new TemplateMap
                {
                    TemplateVersion = "14.1.0",
                    GeneralFields = new Dictionary<string, CellCoordinate>
                    {
                        ["unit.jobName"] = new CellCoordinate { Sheet = "Verification List", Cell = "B2" }
                    },
                    SqRange = new SqRangeMapping { Sheet = "Verification List", StartRow = 50, EndRow = 71 },
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>
                    {
                        ["testRuleInvalid"] = new RuleCellMapping
                        {
                            RuleId = "TEST-RULE-INVALID",
                            Row = 15,
                            NaCell = "C15",
                            DetailerCell = "D15",
                            CheckerCell = "E15",
                            CommentsCell = "F15",
                            InitialsCell = "G15"
                        }
                    }
                };

                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-re-publish-invalid",
                    action = "publishRulePack",
                    payload = new
                    {
                        version = "14.1.0",
                        rules = rules,
                        templateMap = templateMap
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-re-publish-invalid", response.Id);
                Assert.False(response.Success);
                Assert.Contains("has unsupported verificationMode 'AutoEvaluated'", response.Error);
                Assert.False(File.Exists(Path.Combine(tempPublishDir, "manifest.json")));
            }
            finally
            {
                if (Directory.Exists(tempPublishDir))
                {
                    try { Directory.Delete(tempPublishDir, true); } catch { }
                }
            }
        }

        [Fact]
        public void RuleEditor_PublishRulePack_WithTargetPath_PublishesBothLocations()
        {
            string tempActiveDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_active_{Guid.NewGuid():N}");
            string tempTargetDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_target_{Guid.NewGuid():N}");
            Directory.CreateDirectory(tempActiveDir);
            Directory.CreateDirectory(tempTargetDir);

            try
            {
                var handler = new RuleEditorBridgeHandler(tempActiveDir);
                var rules = new List<RuleDefinition>
                {
                    new()
                    {
                        Id = "TEST-DUAL-001",
                        SemanticKey = "testDual",
                        Scope = RuleScope.Unit,
                        Category = "Base",
                        Order = 1,
                        Text = "Dual publish rule",
                        VerificationMode = "ManualCheckbox",
                        RequiredFacts = new List<string>()
                    }
                };

                var templateMap = new TemplateMap
                {
                    TemplateVersion = "14.1.0",
                    GeneralFields = new Dictionary<string, CellCoordinate>
                    {
                        ["unit.jobName"] = new CellCoordinate { Sheet = "Verification List", Cell = "B2" }
                    },
                    SqRange = new SqRangeMapping { Sheet = "Verification List", StartRow = 50, EndRow = 71 },
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>
                    {
                        ["testDual"] = new RuleCellMapping
                        {
                            RuleId = "TEST-DUAL-001",
                            Row = 15,
                            NaCell = "C15",
                            DetailerCell = "D15",
                            CheckerCell = "E15",
                            CommentsCell = "F15",
                            InitialsCell = "G15"
                        }
                    }
                };

                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-re-publish-dual",
                    action = "publishRulePack",
                    payload = new
                    {
                        version = "14.1.0",
                        rules = rules,
                        templateMap = templateMap,
                        targetPath = tempTargetDir
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-re-publish-dual", response.Id);
                Assert.True(response.Success, response.Error);

                var manager = new RulePackManager();
                var activeBundle = manager.LoadFromDirectory(tempActiveDir);
                Assert.True(activeBundle.IsValid);
                Assert.Equal("14.1.0", activeBundle.Manifest.Version);

                var targetBundle = manager.LoadFromDirectory(tempTargetDir);
                Assert.True(targetBundle.IsValid);
                Assert.Equal("14.1.0", targetBundle.Manifest.Version);
                Assert.Equal(activeBundle.Manifest.BundleSha256, targetBundle.Manifest.BundleSha256);
            }
            finally
            {
                if (Directory.Exists(tempActiveDir)) try { Directory.Delete(tempActiveDir, true); } catch { }
                if (Directory.Exists(tempTargetDir)) try { Directory.Delete(tempTargetDir, true); } catch { }
            }
        }

        [Fact]
        public void RuleEditor_PublishRulePack_RollbackOnTargetFailure_PreservesActivePack()
        {
            string tempActiveDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_rollback_{Guid.NewGuid():N}");
            string conflictFile = Path.GetTempFileName();
            Directory.CreateDirectory(tempActiveDir);

            try
            {
                var handler = new RuleEditorBridgeHandler(tempActiveDir);
                var initialRules = new List<RuleDefinition>
                {
                    new()
                    {
                        Id = "TEST-INIT-001",
                        SemanticKey = "testInit",
                        Scope = RuleScope.Unit,
                        Category = "Base",
                        Order = 1,
                        Text = "Initial rule",
                        VerificationMode = "ManualCheckbox",
                        RequiredFacts = new List<string>()
                    }
                };

                var initialMap = new TemplateMap
                {
                    TemplateVersion = "14.0.0",
                    GeneralFields = new Dictionary<string, CellCoordinate>
                    {
                        ["unit.jobName"] = new CellCoordinate { Sheet = "Verification List", Cell = "B2" }
                    },
                    SqRange = new SqRangeMapping { Sheet = "Verification List", StartRow = 50, EndRow = 71 },
                    RuleCellMappings = new Dictionary<string, RuleCellMapping>
                    {
                        ["testInit"] = new RuleCellMapping
                        {
                            RuleId = "TEST-INIT-001",
                            Row = 15,
                            NaCell = "C15",
                            DetailerCell = "D15",
                            CheckerCell = "E15",
                            CommentsCell = "F15",
                            InitialsCell = "G15"
                        }
                    }
                };

                // Step 1: Initial publish succeeds
                var initRes = handler.Handle(JsonSerializer.Serialize(new
                {
                    id = "req-re-init",
                    action = "publishRulePack",
                    payload = new { version = "14.0.0", rules = initialRules, templateMap = initialMap }
                }));
                Assert.True(initRes.Success, initRes.Error);

                // Step 2: Attempting publish with targetPath pointing to a file (not dir) fails during promotion
                var failRes = handler.Handle(JsonSerializer.Serialize(new
                {
                    id = "req-re-fail-target",
                    action = "publishRulePack",
                    payload = new
                    {
                        version = "14.1.0",
                        rules = initialRules,
                        templateMap = initialMap,
                        targetPath = conflictFile
                    }
                }));

                Assert.Equal("req-re-fail-target", failRes.Id);
                Assert.False(failRes.Success);
                Assert.Contains("destination is a file", failRes.Error);

                // Step 3: Active pack was rolled back and preserved intact
                var manager = new RulePackManager();
                var activeBundle = manager.LoadFromDirectory(tempActiveDir);
                Assert.True(activeBundle.IsValid);
                Assert.Equal("14.0.0", activeBundle.Manifest.Version);
            }
            finally
            {
                if (Directory.Exists(tempActiveDir)) try { Directory.Delete(tempActiveDir, true); } catch { }
                if (File.Exists(conflictFile)) try { File.Delete(conflictFile); } catch { }
            }
        }

        [Fact]
        public void Handle_LaunchRuleEditor_CapturesProcessLaunchWithRulePackContext()
        {
            ProcessStartInfo? capturedPsi = null;
            var handler = CreateAppHandler(processLauncher: psi => capturedPsi = psi);

            var response = handler.Handle("{\"id\":\"req-launch-re\",\"action\":\"launchRuleEditor\"}");

            Assert.Equal("req-launch-re", response.Id);
            Assert.True(response.Success, response.Error);
            Assert.NotNull(capturedPsi);
            Assert.True(capturedPsi.UseShellExecute);
            if (!string.IsNullOrEmpty(capturedPsi.Arguments))
            {
                Assert.Contains("--rule-pack", capturedPsi.Arguments);
            }
        }

        [Fact]
        public void RuleEditor_HeadlessDialogActions_ReturnNullWithoutCrashing()
        {
            var handler = CreateRuleEditorHandler();

            var openRes = handler.Handle("{\"id\":\"req-re-ofd\",\"action\":\"openFileDialog\"}");
            Assert.Equal("req-re-ofd", openRes.Id);
            Assert.True(openRes.Success);
            Assert.Null(openRes.Data);

            var folderRes = handler.Handle("{\"id\":\"req-re-sbd\",\"action\":\"selectFolderDialog\"}");
            Assert.Equal("req-re-sbd", folderRes.Id);
            Assert.True(folderRes.Success);
            Assert.Null(folderRes.Data);
        }

        [Fact]
        public void RuleEditor_UnknownAction_ReturnsDescriptiveError()
        {
            var handler = CreateRuleEditorHandler();
            string requestJson = "{\"id\":\"req-re-unknown\",\"action\":\"unsupportedEditorAction\"}";

            var response = handler.Handle(requestJson);

            Assert.Equal("req-re-unknown", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Unsupported Rule Editor bridge action: 'unsupportedEditorAction'", response.Error);
        }
    }
}
