import fileSaver from 'file-saver';
const saveAs = (fileSaver as any)?.saveAs || fileSaver;
import type { DvlProjectFile, NormalizedXmlGraph, Fact, SpecialQuote, ChecklistInstance } from '../types/index.ts';
import { RULE_PACK_IDENTITY } from './rulesCatalog.ts';

const AUTOSAVE_KEY = 'ahu_dvl_autosave';

async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isFullSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export interface DvlIntegrityResult {
  status: 'verified' | 'unverified';
  message?: string;
}

export async function inspectDvlIntegrity(project: DvlProjectFile): Promise<DvlIntegrityResult> {
  const storedRulePackSha = project.rulePack?.sha256;
  const storedXmlSha = project.sourceXml?.fileSha256;

  if (!isFullSha256(storedRulePackSha) || !isFullSha256(storedXmlSha)) {
    return {
      status: 'unverified',
      message: 'This project uses legacy placeholder identity metadata. Its contents were loaded, but cannot be verified until the project is saved again.'
    };
  }

  const actualXmlSha = await sha256Hex(project.sourceXml.rawXml || '');
  const problems: string[] = [];
  if (actualXmlSha !== storedXmlSha.toLowerCase()) {
    problems.push('the embedded Config.xml hash does not match its contents');
  }
  if (
    project.rulePack.version !== RULE_PACK_IDENTITY.version ||
    storedRulePackSha.toLowerCase() !== RULE_PACK_IDENTITY.sha256.toLowerCase()
  ) {
    problems.push(`the project is pinned to Rule Pack ${project.rulePack.version}, not the active ${RULE_PACK_IDENTITY.version}`);
  }

  return problems.length === 0
    ? { status: 'verified' }
    : { status: 'unverified', message: `This project is unverified because ${problems.join(' and ')}. Review it before relying on export results.` };
}

export async function createDvlProject(
  graph: NormalizedXmlGraph,
  facts: Record<string, Fact>,
  sqItems: SpecialQuote[],
  checklists: ChecklistInstance[],
  rawXml: string,
  generalComments: string = '',
  sourceMetadata?: {
    fileName?: string;
    isUpzBundle?: boolean;
    orderRevision?: any;
  }
): Promise<DvlProjectFile> {
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
      version: RULE_PACK_IDENTITY.version,
      sha256: RULE_PACK_IDENTITY.sha256
    },
    sourceXml: {
      fileName: sourceMetadata?.fileName || 'Config.xml',
      fileSha256: await sha256Hex(rawXml),
      schemaVersion: graph.documentVersion || '2018.9.14.1003',
      rawXml,
      isUpzBundle: sourceMetadata?.isUpzBundle,
      orderRevision: sourceMetadata?.orderRevision
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
