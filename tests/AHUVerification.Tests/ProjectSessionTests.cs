using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
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

        private ProjectSession CreateTestSession()
        {
            string configXml = File.ReadAllText(_configXmlPath);
            return new ProjectSession(
                filePath: _configXmlPath,
                configXml: configXml,
                orderRevXml: null,
                manifestXml: null,
                isUpz: false,
                isTrusted: true,
                activePack: _activePack,
                packGeneration: 1
            );
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
        public void UpdateChecklist_StatusOnly_PreservesExistingCommentAndInitials()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var initial = service.OpenSource(new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsTrusted = true
            }, _activePack, 1);
            var firstCheck = initial.Checklists[0];

            // 1. Set initial comment
            service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                CheckId = firstCheck.InstanceKey,
                Comment = "Initial note",
                DetailerInitials = "BB"
            });

            // 2. Status-only update (Status provided, Comment is null)
            var res = service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2,
                CheckId = firstCheck.InstanceKey,
                Status = CheckStatus.Passed
            });

            Assert.True(res.Success);
            var updated = res.Snapshot!.Checklists[0];
            Assert.Equal(CheckStatus.Passed, updated.Status);
            Assert.Equal("Initial note", updated.DetailerComment);
            Assert.Equal("BB", updated.DetailerInitials);
        }

        [Fact]
        public void UpdateChecklist_CommentOnly_PreservesExistingStatusAndInitials()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var initial = service.OpenSource(new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsTrusted = true
            }, _activePack, 1);
            var firstCheck = initial.Checklists[0];

            // 1. Set status to Passed
            service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                CheckId = firstCheck.InstanceKey,
                Status = CheckStatus.Passed,
                DetailerInitials = "BB"
            });

            // 2. Comment-only update (Status is null, Comment provided)
            var res = service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2,
                CheckId = firstCheck.InstanceKey,
                Comment = "Updated verification detail"
            });

            Assert.True(res.Success);
            var updated = res.Snapshot!.Checklists[0];
            Assert.Equal(CheckStatus.Passed, updated.Status);
            Assert.Equal("Updated verification detail", updated.DetailerComment);
            Assert.Equal("BB", updated.DetailerInitials);
        }

        [Fact]
        public void UpdateChecklist_SequentialOrderPreservation_RetainsBothStatusAndComment()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var initial = service.OpenSource(new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsTrusted = true
            }, _activePack, 1);
            var firstCheck = initial.Checklists[0];

            // Sequence A: Comment then Status
            service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 1,
                CheckId = firstCheck.InstanceKey,
                Comment = "Seq A comment"
            });
            var resA = service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 2,
                CheckId = firstCheck.InstanceKey,
                Status = CheckStatus.Flagged
            });
            Assert.Equal(CheckStatus.Flagged, resA.Snapshot!.Checklists[0].Status);
            Assert.Equal("Seq A comment", resA.Snapshot!.Checklists[0].DetailerComment);

            // Sequence B: Status then Comment
            service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 3,
                CheckId = firstCheck.InstanceKey,
                Status = CheckStatus.Passed
            });
            var resB = service.UpdateChecklist(new UpdateChecklistCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 4,
                CheckId = firstCheck.InstanceKey,
                Comment = "Seq B revised comment"
            });
            Assert.Equal(CheckStatus.Passed, resB.Snapshot!.Checklists[0].Status);
            Assert.Equal("Seq B revised comment", resB.Snapshot!.Checklists[0].DetailerComment);
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
        public void ReorderSpecialQuotes_SlotCollisionWithUnassignedQuote_FailsWithoutMutatingState()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);
            var initial = service.OpenSource(new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false
            }, _activePack, 1);

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

            // Attempt to move sq-1 to slot 2 without reassigning sq-2
            var reorderResult = service.ReorderSpecialQuotes(new ReorderSpecialQuotesCommand
            {
                SessionId = initial.SessionId,
                ExpectedRevision = 3,
                Assignments = new System.Collections.Generic.List<SpecialQuoteSlotAssignment>
                {
                    new SpecialQuoteSlotAssignment { QuoteId = "sq-1", Slot = 2 }
                }
            });

            Assert.False(reorderResult.Success);
            Assert.Contains("duplicate slot numbers", reorderResult.ErrorMessage);
            Assert.Equal(3, reorderResult.Revision);
            Assert.Equal(1, reorderResult.Snapshot!.SpecialQuotes.First(s => s.Id == "sq-1").Slot);
            Assert.Equal(2, reorderResult.Snapshot.SpecialQuotes.First(s => s.Id == "sq-2").Slot);
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

        [Fact]
        public void ResetToBaseline_InvalidatesCachedDeduplicationResults_RetryReturnsMismatchNotStaleSnapshot()
        {
            var session = CreateTestSession();
            object? baselineJobValue = session.Facts["unit.jobName"].Value;

            // 1. Override fact from rev 1 -> rev 2
            string requestId = "req-override-dedup-reset";
            var overrideCmd = new OverrideFactCommand
            {
                SessionId = session.SessionId,
                ExpectedRevision = 1,
                RequestId = requestId,
                FactId = "unit.jobName",
                Value = "Overridden Job Name",
                Author = "Detailer",
                Comment = "First edit"
            };
            var res1 = session.OverrideFact(overrideCmd);
            Assert.True(res1.Success);
            Assert.Equal(2, res1.Revision);
            Assert.Equal("Overridden Job Name", res1.Snapshot!.Facts["unit.jobName"].Value?.ToString());

            // 2. Reset session from rev 2 -> rev 3
            var resetCmd = new ResetSessionCommand
            {
                SessionId = session.SessionId,
                ExpectedRevision = 2,
                RequestId = "req-reset-1"
            };
            var resetRes = session.ResetToBaseline(resetCmd);
            Assert.True(resetRes.Success);
            Assert.Equal(3, resetRes.Revision);
            Assert.Equal(baselineJobValue, resetRes.Snapshot!.Facts["unit.jobName"].Value);

            // 3. Retry override with identical requestId from step 1
            // Must NOT return cached rev 2 snapshot containing "Overridden Job Name"
            var retryRes = session.OverrideFact(overrideCmd);
            Assert.False(retryRes.Success, "Retry with stale expectedRevision 1 should fail/conflict on reset session at rev 3");
            Assert.Equal(3, retryRes.Revision);
            Assert.NotEqual("Overridden Job Name", retryRes.Snapshot!.Facts["unit.jobName"].Value?.ToString());
        }

        [Fact]
        public void UpdateRulePack_InvalidatesCachedDeduplicationResults()
        {
            var session = CreateTestSession();

            // 1. Override fact from rev 1 -> rev 2
            string requestId = "req-override-dedup-pack";
            var overrideCmd = new OverrideFactCommand
            {
                SessionId = session.SessionId,
                ExpectedRevision = 1,
                RequestId = requestId,
                FactId = "unit.jobName",
                Value = "Pre Pack Update Name",
                Author = "Detailer",
                Comment = "Before pack update"
            };
            var res1 = session.OverrideFact(overrideCmd);
            Assert.True(res1.Success);
            Assert.Equal(2, res1.Revision);

            // 2. Update rule pack from rev 2 -> rev 3
            var packRes = session.UpdateRulePack(_activePack, 2);
            Assert.True(packRes.Success);
            Assert.Equal(3, packRes.Revision);

            // 3. Retry override with identical requestId
            // Must NOT return cached rev 2 snapshot
            var retryRes = session.OverrideFact(overrideCmd);
            Assert.False(retryRes.Success);
            Assert.Equal(3, retryRes.Revision);
        }

        [Fact]
        public void CreateSnapshot_PopulatesRawOrderRevisionXmlAndRawManifestXml()
        {
            string configXml = File.ReadAllText(_configXmlPath);
            string orderRevXml = "<OrderRev><JobName>Sample</JobName></OrderRev>";
            string manifestXml = "<Manifest><Version>1.0</Version></Manifest>";

            var session = new ProjectSession(
                filePath: _configXmlPath,
                configXml: configXml,
                orderRevXml: orderRevXml,
                manifestXml: manifestXml,
                isUpz: true,
                isTrusted: true,
                activePack: _activePack,
                packGeneration: 1
            );

            var snapshot = session.CreateSnapshot();

            Assert.NotNull(snapshot);
            Assert.NotNull(snapshot.Source);
            Assert.Equal(orderRevXml, snapshot.Source.RawOrderRevisionXml);
            Assert.Equal(manifestXml, snapshot.Source.RawManifestXml);
        }

        [Fact]
        public void TrustedSession_RejectsInitialChecklists_AuthorityBoundaryEnforced()
        {
            string configXml = File.ReadAllText(_configXmlPath);
            var firstRule = _activePack.Rules.First(r => r.Scope == RuleScope.Unit);
            string fingerprint = AstRuleEvaluator.ComputeSemanticFingerprint(firstRule);

            var fakeChecklist = new ChecklistInstance
            {
                RuleId = firstRule.Id,
                SemanticKey = firstRule.SemanticKey,
                InstanceKey = $"unit:{firstRule.Id}",
                ScopeTargetId = "unit",
                Applicability = RuleApplicability.Applicable,
                Status = CheckStatus.Passed,
                DetailerInitials = "HACK",
                CheckerInitials = "FAKE",
                CheckerComment = "Injected approval",
                UpdatedAt = "2020-01-01T00:00:00Z",
                SemanticFingerprint = fingerprint
            };

            var session = new ProjectSession(
                filePath: _configXmlPath,
                configXml: configXml,
                orderRevXml: null,
                manifestXml: null,
                isUpz: false,
                isTrusted: true,
                activePack: _activePack,
                packGeneration: 1,
                initialChecklists: new List<ChecklistInstance> { fakeChecklist }
            );

            var check = session.Checklists.FirstOrDefault(c => c.RuleId == firstRule.Id);
            Assert.NotNull(check);
            Assert.NotEqual(CheckStatus.Passed, check.Status);
            Assert.Null(check.CheckerInitials);
            Assert.Null(check.DetailerInitials);
            Assert.Null(check.CheckerComment);
            Assert.False(session.CreateSnapshot().Readiness.IsReadyForFinal);
        }

        [Fact]
        public void UntrustedSession_HydratesInitialChecklists_ForLegacyDvlHydration()
        {
            string configXml = File.ReadAllText(_configXmlPath);
            var firstRule = _activePack.Rules.First(r => r.Scope == RuleScope.Unit);
            string fingerprint = AstRuleEvaluator.ComputeSemanticFingerprint(firstRule);

            var legacyChecklist = new ChecklistInstance
            {
                RuleId = firstRule.Id,
                SemanticKey = firstRule.SemanticKey,
                InstanceKey = $"unit:{firstRule.Id}",
                ScopeTargetId = "unit",
                Applicability = RuleApplicability.Applicable,
                Status = CheckStatus.Passed,
                DetailerInitials = "LEGACY",
                CheckerInitials = "SIGN",
                CheckerComment = "Persisted comment",
                UpdatedAt = "2025-01-01T00:00:00Z",
                SemanticFingerprint = fingerprint
            };

            var session = new ProjectSession(
                filePath: _configXmlPath,
                configXml: configXml,
                orderRevXml: null,
                manifestXml: null,
                isUpz: false,
                isTrusted: false,
                activePack: _activePack,
                packGeneration: 1,
                initialChecklists: new List<ChecklistInstance> { legacyChecklist }
            );

            var check = session.Checklists.FirstOrDefault(c => c.RuleId == firstRule.Id);
            Assert.NotNull(check);
            Assert.Equal(CheckStatus.Passed, check.Status);
            Assert.Equal("LEGACY", check.DetailerInitials);
            Assert.Equal("SIGN", check.CheckerInitials);
            Assert.Equal("Persisted comment", check.CheckerComment);
            // Untrusted session can never be ready for final export
            Assert.False(session.CreateSnapshot().Readiness.IsReadyForFinal);
        }

        [Fact]
        public void OpenDvl_PinnedToOlderPack_RestoresTrustAndUsesPinnedRulesAndTemplate()
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
            var snap = service.OpenSource(openCmd, _activePack, 1);
            string dvlPath = Path.Combine(Path.GetTempPath(), $"test_pinned_{Guid.NewGuid():N}.dvl");
            try
            {
                var saveResult = service.SaveProject(new SaveProjectCommand
                {
                    SessionId = snap.SessionId,
                    ExpectedRevision = snap.Revision
                }, dvlPath);
                Assert.True(saveResult.Success);

                var packB = new RulePackBundle
                {
                    Manifest = new RulePackManifest
                    {
                        Version = "2.0.0",
                        BundleSha256 = new string('b', 64)
                    },
                    Rules = new List<RuleDefinition>(_activePack.Rules),
                    TemplateMap = _activePack.TemplateMap,
                    ApprovedMappings = _activePack.ApprovedMappings,
                    FactContract = _activePack.FactContract,
                    IsValid = true
                };

                // Reopen under host with pack B installed
                var service2 = new ProjectSessionService();
                var snap2 = service2.OpenDvl(dvlPath, packB, packGeneration: 1);

                Assert.True(snap2.Source.IsTrusted);
                Assert.Equal(_activePack.Manifest.Version, snap2.RulePack.Version);
                Assert.Equal("pack-mismatch", snap2.IntegrityState);
                Assert.NotNull(snap2.IntegrityWarning);
                Assert.Contains("pinned to Rule Pack", snap2.IntegrityWarning);
                Assert.Equal(Path.GetFileName(_configXmlPath), snap2.Source.FileName);
                Assert.Equal(dvlPath, snap2.CurrentProjectPath);

                // Explicitly adopting pack B advances revision and marks dirty
                var snap3 = service2.UpdateActiveRulePack(packB, packGeneration: 2);
                Assert.NotNull(snap3);
                Assert.Equal("2.0.0", snap3.RulePack.Version);
                Assert.True(snap3.IsDirty);
                Assert.Equal("complete", snap3.IntegrityState);
                Assert.Null(snap3.IntegrityWarning);
            }
            finally
            {
                if (File.Exists(dvlPath)) File.Delete(dvlPath);
            }
        }

        [Fact]
        public void Save_Reopen_Save_PreservesSourceMetadataFidelity()
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
            var snap = service.OpenSource(openCmd, _activePack, 1);
            string dvlPath1 = Path.Combine(Path.GetTempPath(), $"test_source_meta1_{Guid.NewGuid():N}.dvl");
            string dvlPath2 = Path.Combine(Path.GetTempPath(), $"test_source_meta2_{Guid.NewGuid():N}.dvl");
            try
            {
                service.SaveProject(new SaveProjectCommand
                {
                    SessionId = snap.SessionId,
                    ExpectedRevision = snap.Revision
                }, dvlPath1);

                var service2 = new ProjectSessionService();
                var reopened = service2.OpenDvl(dvlPath1, _activePack, 1);
                Assert.Equal(Path.GetFileName(_configXmlPath), reopened.Source.FileName);
                Assert.Equal(dvlPath1, reopened.CurrentProjectPath);
                Assert.True(reopened.Source.IsTrusted);

                // Save As to second path
                var saveAsResult = service2.SaveProject(new SaveProjectCommand
                {
                    SessionId = reopened.SessionId,
                    ExpectedRevision = reopened.Revision
                }, dvlPath2);
                Assert.True(saveAsResult.Success);

                // Reopen second file and verify source metadata is still preserved
                var service3 = new ProjectSessionService();
                var reopened2 = service3.OpenDvl(dvlPath2, _activePack, 1);
                Assert.Equal(Path.GetFileName(_configXmlPath), reopened2.Source.FileName);
                Assert.Equal(dvlPath2, reopened2.CurrentProjectPath);
                Assert.True(reopened2.Source.IsTrusted);
            }
            finally
            {
                if (File.Exists(dvlPath1)) File.Delete(dvlPath1);
                if (File.Exists(dvlPath2)) File.Delete(dvlPath2);
            }
        }
    }
}
