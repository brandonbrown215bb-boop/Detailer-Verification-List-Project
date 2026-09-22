using System;
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
    public class GoldenProductionPathTests
    {
        [Fact]
        public void GoldenProductionPath_FullLifecycle_FromUpzToCertifiedWorkbook()
        {
            // 1. Ingestion: Extract real UPZ fixture
            string upzPath = TestPathHelper.GetFixturePath("UPZ_Unit_Examples/2N-0C0146-01.upz");
            Assert.True(File.Exists(upzPath), $"UPZ sample must exist at {upzPath}");

            var upzExtractor = new UpzBundleExtractor();
            var upzBundle = upzExtractor.Extract(upzPath);
            Assert.NotNull(upzBundle.RawConfigXml);
            Assert.NotEmpty(upzBundle.RawConfigXml);

            // 2. Load Active Validated Rule Pack
            string rulePackDir = TestPathHelper.GetRepoPath("resources/rulepack");
            var rulePackManager = new RulePackManager();
            var rulePack = rulePackManager.LoadFromDirectory(rulePackDir);
            Assert.True(rulePack.IsValid);
            Assert.NotEmpty(rulePack.Rules);

            // 3. Initial C# Host Verification
            var hostService = new VerificationHostService();
            var initialResult = hostService.VerifySource(
                upzBundle.RawConfigXml,
                upzBundle.RawOrderRevXml,
                upzBundle.RawManifestXml,
                rulePack
            );

            Assert.NotNull(initialResult.Graph);
            Assert.NotEmpty(initialResult.Facts);
            Assert.NotEmpty(initialResult.Checklists);

            // Gating Assertion: initially not ready for final export
            Assert.False(initialResult.IsReadyForFinal, "Initial verification before detailer signoff must not be ready for final export");

            string tempOutputPath = Path.Combine(Path.GetTempPath(), $"Golden_Export_{Guid.NewGuid():N}.xlsx");
            string tempDvlPath = Path.Combine(Path.GetTempPath(), $"Golden_Project_{Guid.NewGuid():N}.dvl");

            try
            {
                // Verify host blocks uncertified final export
                var uncertifiedEx = Assert.Throws<InvalidOperationException>(() =>
                    hostService.RecomputeAndExport(
                        upzBundle.RawConfigXml,
                        upzBundle.RawOrderRevXml,
                        upzBundle.RawManifestXml,
                        rulePack,
                        tempOutputPath,
                        initialResult.Facts,
                        new List<SpecialQuote>(),
                        initialResult.Checklists,
                        "Initial unconfirmed state",
                        isDraft: false
                    )
                );
                Assert.Contains("Final export requires 100% verification completion", uncertifiedEx.Message);

                // 4. Detailer Fact Resolution & Override with Provenance Snapshot
                var factExtractor = new FactExtractor();
                var resolvedFacts = new Dictionary<string, Fact>(initialResult.Facts);

                foreach (var kvp in resolvedFacts.ToList())
                {
                    if (kvp.Value.Confidence == FactConfidence.RequiresConfirmation)
                    {
                        object overrideValue = kvp.Value.Value ?? (
                            FactContractValidator.TryGetFactType(rulePack.FactContract, kvp.Key, out var factType)
                                ? factType switch
                                {
                                    "number" => kvp.Value.CalculatedValue ?? 10.0,
                                    "string" => "Standard",
                                    "boolean" => true,
                                    _ => true
                                }
                                : true
                        );

                        factExtractor.OverrideFact(
                            resolvedFacts,
                            kvp.Key,
                            overrideValue,
                            "Lead Detailer",
                            "Resolved in engineering review"
                        );
                        // Prove pre-override snapshot was captured
                        Assert.NotNull(resolvedFacts[kvp.Key].OriginalSnapshot);
                        Assert.Equal(FactConfidence.RequiresConfirmation, resolvedFacts[kvp.Key].OriginalSnapshot!.Confidence);
                    }
                }

                // Supply required identity facts
                factExtractor.OverrideFact(resolvedFacts, "unit.detailer", "Alex Detailer", "Detailer", "Assigned detailer");
                factExtractor.OverrideFact(resolvedFacts, "unit.jobName", "St. Jude Childrens Research", "Project", "Job Name");
                factExtractor.OverrideFact(resolvedFacts, "unit.comNumber", "COM-551029", "Project", "COM Number");

                // 5. Checklist Resolution: Mark all applicable/needed checks as Passed
                var resolvedChecklists = initialResult.Checklists.Select(c =>
                {
                    var updated = new ChecklistInstance
                    {
                        RuleId = c.RuleId,
                        SemanticKey = c.SemanticKey,
                        InstanceKey = c.InstanceKey,
                        ScopeTargetId = c.ScopeTargetId,
                        Applicability = c.Applicability == RuleApplicability.NeedsInput ? RuleApplicability.Applicable : c.Applicability,
                        ApplicabilityReason = c.ApplicabilityReason,
                        Status = (c.Status == CheckStatus.Incomplete || c.Status == CheckStatus.NeedsInput) ? CheckStatus.Passed : c.Status,
                        DetailerComment = "Verified against drawing details",
                        DetailerInitials = "AD",
                        CheckerComment = "Reviewed and confirmed",
                        CheckerInitials = "SC",
                        UpdatedAt = DateTime.UtcNow.ToString("o"),
                        FactTraces = c.FactTraces,
                        SemanticFingerprint = c.SemanticFingerprint
                    };
                    return updated;
                }).ToList();

                // 6. Complete All 22 Special Quote Slots
                var fullSqItems = new List<SpecialQuote>();
                for (int slot = 1; slot <= 22; slot++)
                {
                    fullSqItems.Add(new SpecialQuote
                    {
                        Slot = slot,
                        Id = $"SQ-{slot:D3}",
                        Text = $"Special Quote Requirement #{slot}: verified per customer submittal",
                        Initials = "AD",
                        IsCompleted = true
                    });
                }

                // 7. Verify Resolved Model with C# Host Engine
                var certifiedResult = hostService.VerifySource(
                    upzBundle.RawConfigXml,
                    upzBundle.RawOrderRevXml,
                    upzBundle.RawManifestXml,
                    rulePack,
                    resolvedFacts,
                    fullSqItems,
                    resolvedChecklists,
                    isTrusted: true
                );

                Assert.Equal(0, certifiedResult.UnconfirmedFactsCount);
                Assert.Equal(0, certifiedResult.BlockedChecksCount);
                Assert.True(certifiedResult.IsReadyForFinal, "All facts confirmed and checks passed; model must be ready for final export");

                // 8. DVL v2 Persistence & Integrity Check
                var projectManager = new DvlProjectManager();
                var rulePackSnapshot = RulePackManager.CreateSnapshot(rulePack);
                var rulePackProvenance = new RulePackInfo
                {
                    Version = rulePack.Manifest.Version,
                    Sha256 = rulePack.Manifest.BundleSha256,
                    TemplateSha256 = rulePack.Manifest.Files["template.xlsx"].Sha256
                };
                var dvlProject = projectManager.CreateProject(
                    certifiedResult.Graph,
                    certifiedResult.Facts,
                    fullSqItems,
                    certifiedResult.Checklists,
                    upzBundle.RawConfigXml,
                    rulePack.Manifest.Version,
                    rulePack.Manifest.BundleSha256,
                    "Certified final golden verification audit.",
                    sourceFileName: Path.GetFileName(upzPath),
                    isUpzBundle: true,
                    orderRevision: upzBundle.OrderRevision,
                    rawOrderRevisionXml: upzBundle.RawOrderRevXml,
                    rawManifestXml: upzBundle.RawManifestXml,
                    rulePackProvenance: rulePackProvenance,
                    rulePackSnapshot: rulePackSnapshot
                );

                projectManager.SaveToFile(dvlProject, tempDvlPath);
                Assert.True(File.Exists(tempDvlPath));

                // Reopen and validate tamper-evident state
                var reopenedProject = projectManager.LoadFromFile(tempDvlPath);
                var integrity = projectManager.ValidateIntegrity(reopenedProject, reopenedProject.RulePack);
                Assert.True(integrity.IsVerified, $"Integrity check failed: {integrity.Message}");
                Assert.True(integrity.CertificationAllowed);
                Assert.Equal("complete", integrity.State);
                Assert.Equal(22, reopenedProject.SqItems.Count);

                // 9. Certified Final OpenXML Export via C# Host Engine
                hostService.RecomputeAndExport(
                    upzBundle.RawConfigXml,
                    upzBundle.RawOrderRevXml,
                    upzBundle.RawManifestXml,
                    rulePack,
                    tempOutputPath,
                    certifiedResult.Facts,
                    fullSqItems,
                    certifiedResult.Checklists,
                    "Certified deliverable generated via automated production pipeline.",
                    isDraft: false
                );

                Assert.True(File.Exists(tempOutputPath));
                Assert.True(new FileInfo(tempOutputPath).Length > 0);

                // 10. Cell-Level OpenXML Workbook Assertions
                using var doc = SpreadsheetDocument.Open(tempOutputPath, false);

                // A. OpenXML Schema Validation (zero errors)
                var validator = new OpenXmlValidator();
                var schemaErrors = validator.Validate(doc)
                    .Where(e => !e.Description.Contains("shapeId", StringComparison.OrdinalIgnoreCase))
                    .ToList();
                Assert.Empty(schemaErrors);

                var wbPart = doc.WorkbookPart;
                Assert.NotNull(wbPart);

                var sheets = wbPart.Workbook.Sheets?.Elements<Sheet>().ToList();
                Assert.NotNull(sheets);

                // B. Essential Sheets Verification
                Assert.Contains(sheets, s => s.Name?.Value == "Revision List");
                Assert.Contains(sheets, s => s.Name?.Value == "Verification List");
                Assert.Contains(sheets, s => s.Name?.Value == "Check Information");
                Assert.Contains(sheets, s => s.Name?.Value == "Comments");

                // C. Check Information formula validation (no #REF! errors)
                var ciSheet = sheets.First(s => s.Name?.Value == "Check Information");
                var ciWsPart = (WorksheetPart)wbPart.GetPartById(ciSheet.Id!);
                var formulaCells = ciWsPart.Worksheet.Descendants<Cell>().Where(c => c.CellFormula != null).ToList();
                foreach (var fc in formulaCells)
                {
                    Assert.False(
                        fc.CellFormula!.Text.Contains("#REF!"),
                        $"Formula in cell {fc.CellReference?.Value} contains #REF!: {fc.CellFormula.Text}"
                    );
                }

                // D. Verification List Cell-Level Content Verification
                var vlSheet = sheets.First(s => s.Name?.Value == "Verification List");
                var vlWsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
                var sstPart = wbPart.SharedStringTablePart;
                Assert.NotNull(sstPart);
                var sst = sstPart.SharedStringTable.Elements<SharedStringItem>().Select(s => s.InnerText).ToList();

                string ReadCell(string cellRef)
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

                // Header Specifications
                Assert.Equal("Alex Detailer", ReadCell("D3"));
                Assert.Equal("St. Jude Childrens Research", ReadCell("D5"));
                Assert.Equal("COM-551029", ReadCell("D6"));

                // Verify all 22 SQ slots are rendered in rows 4..25
                for (int slot = 1; slot <= 22; slot++)
                {
                    int row = 3 + slot;
                    string slotNumber = ReadCell($"G{row}");
                    string slotText = ReadCell($"H{row}");

                    Assert.Equal(slot.ToString(), slotNumber);
                    Assert.Contains($"Special Quote Requirement #{slot}", slotText);
                }

                // Verify dynamic checklist rows contain explicit Passed / N/A statuses
                var vlRows = vlWsPart.Worksheet.Descendants<Row>()
                    .Where(r => r.RowIndex != null && r.RowIndex.Value >= 26)
                    .ToList();
                Assert.NotEmpty(vlRows);

                var allEmittedStatuses = vlRows.Select(r => ReadCell($"T{r.RowIndex?.Value}"))
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToList();

                Assert.Contains("1", allEmittedStatuses);
                Assert.DoesNotContain("Incomplete", allEmittedStatuses);

                // Verify Column T (Detailer Check) and Column V (Checker Check) use Boolean datatype on actual check rows
                var checkRows = vlRows.Where(r =>
                {
                    string bVal = ReadCell($"B{r.RowIndex?.Value}");
                    return !string.IsNullOrEmpty(bVal) && bVal.Contains("-");
                }).ToList();
                Assert.NotEmpty(checkRows);

                var firstCheckRow = checkRows.First();
                var tCell = firstCheckRow.Elements<Cell>().First(c => c.CellReference?.Value == $"T{firstCheckRow.RowIndex?.Value}");
                var vCell = firstCheckRow.Elements<Cell>().First(c => c.CellReference?.Value == $"V{firstCheckRow.RowIndex?.Value}");
                Assert.Equal(CellValues.Boolean, tCell.DataType?.Value);
                Assert.Equal("1", tCell.CellValue?.Text);
                Assert.Equal(CellValues.Boolean, vCell.DataType?.Value);
                Assert.Equal("0", vCell.CellValue?.Text);
            }
            finally
            {
                if (File.Exists(tempOutputPath)) File.Delete(tempOutputPath);
                if (File.Exists(tempDvlPath)) File.Delete(tempDvlPath);
            }
        }
    }
}
