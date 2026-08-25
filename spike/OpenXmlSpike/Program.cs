using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

namespace OpenXmlSpike
{
    class Program
    {
        static void Main(string[] args)
        {
            string sourceFile = Path.GetFullPath("Detailing Verification List.xlsx");
            if (!File.Exists(sourceFile))
            {
                sourceFile = Path.GetFullPath(@"..\..\Detailing Verification List.xlsx");
            }
            if (!File.Exists(sourceFile))
            {
                Console.WriteLine($"File not found: {sourceFile}");
                return;
            }
            Console.WriteLine($"Inspecting: {sourceFile}");
            using SpreadsheetDocument doc = SpreadsheetDocument.Open(sourceFile, false);
            WorkbookPart wbPart = doc.WorkbookPart!;
            SharedStringTablePart? sstPart = wbPart.SharedStringTablePart;
            var sst = sstPart?.SharedStringTable.Elements<SharedStringItem>().Select(s => s.InnerText).ToList() ?? new List<string>();

            var vlSheet = wbPart.Workbook.Sheets!.Elements<Sheet>().FirstOrDefault(s => s.Name == "Verification List");
            if (vlSheet != null)
            {
                WorksheetPart wsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
                var rows = wsPart.Worksheet.Descendants<Row>().ToList();
                Console.WriteLine($"\n================ ROWS 26 to 96 IN 'Verification List' ================");
                foreach (var row in rows.Where(r => r.RowIndex != null && r.RowIndex.Value >= 26 && r.RowIndex.Value <= 96))
                {
                    var cells = row.Elements<Cell>().Select(c => {
                        string val = c.CellValue?.Text ?? "";
                        if (c.DataType != null && c.DataType.Value == CellValues.SharedString && int.TryParse(val, out int sstIdx) && sstIdx < sst.Count)
                        {
                            val = sst[sstIdx];
                        }
                        return $"{c.CellReference}:{val}";
                    }).Where(s => !string.IsNullOrWhiteSpace(s.Split(':')[1]));
                    
                    if (cells.Any())
                    {
                        Console.WriteLine($"Row {row.RowIndex}: {string.Join(" | ", cells)}");
                    }
                }
            }

        }
    }
}
