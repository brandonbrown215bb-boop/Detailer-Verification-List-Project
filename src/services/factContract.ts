import contractData from '../../resources/rulepack/fact_contract.json' with { type: 'json' };
import type { Fact, RuleDefinition, TemplateMap } from '../types/index.ts';

export type FactValueType = 'string' | 'number' | 'boolean';
export type FactContractEntry = {
  key: string;
  type: FactValueType;
  scope: string;
};

type FactContractData = {
  contractVersion: string;
  facts: FactContractEntry[];
  patterns: FactContractEntry[];
  legacyAliases: Record<string, string>;
};

export const FACT_CONTRACT = contractData as FactContractData;
export const FACT_CONTRACT_VERSION = FACT_CONTRACT.contractVersion;

function patternToRegExp(pattern: string): RegExp {
  return new RegExp(`^${pattern.split('.').map(part => part === '{id}' ? '[^.]+': part.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('\\.')}$`);
}

const compiledPatterns = FACT_CONTRACT.patterns.map(entry => ({
  ...entry,
  regex: patternToRegExp(entry.key)
}));

export function canonicalFactKey(key: string): string {
  return FACT_CONTRACT.legacyAliases[key] || key;
}

export function factContractEntry(key: string): FactContractEntry | undefined {
  const canonical = canonicalFactKey(key);
  return FACT_CONTRACT.facts.find(entry => entry.key === canonical) ||
    compiledPatterns.find(entry => entry.regex.test(canonical));
}

export function isRegisteredFactKey(key: string): boolean {
  return Boolean(factContractEntry(key));
}

export function assertRegisteredFactKey(key: string, context = 'fact key'): string {
  const canonical = canonicalFactKey(key);
  if (!factContractEntry(canonical)) {
    throw new Error(`${context} '${key}' is not registered in fact contract ${FACT_CONTRACT_VERSION}.`);
  }
  return canonical;
}

