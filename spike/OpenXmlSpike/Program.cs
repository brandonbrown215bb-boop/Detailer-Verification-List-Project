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
            string sourceFile = @"C:\Users\brand\Documents\Detailer Verification List Project\Detailing Verification List.xlsx";
            using SpreadsheetDocument doc = SpreadsheetDocument.Open(sourceFile, false);
            WorkbookPart wbPart = doc.WorkbookPart!;
            SharedStringTablePart sstPart = wbPart.SharedStringTablePart!;
            var sst = sstPart.SharedStringTable.Elements<SharedStringItem>().Select(s => s.InnerText).ToList();

            var vlSheet = wbPart.Workbook.Sheets!.Elements<Sheet>().FirstOrDefault(s => s.Name == "Verification List");
            if (vlSheet != null)
            {
                WorksheetPart wsPart = (WorksheetPart)wbPart.GetPartById(vlSheet.Id!);
                var rows = wsPart.Worksheet.Descendants<Row>().ToList();
                Console.WriteLine($"\n================ ALL ROWS IN 'Verification List' ({rows.Count}) ================");
                foreach (var row in rows)
                {
                    var cells = row.Elements<Cell>().Select(c => {
                        string val = c.CellValue?.Text ?? "";
                        if (c.DataType != null && c.DataType.Value == CellValues.SharedString && int.TryParse(val, out int sstIdx))
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
