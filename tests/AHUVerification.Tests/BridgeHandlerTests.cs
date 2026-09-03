using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Models;
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

        private BridgeHandler CreateAppHandler() => new(_rulePackPath);
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

            try
            {
                string projectJson = "{\"version\":\"1.0.0\",\"jobName\":\"TestHospital\",\"comNumber\":\"COM-999\",\"units\":[]}";
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
                Assert.True(response.Success);
                Assert.True(File.Exists(tempDvl));

                string savedContent = File.ReadAllText(tempDvl);
                Assert.Contains("TestHospital", savedContent);
                Assert.Contains("COM-999", savedContent);
            }
            finally
            {
                if (File.Exists(tempDvl)) File.Delete(tempDvl);
            }
        }

        [Fact]
        public void Handle_ExportExcelDeliverable_WithOutputPath_ExportsWorkbook()
        {
            var handler = CreateAppHandler();
            string tempXlsx = Path.Combine(Path.GetTempPath(), $"test_export_{Guid.NewGuid():N}.xlsx");

            try
            {
                var facts = new Dictionary<string, Fact>
                {
                    ["jobName"] = new Fact { Key = "jobName", Value = "Bridge Test Facility", Category = "General", Status = FactStatus.Known },
                    ["orderNumber"] = new Fact { Key = "orderNumber", Value = "ORD-777123", Category = "General", Status = FactStatus.Known }
                };

                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-export-excel",
                    action = "exportExcelDeliverable",
                    payload = new
                    {
                        facts = facts,
                        sqItems = new List<SpecialQuote>(),
                        checklists = new List<ChecklistInstance>(),
                        outputPath = tempXlsx,
                        isDraft = true,
                        generalComments = "Bridge automated test export"
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-export-excel", response.Id);
                Assert.True(response.Success);
                Assert.True(File.Exists(tempXlsx));
                Assert.True(new FileInfo(tempXlsx).Length > 0);
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
                        Category = "Testing",
                        Order = 1,
                        Text = "Automated test rule",
                        VerificationMode = "Automated"
                    }
                };

                var templateMap = new TemplateMap
                {
                    TemplateVersion = "14.1.0",
                    GeneralFields = new Dictionary<string, CellCoordinate>
                    {
                        ["jobName"] = new CellCoordinate { Sheet = "Verification List", Cell = "B2" }
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
                Assert.True(response.Success);
                Assert.True(File.Exists(Path.Combine(tempPublishDir, "manifest.json")));
                Assert.True(File.Exists(Path.Combine(tempPublishDir, "rules.json")));
                Assert.True(File.Exists(Path.Combine(tempPublishDir, "template_map.json")));
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
