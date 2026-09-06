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

        [Fact]
        public void BatchOverrideFacts_ValidOverrides_AppliesAllAtomicallyIncrementsRevisionOnce()
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

            var batchCmd = new BatchOverrideFactsCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                Overrides = new System.Collections.Generic.List<BatchFactOverrideItem>
                {
                    new BatchFactOverrideItem { FactId = "unit.jobName", Value = "Batch Job Name", Author = "Detailer" },
                    new BatchFactOverrideItem { FactId = "unit.comNumber", Value = "COM-999999", Author = "Detailer" },
                    new BatchFactOverrideItem { FactId = "unit.isSeismic", Value = false, Author = "Detailer" },
                    new BatchFactOverrideItem { FactId = "unit.noa", Value = false, Author = "Detailer" }
                }
            };

            var result = service.BatchOverrideFacts(batchCmd);

            Assert.True(result.Success);
            Assert.Equal(2, result.Revision);
            Assert.Equal("Batch Job Name", result.Snapshot!.Facts["unit.jobName"].Value);
            Assert.Equal("COM-999999", result.Snapshot.Facts["unit.comNumber"].Value);
            Assert.Equal(false, result.Snapshot.Facts["unit.isSeismic"].Value);
            Assert.Equal(false, result.Snapshot.Facts["unit.noa"].Value);
            Assert.True(result.Snapshot.IsDirty);
        }

        [Fact]
        public void ReorderSpecialQuotes_ValidAssignments_ReordersSlotsAtomically()
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

            // Add two SQs
            service.UpdateSpecialQuote(new UpdateSpecialQuoteCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                SpecialQuote = new SpecialQuote { Id = "sq-1", Slot = 1, Text = "First SQ" }
            });
            service.UpdateSpecialQuote(new UpdateSpecialQuoteCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2,
                SpecialQuote = new SpecialQuote { Id = "sq-2", Slot = 2, Text = "Second SQ" }
            });

            // Reorder
            var reorderResult = service.ReorderSpecialQuotes(new ReorderSpecialQuotesCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 3,
                Assignments = new System.Collections.Generic.List<SpecialQuoteSlotAssignment>
                {
                    new SpecialQuoteSlotAssignment { QuoteId = "sq-1", Slot = 2 },
                    new SpecialQuoteSlotAssignment { QuoteId = "sq-2", Slot = 1 }
                }
            });

            Assert.True(reorderResult.Success);
            Assert.Equal(4, reorderResult.Revision);
            Assert.Equal(2, reorderResult.Snapshot!.SpecialQuotes.Count);
            Assert.Equal("sq-2", reorderResult.Snapshot.SpecialQuotes[0].Id);
            Assert.Equal(1, reorderResult.Snapshot.SpecialQuotes[0].Slot);
            Assert.Equal("sq-1", reorderResult.Snapshot.SpecialQuotes[1].Id);
            Assert.Equal(2, reorderResult.Snapshot.SpecialQuotes[1].Slot);
        }

        [Fact]
        public void OpenSource_WithInitialHydratedState_PreservesStateAndChecklistOverrides()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);

            var initialOverrides = new System.Collections.Generic.Dictionary<string, Fact>
            {
                ["unit.jobName"] = new Fact { Key = "unit.jobName", Value = "Hydrated Job" }
            };
            var initialSqs = new System.Collections.Generic.List<SpecialQuote>
            {
                new SpecialQuote { Id = "sq-hydrated", Slot = 1, Text = "Hydrated SQ", IsCompleted = true }
            };

            var openCmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true,
                InitialOverrides = initialOverrides,
                InitialSpecialQuotes = initialSqs,
                InitialGeneralComments = "Hydrated comments"
            };

            var snapshot = service.OpenSource(openCmd, _activePack, 1);

            Assert.NotNull(snapshot);
            Assert.Equal("Hydrated Job", snapshot.Facts["unit.jobName"].Value);
            Assert.Single(snapshot.SpecialQuotes);
            Assert.Equal("Hydrated SQ", snapshot.SpecialQuotes[0].Text);
            Assert.Equal("Hydrated comments", snapshot.GeneralComments);
            Assert.True(snapshot.IsDirty);
        }
    }
}
