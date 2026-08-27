using System.IO;
using System.Linq;
using Xunit;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class XmlParserTests
    {
        [Fact]
        public void Parse_ValidConfigXml_ExtractsCompleteGraph()
        {
            string xmlPath = TestPathHelper.GetRepoPath("Config.xml");
            Assert.True(File.Exists(xmlPath), $"Config.xml should exist at {xmlPath}");

            string xmlContent = File.ReadAllText(xmlPath);
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            Assert.NotNull(graph);
            Assert.Equal("{00000000-0000-0000-0000-000000000000}", graph.UnitMOMID);
            Assert.Equal(31376, graph.UnitWeight);
            Assert.Equal(6.26, graph.TotalStaticPressure);

            // Dimensions
            Assert.Equal(411, graph.Dimensions.Length);
            Assert.Equal(110, graph.Dimensions.Height);
            Assert.Equal(194, graph.Dimensions.Width);

            // Unit Options
            Assert.Equal("Outdoor", graph.UnitOptions.UnitType);
            Assert.Equal("ThermalBreak", graph.UnitOptions.Materials.HousingStyle);
            Assert.Equal("STL GALV PPC", graph.UnitOptions.Materials.ExteriorMaterialType);
            Assert.Equal(18, graph.UnitOptions.Materials.ExteriorMaterialGauge);
            Assert.Equal("STL GALV", graph.UnitOptions.Materials.InteriorMaterialType);
            Assert.Equal(22, graph.UnitOptions.Materials.InteriorMaterialGauge);
            Assert.Equal("STL GALV", graph.UnitOptions.Materials.FloorMaterialType);
            Assert.Equal(16, graph.UnitOptions.Materials.FloorMaterialGauge);

            // Skids, Bases, Segments, MotorControls
            Assert.Equal(4, graph.Skids.Count);
            Assert.Equal(9, graph.Bases.Count);
            Assert.Equal(24, graph.Segments.Count);
            Assert.Equal(4, graph.MotorControls.Count);

            // Verify Skid Segments
            Assert.True(graph.Skids[0].SegmentIds.Count > 0);
            Assert.True(graph.Skids[0].CalculatedWeight > 0);
            Assert.Null(graph.Skids[0].AuthoritativeWeight); // Strict weight semantics

            // Openings & Doors
            Assert.True(graph.Doors.Count > 0);
            Assert.True(graph.Dampers.Count > 0);
        }

        [Fact]
        public void Parse_OpeningScheduleAndComponents_ExtractsStructuredData()
        {
            string xmlPath = TestPathHelper.GetRepoPath("Config.xml");
            string xmlContent = File.ReadAllText(xmlPath);
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            // Verify Doors
            var door = graph.Doors.FirstOrDefault();
            Assert.NotNull(door);
            Assert.True(door.Width > 0);
            Assert.True(door.Height > 0);

            // Verify Dampers
            var damper = graph.Dampers.FirstOrDefault();
            Assert.NotNull(damper);
            Assert.False(string.IsNullOrEmpty(damper.DamperType));

            // Verify Testing Options
            Assert.NotNull(graph.TestingOptions);

            // Verify Segment Component configs
            var coilSeg = graph.Segments.FirstOrDefault(s => s.CoilConfig != null);
            if (coilSeg != null)
            {
                Assert.NotNull(coilSeg.CoilConfig.BulkheadMaterial);
            }
        }

        [Fact]
        public void Parse_All18UpzExamples_ExtractsWithoutExceptions()
        {
            string upzDir = TestPathHelper.GetRepoPath("UPZ_Unit_Examples");
            if (!Directory.Exists(upzDir)) return;

            var extractor = new UpzBundleExtractor();
            var parser = new NormalizedXmlParser();
            var factExtractor = new FactExtractor();

            foreach (var upzFile in Directory.GetFiles(upzDir, "*.upz"))
            {
                var bundle = extractor.Extract(upzFile);
                Assert.NotNull(bundle);
                Assert.False(string.IsNullOrWhiteSpace(bundle.RawConfigXml));

                var graph = parser.Parse(bundle.RawConfigXml);
                Assert.NotNull(graph);
                Assert.True(graph.Segments.Count > 0);

                var facts = factExtractor.ExtractFacts(graph, bundle.OrderRevision);
                Assert.NotNull(facts);
                Assert.True(facts.ContainsKey("unit.thermalBreak"));
                Assert.True(facts.ContainsKey("unit.noa"));
                Assert.True(facts.ContainsKey("unit.isTiered"));
                Assert.True(facts.ContainsKey("unit.isStacked"));
                Assert.True(facts.ContainsKey("unit.hasFloorDrains"));
            }
        }
    }
}
