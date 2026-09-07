import type {
  Fact,
  ChecklistInstance,
  ScopeReadiness,
  UnitReadiness,
  DomainFact,
  ChecklistItem,
  RuleDefinition
} from '../types/index.ts';

export type { ScopeReadiness, UnitReadiness, DomainFact, ChecklistItem };

/**
 * Predicate to determine if an individual fact requires confirmation or is unknown.
 * Includes all categories: Order & Identity, Baserails, Casing, Openings, Components, Ratings, and Weights.
 * Note: Status 'Unknown' always requires confirmation regardless of confidence tag.
 */
export function isFactUnconfirmed(fact: Fact | undefined | null): boolean {
  if (!fact) return true;
  return fact.status === 'Unknown' || fact.confidence === 'RequiresConfirmation';
}

/**
 * Predicate to determine if a checklist rule is blocked awaiting fact confirmation.
 */
export function isChecklistBlocked(item: ChecklistInstance): boolean {
  return item.applicability === 'NeedsInput';
}

/**
 * Predicate to determine if a checklist rule is applicable and passed.
 */
export function isChecklistPassed(item: ChecklistInstance): boolean {
  return item.applicability === 'Applicable' && item.status === 'Passed';
}

/**
 * Predicate to determine if a checklist rule is applicable and completed (Passed or NA).
 */
export function isChecklistCompleted(item: ChecklistInstance, rule?: RuleDefinition): boolean {
  const allowNA = rule?.allowNA ?? item.allowNA ?? false;
  return item.applicability === 'Applicable' && (item.status === 'Passed' || (item.status === 'NA' && allowNA));
}

/**
 * Predicate to determine if a checklist rule is applicable but not yet completed.
 */
export function isChecklistIncomplete(item: ChecklistInstance, rule?: RuleDefinition): boolean {
  return item.applicability === 'Applicable' && !isChecklistCompleted(item, rule);
}

/**
 * Resolves a fact key for a specific scope target, mapping generic keys (like 'skid.weight')
 * to scoped keys (like 'skid.skid-1.weight') when applicable.
 */
export function resolveFactForScope(
  facts: Record<string, Fact> | undefined | null,
  factKey: string,
  scopeTargetId: string
): { resolvedKey: string; fact: Fact | undefined } {
  if (!factKey) return { resolvedKey: '', fact: undefined };
  if (facts && scopeTargetId && scopeTargetId !== 'unit' && factKey.startsWith('skid.')) {
    const suffix = factKey.slice(5);
    const scopedKey = `skid.${scopeTargetId}.${suffix}`;
    if (facts[scopedKey]) {
      return { resolvedKey: scopedKey, fact: facts[scopedKey] };
    }
  }
  return { resolvedKey: factKey, fact: facts ? facts[factKey] : undefined };
}

export const EMPTY_SCOPE_READINESS: ScopeReadiness = {
  scopeTargetId: '',
  totalChecks: 0,
  totalChecksCount: 0,
  applicableChecks: 0,
  totalApplicableChecksCount: 0,
  passedChecks: 0,
  completedChecksCount: 0,
  incompleteChecks: 0,
  incompleteChecksCount: 0,
  blockedChecks: 0,
  blockedChecksCount: 0,
  naChecksCount: 0,
  percentComplete: 0,
  isComplete: false,
  isFullyVerified: false,
  blockedRules: [],
  incompleteRules: [],
  passedRules: []
};

export const EMPTY_READINESS: UnitReadiness = {
  unconfirmedFactsCount: 0,
  blockedChecksCount: 0,
  incompleteChecksCount: 0,
  completedChecksCount: 0,
  naChecksCount: 0,
  totalApplicableChecksCount: 0,
  totalChecksCount: 0,
  percentComplete: 0,
  isReadyForFinal: false,
  blockedRules: [],
  unconfirmedFacts: [],
  incompleteRules: [],
  passedRules: [],
  scopeReadinessMap: {}
};

/**
 * Projects authoritative readiness directly from a C# ProjectSessionSnapshot.
 * Business rules, counts, percentages, and certification eligibility are computed in Core;
 * this function maps the snapshot onto the UnitReadiness presentation model for UI views.
 */
export function projectSessionReadiness(snapshot: import('../types/session.ts').ProjectSessionSnapshot): UnitReadiness {
  const r = snapshot.readiness;
  const factsList = Object.values(snapshot.facts || {});
  const unconfirmedFacts = factsList.filter(isFactUnconfirmed);
  const blockedRules = (snapshot.checklists || []).filter(isChecklistBlocked);
  const applicableChecks = (snapshot.checklists || []).filter(c => c.applicability === 'Applicable');
  const passedRules = applicableChecks.filter(c => c.status === 'Passed');
  const naRules = applicableChecks.filter(c => c.status === 'NA');
  const incompleteRules = applicableChecks.filter(c => c.status !== 'Passed' && c.status !== 'NA');

  const scopeReadinessMap: Record<string, ScopeReadiness> = {};
  for (const [scopeId, scopeSumm] of Object.entries(r.scopeReadinessMap || {})) {
    const scopeChecks = (snapshot.checklists || []).filter(c => c.scopeTargetId === scopeId);
    const scopeApplicable = scopeChecks.filter(c => c.applicability === 'Applicable');
    scopeReadinessMap[scopeId] = {
      scopeTargetId: scopeId,
      totalChecks: scopeSumm.totalChecksCount,
      totalChecksCount: scopeSumm.totalChecksCount,
      applicableChecks: scopeSumm.applicableChecksCount,
      totalApplicableChecksCount: scopeSumm.applicableChecksCount,
      passedChecks: scopeSumm.completedChecksCount,
      completedChecksCount: scopeSumm.completedChecksCount,
      incompleteChecks: scopeSumm.incompleteChecksCount,
      incompleteChecksCount: scopeSumm.incompleteChecksCount,
      blockedChecks: scopeSumm.blockedChecksCount,
      blockedChecksCount: scopeSumm.blockedChecksCount,
      naChecksCount: 0,
      percentComplete: scopeSumm.percentComplete,
      isComplete: scopeSumm.isComplete,
      isFullyVerified: scopeSumm.isComplete,
      blockedRules: scopeChecks.filter(isChecklistBlocked),
      incompleteRules: scopeApplicable.filter(c => c.status !== 'Passed' && c.status !== 'NA'),
      passedRules: scopeApplicable.filter(c => c.status === 'Passed' || c.status === 'NA')
    };
  }

  return {
    unconfirmedFactsCount: r.unconfirmedFactsCount,
    blockedChecksCount: r.blockedChecksCount,
    incompleteChecksCount: r.incompleteChecksCount,
    completedChecksCount: r.completedChecksCount,
    naChecksCount: naRules.length,
    totalApplicableChecksCount: r.totalApplicableChecksCount,
    totalChecksCount: r.totalChecksCount,
    percentComplete: r.percentComplete,
    isReadyForFinal: r.isReadyForFinal,
    blockedRules,
    unconfirmedFacts,
    incompleteRules,
    passedRules,
    scopeReadinessMap
  };
}
