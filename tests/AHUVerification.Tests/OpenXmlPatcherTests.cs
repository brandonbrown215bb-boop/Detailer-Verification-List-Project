using System.Collections.Generic;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Validation;
using Xunit;
using AHUVerification.Core.Models;
using AHUVerification.Core.Parsers;
using AHUVerification.Core.Services;

namespace AHUVerification.Tests
{
    public class OpenXmlPatcherTests
    {
        [Fact]
        public void PatchTemplate_GeneratesDynamicDeliverableWithoutNARowsAndAdaptsCategorySheets()
        {
            string templatePath = TestPathHelper.GetRepoPath("Detailing Verification List.xlsx");
            Assert.True(File.Exists(templatePath), $"Template file should exist at {templatePath}");

            string xmlContent = File.ReadAllText(TestPathHelper.GetFixturePath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);
            extractor.OverrideFact(facts, "unit.detailer", "Tanner Dean", "Test", "Test");
            extractor.OverrideFact(facts, "unit.comNumber", "COM-842910", "Test", "Test");
            extractor.OverrideFact(facts, "unit.jobName", "Medical Center Phase 3", "Test", "Test");

            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            // Mark some applicable checks as Passed with comments
            var applicableChecks = checklists.Where(c => c.Applicability == RuleApplicability.Applicable).ToList();
            Assert.NotEmpty(applicableChecks);

            foreach (var c in applicableChecks.Take(5))
            {
                c.Status = CheckStatus.Passed;
                c.DetailerComment = "Verified in CAD model.";
            }

            var needsInputCheck = applicableChecks.Skip(5).FirstOrDefault();
            if (needsInputCheck != null)
            {
                needsInputCheck.Applicability = RuleApplicability.NeedsInput;
                needsInputCheck.Status = CheckStatus.NeedsInput;
            }

            var sqItems = new List<SpecialQuote>
            {
                new SpecialQuote { Slot = 1, Id = "sq-1", Text = "Custom drain pan depth 3.5 in. with copper downspout connection", LinkedSkidId = "skid-3", Initials = "TD", IsCompleted = true },
                new SpecialQuote { Slot = 2, Id = "sq-2", Text = "Dual 630 EBM Fan Wall array with individual disconnects", LinkedSkidId = "skid-4", Initials = "TD", IsCompleted = false }
            };

            string outputPath = Path.Combine(Path.GetTempPath(), $"Dynamic_Deliverable_{System.Guid.NewGuid():N}.xlsx");
            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(
                    templatePath,
                    outputPath,
                    bundle.TemplateMap,
                    facts,
                    sqItems,
                    checklists,
                    bundle.Rules,
                    "General verification audit comments.",
                    isDraft: false,
                    graph: graph
                );

                Assert.True(File.Exists(outputPath));

                // 1. OpenXmlValidator Verification: 0 schema errors
                using (var doc = SpreadsheetDocument.Open(outputPath, false))
                {
                    var validator = new OpenXmlValidator();
                    var schemaErrors = validator.Validate(doc)
                        .Where(e => !e.Description.Contains("shapeId", System.StringComparison.OrdinalIgnoreCase))
                        .ToList();
                    Assert.Empty(schemaErrors);

                    var wbPart = doc.WorkbookPart;
                    Assert.NotNull(wbPart);

                    var sheets = wbPart.Workbook.Sheets?.Elements<Sheet>().ToList();
                    Assert.NotNull(sheets);

                    // 2. Verify essential sheets are present
                    Assert.Contains(sheets, s => s.Name?.Value == "Revision List");
                    Assert.Contains(sheets, s => s.Name?.Value == "Verification List");
                    Assert.Contains(sheets, s => s.Name?.Value == "Check Information");
                    Assert.Contains(sheets, s => s.Name?.Value == "Comments");

                    // 3. Verify only active category sheets are retained
                    var retainedCategorySheetNames = sheets.Select(s => s.Name?.Value).Where(n => n is "Base" or "Drain Pan" or "Housing" or "Paperwork" or "Internal" or "Coil Panels" or "Reconnects" or "MOM").ToList();
                    Assert.NotEmpty(retainedCategorySheetNames);

                    // 4. Verify Check Information formulas have no #REF! errors
                    var ciSheet = sheets.FirstOrDefault(s => s.Name?.Value == "Check Information");
                    Assert.NotNull(ciSheet);
                    var ciWsPart = (WorksheetPart)wbPart.GetPartById(ciSheet.Id!);
                    var formulaCells = ciWsPart.Worksheet.Descendants<Cell>().Where(c => c.CellFormula != null).ToList();
                    foreach (var fc in formulaCells)
                    {
                        Assert.False(fc.CellFormula!.Text.Contains("#REF!"), $"Formula in cell {fc.CellReference?.Value} contains #REF!: {fc.CellFormula.Text}");
                    }

                    // 5. Verify Verification List dynamic structure
                    var vlSheet = sheets.FirstOrDefault(s => s.Name?.Value == "Verification List");
                    Assert.NotNull(vlSheet);
                    var vlWsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);

                    var sstPart = wbPart.SharedStringTablePart;
                    Assert.NotNull(sstPart);
                    var sst = sstPart.SharedStringTable.Elements<SharedStringItem>().Select(s => s.InnerText).ToList();

                    string GetCellValue(string cellRef)
                    {
                        var cell = vlWsPart.Worksheet.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellRef);
                        if (cell == null || cell.CellValue == null) return "";
                        string val = cell.CellValue.Text;
                        if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString && int.TryParse(val, out int idx) && idx < sst.Count)
                        {
                            return sst[idx];
                        }
                        return val;
                    }

