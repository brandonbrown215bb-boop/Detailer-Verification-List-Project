using System.Collections.Generic;
using System.IO;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class DvlProjectTests
    {
        [Fact]
        public void DvlProject_RoundtripSerialization_PreservesAllData()
        {
            string xmlContent = File.ReadAllText(TestPathHelper.GetRepoPath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("src/rulepack"));

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            var sqItems = new List<SpecialQuote>
            {
                new SpecialQuote { Slot = 1, Id = "sq-1", Text = "Custom 3.5\" drain pan depth", LinkedSkidId = "skid-1", Initials = "TD", IsCompleted = true },
                new SpecialQuote { Slot = 2, Id = "sq-2", Text = "Dual EBM fan wall with disconnects", LinkedSkidId = "skid-2", Initials = "TD", IsCompleted = false }
            };

            var projectManager = new DvlProjectManager();
            var project = projectManager.CreateProject(graph, facts, sqItems, checklists, xmlContent, "General comment test");

            string tempFile = Path.Combine(Path.GetTempPath(), "test_roundtrip.dvl");
            try
            {
                projectManager.SaveToFile(project, tempFile);
                Assert.True(File.Exists(tempFile));

                var loaded = projectManager.LoadFromFile(tempFile);
                Assert.Equal(project.JobName, loaded.JobName);
                Assert.Equal(project.ComNumber, loaded.ComNumber);
                Assert.Equal(project.SourceXml.FileSha256, loaded.SourceXml.FileSha256);
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
    }
}
