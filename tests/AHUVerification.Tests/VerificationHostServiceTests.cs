using System;
using System.Collections.Generic;
using System.IO;
using Xunit;
using AHUVerification.Core.Services;
using AHUVerification.Core.Models;

namespace AHUVerification.Tests
{
    public class VerificationHostServiceTests
    {
        [Fact]
        public void VerifySource_ValidXml_ReturnsReadyForFinal()
        {
            var service = new VerificationHostService();
            string configXml = @"<?xml version=""1.0""?><root><unitWeight>1000</unitWeight><totalStaticPressure>1</totalStaticPressure><unitOptions><unitType>Outdoor</unitType><unitConstructionType>Standard</unitConstructionType><knockdown>false</knockdown><defaultUnitBaseHeight>10</defaultUnitBaseHeight><defaultConstructionOptions><housingStyle>Standard</housingStyle><exteriorMaterialType>STL</exteriorMaterialType><interiorMaterialType>STL</interiorMaterialType><floorMaterialType>STL</floorMaterialType><insulationType>Foam</insulationType><exteriorMaterialGauge>18</exteriorMaterialGauge><interiorMaterialGauge>22</interiorMaterialGauge><floorMaterialGauge>16</floorMaterialGauge><housingThicknessFront>2</housingThicknessFront><housingThicknessTop>2</housingThicknessTop></defaultConstructionOptions></unitOptions><roofOptions><hasSlopedRoof>true</hasSlopedRoof><roofSlope>0.25</roofSlope><roofSlopeHighSide>Center</roofSlopeHighSide><roofPeakZDim>50</roofPeakZDim></roofOptions><curbOptions><hasCurbRest>true</hasCurbRest></curbOptions><testingOptions><deflectionTest>None</deflectionTest></testingOptions><unitBaseList><unitBase><geometry><yLength>10</yLength></geometry></unitBase></unitBaseList><openingList></openingList></root>";

            var rules = new List<RuleDefinition>();
            var activePack = new RulePackBundle { Rules = rules, Manifest = new RulePackManifest() };

            var result = service.VerifySource(configXml, null, null, activePack);

            Assert.NotNull(result);
            Assert.NotNull(result.Graph);
            Assert.NotNull(result.Facts);
            Assert.NotNull(result.Checklists);
        }

        [Fact]
        public void RecomputeAndExport_InvalidPath_ThrowsInvalidOperationException()
        {
            var service = new VerificationHostService();
            var activePack = new RulePackBundle { Rules = new List<RuleDefinition>() };

            Assert.Throws<InvalidOperationException>(() =>
                service.RecomputeAndExport("<root/>", null, null, activePack, "relative.xlsx", new Dictionary<string, Fact>(), new List<SpecialQuote>(), new List<ChecklistInstance>(), "", false)
            );
        }
    }
}
