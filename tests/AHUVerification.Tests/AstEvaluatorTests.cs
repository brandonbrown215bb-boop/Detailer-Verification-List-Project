using System.IO;
using System.Linq;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class AstEvaluatorTests
    {
        [Fact]
        public void EvaluateChecklists_EnforcesStrictWeightAndFactCompleteness()
        {
            string xmlContent = File.ReadAllText(TestPathHelper.GetRepoPath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            string rulePackDir = TestPathHelper.GetRepoPath("src/rulepack");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(rulePackDir);

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            Assert.NotEmpty(checklists);

            // BASE-01 requires skid.weight. Since skid.weight is RequiresConfirmation, it MUST evaluate to NeedsInput!
            var base01_skid1 = checklists.FirstOrDefault(c => c.InstanceKey == "skid-1:BASE-01");
            Assert.NotNull(base01_skid1);
            Assert.Equal(RuleApplicability.NeedsInput, base01_skid1.Applicability);

            // Now confirm/override skid-1 weight
            extractor.OverrideFact(facts, "skid.skid-1.weight", 6500.0, "Detailer", "Confirmed from scale calculation");
            var reChecklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts, checklists);

            var base01_skid1_updated = reChecklists.FirstOrDefault(c => c.InstanceKey == "skid-1:BASE-01");
            Assert.NotNull(base01_skid1_updated);
            Assert.Equal(RuleApplicability.Applicable, base01_skid1_updated.Applicability);

            // HOUS-21 (Thermal break == 'Yes') should be Applicable
            var hous21 = reChecklists.FirstOrDefault(c => c.InstanceKey == "unit:HOUS-21");
            Assert.NotNull(hous21);
            Assert.Equal(RuleApplicability.Applicable, hous21.Applicability);
        }
    }
}
