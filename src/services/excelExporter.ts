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
  const formatBool = (val: any, defaultIfNull: string = 'No') => {
    if (val === true || val === 'true' || val === 'Yes') return 'Yes';
    if (val === false || val === 'false' || val === 'No') return 'No';
    if (val === null || val === undefined || val === '') return defaultIfNull;
    return String(val);
  };

  vlData.push(['', 'SHELL TYPE:', facts['unit.shellType']?.value || 'ISG']);
  vlData.push(['', 'UNIT TYPE:', facts['unit.unitType']?.value || 'Outdoor']);
  vlData.push(['', 'BASE HEIGHT:', `${facts['unit.baseHeight']?.value || 10}"`]);
  vlData.push(['', 'WALL THICKNESS:', `${facts['unit.wallThickness']?.value || 2}"`]);
  vlData.push(['', 'THERMAL BREAK:', formatBool(facts['unit.thermalBreak']?.value, 'Yes')]);
  vlData.push(['', 'ROOF PEAK:', String(facts['roof.roofPeak']?.value || facts['unit.roofPeak']?.value || '')]);
  vlData.push(['', 'CURBREST:', formatBool(facts['unit.curbrest']?.value, 'No')]);
  vlData.push(['', 'NOA:', formatBool(facts['unit.noa']?.value, 'No')]);
  vlData.push(['', 'SEISMIC:', formatBool(facts['unit.isSeismic']?.value, 'No')]);
  vlData.push(['', 'LOCATION:', facts['unit.location']?.value || 'Outdoor']);
  vlData.push(['', 'KNOCKDOWN:', formatBool(facts['unit.knockdown']?.value, 'No')]);
  vlData.push(['', 'UTL:', formatBool(facts['unit.hasUTL']?.value || facts['unit.utl']?.value, 'No')]);
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

  // 3. Dynamic Category Scratchpad Sheets
  const activeCategorySheets = new Set<string>();
  const applicableChecks = checklists.filter(c => c.applicability === 'Applicable');
  applicableChecks.forEach(inst => {
    const rule = rules.find(r => r.id === inst.ruleId);
    if (!rule) return;
    const cat = rule.category;
    const sub = rule.subgroup;
    if (cat === 'Base') activeCategorySheets.add('Base');
    else if (cat === 'Paperwork') activeCategorySheets.add('Paperwork');
    else if (cat === 'MOM') activeCategorySheets.add('MOM');
    else if (cat === 'Housing' || cat === 'UTL' || cat === 'Knockdown') activeCategorySheets.add('Housing');
    else if (cat === 'Internals' || cat === 'Internal') {
      if (sub === 'Drain Pan') activeCategorySheets.add('Drain Pan');
      else if (sub === 'Coil Segments') activeCategorySheets.add('Coil Panels');
      else if (sub === 'Reconnects') activeCategorySheets.add('Reconnects');
      else activeCategorySheets.add('Internal');
    }
  });

  const categoryOrder = ['Base', 'Drain Pan', 'Housing', 'Paperwork', 'Internal', 'Coil Panels', 'Reconnects', 'MOM'];
  categoryOrder.forEach(catName => {
    if (activeCategorySheets.has(catName)) {
      const scratchpadData = [
        ['Total Checks', 'Passed', 'Errors (DR)', 0, 'Errors (DVL)', 0, 'Notes', 0, 'Photos', 0],
        ['', ''],
        [`${catName} Scratchpad & Verification Markups`, '', ''],
        ['Paste detailer markups, drawings, and component photos below for checking:']
      ];
      const wsCat = XLSX.utils.aoa_to_sheet(scratchpadData);
      XLSX.utils.book_append_sheet(wb, wsCat, catName);
    }
  });

  // 4. Check Information Sheet
  const checkData: (string | number)[][] = [
    ['Check Information'],
    ['Detailer', facts['unit.detailer']?.value || ''],
    ['COM', facts['unit.comNumber']?.value || ''],
    ['Checker', 'Pending'],
    ['Date Checked', ''],
    ['Error Tracker'],
    ['Category Sheet', 'DR Errors', 'DVL Errors']
  ];

  categoryOrder.forEach(catName => {
    if (activeCategorySheets.has(catName)) {
      checkData.push([`${catName} Errors`, 0, 0]);
    }
  });
  checkData.push(['Total Errors', 0, 0]);

  const wsCheck = XLSX.utils.aoa_to_sheet(checkData);
  XLSX.utils.book_append_sheet(wb, wsCheck, 'Check Information');

  // Generate buffer and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const comNum = facts['unit.comNumber']?.value ? String(facts['unit.comNumber'].value) : 'COM-000000';
  const jobName = String(facts['unit.jobName']?.value || 'AHU').replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetName = fileName || `${jobName}_${comNum}_Detailing_Verification_List.xlsx`;

  saveAs(blob, targetName);
}
