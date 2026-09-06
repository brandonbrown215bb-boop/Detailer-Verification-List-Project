import fileSaver from 'file-saver';
const saveAs = (fileSaver as any)?.saveAs || fileSaver;
import type {
  DvlProjectFile,
  NormalizedXmlGraph,
  Fact,
  SpecialQuote,
  ChecklistInstance,
  RuleDefinition,
  RulePackIdentity,
  DvlRulePackSnapshot,
  TemplateMap
} from '../types/index.ts';
import { APPROVED_MAPPINGS, RULE_PACK_IDENTITY, RULE_PACK_MANIFEST, TEMPLATE_MAP } from './rulesCatalog.ts';

const AUTOSAVE_KEY = 'ahu_dvl_autosave';
const DVL_CANONICAL_ALGORITHM = 'dvl-canonical-json-v1';
const MAX_SQ_SLOTS = 22;

async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isFullSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Canonical JSON used by DVL complete-state integrity. Object member order is
 * independent of insertion order; array order remains meaningful (SQ slots,
 * graph ordering, and checklist ordering are all persisted data).
 */
export function canonicalJson(value: unknown): string {
  // Build the JSON text directly. JSON.stringify reorders integer-like object
  // keys numerically even after we sort them, which breaks the cross-runtime
  // ordinal contract used by DvlProjectManager.
  const serialize = (input: any, inArray = false): string => {
    if (Array.isArray(input)) {
      return `[${input.map(value => serialize(value, true)).join(',')}]`;
    }
    if (input && typeof input === 'object') {
      const keys = Object.keys(input).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
      return `{${keys
        .filter(key => input[key] !== undefined)
        .map(key => `${JSON.stringify(key)}:${serialize(input[key])}`)
        .join(',')}}`;
    }
    const encoded = JSON.stringify(input);
    return encoded === undefined ? (inArray ? 'null' : 'null') : encoded;
  };
  return serialize(value);
}

/** The integrity record itself and the save timestamp are outside the payload. */
export function canonicalDvlPayload(project: DvlProjectFile): string {
  const payload: Record<string, unknown> = { ...(project as any) };
  delete payload.integrity;
  delete payload.lastSavedAt;
  return canonicalJson(payload);
}

export interface DvlIntegrityResult {
  status: 'verified' | 'unverified';
  /** More precise reason retained for UI and audit callers. */
  classification: 'complete' | 'source-only' | 'legacy' | 'tampered' | 'pack-mismatch' | 'artifact-unavailable';
  certificationAllowed: boolean;
  message?: string;
}

/** Saving is persistence only; it must not turn an unverified state into a certified one. */
export function preserveProjectIntegrityWarningAfterSave(existingWarning: string | null): string | null {
  return existingWarning;
}

export function canExportFinalProject(projectIntegrityWarning: string | null): boolean {
  return projectIntegrityWarning === null;
}

function defaultPackIdentity(): RulePackIdentity {
  const files = (RULE_PACK_MANIFEST as any)?.files || {};
  return {
    ...RULE_PACK_IDENTITY,
    templateSha256: files['template.xlsx']?.sha256,
    templateMapSha256: files['template_map.json']?.sha256,
    approvedMappingsSha256: files['approved_mappings.json']?.sha256,
    // The packaged desktop host resolves this exact file from the active pack
    // and verifies its hash before synthesis; this is not an embedded template.
    templateRetrievable: isFullSha256(files['template.xlsx']?.sha256)
  };
}

function sameOptionalIdentity(actual: unknown, expected: unknown): boolean {
  return !expected || actual === expected;
}

function hasReproduciblePackSnapshot(project: DvlProjectFile, activeRulePack: RulePackIdentity): boolean {
  const snapshot = project.rulePackSnapshot;
  return Boolean(
    snapshot
      && snapshot.version === project.rulePack?.version
      && snapshot.bundleSha256?.toLowerCase() === project.rulePack?.sha256?.toLowerCase()
      && Array.isArray(snapshot.rules)
      && snapshot.rules.length > 0
      && snapshot.templateMap
      && typeof snapshot.templateMap === 'object'
      && snapshot.approvedMappings !== undefined
      && snapshot.reproducibility !== 'unavailable'
      && isFullSha256(project.rulePack?.templateSha256)
      && snapshot.templateSha256?.toLowerCase() === project.rulePack?.templateSha256?.toLowerCase()
      && (snapshot.templateEmbedded === true || (snapshot.templateRetrievable === true && activeRulePack.templateRetrievable === true))
  );
}

