using System;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;

namespace AHUVerification.Core.Session
{
    public class ProjectSessionService
    {
        private readonly object _lock = new();
        private ProjectSession? _activeSession;

        public ProjectSession? ActiveSession
        {
            get
            {
                lock (_lock)
                {
                    return _activeSession;
                }
            }
        }

        public ProjectSessionSnapshot OpenSource(OpenSourceCommand cmd, RulePackBundle activePack, int packGeneration)
        {
            if (cmd == null) throw new ArgumentNullException(nameof(cmd));
            if (string.IsNullOrWhiteSpace(cmd.ConfigXml))
                throw new ArgumentException("ConfigXml cannot be empty", nameof(cmd));

            lock (_lock)
            {
                var session = new ProjectSession(
                    cmd.FilePath,
                    cmd.ConfigXml,
                    cmd.OrderRevXml,
                    cmd.ManifestXml,
                    cmd.IsUpz,
                    cmd.IsTrusted,
                    activePack,
                    packGeneration,
                    cmd.InitialOverrides,
                    cmd.InitialChecklists,
                    cmd.InitialSpecialQuotes,
                    cmd.InitialGeneralComments
                );

                _activeSession = session;
                return session.CreateSnapshot();
            }
        }

        public ProjectSessionSnapshot CreateManualProject(CreateManualProjectCommand cmd, RulePackBundle activePack, int packGeneration)
        {
            if (cmd == null) throw new ArgumentNullException(nameof(cmd));
            if (cmd.Config == null) throw new ArgumentException("ManualUnitConfig cannot be null", nameof(cmd));

            lock (_lock)
            {
                var session = ProjectSession.CreateManual(cmd.Config, activePack, packGeneration);
                _activeSession = session;
                return session.CreateSnapshot();
            }
        }

        public ProjectSessionSnapshot? UpdateActiveRulePack(RulePackBundle newPack, int packGeneration)
        {
            if (newPack == null) throw new ArgumentNullException(nameof(newPack));

            lock (_lock)
            {
                if (_activeSession == null) return null;
                var result = _activeSession.UpdateRulePack(newPack, packGeneration);
                if (result.Success)
                {
                    TriggerRecoverySave();
                }
                return result.Snapshot;
            }
        }

        public ProjectSessionSnapshot? GetCurrentSnapshot()
        {
            lock (_lock)
            {
                return _activeSession?.CreateSnapshot();
            }
        }

        public SessionCommandResult OverrideFact(OverrideFactCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.OverrideFact(cmd));
        }

