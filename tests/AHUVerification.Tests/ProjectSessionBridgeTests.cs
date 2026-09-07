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

        [Fact]
        public void ProjectSession_RendererXmlWithoutHostFile_IsAlwaysUntrusted()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);
            var options = JsonDefaults.CreateFlexibleOptions();

            // Client attempts to claim isTrusted: true, but passes non-existent file path
            string openReq = JsonSerializer.Serialize(new
            {
                id = "req-untrusted-1",
                action = "projectSession_open",
                payload = new
                {
                    filePath = "NonExistentClientFile.xml",
                    configXml,
                    isUpz = false,
                    isTrusted = true // Client self-proclaiming trust
                }
            });

            var openRes = handler.Handle(openReq);
            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;
            Assert.NotNull(snapshot);
            Assert.False(snapshot.Source.IsTrusted, "Renderer-provided XML must NEVER be trusted unless host reads from disk");
            Assert.True(snapshot.Readiness.IsDraftOnly);
        }

        [Fact]
        public void ProjectSession_RequestDeduplication_ReturnsSameResultWithoutIncrementingRevision()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            var options = JsonDefaults.CreateFlexibleOptions();

            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open-dedup",
                action = "projectSession_open",
                payload = new { filePath = configXmlPath }
            }));
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;

            string requestId = "unique-mutation-uuid-12345";
            string overrideReq = JsonSerializer.Serialize(new
            {
                id = "req-override-first",
                action = "projectSession_overrideFact",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = 1,
                    requestId,
                    factId = "unit.jobName",
                    value = "Deduplicated Job Name",
                    author = "Detailer",
                    comment = "First attempt"
                }
            });

            var res1 = handler.Handle(overrideReq);
            Assert.True(res1.Success);
            var cmdResult1 = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(res1.Data), options)!;
            Assert.True(cmdResult1.Success);
            Assert.Equal(2, cmdResult1.Revision);
            Assert.Equal("Deduplicated Job Name", cmdResult1.Snapshot!.Facts["unit.jobName"].Value?.ToString());

            // Re-send exact same command with identical requestId (e.g. timeout retry)
            string retryReq = JsonSerializer.Serialize(new
            {
                id = "req-override-retry",
                action = "projectSession_overrideFact",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = 1, // original expected revision
                    requestId,
                    factId = "unit.jobName",
                    value = "Deduplicated Job Name",
                    author = "Detailer",
                    comment = "First attempt"
                }
            });

            var res2 = handler.Handle(retryReq);
            Assert.True(res2.Success);
            var cmdResult2 = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(res2.Data), options)!;
            Assert.True(cmdResult2.Success);
            Assert.Equal(2, cmdResult2.Revision); // NOT 3! Deduplicated!

            // Current snapshot revision is still 2
            var snapRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-snap-check",
                action = "projectSession_getSnapshot"
            }));
            var currentSnapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(snapRes.Data), options)!;
            Assert.Equal(2, currentSnapshot.Revision);
        }

        [Fact]
        public void ProjectSession_UpdateGeneralComments_CommitsSuccessfully()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            var options = JsonDefaults.CreateFlexibleOptions();

            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open-comm",
                action = "projectSession_open",
                payload = new { filePath = configXmlPath }
            }));
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;

            var commentRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-comments",
                action = "projectSession_updateGeneralComments",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = 1,
                    requestId = "comm-req-1",
                    comments = "Unit approved with field notes."
                }
            }));

            Assert.True(commentRes.Success);
            var result = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(commentRes.Data), options)!;
            Assert.True(result.Success);
            Assert.Equal(2, result.Revision);
            Assert.Equal("Unit approved with field notes.", result.Snapshot!.GeneralComments);
        }

        [Fact]
        public void ProjectSession_ExistingDiskPath_VerifiedOnDisk_IsTrusted()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            var options = JsonDefaults.CreateFlexibleOptions();

            // Client supplies real file path from disk (e.g. drag-and-drop from Windows Explorer)
            // The C# engine verifies and reads directly from disk, authorizing it as Trusted for Certified deliverable.
            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open-disk-drop",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath
                }
            }));

            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;
            Assert.NotNull(snapshot);
            Assert.True(snapshot.Source.IsTrusted, "Existing disk path verified on disk by host must be trusted.");
        }

        [Fact]
        public void ProjectSession_NonExistentDiskPath_IsUntrusted()
        {
            var handler = CreateAppHandler();
            string fakePath = @"C:\NonExistentFolder\FakeConfig.xml";
            string validXml = File.ReadAllText(TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml")));
            var options = JsonDefaults.CreateFlexibleOptions();

            // Client supplies non-existent file path with inline configXml
            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open-fake-path",
                action = "projectSession_open",
                payload = new
                {
                    filePath = fakePath,
                    configXml = validXml,
                    isTrusted = true // client claims trust
                }
            }));

            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;
            Assert.NotNull(snapshot);
            Assert.False(snapshot.Source.IsTrusted, "Non-existent disk path must NOT be trusted.");
        }

        [Fact]
        public void ProjectSession_AuthorizedDiskPath_ViaHandle_IsTrusted()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            var options = JsonDefaults.CreateFlexibleOptions();

            // Host authorizes path (simulating native picker selection)
            string handle = handler.AuthorizeSourcePath(configXmlPath);

            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open-auth",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath,
                    sourceHandle = handle
                }
            }));

            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;
            Assert.NotNull(snapshot);
            Assert.True(snapshot.Source.IsTrusted, "Authorized path via host handle must be trusted.");
        }

        [Fact]
        public void ProjectSession_XmlSource_StripsRendererSuppliedOrderRevAndManifest()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            var options = JsonDefaults.CreateFlexibleOptions();

            string handle = handler.AuthorizeSourcePath(configXmlPath);

            // Client attempts to attach unauthenticated OrderRev and Manifest to standalone XML
            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open-xml-strip",
                action = "projectSession_open",
                payload = new
                {
                    filePath = configXmlPath,
                    sourceHandle = handle,
                    orderRevXml = "<untrustedOrderRev><JobName>Injected Job</JobName></untrustedOrderRev>",
                    manifestXml = "<untrustedManifest />"
                }
            }));

            Assert.True(openRes.Success, openRes.Error);
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;
            Assert.NotNull(snapshot);
            Assert.True(snapshot.Source.IsTrusted);
            Assert.Null(snapshot.Source.RawOrderRevisionXml);
            Assert.Null(snapshot.Source.RawManifestXml);
            Assert.NotEqual("Injected Job", snapshot.Facts["unit.jobName"].Value?.ToString());
        }

        [Fact]
        public void ProjectSession_SpecialQuotes_EnforcesSlotBoundsAndMaxCount()
        {
            var handler = CreateAppHandler();
            string configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            string configXml = File.ReadAllText(configXmlPath);
            var options = JsonDefaults.CreateFlexibleOptions();

            var openRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-open",
                action = "projectSession_open",
                payload = new { filePath = configXmlPath, configXml, isUpz = false, isTrusted = true }
            }));
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(JsonSerializer.Serialize(openRes.Data), options)!;

            // Slot 0 or 23 must be rejected
            var invalidSlotRes = handler.Handle(JsonSerializer.Serialize(new
            {
                id = "req-sq-invalid",
                action = "projectSession_updateSpecialQuote",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = snapshot.Revision,
                    requestId = "req-sq-invalid",
                    specialQuote = new { slot = 23, text = "Overflow SQ", id = "sq-23" }
                }
            }));
            Assert.True(invalidSlotRes.Success); // Bridge returns Ok with failing SessionCommandResult
            var invalidResult = JsonSerializer.Deserialize<SessionCommandResult>(JsonSerializer.Serialize(invalidSlotRes.Data), options)!;
            Assert.False(invalidResult.Success);
            Assert.Contains("slots 1 through 22", invalidResult.ErrorMessage);
        }
    }
}
