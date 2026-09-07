using System;
using System.Collections.Generic;
using System.IO;
using Xunit;
using AHUVerification.Core.Services;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;

namespace AHUVerification.Tests
{
    public class VerificationHostServiceTests
    {
        [Fact]
        public void VerifySource_ValidXml_Trusted_ReturnsReadyForFinal()
        {
            var service = new VerificationHostService();
            string configXml = @"<?xml version=""1.0""?><root><unitWeight>1000</unitWeight><totalStaticPressure>1</totalStaticPressure><unitOptions><unitType>Outdoor</unitType><unitConstructionType>Standard</unitConstructionType><knockdown>false</knockdown><defaultUnitBaseHeight>10</defaultUnitBaseHeight><defaultConstructionOptions><housingStyle>Standard</housingStyle><exteriorMaterialType>STL</exteriorMaterialType><interiorMaterialType>STL</interiorMaterialType><floorMaterialType>STL</floorMaterialType><insulationType>Foam</insulationType><exteriorMaterialGauge>18</exteriorMaterialGauge><interiorMaterialGauge>22</interiorMaterialGauge><floorMaterialGauge>16</floorMaterialGauge><housingThicknessFront>2</housingThicknessFront><housingThicknessTop>2</housingThicknessTop></defaultConstructionOptions></unitOptions><roofOptions><hasSlopedRoof>true</hasSlopedRoof><roofSlope>0.25</roofSlope><roofSlopeHighSide>Center</roofSlopeHighSide><roofPeakZDim>50</roofPeakZDim></roofOptions><curbOptions><hasCurbRest>true</hasCurbRest></curbOptions><testingOptions><deflectionTest>None</deflectionTest></testingOptions><unitBaseList><unitBase><geometry><yLength>10</yLength></geometry></unitBase></unitBaseList><openingList></openingList></root>";

            var rules = new List<RuleDefinition>();
            var activePack = new RulePackBundle { Rules = rules, Manifest = new RulePackManifest() };

            var result = service.VerifySource(configXml, null, null, activePack, isTrusted: true);

            Assert.NotNull(result);
            Assert.NotNull(result.Graph);
            Assert.NotNull(result.Facts);
            Assert.NotNull(result.Checklists);
            Assert.True(result.SourceIsTrusted);
            Assert.False(result.IsReadyForFinal);
        }

        [Fact]
        public void VerifySource_UntrustedXml_SourceIsTrustedIsFalse()
        {
            var service = new VerificationHostService();
            string configXml = @"<?xml version=""1.0""?><root/>";
            var rules = new List<RuleDefinition>();
            var activePack = new RulePackBundle { Rules = rules, Manifest = new RulePackManifest() };

            var result = service.VerifySource(configXml, null, null, activePack, isTrusted: false);

            Assert.NotNull(result);
            Assert.False(result.SourceIsTrusted);
            Assert.False(result.IsReadyForFinal);
        }

        [Fact]
        public void VerifySource_InvalidParameters_ThrowsArgumentException()
        {
            var service = new VerificationHostService();
            var validBundle = new RulePackBundle { Rules = new List<RuleDefinition>() };

            Assert.Throws<ArgumentException>(() => service.VerifySource("", null, null, validBundle));
            Assert.Throws<ArgumentException>(() => service.VerifySource("   ", null, null, validBundle));
            Assert.Throws<ArgumentException>(() => service.VerifySource("<root/>", null, null, null!));
            Assert.Throws<ArgumentException>(() => service.VerifySource("<root/>", null, null, new RulePackBundle { Rules = null! }));
        }

        [Fact]
        public void VerifySource_WithOrderRevAndManifest_ParsesSuccessfully()
        {
            var service = new VerificationHostService();
            string configXml = @"<?xml version=""1.0""?><root/>";
            string orderRevXml = @"<?xml version=""1.0""?><OrderRevisionData><RevisionNumber>2</RevisionNumber></OrderRevisionData>";
            string manifestXml = @"<?xml version=""1.0""?><Manifest><Version>1.0.0</Version></Manifest>";
            var activePack = new RulePackBundle { Rules = new List<RuleDefinition>() };

            var result = service.VerifySource(configXml, orderRevXml, manifestXml, activePack, isTrusted: false);

            Assert.NotNull(result);
            Assert.NotNull(result.Facts);
        }

