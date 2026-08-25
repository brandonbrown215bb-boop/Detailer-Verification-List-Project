using System.IO;
using System.Linq;
using Xunit;
using AHUVerification.Core.Parsers;

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
        }
    }
}
