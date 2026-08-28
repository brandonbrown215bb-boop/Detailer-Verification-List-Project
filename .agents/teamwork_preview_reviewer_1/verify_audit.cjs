const fs = require('fs');
const path = require('path');

const auditPath = path.resolve('audits/documentation_gap_audit.md');
const content = fs.readFileSync(auditPath, 'utf8');

const findingRegex = /#### `\[(BLOCKER|SLOW|MINOR)-(\d+)\] ([^`]+)`/g;
let match;
const findings = [];
while ((match = findingRegex.exec(content)) !== null) {
  findings.push({
    fullId: `${match[1]}-${match[2]}`,
    type: match[1],
    num: parseInt(match[2], 10),
    title: match[3],
    index: match.index
  });
}

console.log('Total findings detected:', findings.length);

const categories = { BLOCKER: 0, SLOW: 0, MINOR: 0 };
findings.forEach(f => categories[f.type]++);
console.log('Counts by type:', categories);

// Verify sequence
let seqErrors = 0;
['BLOCKER', 'SLOW', 'MINOR'].forEach(type => {
  const list = findings.filter(f => f.type === type);
  for (let i = 0; i < list.length; i++) {
    if (list[i].num !== i + 1) {
      console.error(`Sequence gap in ${type}: expected ${i+1}, got ${list[i].num}`);
      seqErrors++;
    }
  }
});
if (seqErrors === 0) console.log('Sequence validation: PASSED');

// Check order: all BLOCKERs before SLOWs before MINORs
let lastTypeIdx = 0;
const typeOrder = { BLOCKER: 0, SLOW: 1, MINOR: 2 };
let orderErrors = 0;
findings.forEach(f => {
  const currentIdx = typeOrder[f.type];
  if (currentIdx < lastTypeIdx) {
    console.error(`Ordering violation: ${f.fullId} appeared after higher index type`);
    orderErrors++;
  }
  lastTypeIdx = currentIdx;
});
if (orderErrors === 0) console.log('Ordering validation: PASSED');

// Check fields for each finding
const requiredFields = [
  'Document & Section Reference',
  'Gap Category',
  'Impact Description',
  'One-Sentence Fix Note'
];
const allowedGapCategories = [
  'Missing Information',
  'Unstated Assumption',
  'Ambiguous Step',
  'Unguided Error Scenario',
  'Outdated / Contradictory'
];

const gapCategoryCounts = {};
allowedGapCategories.forEach(c => gapCategoryCounts[c] = { BLOCKER: 0, SLOW: 0, MINOR: 0, total: 0 });

let fieldErrors = 0;
for (let i = 0; i < findings.length; i++) {
  const f = findings[i];
  const start = f.index;
  const end = i < findings.length - 1 ? findings[i+1].index : content.indexOf('## 4. Consolidated', start);
  const block = content.slice(start, end);

  requiredFields.forEach(field => {
    if (!block.includes(`- **${field}**:`)) {
      console.error(`Missing field '${field}' in ${f.fullId}`);
      fieldErrors++;
    }
  });

  const catMatch = block.match(/- \*\*Gap Category\*\*:\s*`([^`]+)`/);
  if (!catMatch) {
    console.error(`Could not parse Gap Category in ${f.fullId}`);
    fieldErrors++;
  } else {
    const cat = catMatch[1];
    if (!allowedGapCategories.includes(cat)) {
      console.error(`Invalid Gap Category '${cat}' in ${f.fullId}`);
      fieldErrors++;
    } else {
      gapCategoryCounts[cat][f.type]++;
      gapCategoryCounts[cat].total++;
    }
  }
}
if (fieldErrors === 0) console.log('5-Field schema validation: PASSED');

console.log('Gap category breakdown matrix:');
console.table(gapCategoryCounts);
