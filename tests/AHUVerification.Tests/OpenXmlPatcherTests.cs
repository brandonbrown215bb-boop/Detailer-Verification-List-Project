using System.Collections.Generic;
using System.IO;
using System.Linq;
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

            string xmlContent = File.ReadAllText(TestPathHelper.GetRepoPath("Config.xml"));
            var parser = new NormalizedXmlParser();
            var graph = parser.Parse(xmlContent);

            var extractor = new FactExtractor();
            var facts = extractor.ExtractFacts(graph);

            var rulePackManager = new RulePackManager();
            var bundle = rulePackManager.LoadFromDirectory(TestPathHelper.GetRepoPath("src/rulepack"));

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

                    var allEmittedTexts = vlRows.SelectMany(r => r.Elements<Cell>()).Select(c => {
                        string txt = c.CellValue?.Text ?? "";
                        if (c.DataType != null && c.DataType.Value == CellValues.SharedString && int.TryParse(txt, out int idx) && idx < sst.Count)
                            return sst[idx];
                        return txt;
                    }).ToList();

                    // Check for Skid / General headers
                    Assert.Contains(allEmittedTexts, t => t.Contains("VERIFICATIONS"));

                    // Verify NO N/A check text is emitted for rules that are non-applicable everywhere (e.g. UTL / Knockdown)
                    var strictlyNaRuleIds = checklists
                        .GroupBy(c => c.RuleId)
                        .Where(g => g.All(i => i.Applicability == RuleApplicability.NotApplicable))
                        .Select(g => g.Key)
                        .ToHashSet();

                    var emittedRuleIds = vlRows
                        .Select(r => GetCellValue($"B{r.RowIndex?.Value}"))
                        .Where(id => !string.IsNullOrEmpty(id) && id.Contains("-"))
                        .ToList();

                    Assert.Equal(applicableChecks.Count, emittedRuleIds.Count);

                    foreach (var emittedId in emittedRuleIds)
                    {
                        Assert.DoesNotContain(emittedId, strictlyNaRuleIds);
                    }
                }
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }
    }
}
