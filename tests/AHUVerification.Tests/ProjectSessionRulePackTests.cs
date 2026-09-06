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
    public class ProjectSessionRulePackTests
    {
        private readonly string _rulePackPath;
        private readonly string _configXmlPath;
        private readonly RulePackBundle _basePack;

        public ProjectSessionRulePackTests()
        {
            _rulePackPath = TestPathHelper.GetRepoPath(Path.Combine("resources", "rulepack"));
            _configXmlPath = TestPathHelper.GetRepoPath(Path.Combine("tests", "fixtures", "Config.xml"));
            _basePack = new RulePackManager().LoadFromDirectory(_rulePackPath);
        }

        [Fact]
        public void UpdateActiveRulePack_ReconcilesChecklistsAndPreservesDetailerReviews()
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

            var snapshot = service.OpenSource(openCmd, _basePack, 1);
            Assert.Equal(1, snapshot.Revision);
            Assert.Equal(1, snapshot.RulePack.Generation);

            // Find an applicable checklist item and mark it Passed with comments
            var targetCheck = snapshot.Checklists.First(c => c.Applicability == RuleApplicability.Applicable);
            string targetRuleId = targetCheck.RuleId;
            string targetKey = targetCheck.InstanceKey;

            var updateCmd = new UpdateChecklistCommand
            {
                SessionId = snapshot.SessionId,
                ExpectedRevision = 1,
                CheckId = targetKey,
                Status = CheckStatus.Passed,
                Comment = "Detailer verified against standard",
                DetailerInitials = "TB"
            };

            var updateRes = service.UpdateChecklist(updateCmd);
            Assert.True(updateRes.Success);
            Assert.Equal(2, updateRes.Revision);

            // Create a modified rule pack bundle:
            // 1. Keep targetRuleId unchanged (same predicate)
            // 2. Add a new rule
            // 3. Modify an existing rule's predicate
            // 4. Archive / remove a rule
            var modifiedRules = new List<RuleDefinition>();
            foreach (var r in _basePack.Rules)
            {
                modifiedRules.Add(new RuleDefinition
                {
                    Id = r.Id,
                    SemanticKey = r.SemanticKey,
                    Text = r.Text,
                    Category = r.Category,
                    Scope = r.Scope,
                    AllowNA = r.AllowNA,
                    RequiredFacts = new List<string>(r.RequiredFacts),
                    Predicate = r.Predicate != null ? new Dictionary<string, JsonElement>(r.Predicate) : null,
                    IsArchived = r.IsArchived
                });
            }

            // Add a new rule
            string newRuleId = "RULE-NEW-TEST-999";
            modifiedRules.Add(new RuleDefinition
            {
                Id = newRuleId,
                SemanticKey = "unit.new_test_rule",
                Text = "New Test Verification Rule",
                Category = "Safety",
                Scope = RuleScope.Unit,
                AllowNA = true,
                RequiredFacts = new List<string> { "unit.unitType" },
                Predicate = null // always applicable
            });

            // Archive an existing rule that isn't the target rule
            var ruleToArchive = modifiedRules.First(r => r.Id != targetRuleId && r.IsArchived != true);
            ruleToArchive.IsArchived = true;
            string archivedRuleId = ruleToArchive.Id;

            var newPack = new RulePackBundle
            {
                Manifest = new RulePackManifest
                {
                    Version = "14.1.0-test",
                    BundleSha256 = "dummy-sha256",
                    Files = _basePack.Manifest.Files
                },
                Rules = modifiedRules,
                TemplateMap = _basePack.TemplateMap,
                ApprovedMappings = _basePack.ApprovedMappings,
                FactContract = _basePack.FactContract,
                TemplatePath = _basePack.TemplatePath,
                RootPath = _basePack.RootPath,
                IsValid = true
            };

            // Update rule pack on the active session
            var updatedSnapshot = service.UpdateActiveRulePack(newPack, 2);

            Assert.NotNull(updatedSnapshot);
            Assert.Equal(3, updatedSnapshot.Revision); // Revision incremented
            Assert.Equal("14.1.0-test", updatedSnapshot.RulePack.Version);
            Assert.Equal(2, updatedSnapshot.RulePack.Generation);

            // 1. Target rule review status and comment should be PRESERVED
            var preservedCheck = updatedSnapshot.Checklists.Find(c => c.InstanceKey == targetKey);
            Assert.NotNull(preservedCheck);
            Assert.Equal(CheckStatus.Passed, preservedCheck.Status);
            Assert.Equal("Detailer verified against standard", preservedCheck.DetailerComment);
            Assert.Equal("TB", preservedCheck.DetailerInitials);

            // 2. Newly added rule should appear in checklists
            Assert.Contains(updatedSnapshot.Checklists, c => c.RuleId == newRuleId);

            // 3. Archived rule should be pruned from checklists
            Assert.DoesNotContain(updatedSnapshot.Checklists, c => c.RuleId == archivedRuleId);
        }

        [Fact]
        public void Readiness_MissingTemplateArtifact_BlocksExport()
        {
            var service = new ProjectSessionService();
            string configXml = File.ReadAllText(_configXmlPath);

            var packWithoutTemplate = new RulePackBundle
            {
                Manifest = _basePack.Manifest,
                Rules = _basePack.Rules,
                TemplateMap = _basePack.TemplateMap,
                ApprovedMappings = _basePack.ApprovedMappings,
                FactContract = _basePack.FactContract,
                TemplatePath = Path.Combine(Path.GetTempPath(), "non_existent_template_file.xlsx"),
                RootPath = _basePack.RootPath,
                IsValid = true
            };

            var openCmd = new OpenSourceCommand
            {
                FilePath = _configXmlPath,
                ConfigXml = configXml,
                IsUpz = false,
                IsTrusted = true
            };

            var snapshot = service.OpenSource(openCmd, packWithoutTemplate, 1);

            Assert.NotNull(snapshot.Readiness);
            Assert.False(snapshot.Readiness.TemplateRetrievable);
            Assert.True(snapshot.Readiness.ExportBlocked);
            Assert.Contains(snapshot.Readiness.Blockers, b => b.Contains("Excel template artifact (template.xlsx) is missing or unavailable"));
        }
    }
}
