using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using AHUVerification.Core.Models;

namespace AHUVerification.Core.Services
{
    public class OpenXmlTemplatePatcher
    {
        public void PatchTemplate(
            string templateFilePath,
            string outputFilePath,
            TemplateMap templateMap,
            Dictionary<string, Fact> facts,
            List<SpecialQuote> sqItems,
            List<ChecklistInstance> checklists,
            List<RuleDefinition> rules,
            string generalComments = "",
            bool isDraft = false)
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
            File.Copy(templateFilePath, outputFilePath, true);

            using var doc = SpreadsheetDocument.Open(outputFilePath, true);
            var wbPart = doc.WorkbookPart ?? throw new InvalidOperationException("Invalid workbook part.");

            // Shared String Table handling
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

            // Locate Verification List sheet
            var vlSheet = wbPart.Workbook.Sheets?.Elements<Sheet>().FirstOrDefault(s => s.Name?.Value == "Verification List");
            if (vlSheet == null || vlSheet.Id == null)
                throw new InvalidOperationException("Verification List worksheet not found in template.");

            var wsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
            var ws = wsPart.Worksheet;
            var sheetData = ws.GetFirstChild<SheetData>() ?? ws.AppendChild(new SheetData());

            void SetCellValue(string cellReference, string value, bool isNumeric = false)
            {
                if (string.IsNullOrEmpty(cellReference)) return;

                // Extract row index from cell reference e.g. "D3" -> 3
                string rowStr = new string(cellReference.Where(char.IsDigit).ToArray());
                if (!uint.TryParse(rowStr, out uint rowIndex)) return;

                var row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex != null && r.RowIndex.Value == rowIndex);
                if (row == null)
                {
                    row = new Row { RowIndex = rowIndex };
                    // Insert in order
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
                    cell.DataType = new DocumentFormat.OpenXml.EnumValue<CellValues>(CellValues.SharedString);
                }
            }

            // 1. Patch General Specification Fields
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
                    else if (facts.TryGetValue(factKey, out var fact))
                    {
                        val = fact.Value?.ToString() ?? "";
                    }
                    SetCellValue(coord.Cell, val);
                }
            }

            // 2. Patch Special Quotes (rows 4..25)
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

            // 3. Patch Verification Rules (cols S, T, V, Y, Z)
            string detailerName = facts.TryGetValue("unit.detailer", out var dFact) ? (dFact.Value?.ToString() ?? "TD") : "TD";
            string initials = detailerName.Length >= 2 ? detailerName.Substring(0, 2).ToUpperInvariant() : detailerName.ToUpperInvariant();

            foreach (var rule in rules)
            {
                if (templateMap.RuleCellMappings.TryGetValue(rule.SemanticKey, out var mapping))
                {
                    // Find checklist instances for this rule across targets
                    var instances = checklists.Where(c => c.RuleId == rule.Id || c.SemanticKey == rule.SemanticKey).ToList();
                    bool isPassed = instances.Any(i => i.Status == CheckStatus.Passed);
                    bool isNA = instances.All(i => i.Status == CheckStatus.NA || i.Applicability == RuleApplicability.NotApplicable);
                    string comments = string.Join("; ", instances.Select(i => i.DetailerComment).Where(c => !string.IsNullOrWhiteSpace(c)));

                    // N/A column (S)
                    SetCellValue(mapping.NaCell, isNA ? "Yes" : "0");

                    // Detailer Check column (T)
                    SetCellValue(mapping.DetailerCell, isPassed ? "Yes" : "0");

                    // Comments column (Y)
                    if (!string.IsNullOrEmpty(comments))
                    {
                        SetCellValue(mapping.CommentsCell, comments);
                    }

                    // Initials column (Z)
                    SetCellValue(mapping.InitialsCell, initials);
                }
            }

            // Update sst count attributes if present
            if (sst.Count != null)
            {
                sst.Count = (uint)sstCount;
            }
            if (sst.UniqueCount != null)
            {
                sst.UniqueCount = (uint)stringMap.Count;
            }

            // Save shared strings and worksheet
            sst.Save();
            ws.Save();
            wbPart.Workbook.Save();
        }
    }
}