        [Fact]
        public void VerifySource_ManualOverrides_AppliesJsonElementsAndValidates()
        {
            var service = new VerificationHostService();
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            string configXml = File.ReadAllText(TestPathHelper.GetFixturePath("Config.xml"));

            // Valid JsonElements for various value kinds
            using var strDoc = System.Text.Json.JsonDocument.Parse("\"Custom Detailer\"");
            using var boolTrueDoc = System.Text.Json.JsonDocument.Parse("true");
            using var boolFalseDoc = System.Text.Json.JsonDocument.Parse("false");
            using var intDoc = System.Text.Json.JsonDocument.Parse("42");
            using var dblDoc = System.Text.Json.JsonDocument.Parse("12.5");

            var overrides = new Dictionary<string, Fact>(StringComparer.OrdinalIgnoreCase)
            {
                ["unit.detailer"] = new Fact { Value = strDoc.RootElement },
                ["unit.curbrest"] = new Fact { Value = boolTrueDoc.RootElement },
                ["unit.knockdown"] = new Fact { Value = boolFalseDoc.RootElement },
                ["unit.baseHeight"] = new Fact { Value = intDoc.RootElement },
                ["casing.thicknessFront"] = new Fact { Value = dblDoc.RootElement }
            };

            var result = service.VerifySource(configXml, null, null, bundle, manualOverrides: overrides, isTrusted: true);

            Assert.NotNull(result);
            Assert.Equal("Custom Detailer", result.Facts["unit.detailer"].Value);
            Assert.Equal(true, result.Facts["unit.curbrest"].Value);
            Assert.Equal(false, result.Facts["unit.knockdown"].Value);
            Assert.Equal(42L, result.Facts["unit.baseHeight"].Value);
            Assert.Equal(12.5, (double)result.Facts["casing.thicknessFront"].Value!);

            // Test unregistered fact override
            var badFactOverrides = new Dictionary<string, Fact>
            {
                ["unregistered.fact.name"] = new Fact { Value = "value" }
            };
            Assert.Throws<ArgumentException>(() =>
                service.VerifySource(configXml, null, null, bundle, manualOverrides: badFactOverrides));

            // Test null value override
            var nullValOverrides = new Dictionary<string, Fact>
            {
                ["unit.detailer"] = new Fact { Value = null }
            };
            Assert.Throws<ArgumentException>(() =>
                service.VerifySource(configXml, null, null, bundle, manualOverrides: nullValOverrides));

            // Test incompatible type override
            var incompatibleOverrides = new Dictionary<string, Fact>
            {
                ["unit.curbrest"] = new Fact { Value = "NotABoolean" }
            };
            Assert.Throws<ArgumentException>(() =>
                service.VerifySource(configXml, null, null, bundle, manualOverrides: incompatibleOverrides));
        }

