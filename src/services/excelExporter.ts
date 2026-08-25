import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Fact, SpecialQuote, ChecklistInstance, RuleDefinition, NormalizedXmlGraph } from '../types';

export function exportToExcel(
  facts: Record<string, Fact>,
  sqItems: SpecialQuote[],
  checklists: ChecklistInstance[],
  rules: RuleDefinition[],
  graph?: NormalizedXmlGraph,
  fileName?: string,
  isDraft: boolean = false
): void {
  const wb = XLSX.utils.book_new();

  // 1. Revision List Sheet
  const revData = [
    ['REVISION'],
    ['SUBMITTED BY:', 'REV. LEVEL:', 'REV. DATE:', 'DESCRIPTION', 'APPROVAL DATE:', 'APPROVED BY:'],
    ['Tanner Dean', 14, new Date().toLocaleDateString(), isDraft ? 'Draft Incomplete Detailing Export' : 'Automated Ingestion & Verification Export (Skid Grouped)', new Date().toLocaleDateString(), 'BB']
  ];
  const wsRev = XLSX.utils.aoa_to_sheet(revData);
  XLSX.utils.book_append_sheet(wb, wsRev, 'Revision List');

  // 2. Verification List Sheet (Dynamic Skid-Grouped Layout)
  const vlData: (string | number)[][] = [];
  vlData.push([]);
  vlData.push(['', isDraft ? 'UNIT DETAILING VERIFICATION LIST [DRAFT - INCOMPLETE]' : 'UNIT DETAILING VERIFICATION LIST', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  vlData.push(['', 'DETAILER:', facts['unit.detailer']?.value || '', '', '', '', 'SQs & Deviation Items Related to Detailing']);
  vlData.push(['', 'DATE:', facts['unit.date']?.value || new Date().toISOString().split('T')[0]]);
  vlData.push(['', 'JOB NAME:', facts['unit.jobName']?.value || '']);
  vlData.push(['', 'COM#:', facts['unit.comNumber']?.value || '']);
  vlData.push(['', 'SHELL TYPE:', facts['unit.shellType']?.value || '']);
  vlData.push(['', 'UNIT TYPE:', facts['unit.unitType']?.value || '']);
  vlData.push(['', 'BASE HEIGHT:', `${facts['unit.baseHeight']?.value || 10}"`]);
  vlData.push(['', 'WALL THICKNESS:', `${facts['unit.wallThickness']?.value || 2}"`]);
  vlData.push(['', 'THERMAL BREAK:', facts['unit.thermalBreak']?.value || 'Yes']);
  vlData.push(['', 'ROOF PEAK:', String(facts['unit.roofPeak']?.value || '')]);
  vlData.push(['', 'CURBREST:', facts['unit.curbrest']?.value || 'Yes']);
  vlData.push(['', 'NOA:', facts['unit.noa']?.value || 'N/A']);
  vlData.push(['', 'SEISMIC:', facts['unit.isSeismic']?.value ? 'Yes' : 'No']);
  vlData.push(['', 'LOCATION:', facts['unit.location']?.value || 'Outdoor']);
  vlData.push(['', 'KNOCKDOWN:', facts['unit.knockdown']?.value || 'No']);
  vlData.push(['', 'UTL:', facts['unit.utl']?.value || 'No']);
  vlData.push(['', 'LINER MATERIAL', facts['unit.linerMaterial']?.value || 'STL GALV', 'GA', facts['unit.linerGauge']?.value || 22]);
  vlData.push(['', 'SKIN MATERIAL', facts['unit.skinMaterial']?.value || 'STL GALV PPC', 'GA', facts['unit.skinGauge']?.value || 18]);
  vlData.push(['', 'FLOOR MATERIAL', facts['unit.floorMaterial']?.value || 'STL GALV', 'GA', facts['unit.floorGauge']?.value || 16]);
  vlData.push(['', 'Additional Comments:', isDraft ? '[DRAFT - INCOMPLETE AUDIT] Verified against Config.xml pipeline.' : 'Verified against Config.xml automated pipeline.']);

  // Fill Special Quotes in columns G & H dynamically
  const maxSqRows = Math.max(sqItems.length, 10);
  for (let s = 1; s <= maxSqRows; s++) {
    const rowIdx = s + 2; // Row index in 0-based array
    while (vlData.length <= rowIdx) vlData.push([]);
    const sq = sqItems.find(item => item.slot === s);
    vlData[rowIdx][6] = s;
    vlData[rowIdx][7] = sq?.text || '';
  }

  // Ensure header has padding before checks
  vlData.push([]);
  vlData.push([]);

  // Column Headers for Verifications
  const columnsHeader = ['', 'Rule ID', 'Verification Check Item', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Status', 'Detailer Check', '', 'Checker Check', '', '', 'Detailer Comments', 'Initials'];

  const detailerInitials = facts['unit.detailer']?.value ? String(facts['unit.detailer'].value).split(' ').map(n => n[0]).join('').toUpperCase() : 'TD';

  // --- SECTION 1: GENERAL UNIT VERIFICATIONS ---
  const unitChecks = checklists.filter(c => c.scopeTargetId === 'unit' && c.applicability === 'Applicable');
  if (unitChecks.length > 0) {
    vlData.push(['', '=== GENERAL UNIT VERIFICATIONS ===']);
    vlData.push(columnsHeader);

    // Group by category
    const unitCatMap: Record<string, ChecklistInstance[]> = {};
    unitChecks.forEach(c => {
      const rule = rules.find(r => r.id === c.ruleId);
      const cat = rule?.category || 'General';
      if (!unitCatMap[cat]) unitCatMap[cat] = [];
      unitCatMap[cat].push(c);
    });

    Object.entries(unitCatMap).forEach(([category, items]) => {
      vlData.push(['', `[Category: ${category}]`]);
      items.forEach(inst => {
        const rule = rules.find(r => r.id === inst.ruleId);
        if (!rule) return;
        const isPassed = inst.status === 'Passed';
        vlData.push([
          '',
          rule.id,
          rule.text,
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          isPassed ? 'Verified' : 'Pending',
          isPassed ? 'Yes' : '0',
          '',
          '0',
          '', '',
          inst.detailerComment || '',
          detailerInitials
        ]);
      });
    });
    vlData.push([]);
  }

  // --- SECTION 2..N: SKID VERIFICATIONS ---
  const skids = graph?.skids || [];
  skids.forEach((skid) => {
    const skidChecks = checklists.filter(c => c.scopeTargetId === skid.id && c.applicability === 'Applicable');
    if (skidChecks.length === 0) return;

    vlData.push(['', `=== ${skid.name.toUpperCase()} VERIFICATIONS ===`]);
    vlData.push(columnsHeader);

    // Group by category & subgroup
    const skidCatMap: Record<string, Record<string, ChecklistInstance[]>> = {};
    skidChecks.forEach(c => {
      const rule = rules.find(r => r.id === c.ruleId);
      const cat = rule?.category || 'Base';
      const sub = rule?.subgroup || 'General';
      if (!skidCatMap[cat]) skidCatMap[cat] = {};
      if (!skidCatMap[cat][sub]) skidCatMap[cat][sub] = [];
      skidCatMap[cat][sub].push(c);
    });

    Object.entries(skidCatMap).forEach(([category, subMap]) => {
      Object.entries(subMap).forEach(([subgroup, items]) => {
        const headerLabel = category === 'Internals' ? `[Internals: ${subgroup}]` : `[Category: ${category}]`;
        vlData.push(['', headerLabel]);

        items.forEach(inst => {
          const rule = rules.find(r => r.id === inst.ruleId);
          if (!rule) return;
          const isPassed = inst.status === 'Passed';
          vlData.push([
            '',
            rule.id,
            rule.text,
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            isPassed ? 'Verified' : 'Pending',
            isPassed ? 'Yes' : '0',
            '',
            '0',
            '', '',
            inst.detailerComment || '',
            detailerInitials
          ]);
        });
      });
    });

    vlData.push([]);
  });

  const wsVL = XLSX.utils.aoa_to_sheet(vlData);
  XLSX.utils.book_append_sheet(wb, wsVL, 'Verification List');

  // 3. Check Information Sheet
  const checkData = [
    ['Check Information'],
    ['Detailer', facts['unit.detailer']?.value || ''],
    ['COM', facts['unit.comNumber']?.value || ''],
    ['Checker', 'Pending'],
    ['Date Checked', ''],
    ['Error Tracker'],
    ['Type', 'DR', 'DVL'],
    ['Base Errors', 0, 0],
    ['Drain Pan Errors', 0, 0],
    ['Housing Errors', 0, 0],
    ['Paperwork Errors', 0, 0],
    ['Internal Component Errors', 0, 0],
    ['Coil Panel Errors', 0, 0],
    ['Reconnect Errors', 0, 0],
    ['MOM Errors', 0, 0],
    ['Total Errors', 0, 0]
  ];
  const wsCheck = XLSX.utils.aoa_to_sheet(checkData);
  XLSX.utils.book_append_sheet(wb, wsCheck, 'Check Information');

  // Generate buffer and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const comNum = facts['unit.comNumber']?.value || 'COM-000000';
  const jobName = (facts['unit.jobName']?.value || 'AHU').replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetName = fileName || `${jobName}_${comNum}_Detailing_Verification_List.xlsx`;

  saveAs(blob, targetName);
}
