using System;
using System.IO;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Session;
using Xunit;

namespace AHUVerification.Tests
{
    public class ProjectSessionTests
    {
        private readonly string _rulePackPath;
        private readonly string _configXmlPath;
        private readonly RulePackBundle _activePack;

        public ProjectSessionTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
            _configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            _activePack = new RulePackManager().LoadFromDirectory(_rulePackPath);
        }

        [Fact]
        public void OpenSource_ValidXml_InitializesSessionWithSnapshot()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);

            var cmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            };

            var snapshot = service.OpenSource(cmd, _activePack, 1);

            Assert.NotNull(snapshot);
            Assert.False(string.IsNullOrWhiteSpace(snapshot.SessionId));
            Assert.Equal(1, snapshot.Revision);
            Assert.NotNull(snapshot.Graph);
            Assert.NotEmpty(snapshot.Facts);
            Assert.NotEmpty(snapshot.Checklists);
            Assert.NotNull(snapshot.Readiness);
            Assert.True(snapshot.Source.IsTrusted);
            Assert.Equal("Config.xml", snapshot.Source.FileName);
            Assert.False(snapshot.IsDirty);
        }

        [Fact]
        public void OverrideFact_ValidFact_UpdatesFactIncrementsRevisionAndRecalculatesReadiness()
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

            var overrideCmd = new OverrideFactCommand
            {
                SessionId = initialSnapshot.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.detailer",
                Value = "Jane Doe",
                Comment = "Assigned detailer"
            };

            var result = service.OverrideFact(overrideCmd);

            Assert.True(result.Success);
            Assert.False(result.IsConflict);
            Assert.Equal(2, result.Revision);
            Assert.NotNull(result.Snapshot);
            Assert.True(result.Snapshot.IsDirty);
            Assert.Equal("Jane Doe", result.Snapshot.Facts["unit.detailer"].Value);
            Assert.Equal(FactStatus.ManuallyOverridden, result.Snapshot.Facts["unit.detailer"].Status);
        }

        [Fact]
        public void OverrideFact_StaleRevision_ReturnsConflictWithCurrentSnapshot()
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
            var initial = service.OpenSource(openCmd, _activePack, 1);

            // First mutation increments revision to 2
            var cmd1 = new OverrideFactCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.detailer",
                Value = "Detailer One"
            };
            var res1 = service.OverrideFact(cmd1);
            Assert.True(res1.Success);
            Assert.Equal(2, res1.Revision);

            // Stale command sent with ExpectedRevision = 1
            var staleCmd = new OverrideFactCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.detailer",
                Value = "Detailer Two"
            };
            var staleResult = service.OverrideFact(staleCmd);

            Assert.False(staleResult.Success);
            Assert.True(staleResult.IsConflict);
            Assert.Equal(2, staleResult.Revision);
            Assert.NotNull(staleResult.Snapshot);
            Assert.Equal(2, staleResult.Snapshot.Revision);
            Assert.Contains("Revision mismatch", staleResult.ErrorMessage);
        }

        [Fact]
        public void RevertFact_ValidOverride_RestoresBaselineAndIncrementsRevision()
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
            var initial = service.OpenSource(openCmd, _activePack, 1);
            object? originalValue = initial.Facts["unit.detailer"].Value;

            // Override fact
            var overrideCmd = new OverrideFactCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.detailer",
                Value = "Custom Detailer"
            };
            var resOverride = service.OverrideFact(overrideCmd);
            Assert.True(resOverride.Success);
            Assert.Equal(2, resOverride.Revision);

            // Revert fact
            var revertCmd = new RevertFactCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2,
                FactId = "unit.detailer"
            };
            var resRevert = service.RevertFact(revertCmd);

            Assert.True(resRevert.Success);
            Assert.False(resRevert.IsConflict);
            Assert.Equal(3, resRevert.Revision);
            Assert.NotNull(resRevert.Snapshot);
            Assert.Equal(originalValue, resRevert.Snapshot.Facts["unit.detailer"].Value);
            Assert.NotEqual(FactStatus.ManuallyOverridden, resRevert.Snapshot.Facts["unit.detailer"].Status);
        }

        [Fact]
        public void UpdateChecklist_ValidCheck_UpdatesStatusAndComment()
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
            var initial = service.OpenSource(openCmd, _activePack, 1);
            var firstCheck = initial.Checklists[0];

            var updateCmd = new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                CheckId = firstCheck.InstanceKey,
                Status = CheckStatus.Passed,
                Comment = "Verified per submittal sheet M-101",
                DetailerInitials = "BB"
            };

            var result = service.UpdateChecklist(updateCmd);

            Assert.True(result.Success);
            Assert.Equal(2, result.Revision);
            Assert.NotNull(result.Snapshot);

            var updatedCheck = result.Snapshot.Checklists[0];
            Assert.Equal(CheckStatus.Passed, updatedCheck.Status);
            Assert.Equal("Verified per submittal sheet M-101", updatedCheck.DetailerComment);
            Assert.Equal("BB", updatedCheck.DetailerInitials);
        }

        [Fact]
        public void SpecialQuote_AddAndUpdateAndDelete_ManagesQuotesAndRevisions()
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
            var initial = service.OpenSource(openCmd, _activePack, 1);

            // Add Special Quote
            var addCmd = new UpdateSpecialQuoteCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                SpecialQuote = new SpecialQuote
                {
                    Id = "SQ-TEST-1",
                    Slot = 1,
                    Text = "Special stainless steel casing extension",
                    Initials = "BB",
                    IsCompleted = true
                }
            };
            var addRes = service.UpdateSpecialQuote(addCmd);
            Assert.True(addRes.Success);
            Assert.Equal(2, addRes.Revision);
            Assert.Single(addRes.Snapshot!.SpecialQuotes);
            Assert.Equal("SQ-TEST-1", addRes.Snapshot.SpecialQuotes[0].Id);

            // Delete Special Quote
            var delCmd = new DeleteSpecialQuoteCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2,
                QuoteId = "SQ-TEST-1"
            };
            var delRes = service.DeleteSpecialQuote(delCmd);
            Assert.True(delRes.Success);
            Assert.Equal(3, delRes.Revision);
            Assert.Empty(delRes.Snapshot!.SpecialQuotes);
        }

        [Fact]
        public void ResetSession_RestoresBaselineState()
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
            var initial = service.OpenSource(openCmd, _activePack, 1);

            // Apply override
            service.OverrideFact(new OverrideFactCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.detailer",
                Value = "Custom Detailer"
            });

            // Reset
            var resetResult = service.ResetSession(new ResetSessionCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2
            });

            Assert.True(resetResult.Success);
            Assert.Equal(3, resetResult.Revision);
            Assert.False(resetResult.Snapshot!.IsDirty);
            Assert.NotEqual(FactStatus.ManuallyOverridden, resetResult.Snapshot.Facts["unit.detailer"].Status);
        }

        [Fact]
        public void SessionIdMismatch_RejectsCommandWithConflict()
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
            var initial = service.OpenSource(openCmd, _activePack, 1);

            var staleSessionCmd = new OverrideFactCommand
            {
                SessionId = "non-existent-session-id",
                ExpectedRevision = 1,
                FactId = "unit.detailer",
                Value = "New Value"
            };

            var result = service.OverrideFact(staleSessionCmd);

            Assert.False(result.Success);
            Assert.True(result.IsConflict);
            Assert.Contains("Session mismatch", result.ErrorMessage);
        }
    }
}
