using System;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using AHUVerification.App.Bridge;
using AHUVerification.Core.Bridge;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Session;
using AHUVerification.Core.Utils;
using Xunit;

namespace AHUVerification.Tests
{
    public class ProjectSessionCe3Tests : IDisposable
    {
        private readonly string _rulePackPath;
        private readonly string _configXmlPath;
        private readonly RulePackBundle _activePack;
        private readonly string _tempDir;

        public ProjectSessionCe3Tests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
            _configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            _activePack = new RulePackManager().LoadFromDirectory(_rulePackPath);
            _tempDir = Path.Combine(Path.GetTempPath(), "AHU_CE3_Tests_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(_tempDir);
        }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(_tempDir))
                {
                    Directory.Delete(_tempDir, true);
                }
            }
            catch
            {
                // Best effort cleanup
            }
        }

        [Fact]
        public void SaveProject_WithTargetFilePath_EmbedsTemplateBytesAndPreservesTrust()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var openCmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            };
            var initialSnapshot = service.OpenSource(openCmd, _activePack, 1);

            string savePath = Path.Combine(_tempDir, "SavedJob_COM123.dvl");
            var saveCmd = new SaveProjectCommand
            {
                SessionId = initialSnapshot.SessionId,
                ExpectedRevision = 1,
                TargetPath = savePath
            };

            var saveResult = service.SaveProject(saveCmd, savePath);

            Assert.True(saveResult.Success);
            Assert.NotNull(saveResult.Snapshot);
            Assert.Equal(savePath, saveResult.Snapshot.CurrentProjectPath);
            Assert.NotNull(saveResult.Snapshot.LastSavedAt);
            Assert.True(File.Exists(savePath));

            // Inspect the saved .dvl file
            var projectManager = new DvlProjectManager();
            var dvlProject = projectManager.LoadFromFile(savePath);

            Assert.NotNull(dvlProject.RulePackSnapshot);
            Assert.NotNull(dvlProject.RulePackSnapshot.TemplateBytesBase64);
            Assert.Equal("self-contained", dvlProject.RulePackSnapshot.Reproducibility);

            byte[] templateBytes = Convert.FromBase64String(dvlProject.RulePackSnapshot.TemplateBytesBase64);
            Assert.True(templateBytes.Length > 10000);

            string expectedSha = _activePack.Manifest!.Files["template.xlsx"].Sha256;
            string actualSha = Convert.ToHexString(SHA256.HashData(templateBytes)).ToLowerInvariant();
            Assert.Equal(expectedSha, actualSha);

            Assert.NotNull(dvlProject.SourceXml);
            Assert.True(dvlProject.SourceXml.IsTrusted);
        }

        [Fact]
        public void OpenDvl_UntamperedWithEmbeddedTemplate_RestoresWithTrustAndTemplateRetrievable()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var openCmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            };
            var initialSnapshot = service.OpenSource(openCmd, _activePack, 1);

            string savePath = Path.Combine(_tempDir, "AuthenticJob.dvl");
            service.SaveProject(new SaveProjectCommand
            {
                SessionId = initialSnapshot.SessionId,
                ExpectedRevision = 1,
                TargetPath = savePath
            }, savePath);

            // Open the saved .dvl in a new session service
            string tempDir = Path.GetTempPath();
            var beforeFiles = Directory.GetFiles(tempDir, "ahu_tpl_*.xlsx");
            var secondService = new ProjectSessionService();
            var snapshot = secondService.OpenDvl(savePath, _activePack, 1);
            var afterFiles = Directory.GetFiles(tempDir, "ahu_tpl_*.xlsx");
            var leakedFiles = afterFiles.Except(beforeFiles).ToList();

            Assert.NotNull(snapshot);
            Assert.True(snapshot.Source.IsTrusted);
            Assert.Equal("complete", snapshot.IntegrityState);
            Assert.Null(snapshot.IntegrityWarning);
            Assert.Equal(savePath, snapshot.CurrentProjectPath);
            Assert.NotNull(snapshot.LastSavedAt);
            Assert.True(snapshot.Readiness.TemplateRetrievable);
            Assert.False(snapshot.IsDirty);
            Assert.Empty(leakedFiles);
        }

        [Fact]
        public void OpenDvl_TamperedPayload_LosesTrustAndSetsIntegrityWarning()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var initialSnapshot = service.OpenSource(new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            }, _activePack, 1);

            string savePath = Path.Combine(_tempDir, "ToTamper.dvl");
            service.SaveProject(new SaveProjectCommand
            {
                SessionId = initialSnapshot.SessionId,
                ExpectedRevision = 1,
                TargetPath = savePath
            }, savePath);

            // Tamper with the DVL JSON (alter material fact value without updating integrity)
            string dvlJson = File.ReadAllText(savePath);
            Assert.Contains("STL GALV PPC", dvlJson);
            string tamperedJson = dvlJson.Replace("STL GALV PPC", "TAMPERED_MATERIAL");
            string tamperedPath = Path.Combine(_tempDir, "Tampered.dvl");
            File.WriteAllText(tamperedPath, tamperedJson);

            var secondService = new ProjectSessionService();
            var snapshot = secondService.OpenDvl(tamperedPath, _activePack, 1);

            Assert.NotNull(snapshot);
            Assert.False(snapshot.Source.IsTrusted);
            Assert.Equal("tampered", snapshot.IntegrityState);
            Assert.NotNull(snapshot.IntegrityWarning);
            Assert.Contains("does not match its contents", snapshot.IntegrityWarning, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public void Recovery_DirtyMutationsAutoSaveAndRestoreSuccessfully()
        {
            var recoveryDir = Path.Combine(_tempDir, "test_recovery");
            var service = new ProjectSessionService { RecoveryDirectory = recoveryDir };
            string configXml = File.ReadAllText(_configXmlPath);
            var initialSnapshot = service.OpenSource(new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            }, _activePack, 1);

            // 1. Initial state has no recovery
            service.DiscardRecovery();
            var initialRecovery = service.GetRecoveryInfo();
            Assert.False(initialRecovery.HasRecovery);

            // 2. Perform a mutation -> triggers recovery save
            var overrideCmd = new OverrideFactCommand
            {
                SessionId = initialSnapshot.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.jobName",
                Value = "CrashRecoveryJob",
                Comment = "Testing recovery auto-save"
            };
            var mutateResult = service.OverrideFact(overrideCmd);
            Assert.True(mutateResult.Success);

            // 3. Verify recovery session was saved
            var recoveryInfo = service.GetRecoveryInfo();
            Assert.True(recoveryInfo.HasRecovery);
            Assert.Equal("CrashRecoveryJob", recoveryInfo.JobName);
            Assert.NotNull(recoveryInfo.LastSavedAt);

            // 4. Restore recovery in a fresh service
            var freshService = new ProjectSessionService { RecoveryDirectory = recoveryDir };
            var restoredSnapshot = freshService.RestoreRecovery(_activePack, 1);
            Assert.NotNull(restoredSnapshot);
            Assert.Equal("CrashRecoveryJob", restoredSnapshot.Facts["unit.jobName"].Value?.ToString());
            Assert.True(restoredSnapshot.IsDirty);

            // 5. Discard recovery clears the file
            freshService.DiscardRecovery();
            var afterDiscardRecovery = freshService.GetRecoveryInfo();
            Assert.False(afterDiscardRecovery.HasRecovery);
        }

        [Fact]
        public void BridgeHandler_Ce3Actions_RoundTripSuccessfully()
        {
            var handler = new BridgeHandler(null, _rulePackPath);
            string configXml = File.ReadAllText(_configXmlPath);
            string sourceHandle = handler.AuthorizeSourcePath(_configXmlPath);

            // 1. Open session
            string openReq = JsonSerializer.Serialize(new
            {
                id = "req-bridge-open",
                action = "projectSession_open",
                payload = new
                {
                    filePath = _configXmlPath,
                    configXml,
                    isUpz = false,
                    isTrusted = true,
                    sourceHandle
                }
            });
            var openRes = handler.Handle(openReq);
            Assert.True(openRes.Success, openRes.Error);

            var options = JsonDefaults.CreateFlexibleOptions();
            var snapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openRes.Data), options)!;

            // 2. Save session via bridge
            string targetPath = Path.Combine(_tempDir, "BridgeSaveTest.dvl");
            string saveReq = JsonSerializer.Serialize(new
            {
                id = "req-bridge-save",
                action = "projectSession_save",
                payload = new
                {
                    sessionId = snapshot.SessionId,
                    expectedRevision = snapshot.Revision,
                    targetPath
                }
            });
            var saveRes = handler.Handle(saveReq);
            Assert.True(saveRes.Success, saveRes.Error);

            var root = JsonNode.Parse(JsonSerializer.Serialize(saveRes.Data))!;
            Assert.True(root["saved"]?.GetValue<bool>());
            Assert.Equal(targetPath, root["path"]?.GetValue<string>());

            // 3. Open DVL via bridge
            string openDvlReq = JsonSerializer.Serialize(new
            {
                id = "req-bridge-opendvl",
                action = "projectSession_openDvl",
                payload = new
                {
                    filePath = targetPath
                }
            });
            var openDvlRes = handler.Handle(openDvlReq);
            Assert.True(openDvlRes.Success, openDvlRes.Error);

            var dvlSnapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openDvlRes.Data), options)!;
            Assert.True(dvlSnapshot.Source.IsTrusted);
            Assert.Equal("complete", dvlSnapshot.IntegrityState);

            // 4. Recovery check via bridge
            string recoveryReq = JsonSerializer.Serialize(new
            {
                id = "req-bridge-recovery",
                action = "getRecoveryInfo"
            });
            var recoveryRes = handler.Handle(recoveryReq);
            Assert.True(recoveryRes.Success, recoveryRes.Error);
        }

        [Fact]
        public void OpenDvl_UntrustedProject_RemainsUntrustedAfterSaveAndReopen()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var openCmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = true,
                IsTrusted = false
            };
            var initialSnapshot = service.OpenSource(openCmd, _activePack, 1);
            Assert.False(initialSnapshot.Source.IsTrusted);

            string targetPath = Path.Combine(_tempDir, "UntrustedSaveReopen.dvl");
            var saveCmd = new SaveProjectCommand
            {
                SessionId = initialSnapshot.SessionId,
                ExpectedRevision = initialSnapshot.Revision,
                TargetPath = targetPath
            };
            var saveRes = service.SaveProject(saveCmd, targetPath);
            Assert.True(saveRes.Success, saveRes.ErrorMessage);

            // Reopen via ProjectSessionService.OpenDvl
            var reopened = service.OpenDvl(targetPath, _activePack, 1);
            Assert.False(reopened.Source.IsTrusted, "Untrusted session must remain untrusted after save/reopen.");

            // Also test a legacy DVL file where isUpzBundle = true and fileSha256 is present, but isTrusted is omitted/null
            string dvlJson = File.ReadAllText(targetPath);
            var jsonNode = JsonNode.Parse(dvlJson)!;
            jsonNode["sourceXml"]!.AsObject().Remove("isTrusted");
            string legacyJson = jsonNode.ToJsonString();
            string legacyPath = Path.Combine(_tempDir, "LegacyUntrusted.dvl");
            File.WriteAllText(legacyPath, legacyJson);

            var legacyReopened = service.OpenDvl(legacyPath, _activePack, 1);
            Assert.False(legacyReopened.Source.IsTrusted, "Legacy project without explicit IsTrusted == true must not be granted trust.");
        }

        [Fact]
        public void BridgeHandler_OpenDvlJson_DragAndDropPayload_LoadsUnsavedSessionSuccessfully()
        {
            // 1. Prepare a valid DVL file by saving an active session
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var openCmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            };
            var initial = service.OpenSource(openCmd, _activePack, 1);
            string savedFile = Path.Combine(_tempDir, "DropSource.dvl");
            var saveCmd = new SaveProjectCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = initial.Revision,
                TargetPath = savedFile
            };
            service.SaveProject(saveCmd, savedFile);
            string dvlJson = File.ReadAllText(savedFile);

            // 2. Open via BridgeHandler with dvlJson and null filePath (emulating drag-and-drop)
            string promptPath = Path.Combine(_tempDir, "PromptSelectedSave.dvl");
            var handler = new BridgeHandler(parentForm: null, _rulePackPath, exportPathSelector: () => promptPath);

            string openDvlReq = JsonSerializer.Serialize(new
            {
                id = "req-drop-dvl",
                action = "projectSession_openDvl",
                payload = new
                {
                    dvlJson
                }
            });
            var openDvlRes = handler.Handle(openDvlReq);
            Assert.True(openDvlRes.Success, openDvlRes.Error);

            var options = JsonDefaults.CreateFlexibleOptions();
            var dvlSnapshot = JsonSerializer.Deserialize<ProjectSessionSnapshot>(
                JsonSerializer.Serialize(openDvlRes.Data), options)!;

            Assert.True(string.IsNullOrEmpty(dvlSnapshot.CurrentProjectPath), "Dropped DVL JSON session must start with null/empty save path.");
            Assert.True(dvlSnapshot.Source.IsTrusted);
            Assert.Equal("complete", dvlSnapshot.IntegrityState);

            // 3. Save without targetPath: verify it routes to exportPathSelector because CurrentSavePath is null
            string saveReq = JsonSerializer.Serialize(new
            {
                id = "req-save-unsaved",
                action = "projectSession_save",
                payload = new
                {
                    sessionId = dvlSnapshot.SessionId,
                    expectedRevision = dvlSnapshot.Revision
                }
            });
            var saveRes = handler.Handle(saveReq);
            Assert.True(saveRes.Success, saveRes.Error);

            var root = JsonNode.Parse(JsonSerializer.Serialize(saveRes.Data))!;
            Assert.True(root["saved"]?.GetValue<bool>());
            Assert.Equal(promptPath, root["path"]?.GetValue<string>());
            Assert.True(File.Exists(promptPath));
        }
    }
}
