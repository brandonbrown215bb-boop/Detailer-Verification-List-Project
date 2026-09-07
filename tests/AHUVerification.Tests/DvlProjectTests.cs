using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;

namespace AHUVerification.Tests
{
    public class DvlProjectTests
    {
        [Fact]
        public void DvlProject_RoundtripSerialization_PreservesAllData()
        {
            string xmlContent = File.ReadAllText(TestPathHelper.GetFixturePath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            var sqItems = new List<SpecialQuote>
            {
                new SpecialQuote { Slot = 1, Id = "sq-1", Text = "Custom 3.5\" drain pan depth", LinkedSkidId = "skid-1", Initials = "TD", IsCompleted = true },
                new SpecialQuote { Slot = 2, Id = "sq-2", Text = "Dual EBM fan wall with disconnects", LinkedSkidId = "skid-2", Initials = "TD", IsCompleted = false }
            };

            var projectManager = new DvlProjectManager();
            var project = projectManager.CreateProject(
                graph,
                facts,
                sqItems,
                checklists,
                xmlContent,
                bundle,
                "General comment test",
                sourceFileName: "unit-package.upz",
                isUpzBundle: true,
                orderRevision: new OrderRevisionData { JobName = "Medical Center Phase 3", OrderNumber = "842910" },
                rawOrderRevisionXml: "<OrderRev />",
                rawManifestXml: "<Manifest />");

            string tempFile = Path.Combine(Path.GetTempPath(), "test_roundtrip.dvl");
            try
            {
                projectManager.SaveToFile(project, tempFile);
                Assert.True(File.Exists(tempFile));

                var loaded = projectManager.LoadFromFile(tempFile);
                Assert.Equal(project.JobName, loaded.JobName);
                Assert.Equal(project.ComNumber, loaded.ComNumber);
                Assert.Equal(project.SourceXml.FileSha256, loaded.SourceXml.FileSha256);
                Assert.Equal(64, loaded.SourceXml.FileSha256.Length);
                Assert.Equal(bundle.Manifest.Version, loaded.RulePack.Version);
                Assert.Equal(bundle.Manifest.BundleSha256, loaded.RulePack.Sha256);
                Assert.Equal("unit-package.upz", loaded.SourceXml.FileName);
                Assert.True(loaded.SourceXml.IsUpzBundle == true);
                Assert.Equal("842910", loaded.SourceXml.OrderRevision?.OrderNumber);
                Assert.Equal("<OrderRev />", loaded.SourceXml.RawOrderRevisionXml);
                Assert.Equal("<Manifest />", loaded.SourceXml.RawManifestXml);
                Assert.Equal(ApplicationVersion.DvlFormat, loaded.FormatVersion);
                Assert.Equal(ApplicationVersion.DocumentSchema, loaded.SourceXml.SchemaVersion);
                Assert.Equal(ApplicationVersion.DocumentSchema, loaded.NormalizedGraph.DocumentVersion);
                Assert.Equal(ApplicationVersion.Current, loaded.AppVersion);
                Assert.NotNull(loaded.Integrity);
                Assert.Equal("complete", loaded.Integrity!.State);
                Assert.Equal(loaded.Integrity.CompleteStateSha256, DvlProjectManager.ComputeCompleteStateSha256(loaded));
                Assert.Equal(project.SqItems.Count, loaded.SqItems.Count);
                Assert.Equal(project.ChecklistInstances.Count, loaded.ChecklistInstances.Count);
                Assert.Equal(project.NormalizedGraph.Segments.Count, loaded.NormalizedGraph.Segments.Count);
                Assert.Equal("General comment test", loaded.GeneralComments);
            }
            finally
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
        }

        [Fact]
        public void CompleteStateHashChangesWhenVerificationStateChanges()
        {
            var project = new DvlProjectManager().CreateProject(
                new NormalizedXmlGraph(),
                new Dictionary<string, Fact>(),
                new List<SpecialQuote>(),
                new List<ChecklistInstance>
                {
                    new ChecklistInstance { RuleId = "R-1", InstanceKey = "unit:R-1", DetailerComment = "before" }
                },
                "<Config />",
                "14.0.0",
                new string('a', 64));

            string before = project.Integrity!.CompleteStateSha256!;
            project.ChecklistInstances[0].DetailerComment = "after";

            Assert.NotEqual(before, DvlProjectManager.ComputeCompleteStateSha256(project));
        }

        [Fact]
        public void Canonicalization_MatchesCrossRuntimeFixture()
        {
            string fixturePath = TestPathHelper.GetFixturePath("dvl-v2-canonical.json");
            string json = File.ReadAllText(fixturePath, System.Text.Encoding.UTF8);

            string canonical = DvlProjectManager.CanonicalizeJsonPayload(json);
            string sha256 = DvlProjectManager.ComputeSha256(canonical);

            Assert.Contains("\"factRegistry\":{\"count\":{\"value\":42},\"measurement\":{\"value\":-0.5}}", canonical);
            Assert.Contains("\"dimensions\":{\"height\":96.5,\"length\":120,\"width\":84}", canonical);
            Assert.DoesNotContain("integrity", canonical);
            Assert.DoesNotContain("lastSavedAt", canonical);

            Assert.Equal("1aa26cd3c1d1b5b4906503ece290375a23471c6ead56aec962709323bbfc27b8", sha256);
        }

        [Fact]
        public void CompleteStateHashCoversVerificationRelevantFields()
        {
            var project = new DvlProjectManager().CreateProject(
                new NormalizedXmlGraph { UnitMOMID = "graph-before" },
                new Dictionary<string, Fact>
                {
                    ["unit.jobName"] = new Fact { Key = "unit.jobName", Value = "before" }
                },
                new List<SpecialQuote> { new SpecialQuote { Slot = 1, Id = "sq-1", Text = "before" } },
                new List<ChecklistInstance>
                {
                    new ChecklistInstance { RuleId = "R-1", InstanceKey = "unit:R-1", DetailerComment = "before" }
                },
                "<Config />",
                "14.0.0",
                new string('a', 64),
                "before");

            string Hash() => DvlProjectManager.ComputeCompleteStateSha256(project);
            string baseline = Hash();
            project.FactRegistry["unit.jobName"].Value = "after";
            Assert.NotEqual(baseline, Hash());
            project.FactRegistry["unit.jobName"].Value = "before";
            project.ChecklistInstances[0].DetailerComment = "after";
            Assert.NotEqual(baseline, Hash());
            project.ChecklistInstances[0].DetailerComment = "before";
            project.SqItems[0].Text = "after";
            Assert.NotEqual(baseline, Hash());
            project.SqItems[0].Text = "before";
            project.NormalizedGraph.UnitMOMID = "after";
            Assert.NotEqual(baseline, Hash());
            project.NormalizedGraph.UnitMOMID = "graph-before";
            project.GeneralComments = "after";
            Assert.NotEqual(baseline, Hash());
            project.GeneralComments = "before";
            project.RulePack.Sha256 = new string('b', 64);
            Assert.NotEqual(baseline, Hash());
        }

        [Fact]
        public void LegacyProjectIsExplicitlyUnverified()
        {
            var manager = new DvlProjectManager();
            var legacy = new DvlProjectFile
            {
                FormatVersion = "1.0",
                SourceXml = new SourceXmlInfo { RawXml = "<Config />", FileSha256 = DvlProjectManager.ComputeSha256("<Config />") }
            };

            var result = manager.ValidateIntegrity(legacy);

            Assert.False(result.IsVerified);
            Assert.False(result.CertificationAllowed);
            Assert.Equal("source-only", result.State);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(1)]
        [InlineData(22)]
        public void SpecialQuoteBoundaryCountsAreSupported(int count)
        {
            var sqItems = Enumerable.Range(1, count)
                .Select(slot => new SpecialQuote { Slot = slot, Id = $"sq-{slot}", Text = $"SQ {slot}" })
                .ToList();

            var project = new DvlProjectManager().CreateProject(
                new NormalizedXmlGraph(), new Dictionary<string, Fact>(), sqItems,
                new List<ChecklistInstance>(), "<Config />", "14.0.0", new string('a', 64));

            Assert.Equal(count, project.SqItems.Count);
        }

        [Fact]
        public void CreateProject_RejectsSpecialQuoteOverflowInsteadOfDroppingEntries()
        {
            var sqItems = Enumerable.Range(1, 23)
                .Select(slot => new SpecialQuote { Slot = slot, Id = $"sq-{slot}", Text = $"SQ {slot}" })
                .ToList();

            Assert.Throws<ArgumentException>(() => new DvlProjectManager().CreateProject(
                new NormalizedXmlGraph(),
                new Dictionary<string, Fact>(),
                sqItems,
                new List<ChecklistInstance>(),
                "<Config />",
                "14.0.0",
                new string('a', 64)));
        }

        [Fact]
        public void SaveJsonToFile_RejectsRelativePaths()
        {
            var projectManager = new DvlProjectManager();
            Assert.Throws<ArgumentException>(() => projectManager.SaveJsonToFile("{}", "Project.dvl"));
        }

        [Fact]
        public void SaveJsonToFile_ReplacesDestinationWithoutLeavingTemporaryFiles()
        {
            string tempDirectory = Path.Combine(Path.GetTempPath(), $"ahu-dvl-{Guid.NewGuid():N}");
            string targetPath = Path.Combine(tempDirectory, "Project.dvl");
            var projectManager = new DvlProjectManager();
            var bundle = new RulePackManager().LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var projectRev1 = projectManager.CreateProject(
                new NormalizedXmlGraph(),
                new Dictionary<string, Fact>(),
                new List<SpecialQuote>(),
                new List<ChecklistInstance>(),
                "<Config />",
                bundle,
                generalComments: "Revision 1");
            string jsonRev1 = System.Text.Json.JsonSerializer.Serialize(projectRev1, JsonDefaults.CreateFlexibleOptions());

            var projectRev2 = projectManager.CreateProject(
                new NormalizedXmlGraph(),
                new Dictionary<string, Fact>(),
                new List<SpecialQuote>(),
                new List<ChecklistInstance>(),
                "<Config />",
                bundle,
                generalComments: "Revision 2");
            string jsonRev2 = System.Text.Json.JsonSerializer.Serialize(projectRev2, JsonDefaults.CreateFlexibleOptions());

            try
            {
                projectManager.SaveJsonToFile(jsonRev1, targetPath);
                Assert.True(File.Exists(targetPath));
                Assert.Contains("Revision 1", File.ReadAllText(targetPath));

                projectManager.SaveJsonToFile(jsonRev2, targetPath);
                Assert.True(File.Exists(targetPath));
                Assert.Contains("Revision 2", File.ReadAllText(targetPath));
                Assert.Empty(Directory.GetFiles(tempDirectory, "*.tmp"));

                // Malformed input must fail validation, preserve previous file contents, and leave no temporary files
                Assert.Throws<ArgumentException>(() => projectManager.SaveJsonToFile("{\"revision\":3}", targetPath));
                Assert.Contains("Revision 2", File.ReadAllText(targetPath));
                Assert.Empty(Directory.GetFiles(tempDirectory, "*.tmp"));
            }
            finally
            {
                if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, recursive: true);
            }
        }

