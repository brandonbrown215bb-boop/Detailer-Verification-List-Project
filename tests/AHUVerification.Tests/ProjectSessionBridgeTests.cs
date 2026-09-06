using System;
using System.IO;
using System.Text.Json;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Session;
using AHUVerification.Core.Utils;
using Xunit;

namespace AHUVerification.Tests
{
    public class ProjectSessionBridgeTests
    {
        private readonly string _rulePackPath;

        public ProjectSessionBridgeTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
        }

        private BridgeHandler CreateAppHandler() => new(null, _rulePackPath);

        [Fact]
        public void ProjectSession_OpenAndOverrideAndConflict_ViaBridge_BehavesDeterministically()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);

            // 1. Open session
            string openReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-open",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath,
                    configXml,
                    isUpz = false,
                    isTrusted = true
                }
            });

            var openRes = handler.Handle(openReq);
            Assert.Equal("req-ps-open", openRes.Id);
            Assert.True(openRes.Success, openRes.Error);
            Assert.NotNull(openRes.Data);

            var options = JsonDefaults.CreateFlexibleOptions();
            var initialSnapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openRes.Data), options);
            Assert.NotNull(initialSnapshot);
            Assert.False(string.IsNullOrWhiteSpace(initialSnapshot.SessionId));
            Assert.Equal(1, initialSnapshot.Revision);

            // 2. Get snapshot
            string getSnapReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-snap",
                action = "projectSession_getSnapshot"
            });
            var snapRes = handler.Handle(getSnapReq);
            Assert.True(snapRes.Success, snapRes.Error);

            // 3. Override fact with expectedRevision = 1
            string overrideReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-override",
                action = "projectSession_overrideFact",
                payload = new
                {
                    sessionId = initialSnapshot.SessionId,
                    expectedRevision = 1,
                    factId = "unit.detailer",
                    value = "Metallic Bronze",
                    comment = "Architect choice"
                }
            });

            var overrideRes = handler.Handle(overrideReq);
            Assert.True(overrideRes.Success, overrideRes.Error);

            var cmdResult = JsonSerializer.Deserialize<SessionCommandResult>(
                JsonSerializer.Serialize(overrideRes.Data), options);
            Assert.NotNull(cmdResult);
            Assert.True(cmdResult.Success);
            Assert.Equal(2, cmdResult.Revision);
            Assert.Equal("Metallic Bronze", cmdResult.Snapshot!.Facts["unit.detailer"].Value?.ToString());

            // 4. Stale mutation with expectedRevision = 1 (should return conflict with revision 2 snapshot)
            string staleReq = JsonSerializer.Serialize(new
            {
                id = "req-ps-stale",
                action = "projectSession_overrideFact",
                payload = new
                {
                    sessionId = initialSnapshot.SessionId,
                    expectedRevision = 1,
                    factId = "unit.detailer",
                    value = "Gloss White"
                }
            });

            var staleRes = handler.Handle(staleReq);
            Assert.True(staleRes.Success); // Bridge IPC succeeds

            var staleCmdResult = JsonSerializer.Deserialize<SessionCommandResult>(
                JsonSerializer.Serialize(staleRes.Data), options);
            Assert.NotNull(staleCmdResult);
            Assert.False(staleCmdResult.Success); // Domain mutation rejected
            Assert.True(staleCmdResult.IsConflict);
            Assert.Equal(2, staleCmdResult.Revision);
            Assert.NotNull(staleCmdResult.Snapshot);
            Assert.Contains("Revision mismatch", staleCmdResult.ErrorMessage);
        }

        [Fact]
        public void ProjectSession_BatchOverrideAndReorder_ViaBridge_Succeeds()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);
            var options = JsonDefaults.CreateFlexibleOptions();

            // Open
            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open",
                action = "projectSession_open",
                payload = new { filePath = configXmlPath, configXml, isUpz = false, isTrusted = true }
            }));
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;

            // Batch override
            var batchRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-batch",
                action = "projectSession_batchOverrideFacts",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = 1,
                    overrides = new[]
                    {
                        new { factId = "unit.jobName", value = "Bridge Batch Test", author = "Tester", comment = "Bridge test" }
                    }
                }
            }));
            Assert.True(batchRes.Success, batchRes.Error);
            var batchResult = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(batchRes.Data), options)!;
            Assert.True(batchResult.Success);
            Assert.Equal(2, batchResult.Revision);
            Assert.Equal("Bridge Batch Test", batchResult.Snapshot!.Facts["unit.jobName"].Value?.ToString());

            // Add an SQ
            var sqRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-sq",
                action = "projectSession_updateSpecialQuote",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = 2,
                    specialQuote = new { id = "sq-bridge-1", slot = 1, text = "Bridge SQ 1" }
                }
            }));
            Assert.True(sqRes.Success);

            // Reorder
            var reorderRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-reorder",
                action = "projectSession_reorderSpecialQuotes",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = 3,
                    assignments = new[]
                    {
                        new { quoteId = "sq-bridge-1", slot = 5 }
                    }
                }
            }));
            Assert.True(reorderRes.Success);
            var reorderResult = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(reorderRes.Data), options)!;
            Assert.True(reorderResult.Success);
            Assert.Equal(4, reorderResult.Revision);
            Assert.Equal(5, reorderResult.Snapshot!.SpecialQuotes[0].Slot);
        }
    }
}
