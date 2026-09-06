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
}

export interface SourceMetadataSummary {
  fileName: string;
  filePath: string;
  fileSha256: string;
  isUpz: boolean;
  isTrusted: boolean;
  orderRevision?: any;
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
}

export interface SessionCommandResult {
  success: boolean;
  revision: number;
  snapshot?: ProjectSessionSnapshot;
  isConflict: boolean;
  errorMessage?: string;
}