        [Fact]
        public void DvlProject_DraftWithoutSnapshot_CanBeSavedAndLoadedAsNonCertifyingDraft()
        {
            var projectManager = new DvlProjectManager();
            var draftProject = projectManager.CreateProject(
                new NormalizedXmlGraph(),
                new Dictionary<string, Fact>(),
                new List<SpecialQuote>(),
                new List<ChecklistInstance>(),
                "<Config />",
                "14.0.0",
                new string('a', 64),
                "Draft project without snapshot");

            string tempFile = Path.Combine(Path.GetTempPath(), $"draft_test_{Guid.NewGuid():N}.dvl");
            try
            {
                projectManager.SaveToFile(draftProject, tempFile);
                Assert.True(File.Exists(tempFile));

                var loaded = projectManager.LoadFromFile(tempFile);
                Assert.Equal("draft", loaded.Integrity!.State);
                Assert.Null(loaded.RulePackSnapshot);
                Assert.Equal("Draft project without snapshot", loaded.GeneralComments);

                var validation = projectManager.ValidateIntegrity(loaded);
                Assert.False(validation.CertificationAllowed);
                Assert.Equal("artifact-unavailable", validation.State);
            }
            finally
            {
                if (File.Exists(tempFile)) File.Delete(tempFile);
            }
        }

