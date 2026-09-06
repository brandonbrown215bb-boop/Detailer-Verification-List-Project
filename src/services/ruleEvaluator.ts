import type { NormalizedXmlGraph, Fact, RuleDefinition, ChecklistInstance, RuleApplicability, CheckStatus, ASTPredicate } from '../types/index.ts';
import { canonicalFactKey } from './factContract.ts';

type ChecklistWithFingerprint = ChecklistInstance & { semanticFingerprint?: string };

function toFiniteNumber(value: unknown): number | undefined {
  // JavaScript coerces null, empty strings, and false to zero. Those values
  // are missing inputs in an engineering predicate and must remain blocked.
  if (value === null || value === undefined || typeof value === 'boolean') return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stableJson(value: any): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function canonicalizePredicate(predicate: any): any {
  if (!predicate || typeof predicate !== 'object') return predicate;
  if (Array.isArray(predicate)) return predicate.map(canonicalizePredicate);
  const result: any = {};
  for (const key of Object.keys(predicate)) {
    if (key === 'var' && typeof predicate[key] === 'string') {
      result[key] = canonicalFactKey(predicate[key]);
    } else {
      result[key] = canonicalizePredicate(predicate[key]);
    }
  }
  return result;
}

export function semanticFingerprint(rule: RuleDefinition): string {
  return stableJson({
    predicate: canonicalizePredicate(rule.predicate) || null,
    requiredFacts: (rule.requiredFacts || []).map(canonicalFactKey).sort(),
    scope: rule.scope,
    verificationMode: rule.verificationMode,
    instructions: rule.text,
    allowNA: rule.allowNA
  });
}

export function evaluateAstPredicate(
  predicate: ASTPredicate | undefined,
  context: Record<string, any>,
  requiredFacts: string[],
  factRegistry: Record<string, Fact>
): { result: boolean; needsInput: boolean; trace: string } {
  // Check if any required fact is Unknown or RequiresConfirmation
  for (const fKey of requiredFacts) {
    const canonicalKey = canonicalFactKey(fKey);
    // Check if the key in context maps to factRegistry
    const mappedKey = canonicalKey.startsWith('skid.') && context.__skidId
      ? canonicalKey.replace('skid.', `skid.${context.__skidId}.`)
      : canonicalKey;

    const fact = factRegistry[mappedKey] || factRegistry[canonicalKey];
    if (!fact || fact.value === null || fact.value === undefined || fact.status === 'Unknown' || fact.confidence === 'RequiresConfirmation') {
      return {
        result: false,
        needsInput: true,
        trace: `Required fact '${fact?.label || canonicalKey}' requires confirmation or is unknown (${fact?.status || 'Missing'})`
      };
    }
  }

  if (!predicate) {
    return { result: true, needsInput: false, trace: 'Standard check (Always applicable)' };
  }

  function resolveValue(val: any): any {
    if (val && typeof val === 'object' && 'var' in val) {
      const varName = canonicalFactKey(val.var);
      return context[varName];
    }
    return val;
  }

  // Evaluator operators
  if ('>=' in predicate) {
    const [left, right] = predicate['>='];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const leftNum = toFiniteNumber(leftVal);
    const rightNum = toFiniteNumber(rightVal);
    if (leftNum === undefined || rightNum === undefined) return { result: false, needsInput: true, trace: 'Numeric predicate requires a known finite value.' };
    const res = leftNum >= rightNum;
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${leftVal} >= ${rightVal} (${res ? 'True' : 'False'})`
    };
  }

  if ('<=' in predicate) {
    const [left, right] = predicate['<='];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const leftNum = toFiniteNumber(leftVal);
    const rightNum = toFiniteNumber(rightVal);
    if (leftNum === undefined || rightNum === undefined) return { result: false, needsInput: true, trace: 'Numeric predicate requires a known finite value.' };
    const res = leftNum <= rightNum;
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${leftVal} <= ${rightVal} (${res ? 'True' : 'False'})`
    };
  }

  if ('>' in predicate) {
    const [left, right] = predicate['>'];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const leftNum = toFiniteNumber(leftVal);
    const rightNum = toFiniteNumber(rightVal);
    if (leftNum === undefined || rightNum === undefined) return { result: false, needsInput: true, trace: 'Numeric predicate requires a known finite value.' };
    const res = leftNum > rightNum;
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${leftVal} > ${rightVal} (${res ? 'True' : 'False'})`
    };
  }

  if ('<' in predicate) {
    const [left, right] = predicate['<'];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const leftNum = toFiniteNumber(leftVal);
    const rightNum = toFiniteNumber(rightVal);
    if (leftNum === undefined || rightNum === undefined) return { result: false, needsInput: true, trace: 'Numeric predicate requires a known finite value.' };
    const res = leftNum < rightNum;
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${leftVal} < ${rightVal} (${res ? 'True' : 'False'})`
    };
  }

  if ('===' in predicate) {
    const [left, right] = predicate['==='];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const res = leftVal === rightVal;
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${JSON.stringify(leftVal)} === ${JSON.stringify(rightVal)} (${res ? 'True' : 'False'})`
    };
  }

  if ('!==' in predicate) {
    const [left, right] = predicate['!=='];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const res = leftVal !== rightVal;
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${JSON.stringify(leftVal)} !== ${JSON.stringify(rightVal)} (${res ? 'True' : 'False'})`
    };
  }

  if ('includes' in predicate) {
    const [left, right] = predicate['includes'];
    const resolvedLeft = resolveValue(left);
    const resolvedRight = resolveValue(right);
    if (typeof resolvedLeft !== 'string' || typeof resolvedRight !== 'string') return { result: false, needsInput: true, trace: 'String predicate requires known string values.' };
    const leftVal = resolvedLeft;
    const rightVal = resolvedRight;
    const res = leftVal.toLowerCase().includes(rightVal.toLowerCase());
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: "${leftVal}" includes "${rightVal}" (${res ? 'True' : 'False'})`
    };
  }

  if ('in' in predicate) {
    const [left, right] = predicate['in'];
    const leftVal = resolveValue(left);
    const rightList: any[] = Array.isArray(right)
      ? right
      : String(resolveValue(right) || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
    if (leftVal === null || leftVal === undefined) return { result: false, needsInput: true, trace: 'Membership predicate requires a known value.' };
    const res = rightList.some(item => typeof item === typeof leftVal && String(item).trim().toLowerCase() === String(leftVal).trim().toLowerCase());
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${JSON.stringify(leftVal)} in [${rightList.join(', ')}] (${res ? 'True' : 'False'})`
    };
  }

  if ('and' in predicate) {
    const subPredicates = predicate['and'] as ASTPredicate[];
    const traces: string[] = [];
    for (const sub of subPredicates) {
      const subEval = evaluateAstPredicate(sub, context, [], factRegistry);
      if (subEval.needsInput) {
        return { result: false, needsInput: true, trace: subEval.trace };
      }
      traces.push(subEval.trace);
      if (!subEval.result) {
        return { result: false, needsInput: false, trace: traces.join(' AND ') };
      }
    }
    return { result: true, needsInput: false, trace: traces.join(' AND ') };
  }

  if ('or' in predicate) {
    const subPredicates = predicate['or'] as ASTPredicate[];
    const traces: string[] = [];
    let hasTrue = false;
    let anyNeedsInput = false;
    let needsInputTrace = '';

    for (const sub of subPredicates) {
      const subEval = evaluateAstPredicate(sub, context, [], factRegistry);
      if (subEval.needsInput) {
        anyNeedsInput = true;
        needsInputTrace = subEval.trace;
      }
      traces.push(subEval.trace);
      if (subEval.result) {
        hasTrue = true;
        break;
      }
    }

    if (hasTrue) {
      return { result: true, needsInput: false, trace: traces.join(' OR ') };
    }
    if (anyNeedsInput) {
      return { result: false, needsInput: true, trace: needsInputTrace };
    }
    return { result: false, needsInput: false, trace: traces.join(' OR ') };
  }

  return { result: false, needsInput: true, trace: 'Unsupported or malformed predicate.' };
}

