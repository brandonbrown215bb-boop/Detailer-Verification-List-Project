import { NormalizedXmlGraph, Fact, RuleDefinition, ChecklistInstance, RuleApplicability, ASTPredicate } from '../types';

export function evaluateAstPredicate(
  predicate: ASTPredicate | undefined,
  context: Record<string, any>,
  requiredFacts: string[],
  factRegistry: Record<string, Fact>
): { result: boolean; needsInput: boolean; trace: string } {
  if (!predicate) {
    return { result: true, needsInput: false, trace: 'Standard check (Always applicable)' };
  }

  // Check if any required fact is Unknown or RequiresConfirmation
  for (const fKey of requiredFacts) {
    // Check if the key in context maps to factRegistry
    const mappedKey = fKey.startsWith('skid.') && context.__skidId
      ? fKey.replace('skid.', `skid.${context.__skidId}.`)
      : fKey;

    const fact = factRegistry[mappedKey] || factRegistry[fKey];
    if (!fact || fact.status === 'Unknown' || fact.confidence === 'RequiresConfirmation') {
      return {
        result: false,
        needsInput: true,
        trace: `Required fact '${fact?.label || fKey}' requires confirmation or is unknown (${fact?.status || 'Missing'})`
      };
    }
  }

  function resolveValue(val: any): any {
    if (val && typeof val === 'object' && 'var' in val) {
      const varName = val.var;
      return context[varName];
    }
    return val;
  }

  // Evaluator operators
  if ('>' in predicate) {
    const [left, right] = predicate['>'];
    const leftVal = resolveValue(left);
    const rightVal = resolveValue(right);
    const res = Number(leftVal) > Number(rightVal);
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: ${leftVal} > ${rightVal} (${res ? 'True' : 'False'})`
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
    const leftVal = String(resolveValue(left) || '');
    const rightVal = String(resolveValue(right) || '');
    const res = leftVal.includes(rightVal);
    return {
      result: res,
      needsInput: false,
      trace: `Evaluated: "${leftVal}" includes "${rightVal}" (${res ? 'True' : 'False'})`
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

  return { result: true, needsInput: false, trace: 'Default true' };
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

  for (const rule of rules) {
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

      instances.push({
        ruleId: rule.id,
        semanticKey: rule.semanticKey,
        instanceKey,
        scopeTargetId: 'unit',
        applicability,
        applicabilityReason: evalResult.trace,
        status: existing?.status || (applicability === 'NotApplicable' ? 'NA' : 'Incomplete'),
        detailerComment: existing?.detailerComment || '',
        checkerComment: existing?.checkerComment || '',
        updatedAt: existing?.updatedAt || new Date().toISOString(),
        factTraces
      });
    } else if (rule.scope === 'Skid') {
      // Create an instance for EACH shipping skid
      for (const skid of graph.skids) {
        const instanceKey = `${skid.id}:${rule.id}`;
        const existing = existingMap.get(instanceKey);

        // Build scoped context for this skid
        const skidContext: Record<string, any> = {
          ...unitContext,
          __skidId: skid.id,
          'skid.weight': factRegistry[`skid.${skid.id}.weight`]?.value ?? skid.calculatedWeight,
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

        instances.push({
          ruleId: rule.id,
          semanticKey: rule.semanticKey,
          instanceKey,
          scopeTargetId: skid.id,
          applicability,
          applicabilityReason: evalResult.trace,
          status: existing?.status || (applicability === 'NotApplicable' ? 'NA' : 'Incomplete'),
          detailerComment: existing?.detailerComment || '',
          checkerComment: existing?.checkerComment || '',
          updatedAt: existing?.updatedAt || new Date().toISOString(),
          factTraces
        });
      }
    }
  }

  return instances;
}