export async function inspectDvlIntegrity(
  project: DvlProjectFile,
  currentRulePack: RulePackIdentity = defaultPackIdentity()
): Promise<DvlIntegrityResult> {
  const storedRulePackSha = project.rulePack?.sha256;
  const storedXmlSha = project.sourceXml?.fileSha256;
  const sourceShaValid = isFullSha256(storedXmlSha);
  const sourceHash = await sha256Hex(project.sourceXml?.rawXml || '');
  const sourceMatches = sourceShaValid && sourceHash === storedXmlSha.toLowerCase();
  const completeStateSha = project.integrity?.completeStateSha256;

  if (!sourceShaValid || !completeStateSha || !isFullSha256(completeStateSha)) {
    return {
      status: 'unverified',
      classification: sourceShaValid && sourceMatches ? 'source-only' : 'legacy',
      certificationAllowed: false,
      message: sourceShaValid && sourceMatches
        ? 'This project has source-only integrity metadata. Its saved checklist state is unverified until it is opened and saved with the current DVL format.'
        : 'This project uses legacy or incomplete identity metadata. Its contents were loaded, but cannot be certified until the project is reviewed and saved again.'
    };
  }

  const problems: string[] = [];
  if (!sourceMatches || project.integrity?.sourceXmlSha256?.toLowerCase() !== sourceHash) {
    problems.push('the embedded Config.xml hash does not match its contents');
  }

  const actualCompleteSha = await sha256Hex(canonicalDvlPayload(project));
  if (actualCompleteSha !== completeStateSha.toLowerCase()) {
    problems.push('the complete saved state hash does not match its contents');
  }

  const expectedPack = currentRulePack || defaultPackIdentity();
  const packMatches = project.rulePack?.version === expectedPack.version
    && storedRulePackSha?.toLowerCase() === expectedPack.sha256?.toLowerCase()
    && sameOptionalIdentity(project.rulePack?.ruleSemanticFingerprint, expectedPack.ruleSemanticFingerprint)
    && sameOptionalIdentity(project.rulePack?.templateSha256, expectedPack.templateSha256)
    && sameOptionalIdentity(project.rulePack?.templateMapSha256, expectedPack.templateMapSha256)
    && sameOptionalIdentity(project.rulePack?.approvedMappingsSha256, expectedPack.approvedMappingsSha256);
  if (!packMatches) {
    problems.push(`the project is pinned to Rule Pack ${project.rulePack?.version || 'unknown'}, not the active ${expectedPack.version}`);
  }

  if (!hasReproduciblePackSnapshot(project, expectedPack)) {
    problems.push('the immutable Rule Pack snapshot or retrievable template artifact is unavailable');
  }

  if (project.integrity?.state && project.integrity.state !== 'complete') {
    problems.push(`the project retains its prior ${project.integrity.state} certification classification`);
  }

  if (problems.length === 0) {
    return { status: 'verified', classification: 'complete', certificationAllowed: true };
  }

  const classification = project.integrity?.state === 'pack-mismatch' || problems.some(p => p.includes('not the active'))
    ? 'pack-mismatch'
    : project.integrity?.state === 'artifact-unavailable' || problems.some(p => p.includes('snapshot') || p.includes('template artifact'))
      ? 'artifact-unavailable'
      : project.integrity?.state === 'legacy' || problems.some(p => p.includes('legacy'))
        ? 'legacy'
      : 'tampered';
  return {
    status: 'unverified',
    classification,
    certificationAllowed: false,
    message: `This project is unverified because ${problems.join(' and ')}. Recompute or migrate it before relying on final export.`
  };
}

export interface DvlProjectBuildOptions {
  rulePackIdentity?: RulePackIdentity;
  /** Active rules are used only to record the semantic evaluator fingerprint. */
  activeRules?: RuleDefinition[];
  /** Canonical rule/template/mapping snapshot used for historical recomputation. */
  rulePackSnapshot?: Partial<DvlRulePackSnapshot>;
  /** Preserve a prior legacy/tampered/mismatched classification across save. */
  integrityState?: string;
}

function semanticRuleProjection(rules: RuleDefinition[]): unknown[] {
  return rules
    .map(rule => ({
      semanticKey: rule.semanticKey,
      scope: rule.scope,
      category: rule.category,
      subgroup: rule.subgroup,
      order: rule.order,
      text: rule.text,
      requiredFacts: rule.requiredFacts,
      predicate: rule.predicate,
      allowNA: rule.allowNA,
      verificationMode: rule.verificationMode,
      isArchived: rule.isArchived === true
    }))
    .sort((a, b) => {
      const left = `${a.semanticKey}\u0000${a.scope}`;
      const right = `${b.semanticKey}\u0000${b.scope}`;
      return left < right ? -1 : left > right ? 1 : 0;
    });
}

