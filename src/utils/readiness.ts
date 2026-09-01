import type {
  Fact,
  ChecklistInstance,
  CheckStatus,
  RuleApplicability,
  ScopeReadiness,
  UnitReadiness,
  DomainFact,
  ChecklistItem
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
export function isChecklistCompleted(item: ChecklistInstance): boolean {
  return item.applicability === 'Applicable' && (item.status === 'Passed' || item.status === 'NA');
}

/**
 * Predicate to determine if a checklist rule is applicable but not yet completed.
 */
export function isChecklistIncomplete(item: ChecklistInstance): boolean {
  return item.applicability === 'Applicable' && item.status !== 'Passed' && item.status !== 'NA';
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

/**
 * Computes readiness metrics for a specific scope target ('unit', 'skid-1', 'skid-2', etc.)
 * Supports multiple overloaded signatures for flexibility.
 */
export function computeScopeReadiness(
  factsOrChecklists: Record<string, Fact> | ChecklistInstance[],
  checklistsOrScope: ChecklistInstance[] | string,
  scopeTargetId?: string
): ScopeReadiness {
  let checklists: ChecklistInstance[] = [];
  let scopeId = '';

  if (typeof checklistsOrScope === 'string') {
    checklists = Array.isArray(factsOrChecklists) ? factsOrChecklists : [];
    scopeId = checklistsOrScope;
  } else {
    checklists = Array.isArray(checklistsOrScope) ? checklistsOrScope : [];
    scopeId = scopeTargetId || '';
  }

  const scopeChecks = (checklists || []).filter(c => c.scopeTargetId === scopeId);
  const applicableChecks = scopeChecks.filter(c => c.applicability === 'Applicable');
  const passedRules = applicableChecks.filter(c => c.status === 'Passed');
  const naRules = applicableChecks.filter(c => c.status === 'NA');
  const incompleteRules = applicableChecks.filter(isChecklistIncomplete);
  const blockedRules = scopeChecks.filter(isChecklistBlocked);

  const totalChecks = scopeChecks.length;
  const applicableChecksCount = applicableChecks.length;
  const passedChecksCount = passedRules.length;
  const completedChecksCount = passedRules.length + naRules.length;
  const incompleteChecksCount = incompleteRules.length;
  const blockedChecksCount = blockedRules.length;
  const naChecksCount = naRules.length;

  const percentComplete = applicableChecksCount > 0
    ? Math.round((completedChecksCount / applicableChecksCount) * 100)
    : 0;

  const isComplete = applicableChecksCount > 0 &&
    blockedChecksCount === 0 &&
    incompleteChecksCount === 0;

  return {
    scopeTargetId: scopeId,
    totalChecks,
    totalChecksCount: totalChecks,
    applicableChecks: applicableChecksCount,
    totalApplicableChecksCount: applicableChecksCount,
    passedChecks: passedChecksCount,
    completedChecksCount,
    incompleteChecks: incompleteChecksCount,
    incompleteChecksCount,
    blockedChecks: blockedChecksCount,
    blockedChecksCount,
    naChecksCount,
    percentComplete,
    isComplete,
    isFullyVerified: isComplete,
    blockedRules,
    incompleteRules,
    passedRules
  };
}

/**
 * Computes deterministic unit-level and project-level readiness metrics.
 * 
 * Rules:
 * 1. unconfirmedFactsCount includes all facts with status === 'Unknown' or confidence === 'RequiresConfirmation' (including weights).
 * 2. blockedChecksCount includes all checklist instances with applicability === 'NeedsInput'.
 * 3. completedChecksCount includes all applicable rules marked Passed or NA.
 * 4. incompleteChecksCount includes applicable rules not marked Passed or NA.
 * 5. isReadyForFinal is strictly true iff unconfirmedFactsCount === 0 && blockedChecksCount === 0 && incompleteChecksCount === 0 && totalApplicableChecksCount > 0.
 */
export function computeUnitReadiness(
  facts: Record<string, Fact> = {},
  checklists: ChecklistInstance[] = []
): UnitReadiness {
  const factList = Object.values(facts || {});
  const unconfirmedFacts = factList.filter(isFactUnconfirmed);
  const unconfirmedFactsCount = unconfirmedFacts.length;

  const blockedRules = (checklists || []).filter(isChecklistBlocked);
  const blockedChecksCount = blockedRules.length;

  const applicableChecks = (checklists || []).filter(c => c.applicability === 'Applicable');
  const totalApplicableChecksCount = applicableChecks.length;

  const passedRules = applicableChecks.filter(c => c.status === 'Passed');
  const naRules = applicableChecks.filter(c => c.status === 'NA');
  const completedChecksCount = passedRules.length + naRules.length;

  const incompleteRules = applicableChecks.filter(isChecklistIncomplete);
  const incompleteChecksCount = incompleteRules.length;

  const totalChecksCount = (checklists || []).length;

  const percentComplete = totalApplicableChecksCount > 0
    ? Math.round((completedChecksCount / totalApplicableChecksCount) * 100)
    : 0;

  const isReadyForFinal = totalApplicableChecksCount > 0 &&
    unconfirmedFactsCount === 0 &&
    blockedChecksCount === 0 &&
    incompleteChecksCount === 0;

  // Build per-scope readiness map
  const scopeIds = Array.from(new Set((checklists || []).map(c => c.scopeTargetId)));
  const scopeReadinessMap: Record<string, ScopeReadiness> = {};
  scopeIds.forEach(scopeId => {
    scopeReadinessMap[scopeId] = computeScopeReadiness(facts, checklists, scopeId);
  });

  return {
    unconfirmedFactsCount,
    blockedChecksCount,
    incompleteChecksCount,
    completedChecksCount,
    naChecksCount: naRules.length,
    totalApplicableChecksCount,
    totalChecksCount,
    percentComplete,
    isReadyForFinal,
    blockedRules,
    unconfirmedFacts,
    incompleteRules,
    passedRules,
    scopeReadinessMap
  };
}