        public SessionCommandResult BatchOverrideFacts(BatchOverrideFactsCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.BatchOverrideFacts(cmd));
        }

        public SessionCommandResult RevertFact(RevertFactCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.RevertFact(cmd));
        }

        public SessionCommandResult UpdateChecklist(UpdateChecklistCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.UpdateChecklist(cmd));
        }

        public SessionCommandResult UpdateSpecialQuote(UpdateSpecialQuoteCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.UpdateSpecialQuote(cmd));
        }

        public SessionCommandResult DeleteSpecialQuote(DeleteSpecialQuoteCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.DeleteSpecialQuote(cmd));
        }

        public SessionCommandResult ReorderSpecialQuotes(ReorderSpecialQuotesCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.ReorderSpecialQuotes(cmd));
        }

        public SessionCommandResult UpdateGeneralComments(UpdateGeneralCommentsCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.UpdateGeneralComments(cmd));
        }

        public SessionCommandResult ResetSession(ResetSessionCommand cmd)
        {
            return ExecuteSessionCommand(cmd.SessionId, session => session.ResetToBaseline(cmd));
        }

        private readonly DvlProjectManager _dvlManager = new();
        private readonly OpenXmlTemplatePatcher _patcher = new();
        private string _recoveryDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AHUVerification",
            "recovery");

        public string RecoveryDirectory
        {
            get => _recoveryDirectory;
            set => _recoveryDirectory = value;
        }

        private string RecoveryFilePath => Path.Combine(_recoveryDirectory, "recovery_session.dvl");

        public SessionCommandResult SaveProject(SaveProjectCommand cmd, string resolvedPath)
        {
            if (cmd == null) throw new ArgumentNullException(nameof(cmd));

            lock (_lock)
            {
                if (_activeSession == null)
                {
                    return SessionCommandResult.Fail("No active project session exists.");
                }

                if (!string.Equals(_activeSession.SessionId, cmd.SessionId, StringComparison.OrdinalIgnoreCase))
                {
                    return SessionCommandResult.Conflict(_activeSession.Revision, _activeSession.CreateSnapshot(),
                        $"Session mismatch: command expected session '{cmd.SessionId}', active is '{_activeSession.SessionId}'");
                }

                var result = _activeSession.Save(cmd, resolvedPath, _dvlManager);
                if (result.Success)
                {
                    DiscardRecoveryInternal();
                }
                return result;
            }
        }

        public ProjectSessionSnapshot OpenDvl(string filePath, RulePackBundle activePack, int packGeneration)
        {
            if (string.IsNullOrWhiteSpace(filePath))
                throw new ArgumentException("File path cannot be empty", nameof(filePath));
            if (activePack == null)
                throw new ArgumentNullException(nameof(activePack));

            var project = _dvlManager.LoadFromFile(filePath);
            return OpenDvlInternal(project, filePath, activePack, packGeneration);
        }

        public ProjectSessionSnapshot OpenDvlJson(string dvlJson, RulePackBundle activePack, int packGeneration)
        {
            if (string.IsNullOrWhiteSpace(dvlJson))
                throw new ArgumentException("DVL JSON cannot be empty", nameof(dvlJson));
            if (activePack == null)
                throw new ArgumentNullException(nameof(activePack));

            var project = _dvlManager.LoadFromJson(dvlJson);
            return OpenDvlInternal(project, filePath: null, activePack, packGeneration);
        }

        private ProjectSessionSnapshot OpenDvlInternal(DvlProjectFile project, string? filePath, RulePackBundle activePack, int packGeneration)
        {
            lock (_lock)
            {
                var activeInfo = new RulePackInfo
                {
                    Version = activePack.Manifest?.Version ?? "",
                    Sha256 = activePack.Manifest?.BundleSha256 ?? "",
                    RuleSemanticFingerprint = null,
                    TemplateSha256 = activePack.Manifest?.Files.TryGetValue("template.xlsx", out var tEntry) == true ? tEntry.Sha256 : null
                };

                RulePackBundle effectivePack;
                string? templateBase64 = null;
                if (project.RulePackSnapshot != null && project.RulePackSnapshot.Rules != null && project.RulePackSnapshot.Rules.Count > 0)
                {
                    string tplSha = project.RulePackSnapshot.TemplateSha256 ?? project.RulePack.TemplateSha256 ?? "";
                    byte[]? templateBytes = DvlProjectManager.GetTemplateBytes(project, activePack);
                    if (templateBytes != null)
                    {
                        templateBase64 = project.RulePackSnapshot?.TemplateBytesBase64 ?? Convert.ToBase64String(templateBytes);
                        if (string.IsNullOrEmpty(tplSha))
                        {
                            tplSha = CryptoUtils.ComputeSha256(templateBytes);
                        }
                    }

                    string mapSha = project.RulePack.TemplateMapSha256 ?? "";
                    string mappingsSha = project.RulePack.ApprovedMappingsSha256 ?? "";

                    effectivePack = new RulePackBundle
                    {
                        Manifest = new RulePackManifest
                        {
                            Version = !string.IsNullOrEmpty(project.RulePackSnapshot.Version) ? project.RulePackSnapshot.Version : (project.RulePack.Version ?? ""),
                            BundleSha256 = !string.IsNullOrEmpty(project.RulePackSnapshot.BundleSha256) ? project.RulePackSnapshot.BundleSha256 : (project.RulePack.Sha256 ?? ""),
                            Files = new Dictionary<string, RulePackManifestFileEntry>(StringComparer.OrdinalIgnoreCase)
                            {
                                ["template.xlsx"] = new RulePackManifestFileEntry { Sha256 = tplSha },
                                ["template_map.json"] = new RulePackManifestFileEntry { Sha256 = mapSha },
                                ["approved_mappings.json"] = new RulePackManifestFileEntry { Sha256 = mappingsSha }
                            }
                        },
                        Rules = project.RulePackSnapshot.Rules,
                        TemplateMap = project.RulePackSnapshot.TemplateMap ?? new TemplateMap(),
                        ApprovedMappings = project.RulePackSnapshot.ApprovedMappings,
                        FactContract = FactContractValidator.MergeFactContracts(activePack.FactContract, project.RulePackSnapshot.FactContract),
                        TemplatePath = activePack.TemplatePath ?? "",
                        IsValid = true
                    };
                }
                else
                {
                    effectivePack = activePack;
                }

                var integrity = _dvlManager.ValidateIntegrity(project, activeInfo);
                var session = ProjectSession.OpenDvl(project, filePath, integrity, effectivePack, packGeneration, templateBase64);
                _activeSession = session;
                return session.CreateSnapshot();
            }
        }

        public ExportDeliverableResult ExportExcel(ExportExcelDeliverableCommand cmd, string targetPath)
        {
            if (cmd == null) throw new ArgumentNullException(nameof(cmd));

            lock (_lock)
            {
                if (_activeSession == null)
                {
                    throw new InvalidOperationException("No active project session exists to export.");
                }

                if (!string.Equals(_activeSession.SessionId, cmd.SessionId, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"Session mismatch: command expected session '{cmd.SessionId}', active is '{_activeSession.SessionId}'");
                }

                return _activeSession.ExportExcel(cmd, _patcher, targetPath);
            }
        }

        public RecoveryInfo GetRecoveryInfo()
        {
            try
            {
                string recPath = RecoveryFilePath;
                if (!File.Exists(recPath))
                {
                    return new RecoveryInfo { HasRecovery = false };
                }

                var project = _dvlManager.LoadFromFile(recPath);
                return new RecoveryInfo
                {
                    HasRecovery = true,
                    JobName = project.JobName,
                    ComNumber = project.ComNumber,
                    Author = project.Author,
                    LastSavedAt = project.LastSavedAt,
                    SourceFileName = project.SourceXml?.FileName,
                    IsTrusted = project.SourceXml?.IsTrusted == true,
                    RecoveryFilePath = recPath
                };
            }
            catch (Exception)
            {
                return new RecoveryInfo { HasRecovery = false };
            }
        }

        public ProjectSessionSnapshot RestoreRecovery(RulePackBundle activePack, int packGeneration)
        {
            string recPath = RecoveryFilePath;
            if (!File.Exists(recPath))
            {
                throw new InvalidOperationException("No recovery session file exists.");
            }

            lock (_lock)
            {
                OpenDvl(recPath, activePack, packGeneration);
                if (_activeSession != null)
                {
                    _activeSession.CurrentSavePath = null;
                    _activeSession.IsDirty = true;
                    return _activeSession.CreateSnapshot();
                }
                throw new InvalidOperationException("Failed to restore recovery session.");
            }
        }

        public bool DiscardRecovery()
        {
            return DiscardRecoveryInternal();
        }

        private bool DiscardRecoveryInternal()
        {
            try
            {
                string recPath = RecoveryFilePath;
                if (File.Exists(recPath))
                {
                    File.Delete(recPath);
                    return true;
                }
            }
            catch
            {
                // Ignored
            }
            return false;
        }

        private void TriggerRecoverySave()
        {
            try
            {
                if (_activeSession == null || !_activeSession.IsDirty) return;

                Directory.CreateDirectory(_recoveryDirectory);
                string recPath = RecoveryFilePath;
                string tmpPath = Path.Combine(_recoveryDirectory, $".recovery.{Guid.NewGuid():N}.dvl");

                var project = _activeSession.BuildDvlProject(_dvlManager);
                _dvlManager.SaveToFile(project, tmpPath);

                if (File.Exists(recPath)) File.Delete(recPath);
                File.Move(tmpPath, recPath, overwrite: true);
            }
            catch
            {
                // Recovery failure should not throw to user mutation
            }
        }

        private SessionCommandResult ExecuteSessionCommand(string sessionId, Func<ProjectSession, SessionCommandResult> action)
        {
            lock (_lock)
            {
                if (_activeSession == null)
                {
                    return SessionCommandResult.Fail("No active project session exists.");
                }

                if (!string.Equals(_activeSession.SessionId, sessionId, StringComparison.OrdinalIgnoreCase))
                {
                    return SessionCommandResult.Conflict(_activeSession.Revision, _activeSession.CreateSnapshot(),
                        $"Session mismatch: request was for session '{sessionId}', but active session is '{_activeSession.SessionId}'.");
                }

                var result = action(_activeSession);
                if (result.Success)
                {
                    TriggerRecoverySave();
                }
                return result;
            }
        }
    }
}
