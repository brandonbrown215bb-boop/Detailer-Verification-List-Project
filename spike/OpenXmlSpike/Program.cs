using System;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Validation;

namespace OpenXmlSpike
{
    class Program
    {
        static void Main(string[] args)
        {
            string sourceFile = @"C:\Users\brand\Documents\Detailer Verification List Project\Detailing Verification List.xlsx";
            string targetFile = @"C:\Users\brand\Documents\Detailer Verification List Project\spike\Detailing_Verification_List_Patched.xlsx";

            Console.WriteLine("=== PHASE 0: OpenXML Compatibility Spike ===");
            Console.WriteLine($"Source: {sourceFile}");
            Console.WriteLine($"Target: {targetFile}");

            // Step 1: Copy template
            File.Copy(sourceFile, targetFile, true);
            Console.WriteLine("[1/5] Template file copied successfully.");

            // Step 2: Open and patch target cells
            using (SpreadsheetDocument doc = SpreadsheetDocument.Open(targetFile, true))
            {
                WorkbookPart wbPart = doc.WorkbookPart ?? throw new InvalidOperationException("WorkbookPart missing");
                
                // Inspect sheets
                var sheets = wbPart.Workbook.Sheets?.Elements<Sheet>().ToList() ?? new();
                Console.WriteLine($"[2/5] Verified {sheets.Count} sheets in workbook:");
                foreach (var s in sheets)
                {
                    Console.WriteLine($"   - {s.Name} (Id: {s.Id})");
                }

                // Patch Header in 'Verification List'
                var vlSheet = sheets.FirstOrDefault(s => s.Name == "Verification List");
                if (vlSheet != null)
                {
                    WorksheetPart wsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
                    Worksheet ws = wsPart.Worksheet;
                    SheetData sheetData = ws.GetFirstChild<SheetData>() ?? ws.AppendChild(new SheetData());

                    // Cell D3: Detailer
                    SetCellValue(sheetData, "D3", "John Doe", CellValues.String);
                    // Cell D4: Date
                    SetCellValue(sheetData, "D4", DateTime.Now.ToString("yyyy-MM-dd"), CellValues.String);
                    // Cell D5: Job Name
                    SetCellValue(sheetData, "D5", "Hospital Tower Phase 2", CellValues.String);
                    // Cell D6: COM#
                    SetCellValue(sheetData, "D6", "COM-987654", CellValues.String);
                    // Cell D7: Shell Type
                    SetCellValue(sheetData, "D7", "ThermalBreak", CellValues.String);

                    // SQ items (Column G is index, Column H is SQ text in rows 4..6)
                    SetCellValue(sheetData, "H4", "SQ-001: Custom drain pan depth 3.5 in.", CellValues.String);
                    SetCellValue(sheetData, "H5", "SQ-002: Dual 630 fan wall configuration.", CellValues.String);

                    // Verification item checkmark (Row 29: Base lifting lugs check)
                    SetCellValue(sheetData, "X29", "Yes", CellValues.String);

                    // Verify DataValidations element exists
                    var dataValidations = ws.Elements<DataValidations>().FirstOrDefault();
                    Console.WriteLine($"[3/5] 'Verification List' DataValidations count: {dataValidations?.Count ?? 0}");

                    ws.Save();
                }

                // Patch 'Base' Sheet
                var baseSheet = sheets.FirstOrDefault(s => s.Name == "Base");
                if (baseSheet != null)
                {
                    WorksheetPart wsPart = (WorksheetPart)wbPart.GetPartById(baseSheet.Id!);
                    Worksheet ws = wsPart.Worksheet;
                    SheetData sheetData = ws.GetFirstChild<SheetData>() ?? ws.AppendChild(new SheetData());

                    // Set Detailer check / comment in row 4
                    SetCellValue(sheetData, "A4", "Done - All 4 lugs verified with ASSY manual p.391-40206-003", CellValues.String);
                    ws.Save();
                }

                // Check 'Check Information' Sheet formula integrity
                var checkSheet = sheets.FirstOrDefault(s => s.Name == "Check Information");
                if (checkSheet != null)
                {
                    WorksheetPart wsPart = (WorksheetPart)wbPart.GetPartById(checkSheet.Id!);
                    Worksheet ws = wsPart.Worksheet;
                    SheetData sheetData = ws.GetFirstChild<SheetData>() ?? ws.AppendChild(new SheetData());
                    
                    var formulas = sheetData.Descendants<CellFormula>().ToList();
                    Console.WriteLine($"[4/5] 'Check Information' Formulas count: {formulas.Count}");
                    foreach (var f in formulas.Take(5))
                    {
                        var parentCell = f.Parent as Cell;
                        Console.WriteLine($"   Formula in {parentCell?.CellReference}: {f.Text}");
                    }
                }

                wbPart.Workbook.Save();
            }

            // Step 3: Validate output with OpenXmlValidator
            Console.WriteLine("[5/5] Running OpenXmlValidator schema and semantic validation...");
            using (SpreadsheetDocument doc = SpreadsheetDocument.Open(targetFile, false))
            {
                OpenXmlValidator validator = new OpenXmlValidator(FileFormatVersions.Microsoft365);
                var errors = validator.Validate(doc).ToList();
                Console.WriteLine($"Validation completed with {errors.Count} schema errors.");
                foreach (var err in errors.Take(10))
                {
                    Console.WriteLine($"   Validation warning/error: {err.Description} (Path: {err.Path?.XPath})");
                }

                if (errors.Count == 0)
                {
                    Console.WriteLine(">>> RESULT: 100% CLEAN OPENXML ROUNDTRIP! 0 ERRORS. <<<");
                }
            }
        }

        static void SetCellValue(SheetData sheetData, string cellReference, string value, CellValues dataType)
        {
            uint rowIndex = uint.Parse(new string(cellReference.Where(char.IsDigit).ToArray()));
            
            Row? row = sheetData.Elements<Row>().FirstOrDefault(r => r.RowIndex != null && r.RowIndex.Value == rowIndex);
            if (row == null)
            {
                row = new Row() { RowIndex = rowIndex };
                sheetData.Append(row);
            }

            Cell? cell = row.Elements<Cell>().FirstOrDefault(c => c.CellReference?.Value == cellReference);
            if (cell == null)
            {
                cell = new Cell() { CellReference = cellReference };
                row.Append(cell);
            }

            cell.CellValue = new CellValue(value);
            cell.DataType = new EnumValue<CellValues>(dataType);
        }
    }
}