export function isFactValueCompatible(key: string, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const entry = factContractEntry(key);
  if (!entry) return false;
  if (entry.type === 'string') return typeof value === 'string';
  if (entry.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'boolean';
}

/** Convert a user's text input at the UI boundary; the domain override stays typed. */
export function parseFactInput(key: string, text: string): string | number | boolean {
  const entry = factContractEntry(key);
  if (!entry) throw new Error(`Unknown fact '${key}'.`);
  const value = text.trim();
  if (!value) throw new Error('Enter a value before confirming this fact.');
  if (entry.type === 'string') return value;
  if (entry.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Enter a finite number.');
    return number;
  }
  if (/^(true|yes)$/i.test(value)) return true;
  if (/^(false|no)$/i.test(value)) return false;
  throw new Error('Enter Yes or No for this fact.');
}

export function normalizeFactRegistryAliases(registry: Record<string, Fact>): Record<string, Fact> {
  const normalized: Record<string, Fact> = {};
  for (const [rawKey, rawFact] of Object.entries(registry || {})) {
    const key = canonicalFactKey(rawKey);
    const fact = { ...rawFact, key } as Fact;
    // Canonical values win if a legacy and canonical copy were persisted together.
    if (!(key in normalized) || rawKey === key) normalized[key] = fact;
  }
  return normalized;
}

function normalizePredicate(predicate: any): any {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return predicate;
  const result: Record<string, any> = {};
  for (const [operator, value] of Object.entries(predicate)) {
    if (operator === 'var' && typeof value === 'string') {
      result[operator] = canonicalFactKey(value);
    } else if (Array.isArray(value)) {
      result[operator] = value.map(item => normalizePredicate(item));
    } else {
      result[operator] = normalizePredicate(value);
    }
  }
  return result;
}

export function normalizeRuleDefinition(rule: RuleDefinition): RuleDefinition {
  return {
    ...rule,
    requiredFacts: (rule.requiredFacts || []).map(key => canonicalFactKey(key)),
    predicate: normalizePredicate(rule.predicate)
  };
}

export function validateRulePackData(
  rules: RuleDefinition[],
  templateMap: TemplateMap,
  options: { throwOnError?: boolean } = {}
): string[] {
  const errors: string[] = [];
  const scopes = new Set(['Unit', 'Skid', 'Segment', 'Component']);
  const modes = new Set(['ManualCheckbox', 'AutoEvaluated', 'MeasurementVerify']);
  const categories = new Set(['Base', 'Housing', 'Knockdown', 'UTL', 'Paperwork', 'MOM', 'Internals']);
  const ids = new Set<string>();
  const semanticKeys = new Set<string>();

  const kindOf = (value: unknown): FactValueType | 'null' | 'array' | 'object' => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number' && Number.isFinite(value)) return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    return 'object';
  };
  const termType = (term: any, path: string): FactValueType | 'null' | undefined => {
    if (term && typeof term === 'object' && !Array.isArray(term) && typeof term.var === 'string' && Object.keys(term).length === 1) {
      const entry = factContractEntry(term.var);
      if (!entry) errors.push(`${path}: unknown fact '${term.var}'.`);
      return entry?.type;
    }
    const kind = kindOf(term);
    if (kind === 'string' || kind === 'number' || kind === 'boolean' || kind === 'null') return kind;
    errors.push(`${path}: malformed literal/variable.`);
    return undefined;
  };
  const validatePredicate = (predicate: any, path: string): void => {
    if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate) || Object.keys(predicate).length !== 1) {
      errors.push(`${path}: predicate must contain exactly one supported operator.`);
      return;
    }
    const [operator, value] = Object.entries(predicate)[0];
    const leaves = new Set(['>=', '<=', '>', '<', '===', '!==', 'includes', 'in']);
    if (leaves.has(operator)) {
      if (!Array.isArray(value) || value.length !== 2) {
        errors.push(`${path}.${operator}: expected exactly two operands.`);
        return;
      }
      const leftType = termType(value[0], `${path}.${operator}[0]`);
      const rightType = operator === 'in' && Array.isArray(value[1])
        ? (value[1].length ? termType(value[1][0], `${path}.${operator}[1][0]`) : undefined)
        : termType(value[1], `${path}.${operator}[1]`);
      if (operator === 'in' && !Array.isArray(value[1]) && rightType !== 'string') {
        errors.push(`${path}.in: right operand must be an array or comma-delimited string.`);
      }
      if (operator === 'includes' && (leftType !== 'string' || rightType !== 'string')) {
        errors.push(`${path}.includes: operands must be strings.`);
      }
      if (['>', '>=', '<', '<='].includes(operator) && (leftType !== 'number' || rightType !== 'number')) {
        errors.push(`${path}.${operator}: operands must be numbers.`);
      }
      if (['===', '!=='].includes(operator) && leftType && rightType && leftType !== 'null' && rightType !== 'null' && leftType !== rightType) {
        errors.push(`${path}.${operator}: operand types ${leftType} and ${rightType} are incompatible.`);
      }
      if (operator === 'in' && Array.isArray(value[1])) {
        for (let i = 0; i < value[1].length; i++) {
          const itemType = termType(value[1][i], `${path}.in[1][${i}]`);
          if (leftType && itemType && itemType !== 'null' && leftType !== itemType) errors.push(`${path}.in: item ${i} has incompatible type.`);
        }
      }
      return;
    }
    if (operator === 'and' || operator === 'or') {
      if (!Array.isArray(value) || value.length === 0) errors.push(`${path}.${operator}: expected a non-empty predicate array.`);
      else value.forEach((child: any, index: number) => validatePredicate(child, `${path}.${operator}[${index}]`));
      return;
    }
    errors.push(`${path}: unsupported AST operator '${operator}'.`);
  };

  for (const [index, original] of (rules || []).entries()) {
    const rule = normalizeRuleDefinition(original);
    if (!rule.id || ids.has(rule.id)) errors.push(`rules[${index}]: duplicate or missing id '${rule.id}'.`);
    ids.add(rule.id);
    if (!rule.semanticKey || semanticKeys.has(rule.semanticKey)) errors.push(`rules[${index}]: duplicate or missing semanticKey '${rule.semanticKey}'.`);
    semanticKeys.add(rule.semanticKey);
    if (!scopes.has(rule.scope)) errors.push(`rules[${index}]: unsupported scope '${rule.scope}'.`);
    if (!modes.has(rule.verificationMode)) errors.push(`rules[${index}]: unsupported verificationMode '${rule.verificationMode}'.`);
    if (!categories.has(rule.category)) errors.push(`rules[${index}]: unsupported category '${rule.category}'.`);
    for (const [factIndex, key] of (rule.requiredFacts || []).entries()) {
      if (!factContractEntry(key)) errors.push(`rules[${index}].requiredFacts[${factIndex}]: unknown fact '${key}'.`);
    }
    if (rule.predicate) validatePredicate(rule.predicate, `rules[${index}].predicate`);
  }

  const map = templateMap as any;
  if (!map || typeof map !== 'object' || typeof map.templateVersion !== 'string') errors.push('template_map: missing templateVersion.');
  const generalFields = map?.generalFields || {};
  for (const key of Object.keys(generalFields)) {
    if (key !== 'generalComments' && !factContractEntry(key)) errors.push(`template_map.generalFields: unknown fact '${key}'.`);
    if (!generalFields[key]?.sheet || !/^[A-Z]{1,3}[1-9][0-9]*$/.test(generalFields[key]?.cell || '')) errors.push(`template_map.generalFields.${key}: malformed cell mapping.`);
  }
  if (!map?.sqRange || map.sqRange.startRow > map.sqRange.endRow || !map.sqRange.sheet) errors.push('template_map.sqRange: malformed range.');
  const mappings = map?.ruleCellMappings || {};
  for (const [semanticKey, mapping] of Object.entries(mappings) as Array<[string, any]>) {
    const rule = (rules || []).find(item => item.semanticKey === semanticKey);
    if (!rule) errors.push(`template_map.ruleCellMappings: orphan semantic key '${semanticKey}'.`);
    if (rule && mapping.ruleId !== rule.id) errors.push(`template_map.ruleCellMappings.${semanticKey}: ruleId does not match rule.`);
    if (!mapping || !Number.isInteger(mapping.row) || mapping.row < 1 || !['naCell', 'detailerCell', 'checkerCell', 'commentsCell', 'initialsCell'].every(name => /^[A-Z]{1,3}[1-9][0-9]*$/.test(mapping[name] || ''))) errors.push(`template_map.ruleCellMappings.${semanticKey}: malformed cell mapping.`);
  }
  for (const rule of rules || []) if (!mappings[rule.semanticKey]) errors.push(`template_map.ruleCellMappings: missing '${rule.semanticKey}'.`);

  if (options.throwOnError !== false && errors.length) throw new Error(`Rule pack validation failed:\n${errors.join('\n')}`);
  return errors;
}
