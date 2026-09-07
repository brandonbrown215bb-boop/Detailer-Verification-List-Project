using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Validation;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class OpenXmlTemplatePatcher
    {
        private static readonly string[] AllCategorySheets = {
            "Base", "Drain Pan", "Housing", "Paperwork", "Internal", "Coil Panels", "Reconnects", "MOM"
        };

        public static void ValidateGeneratedWorkbook(string workbookPath)
        {
            if (!File.Exists(workbookPath))
                throw new FileNotFoundException("Generated workbook was not written.", workbookPath);

            using var document = SpreadsheetDocument.Open(workbookPath, false);
            var errors = new OpenXmlValidator()
                .Validate(document)
                .Where(error => !error.Description.Contains("shapeId", StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (errors.Count > 0)
            {
                string details = string.Join("; ", errors.Take(5).Select(error => error.Description));
                throw new InvalidOperationException($"Generated workbook failed OpenXML validation ({errors.Count} errors): {details}");
            }
        }

        public void PatchTemplate(
            string templateFilePath,
            string outputFilePath,
            TemplateMap templateMap,
            Dictionary<string, Fact> facts,
            List<SpecialQuote> sqItems,
            List<ChecklistInstance> checklists,
            List<RuleDefinition> rules,
            string generalComments = "",
            bool isDraft = false,
            NormalizedXmlGraph? graph = null)
        {
            if (!File.Exists(templateFilePath))
                throw new FileNotFoundException("Excel template file not found.", templateFilePath);

            if (isDraft && !generalComments.StartsWith("[DRAFT"))
            {
                generalComments = string.IsNullOrEmpty(generalComments)
                    ? "[DRAFT - INCOMPLETE VERIFICATION AUDIT]"
                    : $"[DRAFT - INCOMPLETE VERIFICATION AUDIT] {generalComments}";
            }

            // Copy template to destination
            string? dir = Path.GetDirectoryName(outputFilePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            try
            {
                File.Copy(templateFilePath, outputFilePath, true);
            }
            catch (IOException ioEx)
            {
                throw new IOException($"The file '{Path.GetFileName(outputFilePath)}' cannot be written because it is in use by another program (such as Microsoft Excel). Please close the file in Excel and try exporting again.", ioEx);
            }

            SpreadsheetDocument doc;
            try
            {
                doc = SpreadsheetDocument.Open(outputFilePath, true);
            }
            catch (IOException ioEx)
            {
                throw new IOException($"The file '{Path.GetFileName(outputFilePath)}' cannot be opened for writing because it is currently locked by another application. Please close Microsoft Excel and try exporting again.", ioEx);
            }

            using (doc)
            {
                var wbPart = doc.WorkbookPart ?? throw new InvalidOperationException("Invalid workbook part.");

                // 1. Shared String Table handling
                var sstPart = wbPart.SharedStringTablePart;
                if (sstPart == null)
                {
                    sstPart = wbPart.AddNewPart<SharedStringTablePart>();
                    sstPart.SharedStringTable = new SharedStringTable();
                }

                var sst = sstPart.SharedStringTable;
                var stringMap = new Dictionary<string, int>();
                int sstCount = 0;
                foreach (var item in sst.Elements<SharedStringItem>())
                {
                    string text = item.InnerText;
                    if (!stringMap.ContainsKey(text))
                    {
                        stringMap[text] = sstCount;
                    }
                    sstCount++;
                }

                int InsertSharedString(string text)
                {
                    if (stringMap.TryGetValue(text, out int idx))
                    {
                        return idx;
                    }
                    sst.AppendChild(new SharedStringItem(new Text(text)));
                    int newIdx = sstCount++;
                    stringMap[text] = newIdx;
                    return newIdx;
                }

                // 2. Identify active category scratchpad sheets based on applicable checklist rules
                var applicableChecklists = checklists
                    .Where(c => c.Applicability == RuleApplicability.Applicable)
                    .ToList();

                var activeCategorySheets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var inst in applicableChecklists)
                {
                    var rule = rules.FirstOrDefault(r => r.Id == inst.RuleId || r.SemanticKey == inst.SemanticKey);
                    if (rule != null)
                    {
                        string catSheet = GetCategorySheetName(rule);
                        activeCategorySheets.Add(catSheet);
                    }
                }

                // 3. Remove inactive category scratchpad sheets from workbook
                var sheetsElement = wbPart.Workbook.Sheets;
                if (sheetsElement != null)
                {
                    var sheetsList = sheetsElement.Elements<Sheet>().ToList();
                    foreach (var catName in AllCategorySheets)
                    {
                        if (!activeCategorySheets.Contains(catName))
                        {
                            var targetSheet = sheetsList.FirstOrDefault(s => string.Equals(s.Name?.Value, catName, StringComparison.OrdinalIgnoreCase));
                            if (targetSheet != null && targetSheet.Id != null)
                            {
                                var part = wbPart.GetPartById(targetSheet.Id!);
                                targetSheet.Remove();
                                wbPart.DeletePart(part);
                            }
                        }
                    }
                }

                // 4. Protect and adapt formulas on 'Check Information' sheet
                AdaptCheckInformationFormulas(wbPart, activeCategorySheets);

                // 5. Locate Verification List sheet
                var vlSheet = wbPart.Workbook.Sheets?.Elements<Sheet>().FirstOrDefault(s => s.Name?.Value == "Verification List");
                if (vlSheet == null || vlSheet.Id == null)
                    throw new InvalidOperationException("Verification List worksheet not found in template.");

                var wsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
                var ws = wsPart.Worksheet;
                var sheetData = ws.GetFirstChild<SheetData>() ?? ws.AppendChild(new SheetData());

                void SetCellValue(string cellReference, string value, bool isNumeric = false)
                {
                    if (string.IsNullOrEmpty(cellReference)) return;

                    string rowStr = new string(cellReference.Where(char.IsDigit).ToArray());
                    if (!uint.TryParse(rowStr, out uint rowIndex)) return;

                    var row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex != null && r.RowIndex.Value == rowIndex);
                    if (row == null)
                    {
                        row = new Row { RowIndex = rowIndex };
                        var nextRow = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex != null && r.RowIndex.Value > rowIndex);
                        if (nextRow != null)
                            sheetData.InsertBefore(row, nextRow);
                        else
                            sheetData.AppendChild(row);
                    }

                    var cell = row.Elements<Cell>().FirstOrDefault(c => c.CellReference != null && c.CellReference.Value == cellReference);
                    if (cell == null)
                    {
                        cell = new Cell { CellReference = cellReference };
                        row.AppendChild(cell);
                    }

                    if (isNumeric && double.TryParse(value, out double numVal))
                    {
                        cell.CellValue = new CellValue(numVal.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        cell.DataType = CellValues.Number;
                    }
                    else
                    {
                        int idx = InsertSharedString(value);
                        cell.CellValue = new CellValue(idx.ToString());
                        cell.DataType = new EnumValue<CellValues>(CellValues.SharedString);
                    }
                }

                // 6. Patch General Specification Fields (rows 3..22)
                foreach (var kv in templateMap.GeneralFields)
                {
                    string factKey = kv.Key;
                    var coord = kv.Value;
                    if (coord.Sheet == "Verification List")
                    {
                        string val = "";
                        if (factKey == "generalComments")
                        {
                            val = generalComments;
                        }
                        else if (factKey == "unit.date")
                        {
                            val = facts.TryGetValue("unit.date", out var dateFact) && !string.IsNullOrWhiteSpace(dateFact.Value?.ToString())
                                ? dateFact.Value.ToString()!
                                : DateTime.Now.ToString("yyyy-MM-dd");
                        }
                        else if (facts.TryGetValue(factKey, out var fact))
                        {
                            if (fact.Value is bool b)
                            {
                                val = b ? "Yes" : "No";
                            }
                            else if (fact.Value is System.Text.Json.JsonElement je && (je.ValueKind == System.Text.Json.JsonValueKind.True || je.ValueKind == System.Text.Json.JsonValueKind.False))
                            {
                                val = je.GetBoolean() ? "Yes" : "No";
                            }
                            else if (bool.TryParse(fact.Value?.ToString(), out bool bParsed))
                            {
                                val = bParsed ? "Yes" : "No";
                            }
                            else
                            {
                                val = fact.Value?.ToString() ?? "";
                            }
                        }
                        SetCellValue(coord.Cell, val);
                    }
                }

                // 7. Patch Special Quotes (rows 4..25)
                var sqRange = templateMap.SqRange;
                for (int slot = 1; slot <= 22; slot++)
                {
                    int rowNum = sqRange.StartRow + slot - 1;
                    var sq = sqItems.FirstOrDefault(s => s.Slot == slot);
                    string slotCell = $"{sqRange.SlotCol}{rowNum}";
                    string textCell = $"{sqRange.TextCol}{rowNum}";

                    SetCellValue(slotCell, slot.ToString(), true);
                    SetCellValue(textCell, sq?.Text ?? "");
                }

                // 8. Clean static template rows >= 26 and rebuild dynamically
                var existingRows = sheetData.Elements<Row>().ToList();
                uint currentImplicitRow = 1;
                foreach (var r in existingRows)
                {
                    if (r.RowIndex != null)
                    {
                        currentImplicitRow = r.RowIndex.Value;
                    }
                    if (currentImplicitRow >= 26)
                    {
                        r.Remove();
                    }
                    currentImplicitRow++;
                }

                // Preserve merge cells for header area (< 26) and clear old dynamic merges
                var mergeCellsElement = ws.Elements<MergeCells>().FirstOrDefault();
                var retainedMerges = new List<string>();
                if (mergeCellsElement != null)
                {
                    foreach (var mc in mergeCellsElement.Elements<MergeCell>())
                    {
                        string refVal = mc.Reference?.Value ?? "";
                        if (IsHeaderMerge(refVal))
                        {
                            retainedMerges.Add(refVal);
                        }
                    }
                    mergeCellsElement.Remove();
                }

                var dynamicMerges = new List<string>(retainedMerges);
                string detailerName = facts.TryGetValue("unit.detailer", out var dFact) ? (dFact.Value?.ToString() ?? "TD") : "TD";
                string initials = facts.TryGetValue("unit.detailerInitials", out var initFact) && !string.IsNullOrWhiteSpace(initFact.Value?.ToString())
                    ? initFact.Value.ToString()!.Trim()
                    : DeriveInitials(detailerName);

                uint currentRow = 26;
                bool zebraState = false;

                // Shared string pre-inserts for repeated headers
                int strNa = InsertSharedString("N/A");
                int strDetailerCheck = InsertSharedString("Detailer Check off");
                int strCheckerCheck = InsertSharedString("Checker Check off");

                var exportChecklists = checklists
                    .Where(c => c.Applicability != RuleApplicability.NotApplicable)
                    .ToList();
                // --- SECTION 1: GENERAL UNIT VERIFICATIONS ---
                var unitChecks = exportChecklists.Where(c => c.ScopeTargetId == "unit").ToList();
                if (unitChecks.Any())
                {
                    // Main Section Header
                    var secRow = CreateSectionHeaderRow(currentRow, "=== GENERAL UNIT VERIFICATIONS ===", InsertSharedString("=== GENERAL UNIT VERIFICATIONS ==="));
                    sheetData.AppendChild(secRow);
                    dynamicMerges.Add($"B{currentRow}:W{currentRow}");
                    currentRow++;

                    // Group by category
                    var unitCatGroups = unitChecks
                        .GroupBy(c =>
                        {
                            var rule = rules.FirstOrDefault(r => r.Id == c.RuleId || r.SemanticKey == c.SemanticKey);
                            return rule?.Category ?? "General";
                        })
                        .OrderBy(g => g.Key);

                    foreach (var catGroup in unitCatGroups)
                    {
                        string catTitle = $"[Category: {catGroup.Key}]";
                        var subRow = CreateCategorySubheaderRow(currentRow, catTitle, InsertSharedString(catTitle), strNa, strDetailerCheck, strCheckerCheck);
                        sheetData.AppendChild(subRow);
                        dynamicMerges.Add($"B{currentRow}:R{currentRow}");
                        dynamicMerges.Add($"T{currentRow}:U{currentRow}");
                        dynamicMerges.Add($"V{currentRow}:W{currentRow}");
                        currentRow++;

                        foreach (var inst in catGroup)
                        {
                            var rule = rules.FirstOrDefault(r => r.Id == inst.RuleId || r.SemanticKey == inst.SemanticKey);
                            if (rule == null) continue;

                            var checkRow = CreateCheckRow(
                                currentRow,
                                rule.Id,
                                rule.Text,
                                inst,
                                initials,
                                zebraState,
                                InsertSharedString
                            );

                            sheetData.AppendChild(checkRow);
                            dynamicMerges.Add($"C{currentRow}:R{currentRow}");
                            dynamicMerges.Add($"T{currentRow}:U{currentRow}");
                            dynamicMerges.Add($"V{currentRow}:W{currentRow}");

                            zebraState = !zebraState;
                            currentRow++;
                        }
                    }
                }

                // --- SECTION 2..N: SHIPPING SKIDS VERIFICATIONS ---
                var skidTargetIds = exportChecklists
                    .Where(c => c.ScopeTargetId != "unit")
                    .Select(c => c.ScopeTargetId)
                    .Distinct()
                    .OrderBy(id => id)
                    .ToList();

                foreach (var skidId in skidTargetIds)
                {
                    var skidChecks = exportChecklists.Where(c => c.ScopeTargetId == skidId).ToList();
                    if (!skidChecks.Any()) continue;

                    // Determine friendly skid name
                    string skidName = skidId;
                    if (graph?.Skids != null)
                    {
                        var matchingSkid = graph.Skids.FirstOrDefault(s => s.Id == skidId);
                        if (matchingSkid != null)
                        {
                            skidName = matchingSkid.Name;
                        }
                    }

                    // Skid Main Header
                    string skidHeader = $"=== {skidName.ToUpperInvariant()} VERIFICATIONS ===";
                    var secRow = CreateSectionHeaderRow(currentRow, skidHeader, InsertSharedString(skidHeader));
                    sheetData.AppendChild(secRow);
                    dynamicMerges.Add($"B{currentRow}:W{currentRow}");
                    currentRow++;

                    // Group by Category & Subgroup
                    var skidCatGroups = skidChecks
                        .GroupBy(c =>
                        {
                            var rule = rules.FirstOrDefault(r => r.Id == c.RuleId || r.SemanticKey == c.SemanticKey);
                            return new
                            {
                                Category = rule?.Category ?? "Base",
                                Subgroup = rule?.Subgroup ?? "General"
                            };
                        })
                        .OrderBy(g => g.Key.Category)
                        .ThenBy(g => g.Key.Subgroup);

                    foreach (var catGroup in skidCatGroups)
                    {
                        string subTitle = catGroup.Key.Category == "Internals"
                            ? $"[Internals: {catGroup.Key.Subgroup}]"
                            : $"[Category: {catGroup.Key.Category}]";

                        var subRow = CreateCategorySubheaderRow(currentRow, subTitle, InsertSharedString(subTitle), strNa, strDetailerCheck, strCheckerCheck);
                        sheetData.AppendChild(subRow);
                        dynamicMerges.Add($"B{currentRow}:R{currentRow}");
                        dynamicMerges.Add($"T{currentRow}:U{currentRow}");
                        dynamicMerges.Add($"V{currentRow}:W{currentRow}");
                        currentRow++;

                        foreach (var inst in catGroup)
                        {
                            var rule = rules.FirstOrDefault(r => r.Id == inst.RuleId || r.SemanticKey == inst.SemanticKey);
                            if (rule == null) continue;

                            var checkRow = CreateCheckRow(
                                currentRow,
                                rule.Id,
                                rule.Text,
                                inst,
                                initials,
                                zebraState,
                                InsertSharedString
                            );

                            sheetData.AppendChild(checkRow);
                            dynamicMerges.Add($"C{currentRow}:R{currentRow}");
                            dynamicMerges.Add($"T{currentRow}:U{currentRow}");
                            dynamicMerges.Add($"V{currentRow}:W{currentRow}");

                            zebraState = !zebraState;
                            currentRow++;
                        }
                    }
                }

                // 9. Re-append MergeCells element in schema-valid order
                if (dynamicMerges.Any())
                {
                    var newMergeCells = new MergeCells { Count = (uint)dynamicMerges.Count };
                    foreach (var m in dynamicMerges)
                    {
                        newMergeCells.AppendChild(new MergeCell { Reference = m });
                    }

                    // Insert MergeCells in valid schema position (after SheetData, before ConditionalFormatting/DataValidations/PageMargins/etc.)
                    var nextElement = ws.Elements<PhoneticProperties>().FirstOrDefault() as OpenXmlElement
                        ?? ws.Elements<ConditionalFormatting>().FirstOrDefault() as OpenXmlElement
                        ?? ws.Elements<DataValidations>().FirstOrDefault() as OpenXmlElement
                        ?? ws.Elements<Hyperlinks>().FirstOrDefault() as OpenXmlElement
                        ?? ws.Elements<PrintOptions>().FirstOrDefault() as OpenXmlElement
                        ?? ws.Elements<PageMargins>().FirstOrDefault() as OpenXmlElement
                        ?? ws.Elements<PageSetup>().FirstOrDefault() as OpenXmlElement;

                    if (nextElement != null)
                    {
                        ws.InsertBefore(newMergeCells, nextElement);
                    }
                    else
                    {
                        ws.AppendChild(newMergeCells);
                    }
                }

                // 10. Generate Hidden Audit Log Sheet to audit pencil-whipping
                AddAuditLogSheet(wbPart, checklists, rules, detailerName, initials, graph, InsertSharedString);

                // 11. Remove CalculationChainPart if present so Excel rebuilds formulas freshly
                if (wbPart.CalculationChainPart != null)
                {
                    wbPart.DeletePart(wbPart.CalculationChainPart);
                }

                // 11. Update sst count attributes if present
                if (sst.Count != null)
                {
                    sst.Count = (uint)sstCount;
                }
                if (sst.UniqueCount != null)
                {
                    sst.UniqueCount = (uint)stringMap.Count;
                }

                // Save shared strings, worksheet, and workbook
                sst.Save();
                ws.Save();
                wbPart.Workbook.Save();
            }
        }

        private static bool IsHeaderMerge(string mergeRef)
        {
            if (string.IsNullOrEmpty(mergeRef)) return false;
            var parts = mergeRef.Split(':');
            foreach (var p in parts)
            {
                string rowStr = new string(p.Where(char.IsDigit).ToArray());
                if (uint.TryParse(rowStr, out uint r) && r >= 26)
                {
                    return false;
                }
            }
            return true;
        }

        private static string GetCategorySheetName(RuleDefinition rule)
        {
            if (string.Equals(rule.Category, "Base", StringComparison.OrdinalIgnoreCase)) return "Base";
            if (string.Equals(rule.Category, "Paperwork", StringComparison.OrdinalIgnoreCase)) return "Paperwork";
            if (string.Equals(rule.Category, "MOM", StringComparison.OrdinalIgnoreCase)) return "MOM";
            if (string.Equals(rule.Category, "Housing", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(rule.Category, "UTL", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(rule.Category, "Knockdown", StringComparison.OrdinalIgnoreCase))
            {
                return "Housing";
            }

            if (string.Equals(rule.Category, "Internals", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(rule.Category, "Internal", StringComparison.OrdinalIgnoreCase))
            {
                if (string.Equals(rule.Subgroup, "Drain Pan", StringComparison.OrdinalIgnoreCase)) return "Drain Pan";
                if (string.Equals(rule.Subgroup, "Coil Segments", StringComparison.OrdinalIgnoreCase)) return "Coil Panels";
                if (string.Equals(rule.Subgroup, "Reconnects", StringComparison.OrdinalIgnoreCase)) return "Reconnects";
                return "Internal";
            }

            if (string.Equals(rule.Category, "Drain Pan", StringComparison.OrdinalIgnoreCase)) return "Drain Pan";
            if (string.Equals(rule.Category, "Coil Panels", StringComparison.OrdinalIgnoreCase)) return "Coil Panels";
            if (string.Equals(rule.Category, "Reconnects", StringComparison.OrdinalIgnoreCase)) return "Reconnects";

            return "Housing";
        }

        private static void AdaptCheckInformationFormulas(WorkbookPart wbPart, HashSet<string> activeCategorySheets)
        {
            var ciSheet = wbPart.Workbook.Sheets?.Elements<Sheet>().FirstOrDefault(s => s.Name?.Value == "Check Information");
            if (ciSheet == null || ciSheet.Id == null) return;

            var ciWsPart = (WorksheetPart)wbPart.GetPartById(ciSheet.Id!);
            var ciWs = ciWsPart.Worksheet;

            var catCellMap = new Dictionary<string, (string FCell, string DCell)>
            {
                { "Base", ("B8", "C8") },
                { "Drain Pan", ("B9", "C9") },
                { "Housing", ("B10", "C10") },
                { "Paperwork", ("B11", "C11") },
                { "Internal", ("B12", "C12") },
                { "Coil Panels", ("B13", "C13") },
                { "Reconnects", ("B14", "C14") },
                { "MOM", ("B15", "C15") }
            };

            foreach (var kvp in catCellMap)
            {
                string catName = kvp.Key;
                var (fCellRef, dCellRef) = kvp.Value;

                if (!activeCategorySheets.Contains(catName))
                {
                    ClearFormulaToZero(ciWs, fCellRef);
                    ClearFormulaToZero(ciWs, dCellRef);
                }
            }

            // B19 formula
            var b19Cell = ciWs.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == "B19");
            if (b19Cell != null)
            {
                var presentForB19 = AllCategorySheets.Where(s => activeCategorySheets.Contains(s)).ToList();
                if (presentForB19.Any())
                {
                    string formulaText = string.Join("+", presentForB19.Select(s => s.Contains(' ') ? $"'{s}'!H1" : $"{s}!H1"));
                    b19Cell.CellFormula = new CellFormula(formulaText);
                }
                else
                {
                    b19Cell.CellFormula?.Remove();
                    b19Cell.CellValue = new CellValue("0");
                    b19Cell.DataType = CellValues.Number;
                }
            }

            // B20 formula
            var b20Cell = ciWs.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == "B20");
            if (b20Cell != null)
            {
                var presentForB20 = new[] { "Base", "Housing", "Paperwork" }.Where(s => activeCategorySheets.Contains(s)).ToList();
                if (presentForB20.Any())
                {
                    string formulaText = string.Join("+", presentForB20.Select(s => $"{s}!J1"));
                    b20Cell.CellFormula = new CellFormula(formulaText);
                }
                else
                {
                    b20Cell.CellFormula?.Remove();
                    b20Cell.CellValue = new CellValue("0");
                    b20Cell.DataType = CellValues.Number;
                }
            }

            ciWs.Save();
        }

        private static void ClearFormulaToZero(Worksheet ws, string cellReference)
        {
            var cell = ws.Descendants<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellReference);
            if (cell != null)
            {
                cell.CellFormula?.Remove();
                cell.CellValue = new CellValue("0");
                cell.DataType = CellValues.Number;
            }
        }

        private static Row CreateSectionHeaderRow(uint rowIndex, string title, int sharedStringIdx)
        {
            var row = new Row { RowIndex = rowIndex };
            row.AppendChild(new Cell { CellReference = $"B{rowIndex}", StyleIndex = 98U, DataType = CellValues.SharedString, CellValue = new CellValue(sharedStringIdx.ToString()) });
            string[] cols = { "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V" };
            foreach (var c in cols)
            {
                row.AppendChild(new Cell { CellReference = $"{c}{rowIndex}", StyleIndex = 99U });
            }
            row.AppendChild(new Cell { CellReference = $"W{rowIndex}", StyleIndex = 100U });
            return row;
        }

        private static Row CreateCategorySubheaderRow(uint rowIndex, string subtitle, int sharedStringIdx, int naStringIdx, int detailerStringIdx, int checkerStringIdx)
        {
            var row = new Row { RowIndex = rowIndex };
            row.AppendChild(new Cell { CellReference = $"B{rowIndex}", StyleIndex = 70U, DataType = CellValues.SharedString, CellValue = new CellValue(sharedStringIdx.ToString()) });
            string[] crCols = { "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R" };
            foreach (var c in crCols)
            {
                row.AppendChild(new Cell { CellReference = $"{c}{rowIndex}", StyleIndex = 71U });
            }
            row.AppendChild(new Cell { CellReference = $"S{rowIndex}", StyleIndex = 45U, DataType = CellValues.SharedString, CellValue = new CellValue(naStringIdx.ToString()) });
            row.AppendChild(new Cell { CellReference = $"T{rowIndex}", StyleIndex = 96U, DataType = CellValues.SharedString, CellValue = new CellValue(detailerStringIdx.ToString()) });
            row.AppendChild(new Cell { CellReference = $"U{rowIndex}", StyleIndex = 96U });
            row.AppendChild(new Cell { CellReference = $"V{rowIndex}", StyleIndex = 96U, DataType = CellValues.SharedString, CellValue = new CellValue(checkerStringIdx.ToString()) });
            row.AppendChild(new Cell { CellReference = $"W{rowIndex}", StyleIndex = 97U });
            return row;
        }

        private static Row CreateCheckRow(
            uint rowIndex,
            string ruleId,
            string text,
            ChecklistInstance inst,
            string initials,
            bool isEvenZebra,
            Func<string, int> insertSharedString)
        {
            var row = new Row { RowIndex = rowIndex };
            uint bStyle = isEvenZebra ? 42U : 41U;
            uint cStyle = isEvenZebra ? 63U : 61U;
            uint rEndStyle = isEvenZebra ? 64U : 62U;
            uint sStyle = isEvenZebra ? 47U : 46U;
            uint tStyle = isEvenZebra ? 80U : 78U;
            uint wEndStyle = isEvenZebra ? 81U : 79U;

            row.AppendChild(new Cell { CellReference = $"B{rowIndex}", StyleIndex = bStyle, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString(ruleId).ToString()) });
            row.AppendChild(new Cell { CellReference = $"C{rowIndex}", StyleIndex = cStyle, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString(text).ToString()) });

            string[] fillerCols = { "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q" };
            foreach (var c in fillerCols)
            {
                row.AppendChild(new Cell { CellReference = $"{c}{rowIndex}", StyleIndex = cStyle });
            }
            row.AppendChild(new Cell { CellReference = $"R{rowIndex}", StyleIndex = rEndStyle });

            string naVal = "";
            if (inst.Applicability == RuleApplicability.NeedsInput) naVal = "Needs Input";
            else if (inst.Applicability == RuleApplicability.NotApplicable) naVal = "Not Applicable";
            else if (inst.Status == CheckStatus.NA) naVal = "N/A";

            if (!string.IsNullOrEmpty(naVal))
            {
                row.AppendChild(new Cell { CellReference = $"S{rowIndex}", StyleIndex = sStyle, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString(naVal).ToString()) });
            }
            else
            {
                row.AppendChild(new Cell { CellReference = $"S{rowIndex}", StyleIndex = sStyle });
            }

            string detailerVal = "0";
            if (inst.Applicability == RuleApplicability.NeedsInput) detailerVal = "Needs Input";
            else if (inst.Applicability == RuleApplicability.NotApplicable) detailerVal = "Not Applicable";
            else if (inst.Status == CheckStatus.NA) detailerVal = "N/A";
            else if (inst.Status == CheckStatus.Passed) detailerVal = "Yes";
            else if (inst.Status == CheckStatus.Flagged) detailerVal = "Flagged";

            row.AppendChild(new Cell { CellReference = $"T{rowIndex}", StyleIndex = tStyle, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString(detailerVal).ToString()) });
            row.AppendChild(new Cell { CellReference = $"U{rowIndex}", StyleIndex = tStyle });

            row.AppendChild(new Cell { CellReference = $"V{rowIndex}", StyleIndex = tStyle, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString("0").ToString()) });
            row.AppendChild(new Cell { CellReference = $"W{rowIndex}", StyleIndex = wEndStyle });

            string comments = inst.DetailerComment;
            if (!string.IsNullOrEmpty(comments))
            {
                row.AppendChild(new Cell { CellReference = $"Y{rowIndex}", StyleIndex = 19U, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString(comments).ToString()) });
            }
            else
            {
                row.AppendChild(new Cell { CellReference = $"Y{rowIndex}", StyleIndex = 19U });
            }

            bool isReviewed = inst.Status == CheckStatus.Passed || inst.Status == CheckStatus.Flagged;
            string stampInitials = !string.IsNullOrWhiteSpace(inst.DetailerInitials) ? inst.DetailerInitials! : initials;
            if (isReviewed && !string.IsNullOrEmpty(stampInitials))
            {
                row.AppendChild(new Cell { CellReference = $"Z{rowIndex}", StyleIndex = 19U, DataType = CellValues.SharedString, CellValue = new CellValue(insertSharedString(stampInitials).ToString()) });
            }
            else
            {
                row.AppendChild(new Cell { CellReference = $"Z{rowIndex}", StyleIndex = 19U });
            }

            return row;
        }

        public static string DeriveInitials(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "TD";
            var parts = name.Trim().Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return "TD";
            if (parts.Length == 1)
            {
                return parts[0].Length >= 2 ? parts[0].Substring(0, 2).ToUpperInvariant() : parts[0].ToUpperInvariant();
            }
            var letters = parts.Select(p => char.ToUpperInvariant(p[0])).ToArray();
            var result = new string(letters);
            return result.Length > 4 ? result.Substring(0, 4) : result;
        }

        private static void AddAuditLogSheet(
            WorkbookPart wbPart,
            List<ChecklistInstance> checklists,
            List<RuleDefinition> rules,
            string detailerName,
            string defaultInitials,
            NormalizedXmlGraph? graph,
            Func<string, int> insertSharedString)
        {
            var sheetsElement = wbPart.Workbook.Sheets ?? wbPart.Workbook.AppendChild(new Sheets());

            // If an existing Audit Log sheet is present (e.g. from template or previous export), remove it
            var existingSheet = sheetsElement.Elements<Sheet>().FirstOrDefault(s => string.Equals(s.Name?.Value, "Audit Log", StringComparison.OrdinalIgnoreCase));
            if (existingSheet != null && existingSheet.Id != null)
            {
                var existingPart = wbPart.GetPartById(existingSheet.Id!);
                existingSheet.Remove();
                wbPart.DeletePart(existingPart);
            }

            var auditWsPart = wbPart.AddNewPart<WorksheetPart>();
            var auditWs = new Worksheet();
            var auditSheetData = new SheetData();
            auditWs.AppendChild(auditSheetData);
            auditWsPart.Worksheet = auditWs;

            uint maxSheetId = sheetsElement.Elements<Sheet>().Select(s => s.SheetId?.Value ?? 0).DefaultIfEmpty(0U).Max();
            uint auditSheetId = maxSheetId + 1;
            string relId = wbPart.GetIdOfPart(auditWsPart);

            var auditSheet = new Sheet
            {
                Id = relId,
                SheetId = auditSheetId,
                Name = "Audit Log",
                State = SheetStateValues.Hidden
            };
            sheetsElement.AppendChild(auditSheet);

            void AddAuditCell(Row row, string col, uint rowIndex, string text)
            {
                int idx = insertSharedString(text);
                row.AppendChild(new Cell
                {
                    CellReference = $"{col}{rowIndex}",
                    DataType = CellValues.SharedString,
                    CellValue = new CellValue(idx.ToString())
                });
            }

            // Row 1: Header Row
            var headerRow = new Row { RowIndex = 1 };
            AddAuditCell(headerRow, "A", 1, "Timestamp (UTC)");
            AddAuditCell(headerRow, "B", 1, "Rule ID");
            AddAuditCell(headerRow, "C", 1, "Rule Description");
            AddAuditCell(headerRow, "D", 1, "Scope / Skid");
            AddAuditCell(headerRow, "E", 1, "Status");
            AddAuditCell(headerRow, "F", 1, "Detailer Name");
            AddAuditCell(headerRow, "G", 1, "Sign-off Initials");
            AddAuditCell(headerRow, "H", 1, "Detailer Comment");
            auditSheetData.AppendChild(headerRow);

            // Reviewed checks: Passed or Flagged, ordered chronologically by UpdatedAt
            var completedChecks = checklists
                .Where(c => c.Status == CheckStatus.Passed || c.Status == CheckStatus.Flagged)
                .OrderBy(c => c.UpdatedAt)
                .ToList();

            uint auditRowIndex = 2;
            foreach (var inst in completedChecks)
            {
                var rule = rules.FirstOrDefault(r => r.Id == inst.RuleId || r.SemanticKey == inst.SemanticKey);
                string skidName = inst.ScopeTargetId;
                if (inst.ScopeTargetId == "unit")
                {
                    skidName = "General Unit";
                }
                else if (graph?.Skids != null)
                {
                    var matchingSkid = graph.Skids.FirstOrDefault(s => s.Id == inst.ScopeTargetId);
                    if (matchingSkid != null)
                    {
                        skidName = matchingSkid.Name;
                    }
                }

                string timeStr = inst.UpdatedAt;
                if (DateTime.TryParse(inst.UpdatedAt, out var parsedDt))
                {
                    timeStr = parsedDt.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss");
                }

                string rowInitials = !string.IsNullOrWhiteSpace(inst.DetailerInitials) ? inst.DetailerInitials : defaultInitials;

                var row = new Row { RowIndex = auditRowIndex };
                AddAuditCell(row, "A", auditRowIndex, timeStr);
                AddAuditCell(row, "B", auditRowIndex, rule?.Id ?? inst.RuleId);
                AddAuditCell(row, "C", auditRowIndex, rule?.Text ?? "");
                AddAuditCell(row, "D", auditRowIndex, skidName);
                AddAuditCell(row, "E", auditRowIndex, inst.Status.ToString());
                AddAuditCell(row, "F", auditRowIndex, detailerName);
                AddAuditCell(row, "G", auditRowIndex, rowInitials);
                AddAuditCell(row, "H", auditRowIndex, inst.DetailerComment ?? "");

                auditSheetData.AppendChild(row);
                auditRowIndex++;
            }

            auditWs.Save();
        }
    }
}
