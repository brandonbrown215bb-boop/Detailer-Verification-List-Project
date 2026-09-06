using System;
using System.Linq;
using AHUVerification.Core.Manual;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using Xunit;

namespace AHUVerification.Tests
{
    public class ManualUnitFactoryTests
    {
        [Fact]
        public void AvailableSegmentTemplates_ContainsStandardPresets()
        {
            var templates = ManualUnitFactory.AvailableSegmentTemplates;

            Assert.NotEmpty(templates);
            Assert.Contains(templates, t => t.TypeCode == "IP");
            Assert.Contains(templates, t => t.TypeCode == "FS");
            Assert.Contains(templates, t => t.TypeCode == "CC");
            Assert.Contains(templates, t => t.TypeCode == "XA");
            Assert.Contains(templates, t => t.TypeCode == "HW");
            Assert.All(templates, t =>
            {
                Assert.False(string.IsNullOrWhiteSpace(t.Name));
                Assert.False(string.IsNullOrWhiteSpace(t.Category));
                Assert.True(t.DefaultLength > 0);
                Assert.True(t.DefaultWeight > 0);
            });
        }

        [Fact]
        public void Synthesize_DefaultConfig_ProducesValidGraphAndAuthoritativeFacts()
        {
            var factory = new ManualUnitFactory();
            var config = new ManualUnitConfig
            {
                JobName = "Hospital Tower North",
                ComNumber = "COM-987654",
                DetailerName = "Jane Doe",
                UnitType = "Outdoor",
                HousingStyle = "ThermalBreak",
                DefaultUnitWidth = 90,
                DefaultUnitHeight = 100,
                DefaultBaseHeight = 12,
                DefaultWallThickness = 2.5,
                TotalStaticPressure = 3.0,
                SkidCount = 2
            };

            var result = factory.Synthesize(config);

            Assert.NotNull(result);
            Assert.NotNull(result.Graph);
            Assert.Equal(2, result.Graph.Skids.Count);
            Assert.Equal(2, result.Graph.Bases.Count);
            Assert.NotEmpty(result.Graph.Segments);
            Assert.True(result.Graph.Dimensions.Length > 0);
            Assert.Equal(90, result.Graph.Dimensions.Width);
            Assert.Equal(112, result.Graph.Dimensions.Height); // 100 + 12 base
            Assert.Equal(3.0, result.Graph.TotalStaticPressure);

            // Assert authoritative manual facts
            Assert.Equal("Hospital Tower North", result.Facts["unit.jobName"].Value);
            Assert.Equal(FactStatus.ManuallyOverridden, result.Facts["unit.jobName"].Status);
            Assert.Equal(FactConfidence.Authoritative, result.Facts["unit.jobName"].Confidence);

            Assert.Equal("COM-987654", result.Facts["unit.comNumber"].Value);
            Assert.Equal("Jane Doe", result.Facts["unit.detailer"].Value);
            Assert.Equal("Outdoor", result.Facts["unit.unitType"].Value);
            Assert.Equal(2.5, Convert.ToDouble(result.Facts["casing.thicknessFront"].Value));
            Assert.Equal(12.0, Convert.ToDouble(result.Facts["unit.baseHeight"].Value));
            Assert.Equal(3.0, Convert.ToDouble(result.Facts["unit.totalStaticPressure"].Value));

            // Verify manual overrides collection
            Assert.Contains("unit.jobName", result.ManualOverrides.Keys);
            Assert.Contains("unit.comNumber", result.ManualOverrides.Keys);
            Assert.Contains("unit.detailer", result.ManualOverrides.Keys);

            // Verify XML generation
            Assert.False(string.IsNullOrWhiteSpace(result.RawConfigXml));
            Assert.Contains("<AHU>", result.RawConfigXml);
            Assert.Contains("Hospital Tower North", result.RawConfigXml);
            Assert.Contains("<shippingSkidList>", result.RawConfigXml);
            Assert.Contains("<segmentList>", result.RawConfigXml);

            // Verify synthesized XML parses cleanly through NormalizedXmlParser
            var parsedGraph = new NormalizedXmlParser().Parse(result.RawConfigXml);
            Assert.NotNull(parsedGraph);
            Assert.Equal(result.Graph.Skids.Count, parsedGraph.Skids.Count);
            Assert.Equal(result.Graph.Segments.Count, parsedGraph.Segments.Count);
        }