        [Fact]
        public void DvlProjectManager_EdgeCaseValidationAndIntegrity_Coverage()
        {
            var manager = new DvlProjectManager();
            string validDvlPath = Path.Combine(Path.GetTempPath(), $"valid_{Guid.NewGuid():N}.dvl");
            string textPath = Path.Combine(Path.GetTempPath(), $"invalid_{Guid.NewGuid():N}.txt");

            // SaveToFile parameter guards
            Assert.Throws<ArgumentNullException>(() => manager.SaveToFile(null!, validDvlPath));
            var legacyProj = new DvlProjectFile { FormatVersion = "1.0" };
            Assert.Throws<ArgumentException>(() => manager.SaveToFile(legacyProj, validDvlPath));

            // SaveJsonToFile path validation
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("{}", ""));
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("{}", "   "));
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("{}", textPath));

            // ValidateJsonForSave envelope guards
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("", validDvlPath));
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("   ", validDvlPath));
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("[]", validDvlPath));
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile("{\"unrelated\": 123}", validDvlPath));

            // Legacy DVL JSON with completeStateSha256 rejected
            string legacyTampered = "{\"formatVersion\": \"1.0\", \"sourceXml\": {}, \"integrity\": {\"completeStateSha256\": \"" + new string('a', 64) + "\"}}";
            Assert.Throws<ArgumentException>(() => manager.SaveJsonToFile(legacyTampered, validDvlPath));

            // Legacy DVL JSON valid save
            string legacyValid = "{\"formatVersion\": \"1.0\", \"sourceXml\": {}, \"sqItems\": []}";
            manager.SaveJsonToFile(legacyValid, validDvlPath);
            Assert.True(File.Exists(validDvlPath));
            File.Delete(validDvlPath);

            // LoadFromFile non-existent file
            Assert.Throws<FileNotFoundException>(() => manager.LoadFromFile(Path.Combine(Path.GetTempPath(), $"missing_{Guid.NewGuid():N}.dvl")));

            // Create a valid v2 project
            var bundle = new RulePackManager().LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));
            var project = manager.CreateProject(
                new NormalizedXmlGraph(),
                new Dictionary<string, Fact>(),
                new List<SpecialQuote>(),
                new List<ChecklistInstance>(),
                "<Config />",
                bundle);

            // ValidateV2ProjectForSave guards
            var missingRulePack = JsonSerializer.Deserialize<DvlProjectFile>(JsonSerializer.Serialize(project, JsonDefaults.CreateFlexibleOptions()), JsonDefaults.CreateFlexibleOptions())!;
            missingRulePack.RulePack = null!;
            Assert.Throws<ArgumentException>(() => manager.SaveToFile(missingRulePack, validDvlPath));

            var missingSourceXml = JsonSerializer.Deserialize<DvlProjectFile>(JsonSerializer.Serialize(project, JsonDefaults.CreateFlexibleOptions()), JsonDefaults.CreateFlexibleOptions())!;
            missingSourceXml.SourceXml = null!;
            Assert.Throws<ArgumentException>(() => manager.SaveToFile(missingSourceXml, validDvlPath));

            var tamperedSourceXml = JsonSerializer.Deserialize<DvlProjectFile>(JsonSerializer.Serialize(project, JsonDefaults.CreateFlexibleOptions()), JsonDefaults.CreateFlexibleOptions())!;
            tamperedSourceXml.SourceXml.RawXml = "<Config modified=\"true\" />";
            Assert.Throws<ArgumentException>(() => manager.SaveToFile(tamperedSourceXml, validDvlPath));

            var tamperedCompleteState = JsonSerializer.Deserialize<DvlProjectFile>(JsonSerializer.Serialize(project, JsonDefaults.CreateFlexibleOptions()), JsonDefaults.CreateFlexibleOptions())!;
            tamperedCompleteState.Integrity.CompleteStateSha256 = new string('f', 64);
            Assert.Throws<ArgumentException>(() => manager.SaveToFile(tamperedCompleteState, validDvlPath));

            // ValidateIntegrity detection of problems
            var integrityResult = manager.ValidateIntegrity(tamperedSourceXml);
            Assert.False(integrityResult.IsVerified);
            Assert.NotNull(integrityResult.Message);
            Assert.Contains("embedded Config.xml hash", integrityResult.Message);

            var activeRulePackMismatch = new RulePackInfo
            {
                Version = "99.0.0",
                Sha256 = new string('0', 64)
            };
            var mismatchResult = manager.ValidateIntegrity(project, activeRulePackMismatch);
            Assert.NotNull(mismatchResult.Message);
            Assert.Contains("pinned to Rule Pack", mismatchResult.Message);
        }
    }
}