import { DOCUMENT_SCHEMA_VERSION, DVL_FORMAT_VERSION, EFFECTIVE_APPLICATION_VERSION } from './version.ts';



export async function createDvlProject(
  graph: NormalizedXmlGraph,
  facts: Record<string, Fact>,
  sqItems: SpecialQuote[],
  checklists: ChecklistInstance[],
  rawXml: string,
  generalComments: string = '',
  sourceMetadata: {
    fileName?: string;
    isUpzBundle?: boolean;
    orderRevision?: any;
    rawOrderRevisionXml?: string;
    rawManifestXml?: string;
  } = {},
  options: DvlProjectBuildOptions = {}
): Promise<DvlProjectFile> {
  if (sqItems.length > MAX_SQ_SLOTS) {
    throw new RangeError(`A DVL project supports at most ${MAX_SQ_SLOTS} Special Quote slots; ${sqItems.length} were supplied.`);
  }
  if (sqItems.some(sq => !Number.isInteger(sq.slot) || sq.slot < 1 || sq.slot > MAX_SQ_SLOTS)) {
    throw new RangeError(`Special Quote slots must be integers from 1 through ${MAX_SQ_SLOTS}.`);
  }
  if (new Set(sqItems.map(sq => sq.slot)).size !== sqItems.length) {
    throw new RangeError('Special Quote slots must be unique.');
  }

  const author = String(facts['unit.detailer']?.value || 'Detailer');
  const jobName = String(facts['unit.jobName']?.value || 'AHU Project');
  const comNumber = String(facts['unit.comNumber']?.value || 'COM-000000');
  const xmlSha = await sha256Hex(rawXml);
  const identity = { ...defaultPackIdentity(), ...(options.rulePackIdentity || {}) };
  const semanticFingerprint = options.activeRules
    ? await sha256Hex(canonicalJson(semanticRuleProjection(options.activeRules)))
    : identity.ruleSemanticFingerprint;
  const snapshot: DvlRulePackSnapshot = {
    version: identity.version,
    bundleSha256: identity.sha256,
    rules: options.rulePackSnapshot?.rules || options.activeRules || [],
    templateMap: (options.rulePackSnapshot?.templateMap || TEMPLATE_MAP) as TemplateMap,
    approvedMappings: options.rulePackSnapshot?.approvedMappings ?? APPROVED_MAPPINGS,
    templateSha256: options.rulePackSnapshot?.templateSha256 || identity.templateSha256,
    templateRetrievable: options.rulePackSnapshot?.templateRetrievable === true || identity.templateRetrievable === true,
    templateEmbedded: options.rulePackSnapshot?.templateEmbedded === true,
    reproducibility: options.rulePackSnapshot?.reproducibility
      || (identity.templateSha256 ? 'snapshot-without-template' : 'unavailable')
  };

  const project: DvlProjectFile = {
    formatVersion: DVL_FORMAT_VERSION,
    appVersion: EFFECTIVE_APPLICATION_VERSION,
    createdAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    author,
    jobName,
    comNumber,
    rulePack: {
      version: identity.version,
      sha256: identity.sha256,
      ruleSemanticFingerprint: semanticFingerprint,
      templateSha256: identity.templateSha256,
      templateMapSha256: identity.templateMapSha256,
      approvedMappingsSha256: identity.approvedMappingsSha256,
      templateRetrievable: identity.templateRetrievable
    },
    rulePackSnapshot: snapshot,
    sourceXml: {
      fileName: sourceMetadata.fileName || 'Config.xml',
      fileSha256: xmlSha,
      schemaVersion: graph.documentVersion || DOCUMENT_SCHEMA_VERSION,
      rawXml,
      isUpzBundle: sourceMetadata.isUpzBundle,
      orderRevision: sourceMetadata.orderRevision,
      rawOrderRevisionXml: sourceMetadata.rawOrderRevisionXml,
      rawManifestXml: sourceMetadata.rawManifestXml
    },
    normalizedGraph: graph,
    factRegistry: facts,
    sqItems,
    checklistInstances: checklists,
    generalComments,
    integrity: {
      algorithm: DVL_CANONICAL_ALGORITHM,
      sourceXmlSha256: xmlSha,
      state: options.integrityState || 'complete'
    }
  };

  project.integrity!.completeStateSha256 = await sha256Hex(canonicalDvlPayload(project));
  return project;
}

export function saveDvlToFile(project: DvlProjectFile): void {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const safeJob = String(project.jobName || 'AHU_Project').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeCom = String(project.comNumber || 'COM-000000').replace(/[^a-zA-Z0-9_-]/g, '_');
  saveAs(blob, `${safeJob}_${safeCom}.dvl`);
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
