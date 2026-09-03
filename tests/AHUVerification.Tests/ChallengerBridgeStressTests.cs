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
    public class ChallengerBridgeStressTests
    {
        private readonly string _rulePackPath;

        public ChallengerBridgeStressTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
        }

        private BridgeHandler CreateAppHandler() => new(_rulePackPath);
        private RuleEditorBridgeHandler CreateRuleEditorHandler() => new(_rulePackPath);

        // =========================================================================
        // SECTION 1: Adversarial Stress Testing of BridgeRequest.ExtractRequestId
        // =========================================================================

        [Theory]
        // Truncation & Missing Closing Braces
        [InlineData("{\"id\": \"test-id-123\", \"action\": \"foo\"", "test-id-123")]
        [InlineData("{\"id\":\"test-id-456\", \"payload\": {\"sub\": true", "test-id-456")]
        [InlineData("{\"id\":\"test-id-789\"", "test-id-789")]
        [InlineData("{\"id\": \"id-with-colon:and:symbols!@#$\" , \"action", "id-with-colon:and:symbols!@#$")]
        // Embedded Newlines & Whitespace
        [InlineData("{\n  \"id\"\n  :\n  \"newline-id-1\"\n  ,\n  \"action\": \"test\"\n}", "newline-id-1")]
        [InlineData("{\r\n\t\"id\"\t:\t\"tab-cr-id-2\"\r\n}", "tab-cr-id-2")]
        [InlineData("   \t  {\"id\":     \"spaced-id-3\"   , \"broken\": true   ", "spaced-id-3")]
        // Case Variations in Broken/Valid JSON
        [InlineData("{\"Id\": \"cap-id-1\", \"broken\": true", "cap-id-1")]
        [InlineData("{\"ID\": \"allcap-id-2\", \"broken\": true", "allcap-id-2")]
        [InlineData("{\"id\":\"normal-id-3\"}", "normal-id-3")]
        [InlineData("{\"Id\":\"pascal-id-4\"}", "pascal-id-4")]
        // Truncated Inside ID Value (Should safely return empty or partial without crashing)
        [InlineData("{\"id\": \"incomplete-val", "")]
        [InlineData("{\"id\": \"", "")]
        [InlineData("{\"id\": ", "")]
        [InlineData("{\"id\"", "")]
        // Empty / Whitespace / Garbage
        [InlineData("", "")]
        [InlineData("    ", "")]
        [InlineData("not json at all", "")]
        [InlineData("<xml><id>123</id></xml>", "")]
        [InlineData("null", "")]
        [InlineData("12345", "")]
        [InlineData("true", "")]
        [InlineData("[]", "")]
        [InlineData("{}", "")]
        // Non-String ID Values in Valid JSON
        [InlineData("{\"id\": 12345, \"action\": \"test\"}", "")]
        [InlineData("{\"id\": 99.99, \"action\": \"test\"}", "")]
        [InlineData("{\"id\": null, \"action\": \"test\"}", "")]
        [InlineData("{\"id\": true, \"action\": \"test\"}", "")]
        [InlineData("{\"id\": false, \"action\": \"test\"}", "")]
        [InlineData("{\"id\": {}, \"action\": \"test\"}", "")]
        [InlineData("{\"id\": [\"a\", \"b\"], \"action\": \"test\"}", "")]
        // Non-String ID Values in Broken JSON
        [InlineData("{\"id\": 12345, \"broken\": ", "")]
        [InlineData("{\"id\": null, \"broken\": ", "")]
        [InlineData("{\"id\": true, \"broken\": ", "")]
        [InlineData("{\"id\": [1,2,3], \"broken\": ", "")]
        public void ExtractRequestId_AdversarialInputs_ReturnsExpectedIdWithoutThrowing(string? rawJson, string expectedId)
        {
            string actual = BridgeRequest.ExtractRequestId(rawJson);
            Assert.Equal(expectedId, actual);
        }

        [Fact]
        public void ExtractRequestId_NestedVsTopLevelId_InValidJson_ExtractsTopLevel()
        {
            string validJsonWithNestedId = "{\"payload\":{\"id\":\"nested-id\"},\"id\":\"toplevel-id\",\"action\":\"test\"}";
            string extracted = BridgeRequest.ExtractRequestId(validJsonWithNestedId);
            Assert.Equal("toplevel-id", extracted);
        }

        [Fact]
        public void ExtractRequestId_HugePayloadWithBrokenEnd_ExtractsIdPromptly()
        {
            string largePadding = new string('x', 500000);
            string brokenLargeJson = $"{{\"id\":\"huge-req-999\",\"data\":\"{largePadding}\", broken_end";

            string extracted = BridgeRequest.ExtractRequestId(brokenLargeJson);
            Assert.Equal("huge-req-999", extracted);
        }

        // =========================================================================
        // SECTION 2: Adversarial Stress Testing of App BridgeHandler
        // =========================================================================

        [Theory]
        [InlineData("getAppInfo")]
        [InlineData("getRulePack")]
        [InlineData("openFileDialog")]
        [InlineData("saveFileDialog")]
        [InlineData("extractUpz")]
        [InlineData("saveDvl")]
        [InlineData("exportExcelDeliverable")]
        [InlineData("openFile")]
        [InlineData("showInExplorer")]
        [InlineData("checkRulePackUpdate")]
        [InlineData("syncRulePack")]
        [InlineData("selectFolderDialog")]
        [InlineData("launchRuleEditor")]
        public void AppBridgeHandler_BrokenJsonEnvelope_PreservesIdAndReturnsFail(string action)
        {
            var handler = CreateAppHandler();
            string brokenEnvelope = $"{{\"id\":\"adv-req-{action}\", \"action\":\"{action}\", \"payload\": {{ incomplete_json_here";

            var response = handler.Handle(brokenEnvelope);

            Assert.Equal($"adv-req-{action}", response.Id);
            Assert.False(response.Success);
            Assert.NotNull(response.Error);
            Assert.Contains("Deserialization error", response.Error);
        }

        [Theory]
        [InlineData("extractUpz")]
        [InlineData("saveDvl")]
        [InlineData("exportExcelDeliverable")]
        [InlineData("openFile")]
        [InlineData("showInExplorer")]
        [InlineData("checkRulePackUpdate")]
        [InlineData("syncRulePack")]
        public void AppBridgeHandler_NullOrNonObjectPayload_ForActionsRequiringPayload_FailsSafely(string action)
        {
            var handler = CreateAppHandler();

            // 1. Payload as null
            string reqNullPayload = $"{{\"id\":\"req-null-{action}\",\"action\":\"{action}\",\"payload\":null}}";
            var resNull = handler.Handle(reqNullPayload);
            Assert.Equal($"req-null-{action}", resNull.Id);
            Assert.False(resNull.Success);
            Assert.NotNull(resNull.Error);

            // 2. Payload as integer
            string reqIntPayload = $"{{\"id\":\"req-int-{action}\",\"action\":\"{action}\",\"payload\":12345}}";
            var resInt = handler.Handle(reqIntPayload);
            Assert.Equal($"req-int-{action}", resInt.Id);
            Assert.False(resInt.Success);
            Assert.NotNull(resInt.Error);

            // 3. Payload as array
            string reqArrPayload = $"{{\"id\":\"req-arr-{action}\",\"action\":\"{action}\",\"payload\":[1,2,3]}}";
            var resArr = handler.Handle(reqArrPayload);
            Assert.Equal($"req-arr-{action}", resArr.Id);
            Assert.False(resArr.Success);
            Assert.NotNull(resArr.Error);

            // 4. Payload as string
            string reqStrPayload = $"{{\"id\":\"req-str-{action}\",\"action\":\"{action}\",\"payload\":\"raw string\"}}";
            var resStr = handler.Handle(reqStrPayload);
            Assert.Equal($"req-str-{action}", resStr.Id);
            Assert.False(resStr.Success);
            Assert.NotNull(resStr.Error);
        }

        [Theory]
        [InlineData("extractUpz", "filePath")]
        [InlineData("saveDvl", "filePath")]
        [InlineData("openFile", "filePath")]
        [InlineData("showInExplorer", "filePath")]
        [InlineData("checkRulePackUpdate", "remotePath")]
        [InlineData("syncRulePack", "remotePath")]
        public void AppBridgeHandler_EmptyOrWhitespaceRequiredString_FailsWithDescriptiveError(string action, string propName)
        {
            var handler = CreateAppHandler();

            // Empty string
            string reqEmpty = $"{{\"id\":\"req-empty-{action}\",\"action\":\"{action}\",\"payload\":{{\"{propName}\":\"\"}}}}";
            var resEmpty = handler.Handle(reqEmpty);
            Assert.Equal($"req-empty-{action}", resEmpty.Id);
            Assert.False(resEmpty.Success);
            Assert.Contains(propName, resEmpty.Error);

            // Whitespace string
            string reqWs = $"{{\"id\":\"req-ws-{action}\",\"action\":\"{action}\",\"payload\":{{\"{propName}\":\"   \\t\\n\"}}}}";
            var resWs = handler.Handle(reqWs);
            Assert.Equal($"req-ws-{action}", resWs.Id);
            Assert.False(resWs.Success);
            Assert.Contains(propName, resWs.Error);

            // Wrong type (integer instead of string)
            string reqBadType = $"{{\"id\":\"req-type-{action}\",\"action\":\"{action}\",\"payload\":{{\"{propName}\":99999}}}}";
            var resBadType = handler.Handle(reqBadType);
            Assert.Equal($"req-type-{action}", resBadType.Id);
            Assert.False(resBadType.Success);
            Assert.Contains(propName, resBadType.Error);
        }

        [Theory]
        // Invalid Facts (array instead of dictionary object)
        [InlineData("{\"sqItems\":[], \"checklists\":[]}", "facts")]
        [InlineData("{\"facts\":[1,2,3], \"sqItems\":[], \"checklists\":[]}", "facts")]
        [InlineData("{\"facts\": \"invalid_str\", \"sqItems\":[], \"checklists\":[]}", "facts")]
        // Invalid sqItems (object instead of array)
        [InlineData("{\"facts\":{}, \"checklists\":[]}", "sqItems")]
        [InlineData("{\"facts\":{}, \"sqItems\":{}, \"checklists\":[]}", "sqItems")]
        [InlineData("{\"facts\":{}, \"sqItems\":\"invalid\", \"checklists\":[]}", "sqItems")]
        // Invalid checklists (object instead of array)
        [InlineData("{\"facts\":{}, \"sqItems\":[]}", "checklists")]
        [InlineData("{\"facts\":{}, \"sqItems\":[], \"checklists\":{}}", "checklists")]
        [InlineData("{\"facts\":{}, \"sqItems\":[], \"checklists\":123}", "checklists")]
        public void AppBridgeHandler_ExportExcelDeliverable_MalformedPayloadStructures_FailsGracefully(string payloadJson, string expectedErrorKey)
        {
            var handler = CreateAppHandler();
            string req = $"{{\"id\":\"req-adv-export\",\"action\":\"exportExcelDeliverable\",\"payload\":{payloadJson}}}";

            var res = handler.Handle(req);

            Assert.Equal("req-adv-export", res.Id);
            Assert.False(res.Success);
            Assert.NotNull(res.Error);
            Assert.Contains(expectedErrorKey, res.Error, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("nonExistentBridgeAction123")]
        [InlineData("DROP TABLE USERS; --")]
        [InlineData("<script>alert('xss')</script>")]
        [InlineData("getAppInfo; shutdown -s")]
        public void AppBridgeHandler_UnknownOrMaliciousActions_ReturnsFailureSafely(string actionName)
        {
            var handler = CreateAppHandler();
            string req = JsonSerializer.Serialize(new
            {
                id = "req-unknown-act-check",
                action = actionName,
                payload = new { }
            });

            var res = handler.Handle(req);

            Assert.Equal("req-unknown-act-check", res.Id);
            Assert.False(res.Success);
            Assert.NotNull(res.Error);
        }

        // =========================================================================
        // SECTION 3: Adversarial Stress Testing of RuleEditorBridgeHandler
        // =========================================================================

        [Theory]
        [InlineData("getAppInfo")]
        [InlineData("getRulePack")]
        [InlineData("publishRulePack")]
        [InlineData("openFileDialog")]
        [InlineData("selectFolderDialog")]
        public void RuleEditorBridgeHandler_BrokenJsonEnvelope_PreservesIdAndReturnsFail(string action)
        {
            var handler = CreateRuleEditorHandler();
            string brokenEnvelope = $"{{\"id\":\"re-adv-req-{action}\", \"action\":\"{action}\", \"payload\": {{ broken_payload";

            var response = handler.Handle(brokenEnvelope);

            Assert.Equal($"re-adv-req-{action}", response.Id);
            Assert.False(response.Success);
            Assert.NotNull(response.Error);
            Assert.Contains("Deserialization error", response.Error);
        }

        [Theory]
        [InlineData("publishRulePack")]
        public void RuleEditorBridgeHandler_NullOrNonObjectPayload_FailsSafely(string action)
        {
            var handler = CreateRuleEditorHandler();

            // Null payload
            var resNull = handler.Handle($"{{\"id\":\"re-null-{action}\",\"action\":\"{action}\",\"payload\":null}}");
            Assert.Equal($"re-null-{action}", resNull.Id);
            Assert.False(resNull.Success);

            // Int payload
            var resInt = handler.Handle($"{{\"id\":\"re-int-{action}\",\"action\":\"{action}\",\"payload\":999}}");
            Assert.Equal($"re-int-{action}", resInt.Id);
            Assert.False(resInt.Success);

            // Array payload
            var resArr = handler.Handle($"{{\"id\":\"re-arr-{action}\",\"action\":\"{action}\",\"payload\":[\"a\",\"b\"]}}");
            Assert.Equal($"re-arr-{action}", resArr.Id);
            Assert.False(resArr.Success);
        }

        [Theory]
        // Missing version
        [InlineData("{\"rules\":[], \"templateMap\":{}}", "version")]
        // Empty version
        [InlineData("{\"version\":\"\", \"rules\":[], \"templateMap\":{}}", "version")]
        // Whitespace version
        [InlineData("{\"version\":\"   \", \"rules\":[], \"templateMap\":{}}", "version")]
        // Integer version
        [InlineData("{\"version\": 14, \"rules\":[], \"templateMap\":{}}", "version")]
        // Missing rules
        [InlineData("{\"version\":\"14.0.0\", \"templateMap\":{}}", "rules")]
        // Rules is object instead of array
        [InlineData("{\"version\":\"14.0.0\", \"rules\":{}, \"templateMap\":{}}", "rules")]
        // Missing templateMap
        [InlineData("{\"version\":\"14.0.0\", \"rules\":[]}", "templateMap")]
        // TemplateMap is array instead of object
        [InlineData("{\"version\":\"14.0.0\", \"rules\":[], \"templateMap\":[]}", "templateMap")]
        public void RuleEditorBridgeHandler_PublishRulePack_MalformedFieldTypes_ReturnsDescriptiveFailure(string payloadJson, string expectedErrorProp)
        {
            var handler = CreateRuleEditorHandler();
            string req = $"{{\"id\":\"re-pub-malformed\",\"action\":\"publishRulePack\",\"payload\":{payloadJson}}}";

            var res = handler.Handle(req);

            Assert.Equal("re-pub-malformed", res.Id);
            Assert.False(res.Success);
            Assert.NotNull(res.Error);
            Assert.Contains(expectedErrorProp, res.Error, StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        [InlineData("nonExistentEditorAction")]
        [InlineData("launchRocket")]
        [InlineData("extractUpz")] // App action sent to RuleEditor handler
        public void RuleEditorBridgeHandler_UnsupportedActions_ReturnsDescriptiveFailure(string actionName)
        {
            var handler = CreateRuleEditorHandler();
            string req = JsonSerializer.Serialize(new
            {
                id = "re-unknown-act-check",
                action = actionName,
                payload = new { }
            });

            var res = handler.Handle(req);

            Assert.Equal("re-unknown-act-check", res.Id);
            Assert.False(res.Success);
            Assert.NotNull(res.Error);
        }
    }
}