                    // Check General Specs & SQs
                    Assert.Equal("Tanner Dean", GetCellValue("D3"));
                    Assert.Equal("Medical Center Phase 3", GetCellValue("D5"));
                    Assert.Equal("COM-842910", GetCellValue("D6"));
                    Assert.Equal("1", GetCellValue("G4"));
                    Assert.Equal("Custom drain pan depth 3.5 in. with copper downspout connection", GetCellValue("H4"));

                    // Verify dynamic rows start at row 26 with section headers
                    var vlRows = vlWsPart.Worksheet.Descendants<Row>().Where(r => r.RowIndex != null && r.RowIndex.Value >= 26).ToList();
                    Assert.NotEmpty(vlRows);

                    var allEmittedTexts = vlRows.SelectMany(r => r.Elements<Cell>()).Select(c =>
                    {
                        string txt = c.CellValue?.Text ?? "";
                        if (c.DataType != null && c.DataType.Value == CellValues.SharedString && int.TryParse(txt, out int idx) && idx < sst.Count)
                            return sst[idx];
                        return txt;
                    }).ToList();

                    // Check for Skid / General headers
                    Assert.Contains(allEmittedTexts, t => t.Contains("VERIFICATIONS"));

                    // Product contract: Not Applicable verifications are excluded
                    // from the Verification List worksheet in both Draft and Final exports (audited in-app).
                    var emittedRuleIds = vlRows
                        .Select(r => GetCellValue($"B{r.RowIndex?.Value}"))
                        .Where(id => !string.IsNullOrEmpty(id) && id.Contains("-"))
                        .ToList();

                    var expectedRuleCount = checklists
                        .Where(c => c.Applicability != RuleApplicability.NotApplicable)
                        .Count(c => bundle.Rules.Any(r => r.Id == c.RuleId || r.SemanticKey == c.SemanticKey));
                    Assert.Equal(expectedRuleCount, emittedRuleIds.Count);
                    Assert.Contains(allEmittedTexts, t => t == "Needs Input");
                    Assert.DoesNotContain(allEmittedTexts, t => t == "Not Applicable");

                    // Verify hidden Audit Log sheet exists with hidden state
                    var auditSheet = sheets.FirstOrDefault(s => s.Name?.Value == "Audit Log");
                    Assert.NotNull(auditSheet);
                    Assert.Equal(SheetStateValues.Hidden, auditSheet.State?.Value);

