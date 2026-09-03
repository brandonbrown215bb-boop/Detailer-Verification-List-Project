using System;
using System.IO;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;
using Xunit;

namespace AHUVerification.Tests
{
    public class UpzExtractorTests
    {
        private static string SampleUpzPath => TestPathHelper.GetFixturePath("UPZ_Unit_Examples/6E-060036-04.upz");

        [Fact]
        public void Extract_ValidUpz_ExtractsXmlsAndParsesMetadata()
        {
            if (!File.Exists(SampleUpzPath))
            {
                // Skip if sample UPZ is absent in environment
                return;
            }

            var extractor = new UpzBundleExtractor();
            var bundle = extractor.Extract(SampleUpzPath);

            Assert.NotNull(bundle);
            Assert.False(string.IsNullOrWhiteSpace(bundle.RawConfigXml));
            Assert.False(string.IsNullOrWhiteSpace(bundle.RawOrderRevXml));
            Assert.False(string.IsNullOrWhiteSpace(bundle.RawManifestXml));

            // Verify OrderRevision parsing
            Assert.NotNull(bundle.OrderRevision);
            Assert.False(string.IsNullOrWhiteSpace(bundle.OrderRevision.JobName));
            Assert.False(string.IsNullOrWhiteSpace(bundle.OrderRevision.OrderNumber));
            Assert.Equal("SolutionYC", bundle.OrderRevision.ProductType);

            // Verify FactExtractor integration
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(bundle.RawConfigXml);
            var factExtractor = new FactExtractor();
            var facts = factExtractor.ExtractFacts(graph, bundle.OrderRevision);

            Assert.Equal(bundle.OrderRevision.JobName, facts["unit.jobName"].Value);
            Assert.Equal(FactStatus.Known, facts["unit.jobName"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.jobName"].Confidence);

            Assert.True(facts.ContainsKey("unit.orderNumber"));
            Assert.Equal(bundle.OrderRevision.OrderNumber, facts["unit.orderNumber"].Value);
            Assert.Equal(FactStatus.Known, facts["unit.orderNumber"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.orderNumber"].Confidence);

            // COM # remains manual entry
            Assert.Null(facts["unit.comNumber"].Value);
            Assert.Equal("Enter COM# from MAPICS (e.g. COM-123456)", facts["unit.comNumber"].PromptNote);

            Assert.True(facts.ContainsKey("unit.tag"));
            Assert.Equal(FactStatus.Known, facts["unit.tag"].Status);
            Assert.Equal(FactConfidence.Authoritative, facts["unit.tag"].Confidence);

            Assert.True(facts.ContainsKey("unit.productType"));
            Assert.Equal("SolutionYC", facts["unit.productType"].Value);

            // Assert removed fields are not present
            Assert.False(facts.ContainsKey("unit.quantity"));
            Assert.False(facts.ContainsKey("unit.revisionDate"));
            Assert.False(facts.ContainsKey("unit.salesEngineer"));
        }

        [Fact]
        public void OrderRevParser_DirectXml_ParsesCorrectly()
        {
            string sampleXml = @"<root:OrderRevision xmlns:root=""http://schemas.airside.be.jci.com/AHU/OrderRevision"">
  <productType>SolutionYC</productType>
  <jobName>Test Hospital Tower B</jobName>
  <orderNumber>8E-123456-01</orderNumber>
  <lineNumber>2</lineNumber>
  <projectName>Test Hospital Tower B</projectName>
  <projectID>{11111111-2222-3333-4444-555555555555}</projectID>
  <baseSQOrderNumber>SQ-999</baseSQOrderNumber>
  <quantity>3</quantity>
  <tagList>
    <tag>AHU-01</tag>
    <tag>AHU-02</tag>
  </tagList>
</root:OrderRevision>";

            var parser = new OrderRevParser();
            var data = parser.Parse(sampleXml);

            Assert.Equal("SolutionYC", data.ProductType);
            Assert.Equal("Test Hospital Tower B", data.JobName);
            Assert.Equal("8E-123456-01", data.OrderNumber);
            Assert.Equal(2, data.LineNumber);
            Assert.Equal("SQ-999", data.BaseSQOrderNumber);
            Assert.Equal("AHU-01", data.PrimaryTag);
            Assert.Equal(2, data.TagList.Count);
        }
    }
}
