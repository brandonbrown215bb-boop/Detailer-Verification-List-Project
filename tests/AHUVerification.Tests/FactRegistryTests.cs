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
            string xmlContent = File.ReadAllText(TestPathHelper.GetFixturePath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            // Missing Facts from Config.xml evaluate to Unknown
            Assert.True(facts.ContainsKey("unit.jobName"));
            Assert.Equal(FactStatus.Unknown, facts["unit.jobName"].Status);
            Assert.Equal(FactConfidence.RequiresConfirmation, facts["unit.jobName"].Confidence);

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

            // Skid Weight is Authoritative from engineering segment weights
            Assert.True(facts.ContainsKey("skid.skid-1.weight"));
            var skid1Weight = facts["skid.skid-1.weight"];
            Assert.Equal(FactStatus.Derived, skid1Weight.Status);
            Assert.Equal(FactConfidence.Authoritative, skid1Weight.Confidence);
            Assert.True(System.Convert.ToDouble(skid1Weight.Value) > 0);
            Assert.Equal("Sum of Segment Weights", skid1Weight.DerivationName);
            Assert.Equal("derived", skid1Weight.SourceState);

            // Verify a skid without engineering weight remains Unknown / RequiresConfirmation
            graph.Skids.Add(new ShippingSkid { Id = "skid-empty", Index = 99, Name = "Empty Skid", CalculatedWeight = 0 });
            var factsWithEmpty = extractor.ExtractFacts(graph);
            var emptyWeight = factsWithEmpty["skid.skid-empty.weight"];
            Assert.Equal(FactStatus.Unknown, emptyWeight.Status);
            Assert.Equal(FactConfidence.RequiresConfirmation, emptyWeight.Confidence);
            Assert.Null(emptyWeight.Value);
            Assert.Equal("absent", emptyWeight.SourceState);
            Assert.Contains("Authoritative skid weight is required", emptyWeight.PromptNote);
        }

        [Fact]
        public void OverrideAndRevertFact_MaintainsFullAuditTrail()
        {
            string xmlContent = File.ReadAllText(TestPathHelper.GetFixturePath("Config.xml"));
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

        [Fact]
        public void IsFactContractCovered_WhenCandidateHasAllFacts_ReturnsTrue()
        {
            string baselineJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""string"", ""scope"": ""Unit"" },
                    { ""key"": ""unit.unitType"", ""type"": ""string"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            string candidateJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""string"", ""scope"": ""Unit"" },
                    { ""key"": ""unit.unitType"", ""type"": ""string"", ""scope"": ""Unit"" },
                    { ""key"": ""unit.extra"", ""type"": ""boolean"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            using var baseDoc = System.Text.Json.JsonDocument.Parse(baselineJson);
            using var candDoc = System.Text.Json.JsonDocument.Parse(candidateJson);

            Assert.True(FactContractValidator.IsFactContractCovered(baseDoc.RootElement, candDoc.RootElement));
        }

        [Fact]
        public void IsFactContractCovered_WhenCandidateMissingFact_ReturnsFalse()
        {
            string baselineJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""string"", ""scope"": ""Unit"" },
                    { ""key"": ""unit.unitType"", ""type"": ""string"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            string candidateJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.unitType"", ""type"": ""string"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            using var baseDoc = System.Text.Json.JsonDocument.Parse(baselineJson);
            using var candDoc = System.Text.Json.JsonDocument.Parse(candidateJson);

            Assert.False(FactContractValidator.IsFactContractCovered(baseDoc.RootElement, candDoc.RootElement));
        }

        [Fact]
        public void IsFactContractCovered_WhenTypeMismatch_ReturnsFalse()
        {
            string baselineJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""string"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            string candidateJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""number"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            using var baseDoc = System.Text.Json.JsonDocument.Parse(baselineJson);
            using var candDoc = System.Text.Json.JsonDocument.Parse(candidateJson);

            Assert.False(FactContractValidator.IsFactContractCovered(baseDoc.RootElement, candDoc.RootElement));
        }

        [Fact]
        public void MergeFactContracts_WhenSnapshotMissingFact_AugmentsWithBaselineFacts()
        {
            string baselineJson = @"{
                ""contractVersion"": ""1.1.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""string"", ""scope"": ""Unit"" },
                    { ""key"": ""unit.unitType"", ""type"": ""string"", ""scope"": ""Unit"" }
                ],
                ""patterns"": [
                    { ""key"": ""skid.{id}.weight"", ""type"": ""number"", ""scope"": ""Skid"" }
                ],
                ""legacyAliases"": {
                    ""unit.tool"": ""unit.detailingTool""
                }
            }";

            string snapshotJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.unitType"", ""type"": ""string"", ""scope"": ""Unit"" },
                    { ""key"": ""custom.legacyFact"", ""type"": ""number"", ""scope"": ""Unit"" }
                ],
                ""patterns"": [],
                ""legacyAliases"": {
                    ""legacy.type"": ""unit.unitType""
                }
            }";

            using var baseDoc = System.Text.Json.JsonDocument.Parse(baselineJson);
            using var snapDoc = System.Text.Json.JsonDocument.Parse(snapshotJson);

            var merged = FactContractValidator.MergeFactContracts(baseDoc.RootElement, snapDoc.RootElement);

            // unit.detailingTool should be present and valid
            Assert.True(FactContractValidator.TryGetFactType(merged, "unit.detailingTool", out string type));
            Assert.Equal("string", type);
            Assert.True(FactContractValidator.IsFactValueCompatible(merged, "unit.detailingTool", "CAD"));
            Assert.False(FactContractValidator.IsFactValueCompatible(merged, "unit.detailingTool", 123));

            // custom.legacyFact from snapshot should be preserved
            Assert.True(FactContractValidator.TryGetFactType(merged, "custom.legacyFact", out string customType));
            Assert.Equal("number", customType);

            // Pattern and aliases should be merged
            Assert.True(FactContractValidator.TryGetFactType(merged, "skid.1.weight", out string skidType));
            Assert.Equal("number", skidType);
            Assert.Equal("unit.detailingTool", FactContractValidator.CanonicalizeKey("unit.tool", merged));
            Assert.Equal("unit.unitType", FactContractValidator.CanonicalizeKey("legacy.type", merged));
        }

        [Fact]
        public void MergeFactContracts_WhenOneContractInvalid_ReturnsOther()
        {
            string baselineJson = @"{
                ""contractVersion"": ""1.0.0"",
                ""facts"": [
                    { ""key"": ""unit.detailingTool"", ""type"": ""string"", ""scope"": ""Unit"" }
                ],
                ""patterns"": []
            }";

            using var baseDoc = System.Text.Json.JsonDocument.Parse(baselineJson);
            using var emptyDoc = System.Text.Json.JsonDocument.Parse(@"[]");

            var merged = FactContractValidator.MergeFactContracts(baseDoc.RootElement, emptyDoc.RootElement);
            Assert.True(FactContractValidator.TryGetFactType(merged, "unit.detailingTool", out _));
        }

        [Fact]
        public void ExtractFacts_DerivesUnitTagsAndShellType_ForVariousConfigurations()
        {
            var extractor = new FactExtractor();

            // Config 1: Multi-tunnel, tiered, stacked, standard outdoor housing
            var graph1 = TestGraphFactory.CreateStandardMultiSkidGraph();
            graph1.IsMultiTunnel = true;
            graph1.IsTiered = true;
            graph1.IsStacked = true;
            graph1.UnitOptions.Materials.HousingStyle = "Standard Outdoor";

            var facts1 = extractor.ExtractFacts(graph1);
            Assert.Equal("Tiered, Stacked, Multi-Tunnel", facts1["unit.tags"].Value);
            Assert.Equal("Standard", facts1["unit.shellType"].Value);
            Assert.Equal("ISG", facts1["unit.detailingTool"].Value);
            Assert.True((bool)facts1["unit.isMultiTunnel"].Value!);

            // Config 2: Thermal break housing, no special tags
            var graph2 = TestGraphFactory.CreateStandardMultiSkidGraph();
            graph2.IsMultiTunnel = false;
            graph2.IsTiered = false;
            graph2.IsStacked = false;
            graph2.UnitOptions.Materials.HousingStyle = "ThermalBreak_Custom";

            var facts2 = extractor.ExtractFacts(graph2);
            Assert.Equal("Standard", facts2["unit.tags"].Value);
            Assert.Equal("ThermalBreak", facts2["unit.shellType"].Value);

            // Config 3: Empty housing style
            var graph3 = TestGraphFactory.CreateStandardMultiSkidGraph();
            graph3.UnitOptions.Materials.HousingStyle = "";
            var facts3 = extractor.ExtractFacts(graph3);
            Assert.Equal("ThermalBreak", facts3["unit.shellType"].Value);
        }

        [Fact]
        public void OverrideAndRevertFact_SyncsUnitTagsProperly()
        {
            var extractor = new FactExtractor();
            var graph = TestGraphFactory.CreateStandardMultiSkidGraph();
            graph.IsTiered = false;
            graph.IsStacked = false;
            graph.IsMultiTunnel = false;

            var facts = extractor.ExtractFacts(graph);
            Assert.Equal("Standard", facts["unit.tags"].Value);

            // Override tiered
            extractor.OverrideFact(facts, "unit.isTiered", true);
            Assert.Equal("Tiered", facts["unit.tags"].Value);

            // Override stacked with string "Yes"
            extractor.OverrideFact(facts, "unit.isStacked", "Yes");
            Assert.Equal("Tiered, Stacked", facts["unit.tags"].Value);

            // Override multi-tunnel with string "True"
            extractor.OverrideFact(facts, "unit.isMultiTunnel", "True");
            Assert.Equal("Tiered, Stacked, Multi-Tunnel", facts["unit.tags"].Value);

            // Override unit.tags directly -> becomes ManuallyOverridden
            extractor.OverrideFact(facts, "unit.tags", "CustomTag");
            Assert.Equal("CustomTag", facts["unit.tags"].Value);
            Assert.Equal(FactStatus.ManuallyOverridden, facts["unit.tags"].Status);

            // Now overriding unit.isTiered should NOT overwrite CustomTag
            extractor.OverrideFact(facts, "unit.isTiered", false);
            Assert.Equal("CustomTag", facts["unit.tags"].Value);

            // Revert unit.tags -> returns to Derived status
            extractor.RevertFact(facts, "unit.tags");
            Assert.Equal(FactStatus.Derived, facts["unit.tags"].Status);

            // Revert the others
            extractor.RevertFact(facts, "unit.isTiered");
            extractor.RevertFact(facts, "unit.isStacked");
            extractor.RevertFact(facts, "unit.isMultiTunnel");
            Assert.Equal("Standard", facts["unit.tags"].Value);
        }
    }
}