        [Fact]
        public void VerifySource_AllChecksCompletedAndTrusted_ReturnsReadyForFinalTrue()
        {
            var service = new VerificationHostService();
            string configXml = @"<?xml version=""1.0""?><root/>";

            var rule1 = new RuleDefinition { Id = "R1", SemanticKey = "R1", Scope = RuleScope.Unit, AllowNA = false, RequiredFacts = new List<string>() };
            var rule2 = new RuleDefinition { Id = "R2", SemanticKey = "R2", Scope = RuleScope.Unit, AllowNA = true, RequiredFacts = new List<string>() };
            using var pred3Doc = System.Text.Json.JsonDocument.Parse(@"{""==="": [1, 2]}");
            var rule3 = new RuleDefinition
            {
                Id = "R3",
                SemanticKey = "R3",
                Scope = RuleScope.Unit,
                AllowNA = false,
                RequiredFacts = new List<string>(),
                Predicate = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(pred3Doc.RootElement.GetRawText())
            };

            var activePack = new RulePackBundle
            {
                Rules = new List<RuleDefinition> { rule1, rule2, rule3 }
            };

            var existingChecklists = new List<ChecklistInstance>
            {
                new ChecklistInstance
                {
                    RuleId = "R1",
                    SemanticKey = "R1",
                    InstanceKey = "unit:R1",
                    Applicability = RuleApplicability.Applicable,
                    Status = CheckStatus.Passed,
                    SemanticFingerprint = AstRuleEvaluator.ComputeSemanticFingerprint(rule1)
                },
                new ChecklistInstance
                {
                    RuleId = "R2",
                    SemanticKey = "R2",
                    InstanceKey = "unit:R2",
                    Applicability = RuleApplicability.Applicable,
                    Status = CheckStatus.NA,
                    SemanticFingerprint = AstRuleEvaluator.ComputeSemanticFingerprint(rule2)
                },
                new ChecklistInstance
                {
                    RuleId = "R3",
                    SemanticKey = "R3",
                    InstanceKey = "unit:R3",
                    Applicability = RuleApplicability.NotApplicable,
                    Status = CheckStatus.NA,
                    SemanticFingerprint = AstRuleEvaluator.ComputeSemanticFingerprint(rule3)
                }
            };

            var initialFacts = new FactExtractor().ExtractFacts(new NormalizedXmlParser().Parse(configXml));
            var overrides = new Dictionary<string, Fact>(StringComparer.OrdinalIgnoreCase);
            foreach (var fact in initialFacts.Values.Where(f => f.Status == FactStatus.Unknown || f.Confidence == FactConfidence.RequiresConfirmation))
            {
                overrides[fact.Key] = new Fact { Value = "Confirmed" };
            }

            var sqItems = new List<SpecialQuote>
            {
                new SpecialQuote { Slot = 1, Id = "SQ-1", IsCompleted = true }
            };

            var result = service.VerifySource(
                configXml,
                null,
                null,
                activePack,
                manualOverrides: overrides,
                sqItems: sqItems,
                existingChecklists: existingChecklists,
                isTrusted: true
            );

            Assert.NotNull(result);
            Assert.True(result.SourceIsTrusted);
            Assert.Equal(0, result.UnconfirmedFactsCount);
            Assert.Equal(0, result.BlockedChecksCount);
            Assert.Equal(0, result.IncompleteSpecialQuotesCount);
            Assert.True(result.IsReadyForFinal);
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

        [Fact]
        public void RecomputeAndExport_ManualUnitDraft_Succeeds()
        {
            var service = new VerificationHostService();
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            string outputPath = Path.Combine(Path.GetTempPath(), $"Manual_Draft_{Guid.NewGuid():N}.xlsx");
            try
            {
                service.RecomputeAndExport(
                    configXml: "",
                    orderRevXml: null,
                    manifestXml: null,
                    activePack: bundle,
                    targetXlsxPath: outputPath,
                    rendererFacts: new Dictionary<string, Fact>(),
                    sqItems: new List<SpecialQuote>(),
                    userChecklists: new List<ChecklistInstance>(),
                    generalComments: "Draft authoring comments",
                    isDraft: true
                );

                Assert.True(File.Exists(outputPath));
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }

        [Fact]
        public void RecomputeAndExport_ManualUnitNonDraft_ThrowsInvalidOperationException()
        {
            var service = new VerificationHostService();
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            string outputPath = Path.Combine(Path.GetTempPath(), $"Manual_Final_{Guid.NewGuid():N}.xlsx");

            Assert.Throws<InvalidOperationException>(() =>
                service.RecomputeAndExport(
                    configXml: "",
                    orderRevXml: null,
                    manifestXml: null,
                    activePack: bundle,
                    targetXlsxPath: outputPath,
                    rendererFacts: new Dictionary<string, Fact>(),
                    sqItems: new List<SpecialQuote>(),
                    userChecklists: new List<ChecklistInstance>(),
                    generalComments: "",
                    isDraft: false
                )
            );
        }

        [Fact]
        public void RecomputeAndExport_FinalExport_NotReadyForFinal_ThrowsInvalidOperationException()
        {
            var service = new VerificationHostService();
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            string configXml = @"<?xml version=""1.0""?><root/>";
            string outputPath = Path.Combine(Path.GetTempPath(), $"Unverified_Final_{Guid.NewGuid():N}.xlsx");

            Assert.Throws<InvalidOperationException>(() =>
                service.RecomputeAndExport(
                    configXml: configXml,
                    orderRevXml: null,
                    manifestXml: null,
                    activePack: bundle,
                    targetXlsxPath: outputPath,
                    rendererFacts: new Dictionary<string, Fact>(),
                    sqItems: new List<SpecialQuote>(),
                    userChecklists: new List<ChecklistInstance>(),
                    generalComments: "",
                    isDraft: false
                )
            );
        }
    }
}