        [Fact]
        public void Synthesize_CustomSkidsAndSegments_MapsCorrectly()
        {
            var factory = new ManualUnitFactory();
            var config = new ManualUnitConfig
            {
                JobName = "Custom 1-Skid AHU",
                ComNumber = "COM-112233",
                DetailerName = "John Smith",
                Skids = new System.Collections.Generic.List<ManualSkidItem>
                {
                    new ManualSkidItem { Id = "skid-main", Index = 1, Name = "Main Skid", BaseHeight = 10, AuthoritativeWeight = 5000, IsWeightConfirmed = true }
                },
                Segments = new System.Collections.Generic.List<ManualSegmentItem>
                {
                    new ManualSegmentItem { Id = "seg-1", TypeCode = "FF", Name = "Pre-Filter", SkidId = "skid-main", Length = 24, Weight = 800 },
                    new ManualSegmentItem { Id = "seg-2", TypeCode = "FS", Name = "Supply Fan", SkidId = "skid-main", Length = 60, Weight = 3200, AirPressureType = "Positive" }
                }
            };

            var result = factory.Synthesize(config);

            Assert.Single(result.Graph.Skids);
            var skid = result.Graph.Skids[0];
            Assert.Equal("skid-main", skid.Id);
            Assert.Equal(2, skid.SegmentIds.Count);
            Assert.Equal(4000, skid.CalculatedWeight); // 800 + 3200
            Assert.Equal(5000, skid.AuthoritativeWeight);
            Assert.True(skid.IsWeightConfirmed);
            Assert.Equal(84, skid.Dimensions.Length); // 24 + 60
        }

        [Fact]
        public void Synthesize_SegmentsWithSpecialCharactersAndAmpersands_ProducesParseableXml()
        {
            var factory = new ManualUnitFactory();
            var config = new ManualUnitConfig
            {
                JobName = "Research & Development <Main Building> \"Phase 2\"",
                ComNumber = "COM-889900",
                DetailerName = "Engineer & Detailer",
                Skids = new System.Collections.Generic.List<ManualSkidItem>
                {
                    new ManualSkidItem { Id = "skid-1", Index = 1, Name = "Skid 1 & 2 Joint", BaseHeight = 12 }
                },
                Segments = new System.Collections.Generic.List<ManualSegmentItem>
                {
                    new ManualSegmentItem
                    {
                        Id = "seg-mb",
                        TypeCode = "MB",
                        Name = "Mixing Box",
                        SkidId = "skid-1",
                        Length = 60,
                        Weight = 2200,
                        Internals = new System.Collections.Generic.List<string>
                        {
                            "Damper Wall (Return & Outside Air)",
                            "Filter Rack <2\" Pre-Filter & 12\" Final>"
                        }
                    }
                }
            };

            var result = factory.Synthesize(config);

            Assert.NotNull(result);
            Assert.False(string.IsNullOrWhiteSpace(result.RawConfigXml));
            Assert.Contains("&amp;", result.RawConfigXml);

            // Verify both standard System.Xml.Linq.XDocument and NormalizedXmlParser parse it cleanly
            var xDoc = System.Xml.Linq.XDocument.Parse(result.RawConfigXml);
            Assert.NotNull(xDoc.Root);
            Assert.Equal("AHU", xDoc.Root.Name.LocalName);
            var featureNodes = xDoc.Descendants("internalFeature").Select(n => n.Value).ToList();
            Assert.Contains(featureNodes, f => f.Contains("Return & Outside Air"));

            var parsedGraph = new NormalizedXmlParser().Parse(result.RawConfigXml);
            Assert.NotNull(parsedGraph);
            Assert.Single(parsedGraph.Segments);
        }

        [Fact]
        public void Synthesize_JobNameAndComWithDoubleHyphens_GeneratesValidXmlComments()
        {
            var factory = new ManualUnitFactory();
            var config = new ManualUnitConfig
            {
                JobName = "North -- South --- Edge--",
                ComNumber = "COM--000000--",
                DetailerName = "Detailer",
                UnitType = "Outdoor"
            };

            var result = factory.Synthesize(config);

            Assert.NotNull(result);
            Assert.False(string.IsNullOrWhiteSpace(result.RawConfigXml));

            // Standard XML specification strictly forbids '--' inside comments
            // Verify System.Xml.Linq.XDocument parses without throwing XmlException
            var xDoc = System.Xml.Linq.XDocument.Parse(result.RawConfigXml);
            Assert.NotNull(xDoc.Root);

            var comment = xDoc.Nodes().OfType<System.Xml.Linq.XComment>().FirstOrDefault();
            Assert.NotNull(comment);
            Assert.DoesNotContain("--", comment.Value);
            Assert.False(comment.Value.EndsWith("-"));

            var parsedGraph = new NormalizedXmlParser().Parse(result.RawConfigXml);
            Assert.NotNull(parsedGraph);
        }
    }
}
