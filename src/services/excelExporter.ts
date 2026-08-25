import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { DvlProjectFile, Fact, SpecialQuote, ChecklistInstance, RuleDefinition } from '../types';

export function exportToExcel(
  facts: Record<string, Fact>,
  sqItems: SpecialQuote[],
  checklists: ChecklistInstance[],
  rules: RuleDefinition[],
  fileName?: string
): void {
  // Build a multi-tab workbook representing the official verification deliverable
  const wb = XLSX.utils.book_new();

  // 1. Revision List Sheet
  const revData = [
    ['REVISION'],
    ['SUBMITTED BY:', 'REV. LEVEL:', 'REV. DATE:', 'DESCRIPTION', 'APPROVAL DATE:', 'APPROVED BY:'],
    ['Tanner Dean', 13, new Date().toLocaleDateString(), 'Automated Ingestion & Verification Export', new Date().toLocaleDateString(), 'BB']
  ];
  const wsRev = XLSX.utils.aoa_to_sheet(revData);
  XLSX.utils.book_append_sheet(wb, wsRev, 'Revision List');

  // 2. Verification List Sheet
  const vlData: (string | number)[][] = [];
  vlData.push([]);
  vlData.push(['', 'UNIT DETAILING VERIFICATION LIST', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
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
  vlData.push(['', 'Additional Comments:', 'Verified against Config.xml automated pipeline.']);

  // Fill SQs in rows 3..24 (1..22 slots)
  for (let s = 1; s <= 22; s++) {
    const rowIdx = s + 2; // Row index in 0-based array
    while (vlData.length <= rowIdx) vlData.push([]);
    const sq = sqItems.find(item => item.slot === s);
    vlData[rowIdx][6] = s;
    vlData[rowIdx][7] = sq?.text || '';
  }

  // Add Verification Header
  vlData.push([]);
  vlData.push(['', 'CAD Verifications', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'N/A', 'Detailer Check off', '', 'Checker Check off', '', '', 'Comments', 'Initials']);

  // Add Verification Rules
  rules.forEach((rule, idx) => {
    // Find checklist instances for this rule across targets
    const instances = checklists.filter(c => c.ruleId === rule.id);
    const isPassed = instances.some(i => i.status === 'Passed');
    const isNA = instances.every(i => i.status === 'NA' || i.applicability === 'NotApplicable');
    const comments = instances.map(i => i.detailerComment).filter(Boolean).join('; ');

    const rowArr: (string | number)[] = [
      '',
      idx + 1,
      rule.text,
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      isNA ? 'Yes' : '0',
      isPassed ? 'Yes' : '0',
      '',
      '0',
      '', '',
      comments || '',
      facts['unit.detailer']?.value ? String(facts['unit.detailer'].value).slice(0, 2).toUpperCase() : 'TD'
    ];
    vlData.push(rowArr);
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
