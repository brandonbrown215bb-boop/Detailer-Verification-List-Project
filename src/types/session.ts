import type { NormalizedXmlGraph, Fact, ChecklistInstance, SpecialQuote } from './index.ts';

export interface ScopeReadinessSummary {
  scopeTargetId: string;
  totalChecksCount: number;
  applicableChecksCount: number;
  completedChecksCount: number;
  incompleteChecksCount: number;
  blockedChecksCount: number;
  percentComplete: number;
  isComplete: boolean;
}

export interface ProjectReadinessSummary {
  isReadyForFinal: boolean;
  isDraftOnly: boolean;
  unconfirmedFactsCount: number;
  blockedChecksCount: number;
  incompleteChecksCount: number;
  completedChecksCount: number;
  totalApplicableChecksCount: number;
  totalChecksCount: number;
  incompleteSpecialQuotesCount: number;
  percentComplete: number;
  scopeReadinessMap: Record<string, ScopeReadinessSummary>;
  blockers: string[];
  exportBlocked?: boolean;
  templateRetrievable?: boolean;
}

export interface SourceMetadataSummary {
  fileName: string;
  filePath: string;
  fileSha256: string;
  isUpz: boolean;
  isTrusted: boolean;
  orderRevision?: any;
  rawOrderRevisionXml?: string;
  rawManifestXml?: string;
}

export interface RulePackSummary {
  version: string;
  bundleSha256: string;
  generation: number;
}

export interface ProjectSessionSnapshot {
  sessionId: string;
  revision: number;
  graph: NormalizedXmlGraph;
  facts: Record<string, Fact>;
  checklists: ChecklistInstance[];
  specialQuotes: SpecialQuote[];
  generalComments: string;
  source: SourceMetadataSummary;
  rulePack: RulePackSummary;
  readiness: ProjectReadinessSummary;
  isDirty: boolean;
  isTrusted?: boolean;
  rawConfigXml?: string;
  currentProjectPath?: string;
  lastSavedAt?: string;
  integrityState?: string;
  integrityWarning?: string;
}

export interface SessionCommandResult {
  success: boolean;
  revision: number;
  snapshot?: ProjectSessionSnapshot;
  isConflict: boolean;
  errorMessage?: string;
}

export interface BatchFactOverrideItem {
  factId: string;
  value: any;
  comment?: string;
  author?: string;
}

export interface ProjectSessionOpenPayload {
  filePath?: string;
  configXml?: string;
  orderRevXml?: string;
  manifestXml?: string;
  isUpz?: boolean;
  isTrusted?: boolean;
  sourceHandle?: string;
  initialOverrides?: Record<string, Fact>;
  initialChecklists?: ChecklistInstance[];
  initialSpecialQuotes?: SpecialQuote[];
  initialGeneralComments?: string;
}

export interface OverrideFactPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  factId: string;
  value: any;
  comment?: string;
  author?: string;
}

export interface BatchOverrideFactsPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  overrides: BatchFactOverrideItem[];
}

export interface RevertFactPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  factId: string;
}

export interface UpdateChecklistPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  checkId: string;
  status?: string;
  comment?: string;
  detailerInitials?: string;
}

export interface UpdateSpecialQuotePayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  specialQuote: SpecialQuote;
}

export interface DeleteSpecialQuotePayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  quoteId: string;
}

export interface SpecialQuoteSlotAssignment {
  quoteId: string;
  slot: number;
}

export interface ReorderSpecialQuotesPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  assignments: SpecialQuoteSlotAssignment[];
}

export interface UpdateGeneralCommentsPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  comments: string;
}

export interface ResetSessionPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
}

import type { ManualUnitConfig, SegmentTemplate } from './manual.ts';

export interface CreateManualProjectCommand {
  config: ManualUnitConfig;
}

export interface SaveProjectPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  targetPath?: string;
  defaultDirectory?: string;
  forceSaveAs?: boolean;
}

export interface SaveProjectResult {
  saved: boolean;
  cancelled?: boolean;
  path?: string;
  fileName?: string;
  lastSavedAt?: string;
  snapshot?: ProjectSessionSnapshot;
}

export interface OpenDvlPayload {
  filePath?: string;
  dvlJson?: string;
}

export interface ExportExcelPayload {
  sessionId: string;
  expectedRevision: number;
  requestId?: string;
  isDraft: boolean;
  targetPath?: string;
  defaultDirectory?: string;
}

export interface ExportExcelResult {
  exported: boolean;
  cancelled?: boolean;
  filePath?: string;
  fileName?: string;
  isDraft?: boolean;
  certificationAllowed?: boolean;
}

export interface RecoveryInfo {
  hasRecovery: boolean;
  jobName?: string;
  comNumber?: string;
  author?: string;
  lastSavedAt?: string;
  sourceFileName?: string;
  isTrusted?: boolean;
  recoveryFilePath?: string;
}

export type { ManualUnitConfig, SegmentTemplate };

