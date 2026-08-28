const fs = require('fs');
const path = require('path');

const auditPath = path.resolve('audits/documentation_gap_audit.md');
const content = fs.readFileSync(auditPath, 'utf8');

// Parse findings with their cited document
const findingRegex = /#### `\[(BLOCKER|SLOW|MINOR)-(\d+)\] ([^`]+)`[\s\S]*?- \*\*Document & Section Reference\*\*:\s*`?([^`\n]+)`?/g;
let match;
const docFindings = {};

while ((match = findingRegex.exec(content)) !== null) {
  const type = match[1];
  const fullId = `${match[1]}-${match[2]}`;
  const docRef = match[4].trim();
  
  // Extract base document name/path
  let docPath = docRef.split(' § ')[0].trim().replace(/^`|`$/g, '').split(' (lines')[0].split(' (line')[0].split(' Lines')[0].split(' Line')[0].split(' lines')[0].split(' line')[0].trim();
  
  if (!docFindings[docPath]) {
    docFindings[docPath] = { BLOCKER: 0, SLOW: 0, MINOR: 0, items: [] };
  }
  docFindings[docPath][type]++;
  docFindings[docPath].items.push(fullId);
}

console.log('Document finding aggregation:');
console.log(docFindings);
