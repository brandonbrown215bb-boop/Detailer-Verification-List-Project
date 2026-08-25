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
        public void PatchTemplate_PreservesZeroSchemaErrorsAndFormulaChains()
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

            // Mark some checklists as Passed
            foreach (var c in checklists.Take(10))
            {
                c.Status = CheckStatus.Passed;
                c.DetailerComment = "Verified in CAD model.";
            }

            var sqItems = new List<SpecialQuote>
            {
                new SpecialQuote { Slot = 1, Id = "sq-1", Text = "Custom drain pan depth 3.5 in. with copper downspout connection", LinkedSkidId = "skid-3", Initials = "TD", IsCompleted = true },
                new SpecialQuote { Slot = 2, Id = "sq-2", Text = "Dual 630 EBM Fan Wall array with individual disconnects", LinkedSkidId = "skid-4", Initials = "TD", IsCompleted = false }
            };

            string outputPath = Path.Combine(Path.GetTempPath(), "Patched_Verification_Deliverable.xlsx");
            try
            {
                var patcher = new OpenXmlTemplatePatcher();
                patcher.PatchTemplate(templatePath, outputPath, bundle.TemplateMap, facts, sqItems, checklists, bundle.Rules, "General verification notes.");

                Assert.True(File.Exists(outputPath));

                // 1. OpenXmlValidator Verification: 0 new schema errors
                using (var doc = SpreadsheetDocument.Open(outputPath, false))
                {
                    var validator = new OpenXmlValidator();
                    // Filter legacy Office shapeId attribute warning inherent to Excel VML comments
                    var schemaErrors = validator.Validate(doc)
                        .Where(e => !e.Description.Contains("shapeId", System.StringComparison.OrdinalIgnoreCase))
                        .ToList();
                    Assert.Empty(schemaErrors);

                    var wbPart = doc.WorkbookPart;
                    Assert.NotNull(wbPart);

                    // 2. Verify all 12 sheets are present
                    var sheets = wbPart.Workbook.Sheets?.Elements<Sheet>().ToList();
                    Assert.NotNull(sheets);
                    Assert.Equal(12, sheets.Count);

                    // 3. Verify DataValidations elements are preserved
                    int totalDataValidations = 0;
                    foreach (var wsPart in wbPart.WorksheetParts)
                    {
                        var dvs = wsPart.Worksheet.Elements<DataValidations>().ToList();
                        totalDataValidations += dvs.Count;
                    }
                    Assert.True(totalDataValidations > 0, "DataValidations should be preserved across sheets");

                    // 4. Verify Formula Chains on 'Check Information'
                    var checkSheet = sheets.FirstOrDefault(s => s.Name?.Value == "Check Information");
                    Assert.NotNull(checkSheet);
                    var checkWsPart = (WorksheetPart)wbPart.GetPartById(checkSheet.Id!);
                    var formulaCells = checkWsPart.Worksheet.Descendants<Cell>().Where(c => c.CellFormula != null).ToList();
                    Assert.NotEmpty(formulaCells);

                    // 5. Verify patched values on 'Verification List'
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

                    // Check General Specs
                    Assert.Equal("Tanner Dean", GetCellValue("D3"));
                    Assert.Equal("Medical Center Phase 3", GetCellValue("D5"));
                    Assert.Equal("COM-842910", GetCellValue("D6"));

                    // Check SQs
                    Assert.Equal("1", GetCellValue("G4"));
                    Assert.Equal("Custom drain pan depth 3.5 in. with copper downspout connection", GetCellValue("H4"));
                    Assert.Equal("2", GetCellValue("G5"));
                    Assert.Equal("Dual 630 EBM Fan Wall array with individual disconnects", GetCellValue("H5"));
                }
            }
            finally
            {
                if (File.Exists(outputPath)) File.Delete(outputPath);
            }
        }
    }
}
