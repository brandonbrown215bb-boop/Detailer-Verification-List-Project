import fs from 'fs';
import * as XLSX from '../node_modules/xlsx/xlsx.mjs';

const buf = fs.readFileSync('Detailing Verification List.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const ws = wb.Sheets['Verification List'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

for (let r = 20; r < 60; r++) {
  if (data[r]) {
    console.log(`Row ${r + 1}:`, JSON.stringify(data[r]));
  }
}