                    var auditWsPart = (WorksheetPart)wbPart.GetPartById(auditSheet.Id!);
                    var auditCells = auditWsPart.Worksheet.Descendants<Cell>().ToList();
                    Assert.NotEmpty(auditCells);
                }
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }

        [Fact]
        public void PatchTemplate_SupportsArbitraryMultiSkidUnit()
        {
            string templatePath = TestPathHelper.GetRepoPath("Detailing Verification List.xlsx");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var graph = TestGraphFactory.CreateStandardMultiSkidGraph();

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);
            extractor.OverrideFact(facts, "unit.detailer", "Tanner Dean", "Test", "Test");
            extractor.OverrideFact(facts, "unit.comNumber", "COM-992211", "Test", "Test");

            var evaluator = new AstRuleEvaluator();
            var checklists = evaluator.GenerateChecklists(bundle.Rules, graph, facts);

            var sqItems = new List<SpecialQuote>
            {
                new SpecialQuote { Slot = 1, Id = "sq-1", Text = "Custom Heat Recovery Purge Sector", LinkedSkidId = "skid-2", Initials = "TD", IsCompleted = true }
            };

            string outputPath = Path.Combine(Path.GetTempPath(), $"Dynamic_MultiSkid_{System.Guid.NewGuid():N}.xlsx");
            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(
                    templatePath,
                    outputPath,
                    bundle.TemplateMap,
                    facts,
                    sqItems,
                    checklists,
                    bundle.Rules,
                    "Multi-skid verification audit.",
                    isDraft: false,
                    graph: graph
                );

                Assert.True(File.Exists(outputPath));

                using var doc = SpreadsheetDocument.Open(outputPath, false);
                var validator = new OpenXmlValidator();
                var schemaErrors = validator.Validate(doc)
                    .Where(e => !e.Description.Contains("shapeId", System.StringComparison.OrdinalIgnoreCase))
                    .ToList();
                Assert.Empty(schemaErrors);

                var wbPart = doc.WorkbookPart;
                Assert.NotNull(wbPart);

                var vlSheet = wbPart.Workbook.Sheets?.Elements<Sheet>().FirstOrDefault(s => s.Name?.Value == "Verification List");
                Assert.NotNull(vlSheet);
                var vlWsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
                var sheetData = vlWsPart.Worksheet.GetFirstChild<SheetData>();
                Assert.NotNull(sheetData);

                var sst = wbPart.SharedStringTablePart?.SharedStringTable;
                var sharedStrings = sst?.Elements<SharedStringItem>().Select(s => s.InnerText).ToList() ?? new List<string>();

                // Verify section headers exist for Skid 1 through Skid 5
                for (int i = 1; i <= 5; i++)
                {
                    Assert.Contains(sharedStrings, text => text.Contains($"SKID {i}", System.StringComparison.OrdinalIgnoreCase));
                }
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }

        [Fact]
        public void FlexibleJsonDeserialization_HandlesDecimalGaugesAndStrings()
        {
            string jsonWithDecimalGauges = @"
            {
                ""segments"": [
                    {
                        ""id"": ""seg-1"",
                        ""name"": ""Access Segment"",
                        ""surfaces"": {
                            ""bottom"": {
                                ""interiorGauge"": 22.0,
                                ""exteriorGauge"": 18.0,
                                ""housingThickness"": 2.0
                            },
                            ""top"": {
                                ""interiorGauge"": ""22"",
                                ""exteriorGauge"": ""18.000""
                            }
                        }
                    }
                ]
            }";

            var options = AHUVerification.Core.Utils.JsonDefaults.CreateFlexibleOptions();
            var graph = System.Text.Json.JsonSerializer.Deserialize<NormalizedXmlGraph>(jsonWithDecimalGauges, options);

            Assert.NotNull(graph);
            Assert.Single(graph.Segments);
            Assert.Equal(22, graph.Segments[0].Surfaces.Bottom.InteriorGauge);
            Assert.Equal(18, graph.Segments[0].Surfaces.Bottom.ExteriorGauge);
            Assert.Equal(22, graph.Segments[0].Surfaces.Top.InteriorGauge);
            Assert.Equal(18, graph.Segments[0].Surfaces.Top.ExteriorGauge);
        }

        [Fact]
        public void ValidateGeneratedWorkbook_NonExistentFile_ThrowsFileNotFoundException()
        {
            Assert.Throws<FileNotFoundException>(() =>
                OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(Path.Combine(Path.GetTempPath(), $"missing_{System.Guid.NewGuid():N}.xlsx"))
            );
        }

        [Fact]
        public void ValidateGeneratedWorkbook_InvalidXmlWorkbook_ThrowsInvalidOperationException()
        {
            string tempInvalidDoc = Path.Combine(Path.GetTempPath(), $"invalid_{System.Guid.NewGuid():N}.xlsx");
            try
            {
                using (var package = SpreadsheetDocument.Create(tempInvalidDoc, SpreadsheetDocumentType.Workbook))
                {
                    var wbPart = package.AddWorkbookPart();
                    wbPart.Workbook = new Workbook();
                    // An empty workbook with no sheets element violates OpenXML SpreadsheetML schema
                }

                Assert.Throws<InvalidOperationException>(() =>
                    OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(tempInvalidDoc)
                );
            }
            finally
            {
                if (File.Exists(tempInvalidDoc)) File.Delete(tempInvalidDoc);
            }
        }

        [Fact]
        public void PatchTemplate_NonExistentTemplate_ThrowsFileNotFoundException()
        {
            var patcher = new OpenXmlTemplatePatcher();
            var bundle = new RulePackBundle { TemplateMap = new TemplateMap(), Rules = new List<RuleDefinition>() };

            Assert.Throws<FileNotFoundException>(() =>
                patcher.PatchTemplate(
                    Path.Combine(Path.GetTempPath(), $"missing_template_{System.Guid.NewGuid():N}.xlsx"),
                    Path.Combine(Path.GetTempPath(), $"out_{System.Guid.NewGuid():N}.xlsx"),
                    bundle.TemplateMap,
                    new Dictionary<string, Fact>(),
                    new List<SpecialQuote>(),
                    new List<ChecklistInstance>(),
                    bundle.Rules
                )
            );
        }

        [Fact]
        public void PatchTemplate_DraftWithComments_AndNestedDirectory_Succeeds()
        {
            string templatePath = TestPathHelper.GetRepoPath("Detailing Verification List.xlsx");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var graph = new NormalizedXmlGraph();
            using var jsonTrue = System.Text.Json.JsonDocument.Parse("true");
            using var jsonFalse = System.Text.Json.JsonDocument.Parse("false");
            var facts = new Dictionary<string, Fact>(System.StringComparer.OrdinalIgnoreCase)
            {
                ["unit.hasCurb"] = new Fact { Value = jsonTrue.RootElement },
                ["unit.hasKnockdown"] = new Fact { Value = jsonFalse.RootElement },
                ["unit.date"] = new Fact { Value = "2026-09-06" }
            };

            var customRules = new List<RuleDefinition>
            {
                new RuleDefinition { Id = "DP-1", SemanticKey = "DP-1", Category = "Drain Pan" },
                new RuleDefinition { Id = "CP-1", SemanticKey = "CP-1", Category = "Coil Panels" },
                new RuleDefinition { Id = "RC-1", SemanticKey = "RC-1", Category = "Reconnects" },
                new RuleDefinition { Id = "CUST-1", SemanticKey = "CUST-1", Category = "UnknownCategory" }
            };

            var checklists = new List<ChecklistInstance>
            {
                new ChecklistInstance { RuleId = "DP-1", SemanticKey = "DP-1", Applicability = RuleApplicability.Applicable, Status = CheckStatus.Passed },
                new ChecklistInstance { RuleId = "CP-1", SemanticKey = "CP-1", Applicability = RuleApplicability.Applicable, Status = CheckStatus.Passed },
                new ChecklistInstance { RuleId = "RC-1", SemanticKey = "RC-1", Applicability = RuleApplicability.Applicable, Status = CheckStatus.Passed },
                new ChecklistInstance { RuleId = "CUST-1", SemanticKey = "CUST-1", Applicability = RuleApplicability.Applicable, Status = CheckStatus.Passed }
            };

            string nestedDir = Path.Combine(Path.GetTempPath(), $"dir_{System.Guid.NewGuid():N}", "nested");
            string outputPath = Path.Combine(nestedDir, "Draft_Output.xlsx");

            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(
                    templatePath,
                    outputPath,
                    bundle.TemplateMap,
                    facts,
                    new List<SpecialQuote>(),
                    checklists,
                    customRules,
                    generalComments: "Audited manually",
                    isDraft: true,
                    graph: graph
                );

                Assert.True(File.Exists(outputPath));
                OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(outputPath);
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
                if (Directory.Exists(nestedDir)) Directory.Delete(nestedDir, true);
            }
        }

        [Fact]
        public void PatchTemplate_EmptyRules_HandlesCheckInformationWithoutActiveCategorySheets()
        {
            string templatePath = TestPathHelper.GetRepoPath("Detailing Verification List.xlsx");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var graph = new NormalizedXmlGraph();
            var facts = new Dictionary<string, Fact>(System.StringComparer.OrdinalIgnoreCase);

            string outputPath = Path.Combine(Path.GetTempPath(), $"NoCategory_{System.Guid.NewGuid():N}.xlsx");
            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(
                    templatePath,
                    outputPath,
                    bundle.TemplateMap,
                    facts,
                    new List<SpecialQuote>(),
                    new List<ChecklistInstance>(),
                    new List<RuleDefinition>(),
                    generalComments: "",
                    isDraft: false,
                    graph: graph
                );

                Assert.True(File.Exists(outputPath));
                OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(outputPath);
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }

        [Fact]
        public void DeriveInitials_WordInitials_CalculatedCorrectly()
        {
            Assert.Equal("BB", OpenXmlTemplatePatcher.DeriveInitials("Brandon Brown"));
            Assert.Equal("BRB", OpenXmlTemplatePatcher.DeriveInitials("Brandon R. Brown"));
            Assert.Equal("TD", OpenXmlTemplatePatcher.DeriveInitials("Tanner Dean"));
            Assert.Equal("DE", OpenXmlTemplatePatcher.DeriveInitials("Detailer"));
            Assert.Equal("TD", OpenXmlTemplatePatcher.DeriveInitials(""));
            Assert.Equal("TD", OpenXmlTemplatePatcher.DeriveInitials("   "));
        }

        [Fact]
        public void PatchTemplate_InitialsStamping_OnlyOnReviewedChecks_AndAuditLogPopulated()
        {
            string templatePath = TestPathHelper.GetRepoPath("Detailing Verification List.xlsx");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var graph = new NormalizedXmlGraph();
            var facts = new Dictionary<string, Fact>(System.StringComparer.OrdinalIgnoreCase)
            {
                ["unit.detailer"] = new Fact { Value = "Brandon Brown" },
                ["unit.date"] = new Fact { Value = "2026-09-07" }
            };

            var testRules = new List<RuleDefinition>
            {
                new RuleDefinition { Id = "TEST-01", SemanticKey = "TEST-01", Text = "First check passed", Category = "Base" },
                new RuleDefinition { Id = "TEST-02", SemanticKey = "TEST-02", Text = "Second check flagged", Category = "Base" },
                new RuleDefinition { Id = "TEST-03", SemanticKey = "TEST-03", Text = "Third check incomplete", Category = "Base" },
                new RuleDefinition { Id = "TEST-04", SemanticKey = "TEST-04", Text = "Fourth check not applicable", Category = "Base" }
            };

            var testChecklists = new List<ChecklistInstance>
            {
                new ChecklistInstance
                {
                    RuleId = "TEST-01",
                    SemanticKey = "TEST-01",
                    ScopeTargetId = "unit",
                    Applicability = RuleApplicability.Applicable,
                    Status = CheckStatus.Passed,
                    DetailerComment = "Good to go",
                    UpdatedAt = "2026-09-07T12:30:15.000Z"
                },
                new ChecklistInstance
                {
                    RuleId = "TEST-02",
                    SemanticKey = "TEST-02",
                    ScopeTargetId = "unit",
                    Applicability = RuleApplicability.Applicable,
                    Status = CheckStatus.Flagged,
                    DetailerComment = "Requires shop review",
                    UpdatedAt = "2026-09-07T12:30:45.000Z"
                },
                new ChecklistInstance
                {
                    RuleId = "TEST-03",
                    SemanticKey = "TEST-03",
                    ScopeTargetId = "unit",
                    Applicability = RuleApplicability.Applicable,
                    Status = CheckStatus.Incomplete,
                    UpdatedAt = "2026-09-07T12:00:00.000Z"
                },
                new ChecklistInstance
                {
                    RuleId = "TEST-04",
                    SemanticKey = "TEST-04",
                    ScopeTargetId = "unit",
                    Applicability = RuleApplicability.NotApplicable,
                    Status = CheckStatus.Incomplete,
                    UpdatedAt = "2026-09-07T12:00:00.000Z"
                }
            };

            string outputPath = Path.Combine(Path.GetTempPath(), $"Draft_InitialsTest_{System.Guid.NewGuid():N}.xlsx");
            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(
                    templatePath,
                    outputPath,
                    bundle.TemplateMap,
                    facts,
                    new List<SpecialQuote>(),
                    testChecklists,
                    testRules,
                    generalComments: "Draft test",
                    isDraft: true,
                    graph: graph
                );

                Assert.True(File.Exists(outputPath));
                OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(outputPath);

                using var doc = SpreadsheetDocument.Open(outputPath, false);
                var wbPart = doc.WorkbookPart!;
                var sstPart = wbPart.SharedStringTablePart!;
                var sst = sstPart.SharedStringTable.Elements<SharedStringItem>().Select(s => s.InnerText).ToList();

                // 1. Verify Verification List sheet
                var vlSheet = wbPart.Workbook.Sheets!.Elements<Sheet>().First(s => s.Name?.Value == "Verification List");
                var vlWsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);

                string GetVlCellValue(string cellRef)
                {
                    var cell = vlWsPart.Worksheet.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellRef);
                    if (cell == null || cell.CellValue == null) return "";
                    string val = cell.CellValue.Text;
                    if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString && int.TryParse(val, out int idx) && idx < sst.Count)
                    {
                        return sst[idx];
                    }
                    return val;
                }

                // Verify Not Applicable rule TEST-04 was completely excluded
                var vlRows = vlWsPart.Worksheet.Descendants<Row>().Where(r => r.RowIndex != null && r.RowIndex.Value >= 26).ToList();
                var emittedRuleIds = vlRows
                    .Select(r => GetVlCellValue($"B{r.RowIndex?.Value}"))
                    .Where(id => !string.IsNullOrEmpty(id) && id.StartsWith("TEST-"))
                    .ToList();

                Assert.Contains("TEST-01", emittedRuleIds);
                Assert.Contains("TEST-02", emittedRuleIds);
                Assert.Contains("TEST-03", emittedRuleIds);
                Assert.DoesNotContain("TEST-04", emittedRuleIds);

                // Find rows for each rule
                var row01 = vlRows.First(r => GetVlCellValue($"B{r.RowIndex?.Value}") == "TEST-01");
                var row02 = vlRows.First(r => GetVlCellValue($"B{r.RowIndex?.Value}") == "TEST-02");
                var row03 = vlRows.First(r => GetVlCellValue($"B{r.RowIndex?.Value}") == "TEST-03");

                // Check Column Z (Initials):
                // TEST-01 (Passed): should have derived initials "BB" (for Brandon Brown)
                Assert.Equal("BB", GetVlCellValue($"Z{row01.RowIndex?.Value}"));
                // TEST-02 (Flagged): should have derived initials "BB"
                Assert.Equal("BB", GetVlCellValue($"Z{row02.RowIndex?.Value}"));
                // TEST-03 (Incomplete): should be empty (no initials stamped)
                Assert.Equal("", GetVlCellValue($"Z{row03.RowIndex?.Value}"));

                // 2. Verify Hidden Audit Log Sheet
                var auditSheet = wbPart.Workbook.Sheets.Elements<Sheet>().FirstOrDefault(s => s.Name?.Value == "Audit Log");
                Assert.NotNull(auditSheet);
                Assert.Equal(SheetStateValues.Hidden, auditSheet.State?.Value);

                var auditWsPart = (WorksheetPart)wbPart.GetPartById(auditSheet.Id!);
                var auditSheetData = auditWsPart.Worksheet.GetFirstChild<SheetData>()!;
                var auditRows = auditSheetData.Elements<Row>().ToList();

                string GetAuditCellValue(string cellRef)
                {
                    var cell = auditWsPart.Worksheet.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellRef);
                    if (cell == null || cell.CellValue == null) return "";
                    string val = cell.CellValue.Text;
                    if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString && int.TryParse(val, out int idx) && idx < sst.Count)
                    {
                        return sst[idx];
                    }
                    return val;
                }

                // Row 1: Headers
                Assert.Equal("Timestamp (UTC)", GetAuditCellValue("A1"));
                Assert.Equal("Rule ID", GetAuditCellValue("B1"));
                Assert.Equal("Rule Description", GetAuditCellValue("C1"));
                Assert.Equal("Scope / Skid", GetAuditCellValue("D1"));
                Assert.Equal("Status", GetAuditCellValue("E1"));
                Assert.Equal("Detailer Name", GetAuditCellValue("F1"));
                Assert.Equal("Sign-off Initials", GetAuditCellValue("G1"));
                Assert.Equal("Detailer Comment", GetAuditCellValue("H1"));

                // Data rows: only reviewed checks (TEST-01 and TEST-02), ordered by UpdatedAt
                Assert.Equal(3, auditRows.Count); // Header + 2 data rows

                Assert.Equal("2026-09-07 12:30:15", GetAuditCellValue("A2"));
                Assert.Equal("TEST-01", GetAuditCellValue("B2"));
                Assert.Equal("First check passed", GetAuditCellValue("C2"));
                Assert.Equal("General Unit", GetAuditCellValue("D2"));
                Assert.Equal("Passed", GetAuditCellValue("E2"));
                Assert.Equal("Brandon Brown", GetAuditCellValue("F2"));
                Assert.Equal("BB", GetAuditCellValue("G2"));
                Assert.Equal("Good to go", GetAuditCellValue("H2"));

                Assert.Equal("2026-09-07 12:30:45", GetAuditCellValue("A3"));
                Assert.Equal("TEST-02", GetAuditCellValue("B3"));
                Assert.Equal("Second check flagged", GetAuditCellValue("C3"));
                Assert.Equal("General Unit", GetAuditCellValue("D3"));
                Assert.Equal("Flagged", GetAuditCellValue("E3"));
                Assert.Equal("Brandon Brown", GetAuditCellValue("F3"));
                Assert.Equal("BB", GetAuditCellValue("G3"));
                Assert.Equal("Requires shop review", GetAuditCellValue("H3"));
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }

        [Fact]
        public void PatchTemplate_UsesExplicitDetailerInitialsFactOverride_WhenProvided()
        {
            string templatePath = TestPathHelper.GetRepoPath("Detailing Verification List.xlsx");
            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("resources/rulepack"));

            var graph = new NormalizedXmlGraph();
            var facts = new Dictionary<string, Fact>(System.StringComparer.OrdinalIgnoreCase)
            {
                ["unit.detailer"] = new Fact { Value = "Brandon Brown" },
                ["unit.detailerInitials"] = new Fact { Value = "BRB" },
                ["unit.date"] = new Fact { Value = "2026-09-07" }
            };

            var testRules = new List<RuleDefinition>
            {
                new RuleDefinition { Id = "OVERRIDE-01", SemanticKey = "OVERRIDE-01", Text = "Override test check", Category = "Base" }
            };

            var testChecklists = new List<ChecklistInstance>
            {
                new ChecklistInstance
                {
                    RuleId = "OVERRIDE-01",
                    SemanticKey = "OVERRIDE-01",
                    ScopeTargetId = "unit",
                    Applicability = RuleApplicability.Applicable,
                    Status = CheckStatus.Passed,
                    UpdatedAt = "2026-09-07T14:15:00.000Z"
                }
            };

            string outputPath = Path.Combine(Path.GetTempPath(), $"Override_InitialsTest_{System.Guid.NewGuid():N}.xlsx");
            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(
                    templatePath,
                    outputPath,
                    bundle.TemplateMap,
                    facts,
                    new List<SpecialQuote>(),
                    testChecklists,
                    testRules,
                    generalComments: "Override test",
                    isDraft: false,
                    graph: graph
                );

                Assert.True(File.Exists(outputPath));
                OpenXmlTemplatePatcher.ValidateGeneratedWorkbook(outputPath);

                using var doc = SpreadsheetDocument.Open(outputPath, false);
                var wbPart = doc.WorkbookPart!;
                var sstPart = wbPart.SharedStringTablePart!;
                var sst = sstPart.SharedStringTable.Elements<SharedStringItem>().Select(s => s.InnerText).ToList();

                var vlSheet = wbPart.Workbook.Sheets!.Elements<Sheet>().First(s => s.Name?.Value == "Verification List");
                var vlWsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);

                string GetVlCellValue(string cellRef)
                {
                    var cell = vlWsPart.Worksheet.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellRef);
                    if (cell == null || cell.CellValue == null) return "";
                    string val = cell.CellValue.Text;
                    if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString && int.TryParse(val, out int idx) && idx < sst.Count)
                    {
                        return sst[idx];
                    }
                    return val;
                }

                var row = vlWsPart.Worksheet.Descendants<Row>().First(r => GetVlCellValue($"B{r.RowIndex?.Value}") == "OVERRIDE-01");
                // Column Z should have the overridden initials "BRB" instead of "BB"
                Assert.Equal("BRB", GetVlCellValue($"Z{row.RowIndex?.Value}"));
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }
    }
}
