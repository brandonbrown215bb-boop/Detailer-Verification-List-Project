using System.IO;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class FactRegistryTests
    {
        [Fact]
        public void ExtractFacts_PreservesProvenanceAndStrictWeightSemantics()
        {
            string xmlContent = File.ReadAllText(TestPathHelper.GetRepoPath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            // Authoritative Known Facts
            Assert.True(facts.ContainsKey("unit.jobName"));
            Assert.Equal(FactStatus.Known, facts["unit.jobName"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.jobName"].Confidence);

            // Derived Facts
            Assert.True(facts.ContainsKey("unit.thermalBreak"));
            Assert.Equal("Yes", facts["unit.thermalBreak"].Value);
            Assert.Equal(FactStatus.Derived, facts["unit.thermalBreak"].Status);

            // Derived Facts from Config.xml (unitConstructionType = Standard)
            Assert.True(facts.ContainsKey("unit.isSeismic"));
            Assert.Equal(false, facts["unit.isSeismic"].Value);
            Assert.Equal(FactStatus.Derived, facts["unit.isSeismic"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.isSeismic"].Confidence);

            Assert.True(facts.ContainsKey("unit.noa"));
            Assert.Equal("N/A", facts["unit.noa"].Value);
            Assert.Equal(FactStatus.Derived, facts["unit.noa"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.noa"].Confidence);

            // Strict Skid Weight Semantics
            Assert.True(facts.ContainsKey("skid.skid-1.weight"));
            Assert.Equal(FactStatus.Derived, facts["skid.skid-1.weight"].Status);
            Assert.Equal(FactConfidence.RequiresConfirmation, facts["skid.skid-1.weight"].Confidence);
        }

        [Fact]
        public void OverrideAndRevertFact_MaintainsFullAuditTrail()
        {
            string xmlContent = File.ReadAllText(TestPathHelper.GetRepoPath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            // Override
            extractor.OverrideFact(facts, "unit.linerMaterial", "Stainless Steel 304", "Tanner Dean", "Custom corrosive requirement");
            var fact = facts["unit.linerMaterial"];

            Assert.Equal("Stainless Steel 304", fact.Value);
            Assert.Equal(FactStatus.ManuallyOverridden, fact.Status);
            Assert.Equal(FactConfidence.Authoritative, fact.Confidence);
            Assert.Single(fact.OverrideHistory);
            Assert.Equal("Tanner Dean", fact.OverrideHistory[0].OverriddenBy);
            Assert.Equal("STL GALV", fact.OverrideHistory[0].PreviousValue);

            // Revert
            extractor.RevertFact(facts, "unit.linerMaterial");
            Assert.Equal("STL GALV", facts["unit.linerMaterial"].Value);
            Assert.Equal(FactStatus.Known, facts["unit.linerMaterial"].Status);
        }
    }
}
