using System;
using System.IO;
using AHUVerification.Core.Manual;
using AHUVerification.Core.Models;
using AHUVerification.Core.Services;
using AHUVerification.Core.Session;
using Xunit;

namespace AHUVerification.Tests
{
    public class ProjectSessionManualTests
    {
        private readonly string _rulePackPath;
        private readonly RulePackBundle _activePack;

        public ProjectSessionManualTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
            _activePack = new RulePackManager().LoadFromDirectory(_rulePackPath);
        }

        [Fact]
        public void CreateManualProject_InitializesDraftOnlyUntrustedSession()
        {
            var service = new ProjectSessionService();
            var cmd = new CreateManualProjectCommand
            {
                Config = new ManualUnitConfig
                {
                    JobName = "Manual Rooftop Unit",
                    ComNumber = "COM-554433",
                    DetailerName = "Manual Detailer",
                    UnitType = "Outdoor",
                    HousingStyle = "ThermalBreak",
                    SkidCount = 2
                }
            };

            var snapshot = service.CreateManualProject(cmd, _activePack, 1);

            Assert.NotNull(snapshot);
            Assert.False(string.IsNullOrWhiteSpace(snapshot.SessionId));
            Assert.Equal(1, snapshot.Revision);
            Assert.Equal("Manual Unit Configuration.xml", snapshot.Source.FileName);
            Assert.False(snapshot.Source.IsTrusted);
            Assert.True(snapshot.IsDirty); // Manual projects start dirty

            // Assert readiness marks manual unit as draft-only
            Assert.NotNull(snapshot.Readiness);
            Assert.True(snapshot.Readiness.IsDraftOnly);
            Assert.False(snapshot.Readiness.IsReadyForFinal);
            Assert.Contains(snapshot.Readiness.Blockers, b => b.Contains("Project source is not an authentic native UPZ/Config.xml"));

            // Checklists generated and evaluated
            Assert.NotEmpty(snapshot.Checklists);
            Assert.NotEmpty(snapshot.Facts);
            Assert.Equal("Manual Rooftop Unit", snapshot.Facts["unit.jobName"].Value);
        }

        [Fact]
        public void ManualSession_CanOverrideAndRevertFacts_WithMonotonicRevisions()
        {
            var service = new ProjectSessionService();
            var cmd = new CreateManualProjectCommand
            {
                Config = new ManualUnitConfig
                {
                    JobName = "Manual Unit A",
                    ComNumber = "COM-111111",
                    DetailerName = "Detailer A",
                    SkidCount = 1
                }
            };

            var snapshot = service.CreateManualProject(cmd, _activePack, 1);
            Assert.Equal(1, snapshot.Revision);

            // Override a fact
            var overrideCmd = new OverrideFactCommand
            {
                SessionId = snapshot.SessionId,
                ExpectedRevision = 1,
                FactId = "unit.jobName",
                Value = "Updated Manual Job Name",
                Author = "Detailer B",
                Comment = "Customer requested change"
            };

            var overrideRes = service.OverrideFact(overrideCmd);
            Assert.True(overrideRes.Success);
            Assert.Equal(2, overrideRes.Revision);
            Assert.Equal("Updated Manual Job Name", overrideRes.Snapshot!.Facts["unit.jobName"].Value);

            // Stale revision is rejected
            var staleCmd = new OverrideFactCommand
            {
                SessionId = snapshot.SessionId,
                ExpectedRevision = 1, // Stale!
                FactId = "unit.jobName",
                Value = "Stale update"
            };
            var staleRes = service.OverrideFact(staleCmd);
            Assert.False(staleRes.Success);
            Assert.True(staleRes.IsConflict);
            Assert.Equal(2, staleRes.Revision);
        }

        [Fact]
        public void ManualSession_ChecklistAndSpecialQuoteMutations_WorkIdentically()
        {
            var service = new ProjectSessionService();
            var cmd = new CreateManualProjectCommand
            {
                Config = new ManualUnitConfig
                {
                    JobName = "Manual Unit B",
                    ComNumber = "COM-222222",
                    DetailerName = "Detailer",
                    SkidCount = 2
                }
            };

            var snapshot = service.CreateManualProject(cmd, _activePack, 1);
            string firstKey = snapshot.Checklists[0].InstanceKey;

            // Update checklist
            var clCmd = new UpdateChecklistCommand
            {
                SessionId = snapshot.SessionId,
                ExpectedRevision = 1,
                CheckId = firstKey,
                Status = CheckStatus.Passed,
                Comment = "Verified manually in CAD model",
                DetailerInitials = "MD"
            };

            var clRes = service.UpdateChecklist(clCmd);
            Assert.True(clRes.Success);
            Assert.Equal(2, clRes.Revision);
            var updatedCheck = clRes.Snapshot!.Checklists.Find(c => c.InstanceKey == firstKey);
            Assert.NotNull(updatedCheck);
            Assert.Equal(CheckStatus.Passed, updatedCheck.Status);
            Assert.Equal("Verified manually in CAD model", updatedCheck.DetailerComment);

            // Add and complete special quote
            var sqCmd = new UpdateSpecialQuoteCommand
            {
                SessionId = snapshot.SessionId,
                ExpectedRevision = 2,
                SpecialQuote = new SpecialQuote
                {
                    Slot = 1,
                    Id = "sq-manual-1",
                    Text = "Custom structural lifting lugs welded per skid",
                    Initials = "MD",
                    IsCompleted = true
                }
            };

            var sqRes = service.UpdateSpecialQuote(sqCmd);
            Assert.True(sqRes.Success);
            Assert.Equal(3, sqRes.Revision);
            Assert.Single(sqRes.Snapshot!.SpecialQuotes);
            Assert.Equal("Custom structural lifting lugs welded per skid", sqRes.Snapshot.SpecialQuotes[0].Text);
        }
    }
}
