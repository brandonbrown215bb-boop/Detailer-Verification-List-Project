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
            Assert.Equal(true, facts["unit.thermalBreak"].Value);
            Assert.Equal(FactStatus.Derived, facts["unit.thermalBreak"].Status);

            // Derived Facts from Config.xml (unitConstructionType = Standard)
            Assert.True(facts.ContainsKey("unit.isSeismic"));
            Assert.Equal(false, facts["unit.isSeismic"].Value);
            Assert.Equal(FactStatus.Derived, facts["unit.isSeismic"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.isSeismic"].Confidence);

            Assert.True(facts.ContainsKey("unit.noa"));
            Assert.Equal(false, facts["unit.noa"].Value);
            Assert.Equal(FactStatus.Derived, facts["unit.noa"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.noa"].Confidence);

            // Skid Weight is Authoritative (informational)
            Assert.True(facts.ContainsKey("skid.skid-1.weight"));
            Assert.Equal(FactStatus.Derived, facts["skid.skid-1.weight"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["skid.skid-1.weight"].Confidence);
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
            extractor.OverrideFact(facts, "casing.interiorMaterial", "Stainless Steel 304", "Tanner Dean", "Custom corrosive requirement");
            var fact = facts["casing.interiorMaterial"];

            Assert.Equal("Stainless Steel 304", fact.Value);
            Assert.Equal(FactStatus.ManuallyOverridden, fact.Status);
            Assert.Equal(FactConfidence.Authoritative, fact.Confidence);
            Assert.Single(fact.OverrideHistory);
            Assert.Equal("Tanner Dean", fact.OverrideHistory[0].OverriddenBy);
            Assert.Equal("STL GALV", fact.OverrideHistory[0].PreviousValue);

            // Revert
            extractor.RevertFact(facts, "casing.interiorMaterial");
            Assert.Equal("STL GALV", facts["casing.interiorMaterial"].Value);
            Assert.Equal(FactStatus.Known, facts["casing.interiorMaterial"].Status);
        }

        [Fact]
        public void ExtractFacts_SupportsArbitrarySkidsAndCustomSegmentSequencing()
        {
            var graph = TestGraphFactory.CreateStandardMultiSkidGraph();

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            // Verify all 5 skids have extracted facts
            for (int i = 1; i <= 5; i++)
            {
                Assert.True(facts.ContainsKey($"skid.skid-{i}.weight"));
                Assert.True(facts.ContainsKey($"skid.skid-{i}.segmentCount"));
                Assert.True(facts.ContainsKey($"skid.skid-{i}.hasDrainPan"));
                Assert.True(facts.ContainsKey($"skid.skid-{i}.hasFans"));
                Assert.True(facts.ContainsKey($"skid.skid-{i}.hasCoils"));
                Assert.True(facts.ContainsKey($"skid.skid-{i}.hasFilters"));
                Assert.True(facts.ContainsKey($"skid.skid-{i}.hasHeatWheel"));
            }

            // Verify specific skid feature detection based on segment sequence
            Assert.True((bool)facts["skid.skid-1.hasFilters"].Value!);
            Assert.False((bool)facts["skid.skid-1.hasFans"].Value!);

            Assert.True((bool)facts["skid.skid-2.hasHeatWheel"].Value!);
            Assert.True((bool)facts["skid.skid-2.hasCoils"].Value!);
            Assert.True((bool)facts["skid.skid-2.hasDrainPan"].Value!);

            Assert.True((bool)facts["skid.skid-3.hasCoils"].Value!);
            Assert.False((bool)facts["skid.skid-3.hasFans"].Value!);

            Assert.True((bool)facts["skid.skid-4.hasFans"].Value!);
            Assert.False((bool)facts["skid.skid-4.hasCoils"].Value!);

            Assert.False((bool)facts["skid.skid-5.hasFans"].Value!);
        }
    }
}
