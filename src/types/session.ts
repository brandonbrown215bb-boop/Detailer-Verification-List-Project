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
  rawConfigXml?: string;
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
  status: string;
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

import type { ManualUnitConfig, SegmentTemplate } from '../services/manualUnitFactory.ts';

export interface CreateManualProjectCommand {
  config: ManualUnitConfig;
}

export type { ManualUnitConfig, SegmentTemplate };