export function generateChecklists(
  rules: RuleDefinition[],
  graph: NormalizedXmlGraph,
  factRegistry: Record<string, Fact>,
  existingInstances?: ChecklistInstance[]
): ChecklistInstance[] {
  const existingMap = new Map<string, ChecklistInstance>();
  if (existingInstances) {
    existingInstances.forEach(inst => existingMap.set(inst.instanceKey, inst));
  }

  const instances: ChecklistInstance[] = [];

  // Helper context builder
  const unitContext: Record<string, any> = {};
  Object.keys(factRegistry).forEach(k => {
    unitContext[k] = factRegistry[k].value;
  });

  const activeRules = rules.filter(r => !r.isArchived);

  const nextStatus = (rule: RuleDefinition, applicability: RuleApplicability, existing?: ChecklistWithFingerprint): CheckStatus => {
    if (applicability === 'NotApplicable') return 'NA';
    if (applicability === 'NeedsInput') return 'Incomplete';
    const fingerprint = semanticFingerprint(rule);
    return existing?.applicability === 'Applicable' && existing.semanticFingerprint === fingerprint
      ? existing.status
      : 'Incomplete';
  };
  const addFingerprint = (instance: ChecklistInstance, rule: RuleDefinition): ChecklistInstance => {
    (instance as ChecklistWithFingerprint).semanticFingerprint = semanticFingerprint(rule);
    return instance;
  };

  for (const rule of activeRules) {
    if (rule.scope === 'Unit') {
      const instanceKey = `unit:${rule.id}`;
      const existing = existingMap.get(instanceKey);

      const evalResult = evaluateAstPredicate(rule.predicate, unitContext, rule.requiredFacts, factRegistry);
      const applicability: RuleApplicability = evalResult.needsInput
        ? 'NeedsInput'
        : evalResult.result
        ? 'Applicable'
        : 'NotApplicable';

      const factTraces = rule.requiredFacts.map(k => ({
        key: k,
        label: factRegistry[k]?.label || k,
        value: factRegistry[k]?.value,
        status: factRegistry[k]?.status || 'Unknown'
      }));

      instances.push(addFingerprint({
        ruleId: rule.id,
        semanticKey: rule.semanticKey,
        instanceKey,
        scopeTargetId: 'unit',
        applicability,
        applicabilityReason: evalResult.trace,
        status: nextStatus(rule, applicability, existing as ChecklistWithFingerprint | undefined),
        allowNA: rule.allowNA,
        detailerComment: existing?.detailerComment || '',
        checkerComment: existing?.checkerComment || '',
        updatedAt: existing?.updatedAt || new Date().toISOString(),
        factTraces
      }, rule));
    } else if (rule.scope === 'Skid') {
      // Create an instance for EACH shipping skid
      for (const skid of graph.skids) {
        const instanceKey = `${skid.id}:${rule.id}`;
        const existing = existingMap.get(instanceKey);

        // Build scoped context for this skid
        const skidContext: Record<string, any> = {
          ...unitContext,
          __skidId: skid.id,
          'skid.hasSplit': factRegistry[`skid.${skid.id}.hasSplit`]?.value ?? (graph.skids.length > 1),
          'skid.weight': factRegistry[`skid.${skid.id}.weight`]?.value,
          'skid.segmentCount': factRegistry[`skid.${skid.id}.segmentCount`]?.value ?? skid.segmentIds.length,
          'skid.hasDrainPan': factRegistry[`skid.${skid.id}.hasDrainPan`]?.value ?? false,
          'skid.hasFans': factRegistry[`skid.${skid.id}.hasFans`]?.value ?? false,
          'skid.hasCoils': factRegistry[`skid.${skid.id}.hasCoils`]?.value ?? false,
          'skid.hasFilters': factRegistry[`skid.${skid.id}.hasFilters`]?.value ?? false,
          'skid.hasHeatWheel': factRegistry[`skid.${skid.id}.hasHeatWheel`]?.value ?? false
        };

        const evalResult = evaluateAstPredicate(rule.predicate, skidContext, rule.requiredFacts, factRegistry);
        const applicability: RuleApplicability = evalResult.needsInput
          ? 'NeedsInput'
          : evalResult.result
          ? 'Applicable'
          : 'NotApplicable';

        const factTraces = rule.requiredFacts.map(k => {
          const mappedKey = k.startsWith('skid.') ? k.replace('skid.', `skid.${skid.id}.`) : k;
          return {
            key: mappedKey,
            label: factRegistry[mappedKey]?.label || factRegistry[k]?.label || k,
            value: skidContext[k] ?? factRegistry[mappedKey]?.value ?? factRegistry[k]?.value,
            status: factRegistry[mappedKey]?.status || factRegistry[k]?.status || 'Unknown'
          };
        });

        instances.push(addFingerprint({
          ruleId: rule.id,
          semanticKey: rule.semanticKey,
          instanceKey,
          scopeTargetId: skid.id,
          applicability,
          applicabilityReason: evalResult.trace,
          status: nextStatus(rule, applicability, existing as ChecklistWithFingerprint | undefined),
          allowNA: rule.allowNA,
          detailerComment: existing?.detailerComment || '',
          checkerComment: existing?.checkerComment || '',
          updatedAt: existing?.updatedAt || new Date().toISOString(),
          factTraces
        }, rule));
      }
    }
  }

  return instances;
}
