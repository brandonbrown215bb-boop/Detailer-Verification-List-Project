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

        [Fact]
        public void ExtractFacts_SupportsArbitrarySkidsAndCustomSegmentSequencing()
        {
            var graph = new NormalizedXmlGraph
            {
                UnitWeight = 18500,
                TotalStaticPressure = 3.0,
                Dimensions = new UnitDimensions { Length = 360, Width = 96, Height = 108 },
                UnitOptions = new UnitOptions
                {
                    UnitType = "Outdoor",
                    BrandOption = "YORKCustom",
                    UnitConstructionType = "Standard",
                    DefaultUnitBaseHeight = 12,
                    Materials = new MaterialOptions
                    {
                        ExteriorMaterialType = "STL GALV PPC",
                        ExteriorMaterialGauge = 18,
                        InteriorMaterialType = "STL GALV",
                        InteriorMaterialGauge = 22,
                        FloorMaterialType = "STL GALV",
                        FloorMaterialGauge = 16,
                        HousingStyle = "ThermalBreak",
                        InsulationType = "Foam"
                    }
                },
                RoofOptions = new RoofOptions { HasSlopedRoof = true, RoofSlope = 0.25 },
                CurbOptions = new CurbOptions { HasCurbRest = true },
                Skids = new List<ShippingSkid>
                {
                    new ShippingSkid { Id = "skid-1", Index = 1, Name = "Skid 1 (Mixing & Filtration)", SegmentIds = new List<string> { "seg-1", "seg-2" }, BaseIds = new List<string> { "base-1" }, CalculatedWeight = 4200, Dimensions = new SkidDimensions { Length = 96, Width = 96, Height = 108 } },
                    new ShippingSkid { Id = "skid-2", Index = 2, Name = "Skid 2 (Heat Recovery & Coil)", SegmentIds = new List<string> { "seg-3", "seg-4" }, BaseIds = new List<string> { "base-2" }, CalculatedWeight = 6500, Dimensions = new SkidDimensions { Length = 96, Width = 96, Height = 108 } },
                    new ShippingSkid { Id = "skid-3", Index = 3, Name = "Skid 3 (Access & Heating)", SegmentIds = new List<string> { "seg-5", "seg-6" }, BaseIds = new List<string> { "base-3" }, CalculatedWeight = 3200, Dimensions = new SkidDimensions { Length = 66, Width = 96, Height = 108 } },
                    new ShippingSkid { Id = "skid-4", Index = 4, Name = "Skid 4 (Supply Fan Wall)", SegmentIds = new List<string> { "seg-7" }, BaseIds = new List<string> { "base-4" }, CalculatedWeight = 3800, Dimensions = new SkidDimensions { Length = 72, Width = 96, Height = 108 } },
                    new ShippingSkid { Id = "skid-5", Index = 5, Name = "Skid 5 (Silencer & Discharge)", SegmentIds = new List<string> { "seg-8", "seg-9" }, BaseIds = new List<string> { "base-5" }, CalculatedWeight = 3400, Dimensions = new SkidDimensions { Length = 96, Width = 96, Height = 108 } }
                },
                Segments = new List<Segment>
                {
                    new Segment { Id = "seg-1", Tag = "segment_MB", TypeCode = "MB", Name = "Mixing Box", Weight = 2400, Internals = new List<string> { "Damper Wall" } },
                    new Segment { Id = "seg-2", Tag = "segment_AF", TypeCode = "AF", Name = "Angle Filter", Weight = 1800, Internals = new List<string> { "Angle Filter Track" } },
                    new Segment { Id = "seg-3", Tag = "segment_HW", TypeCode = "HW", Name = "Heat Wheel", Weight = 3700, Internals = new List<string> { "Heat Wheel Rotor" } },
                    new Segment { Id = "seg-4", Tag = "segment_CC", TypeCode = "CC", Name = "Cooling Coil", Weight = 2800, Internals = new List<string> { "Coil (Cooling)", "Drain Pan" } },
                    new Segment { Id = "seg-5", Tag = "segment_XA", TypeCode = "XA", Name = "Access Section", Weight = 1000, Internals = new List<string> { "Access Door" } },
                    new Segment { Id = "seg-6", Tag = "segment_HC", TypeCode = "HC", Name = "Heating Coil", Weight = 2200, Internals = new List<string> { "Coil (Heating)" } },
                    new Segment { Id = "seg-7", Tag = "segment_FS", TypeCode = "FS", Name = "Supply Fan", Weight = 3800, Internals = new List<string> { "EBM Fan Wall Array" } },
                    new Segment { Id = "seg-8", Tag = "segment_AT", TypeCode = "AT", Name = "Sound Attenuator", Weight = 2000, Internals = new List<string> { "Acoustic Silencer" } },
                    new Segment { Id = "seg-9", Tag = "segment_DP", TypeCode = "DP", Name = "Discharge Plenum", Weight = 1400, Internals = new List<string>() }
                }
            };

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
