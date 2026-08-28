using System.Collections.Generic;
using System.IO;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;
using AHUVerification.Core.Utils;

namespace AHUVerification.Tests
{
    public class TestPipelineContext
    {
        public string XmlContent { get; set; } = "";
        public NormalizedXmlGraph Graph { get; set; } = new();
        public Dictionary<string, Fact> Facts { get; set; } = new();
        public RulePackBundle RulePack { get; set; } = new();
        public List<ChecklistInstance> Checklists { get; set; } = new();

        public static TestPipelineContext CreateStandardContext(string xmlFilename = "Config.xml")
        {
            string xmlPath = PathUtils.ResolveRepoPath(xmlFilename);
            string xmlContent = File.ReadAllText(xmlPath);

            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            string rulePackDir = PathUtils.ResolveRepoPath("resources/rulepack");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(rulePackDir);

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            return new TestPipelineContext
            {
                XmlContent = xmlContent,
                Graph = graph,
                Facts = facts,
                RulePack = bundle,
                Checklists = checklists
            };
        }
    }
}

