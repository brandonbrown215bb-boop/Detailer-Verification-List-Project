import fs from 'fs';
import * as XLSX from '../node_modules/xlsx/xlsx.mjs';

const buf = fs.readFileSync('Detailing Verification List.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
console.log('Sheet names in Detailing Verification List.xlsx:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`Row count: ${data.length}`);
  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`Row ${i + 1}:`, JSON.stringify(data[i]));
  }
}
