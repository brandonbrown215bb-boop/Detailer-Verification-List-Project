using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Session;
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

        [Theory]
        [InlineData("saveDvl")]
        [InlineData("verifySource")]
        [InlineData("exportExcelDeliverable")]
        public void Handle_RetiredLegacyActions_AreRejectedWithUnknownAction(string action)
        {
            var handler = CreateAppHandler();
            string requestJson = JsonSerializer.Serialize(new
            {
                id = $"req-retired-{action}",
                action = action,
                payload = new { }
            });

            var response = handler.Handle(requestJson);
            Assert.Equal($"req-retired-{action}", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Unknown bridge action", response.Error);
        }

        [Fact]
        public void Handle_ProjectSession_RawXml_WithoutDiskPath_IsUntrusted_AndFinalExportFailsClosed()
        {
            string tempXlsx = Path.Combine(Path.GetTempPath(), $"test_ps_final_{Guid.NewGuid():N}.xlsx");
            var handler = CreateAppHandler(() => tempXlsx);

            try
            {
                string rawXml = @"<?xml version=""1.0""?><unitRevision><unitWeight>5000</unitWeight></unitRevision>";

                // 1. Open session with raw XML and no valid disk path; client attempts to inject isTrusted = true
                string openReq = JsonSerializer.Serialize(new
                {
                    id = "req-ps-open-raw",
                    action = "projectSession_open",
                    payload = new
                    {
                        configXml = rawXml,
                        isTrusted = true // client-injected trust must be ignored and set to false
                    }
                });

                var openRes = handler.Handle(openReq);
                Assert.True(openRes.Success, openRes.Error);

                var options = JsonDefaults.CreateFlexibleOptions();
                var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                    JsonSerializer.Serialize(openRes.Data), options);
                Assert.NotNull(snapshot);
                Assert.False(snapshot.Source.IsTrusted);
                Assert.False(snapshot.Readiness.IsReadyForFinal);
                Assert.Contains("Project source is not an authentic native UPZ/Config.xml", snapshot.Readiness.Blockers);

                // 2. Attempt final export on untrusted session -> must fail closed
                string finalExportReq = JsonSerializer.Serialize(new
                {
                    id = "req-ps-export-final",
                    action = "projectSession_exportExcel",
                    payload = new
                    {
                        sessionId = snapshot.SessionId,
                        expectedRevision = snapshot.Revision,
                        isDraft = false
                    }
                });

                var finalExportRes = handler.Handle(finalExportReq);
                Assert.False(finalExportRes.Success);
                Assert.Contains("Final export requires a verified authentic source", finalExportRes.Error);
                Assert.False(File.Exists(tempXlsx));

                // 3. Draft export on untrusted session -> succeeds
                string draftExportReq = JsonSerializer.Serialize(new
                {
                    id = "req-ps-export-draft",
                    action = "projectSession_exportExcel",
                    payload = new
                    {
                        sessionId = snapshot.SessionId,
                        expectedRevision = snapshot.Revision,
                        isDraft = true
                    }
                });

                var draftExportRes = handler.Handle(draftExportReq);
                Assert.True(draftExportRes.Success, draftExportRes.Error);
                Assert.True(File.Exists(tempXlsx));
            }
            finally
            {
                if (File.Exists(tempXlsx)) File.Delete(tempXlsx);
            }
        }

        [Fact]
        public void Handle_ProjectSession_ExportExcel_Cancellation_ReturnsCancelledWithoutWritingFile()
        {
            var handler = CreateAppHandler(() => null); // Selector returns null (cancelled)
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);

            string openReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-open-cancel",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath,
                    configXml,
                    isUpz = false
                }
            });
            var openRes = handler.Handle(openReq);
            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openRes.Data), JsonDefaults.CreateFlexibleOptions())!;

            string exportReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-export-cancelled",
                action = "projectSession_exportExcel",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = snapshot.Revision,
                    isDraft = true
                }
            });

            var exportRes = handler.Handle(exportReq);
            Assert.True(exportRes.Success, exportRes.Error);
            string json = JsonSerializer.Serialize(exportRes.Data);
            Assert.Contains("\"cancelled\":true", json);
        }

        [Fact]
        public void Handle_ProjectSession_UpdateChecklist_ValidatesAllowedTransitions()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);

            string openReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-open-cl",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath,
                    configXml,
                    isUpz = false
                }
            });
            var openRes = handler.Handle(openReq);
            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openRes.Data), JsonDefaults.CreateFlexibleOptions())!;

            var check = snapshot.Checklists.First();

            // 1. Invalid status value (out of enum range)
            string invalidStatusReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-cl-invalid-status",
                action = "projectSession_updateChecklist",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = snapshot.Revision,
                    checkId = check.InstanceKey,
                    status = 999
                }
            });
            var invalidRes = handler.Handle(invalidStatusReq);
            Assert.True(invalidRes.Success);
            var invalidCmdResult = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(invalidRes.Data), JsonDefaults.CreateFlexibleOptions())!;
            Assert.False(invalidCmdResult.Success);
            Assert.Contains("Invalid checklist status", invalidCmdResult.ErrorMessage);

            // 2. Find a rule where AllowNA is false
            var bundle = new RulePackManager().LoadFromDirectory(_rulePackPath);
            var nonNaRule = bundle.Rules.FirstOrDefault(r => r.AllowNA == false);
            if (nonNaRule != null)
            {
                var nonNaCheck = snapshot.Checklists.FirstOrDefault(c => c.RuleId == nonNaRule.Id);
                if (nonNaCheck != null)
                {
                    string naReq = JsonSerializer.Serialize(new
                    {
                        id = "req-ps-cl-na-not-allowed",
                        action = "projectSession_updateChecklist",
                        payload = new
                        {
                            sessionId = snapshot.SessionId,
                            expectedRevision = snapshot.Revision,
                            checkId = nonNaCheck.InstanceKey,
                            status = (int)CheckStatus.NA
                        }
                    });
                    var naRes = handler.Handle(naReq);
                    Assert.True(naRes.Success);
                    var naCmdResult = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(naRes.Data), JsonDefaults.CreateFlexibleOptions())!;
                    Assert.False(naCmdResult.Success);
                    Assert.Contains("does not allow N/A status", naCmdResult.ErrorMessage);
                }
            }
        }

        [Fact]
        public void Handle_ProjectSession_ReorderSpecialQuotes_ValidatesBoundsAndDuplicates()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);

            string openReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-open-sq",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath,
                    configXml,
                    isUpz = false
                }
            });
            var openRes = handler.Handle(openReq);
            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openRes.Data), JsonDefaults.CreateFlexibleOptions())!;

            // Add 2 special quotes
            var sq1Res = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-ps-add-sq1",
                action = "projectSession_updateSpecialQuote",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = snapshot.Revision,
                    specialQuote = new SpecialQuote { Id = "sq-1", Slot = 1, Text = "SQ 1" }
                }
            }));
            Assert.True(sq1Res.Success);
            var snap1 = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(sq1Res.Data), JsonDefaults.CreateFlexibleOptions())!.Snapshot!;

            var sq2Res = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-ps-add-sq2",
                action = "projectSession_updateSpecialQuote",
                payload = new
                {
                    sessionId = snap1.SessionId,
                    expectedRevision = snap1.Revision,
                    specialQuote = new SpecialQuote { Id = "sq-2", Slot = 2, Text = "SQ 2" }
                }
            }));
            Assert.True(sq2Res.Success);
            var snap2 = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(sq2Res.Data), JsonDefaults.CreateFlexibleOptions())!.Snapshot!;

            // 1. Slot out of bounds (slot 0 or 23)
            var outOfBoundsRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-ps-reorder-oob",
                action = "projectSession_reorderSpecialQuotes",
                payload = new
                {
                    sessionId = snap2.SessionId,
                    expectedRevision = snap2.Revision,
                    assignments = new[]
                    {
                        new { quoteId = "sq-1", slot = 0 }
                    }
                }
            }));
            Assert.True(outOfBoundsRes.Success);
            var outOfBoundsCmd = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(outOfBoundsRes.Data), JsonDefaults.CreateFlexibleOptions())!;
            Assert.False(outOfBoundsCmd.Success);
            Assert.Contains("Invalid slot", outOfBoundsCmd.ErrorMessage);

            // 2. Duplicate slots
            var duplicateRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-ps-reorder-dup",
                action = "projectSession_reorderSpecialQuotes",
                payload = new
                {
                    sessionId = snap2.SessionId,
                    expectedRevision = snap2.Revision,
                    assignments = new[]
                    {
                        new { quoteId = "sq-1", slot = 5 },
                        new { quoteId = "sq-2", slot = 5 }
                    }
                }
            }));
            Assert.True(duplicateRes.Success);
            var dupCmd = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(duplicateRes.Data), JsonDefaults.CreateFlexibleOptions())!;
            Assert.False(dupCmd.Success);
            Assert.Contains("duplicate slot numbers", dupCmd.ErrorMessage);
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
        public void RuleEditor_GetAppInfo_ReturnsDefaultPublishPathWhenConfigured()
        {
            string expectedPath = @"P:\Detailing\DVL Rulepack";
            string pack = TestPathHelper.GetRepoPath("resources/rulepack");
            var handler = new RuleEditorBridgeHandler(null, pack, defaultPublishPath: expectedPath);
            string requestJson = "{\"id\":\"req-re-info-pub\",\"action\":\"getAppInfo\"}";

            var response = handler.Handle(requestJson);

            Assert.Equal("req-re-info-pub", response.Id);
            Assert.True(response.Success);

            using var doc = JsonDocument.Parse(JsonSerializer.Serialize(response.Data));
            Assert.True(doc.RootElement.TryGetProperty("defaultPublishPath", out var prop));
            Assert.Equal(expectedPath, prop.GetString());
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
        public void RuleEditor_PublishRulePack_WithDefaultPublishPath_PublishesBothLocations()
        {
            string tempActiveDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_active_{Guid.NewGuid():N}");
            string tempDefaultTargetDir = Path.Combine(Path.GetTempPath(), $"test_rulepack_default_target_{Guid.NewGuid():N}");
            Directory.CreateDirectory(tempActiveDir);
            Directory.CreateDirectory(tempDefaultTargetDir);

            try
            {
                var handler = new RuleEditorBridgeHandler(null, tempActiveDir, defaultPublishPath: tempDefaultTargetDir);
                var rules = new List<RuleDefinition>
                {
                    new()
                    {
                        Id = "TEST-DEF-001",
                        SemanticKey = "testDef",
                        Scope = RuleScope.Unit,
                        Category = "Base",
                        Order = 1,
                        Text = "Default publish rule",
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
                        ["testDef"] = new RuleCellMapping
                        {
                            RuleId = "TEST-DEF-001",
                            Row = 15,
                            NaCell = "C15",
                            DetailerCell = "D15",
                            CheckerCell = "E15",
                            CommentsCell = "F15",
                            InitialsCell = "G15"
                        }
                    }
                };

                // Request without explicit targetPath; should fall back to defaultPublishPath
                string requestJson = JsonSerializer.Serialize(new
                {
                    id = "req-re-publish-default-path",
                    action = "publishRulePack",
                    payload = new
                    {
                        version = "14.1.0",
                        rules = rules,
                        templateMap = templateMap
                    }
                });

                var response = handler.Handle(requestJson);

                Assert.Equal("req-re-publish-default-path", response.Id);
                Assert.True(response.Success, response.Error);

                var manager = new RulePackManager();
                var activeBundle = manager.LoadFromDirectory(tempActiveDir);
                Assert.True(activeBundle.IsValid);
                Assert.Equal("14.1.0", activeBundle.Manifest.Version);

                var targetBundle = manager.LoadFromDirectory(tempDefaultTargetDir);
                Assert.True(targetBundle.IsValid);
                Assert.Equal("14.1.0", targetBundle.Manifest.Version);
                Assert.Equal(activeBundle.Manifest.BundleSha256, targetBundle.Manifest.BundleSha256);
            }
            finally
            {
                if (Directory.Exists(tempActiveDir)) try { Directory.Delete(tempActiveDir, true); } catch { }
                if (Directory.Exists(tempDefaultTargetDir)) try { Directory.Delete(tempDefaultTargetDir, true); } catch { }
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
        public void Handle_LaunchRuleEditor_IsGuttedAndReturnsUnsupportedAction()
        {
            var handler = CreateAppHandler();

            var response = handler.Handle("{\"id\":\"req-launch-re\",\"action\":\"launchRuleEditor\"}");

            Assert.Equal("req-launch-re", response.Id);
            Assert.False(response.Success);
            Assert.Contains("Unknown bridge action: 'launchRuleEditor'", response.Error);
        }

        [Fact]
        public void Handle_ReloadActiveRulePack_ReloadsAndReturnsPackAndSnapshot()
        {
            var handler = CreateAppHandler();

            var response = handler.Handle("{\"id\":\"req-reload-rp\",\"action\":\"reloadActiveRulePack\"}");

            Assert.Equal("req-reload-rp", response.Id);
            Assert.True(response.Success, response.Error);
            Assert.NotNull(response.Data);
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
