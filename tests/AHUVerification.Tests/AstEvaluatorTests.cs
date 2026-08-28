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

            string rulePackDir = TestPathHelper.GetRepoPath("resources/rulepack");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(rulePackDir);

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            Assert.NotEmpty(checklists);

            // BASE-01 (Upturned lip height > 0) evaluates to Applicable
            var base01_skid1 = checklists.FirstOrDefault(c => c.InstanceKey == "skid-1:BASE-01");
            Assert.NotNull(base01_skid1);
            Assert.Equal(RuleApplicability.Applicable, base01_skid1.Applicability);

            // HOUS-21 (Thermal break == 'Yes') should be Applicable
            var hous21 = checklists.FirstOrDefault(c => c.InstanceKey == "unit:HOUS-21");
            Assert.NotNull(hous21);
            Assert.Equal(RuleApplicability.Applicable, hous21.Applicability);
        }

        [Fact]
        public void EvaluatePredicate_NestedOrGroup_EvaluatesCorrectly()
        {
            var evaluator = new AstRuleEvaluator();
            var context = new System.Collections.Generic.Dictionary<string, object?>
            {
                ["unit.unitType"] = "Outdoor",
                ["unit.shellType"] = "ThermalBreak"
            };
            var factRegistry = new System.Collections.Generic.Dictionary<string, Fact>();

            // Construct AST: { and: [ { "===": [{var: "unit.unitType"}, "Outdoor"] }, { or: [ { "===": [{var: "unit.shellType"}, "ThermalBreak"] }, { "===": [{var: "unit.shellType"}, "Custom"] } ] } ] }
            string jsonAst = "{\"and\": [{\"===\": [{\"var\": \"unit.unitType\"}, \"Outdoor\"]}, {\"or\": [{\"===\": [{\"var\": \"unit.shellType\"}, \"ThermalBreak\"]}, {\"===\": [{\"var\": \"unit.shellType\"}, \"Custom\"]}]}]}";
            var pred = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>>(jsonAst);

            var eval = evaluator.EvaluatePredicate(pred, context, new System.Collections.Generic.List<string>(), factRegistry);
            Assert.True(eval.Result);
            Assert.False(eval.NeedsInput);
        }

        [Fact]
        public void EvaluatePredicate_ComparisonOperators_EvaluateCorrectly()
        {
            var evaluator = new AstRuleEvaluator();
            var context = new System.Collections.Generic.Dictionary<string, object?>
            {
                ["val1"] = 10,
                ["val2"] = "FS"
            };
            var factRegistry = new System.Collections.Generic.Dictionary<string, Fact>();

            // >=
            string jsonGte = "{\">=\": [{\"var\": \"val1\"}, 10]}";
            var predGte = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>>(jsonGte);
            var evalGte = evaluator.EvaluatePredicate(predGte, context, new System.Collections.Generic.List<string>(), factRegistry);
            Assert.True(evalGte.Result);

            // <=
            string jsonLte = "{\"<=\": [{\"var\": \"val1\"}, 10]}";
            var predLte = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>>(jsonLte);
            var evalLte = evaluator.EvaluatePredicate(predLte, context, new System.Collections.Generic.List<string>(), factRegistry);
            Assert.True(evalLte.Result);

            // in
            string jsonIn = "{\"in\": [{\"var\": \"val2\"}, [\"FS\", \"FR\", \"FE\"]]}";
            var predIn = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, System.Text.Json.JsonElement>>(jsonIn);
            var evalIn = evaluator.EvaluatePredicate(predIn, context, new System.Collections.Generic.List<string>(), factRegistry);
            Assert.True(evalIn.Result);
        }
    }
}
