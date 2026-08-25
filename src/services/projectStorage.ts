import { saveAs } from 'file-saver';
import { DvlProjectFile, NormalizedXmlGraph, Fact, SpecialQuote, ChecklistInstance } from '../types';

const AUTOSAVE_KEY = 'ahu_dvl_autosave';

export function createDvlProject(
  graph: NormalizedXmlGraph,
  facts: Record<string, Fact>,
  sqItems: SpecialQuote[],
  checklists: ChecklistInstance[],
  rawXml: string,
  generalComments: string = ''
): DvlProjectFile {
  const author = String(facts['unit.detailer']?.value || 'Detailer');
  const jobName = String(facts['unit.jobName']?.value || 'AHU Project');
  const comNumber = String(facts['unit.comNumber']?.value || 'COM-000000');

  return {
    formatVersion: '1.0',
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    author,
    jobName,
    comNumber,
    rulePack: {
      version: '13.1.0',
      sha256: 'a3f8901c34de2e8b'
    },
    sourceXml: {
      fileName: 'Config.xml',
      fileSha256: 'e89b21cf4a09',
      schemaVersion: graph.documentVersion || '2018.9.14.1003',
      rawXml
    },
    normalizedGraph: graph,
    factRegistry: facts,
    sqItems,
    checklistInstances: checklists,
    generalComments
  };
}

export function saveDvlToFile(project: DvlProjectFile): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `${project.jobName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${project.comNumber}.dvl`;
  saveAs(blob, filename);
}

export function autosaveToLocal(project: DvlProjectFile): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
  } catch (e) {
    console.warn('Autosave to localStorage failed:', e);
  }
}

export function loadAutosave(): DvlProjectFile | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
