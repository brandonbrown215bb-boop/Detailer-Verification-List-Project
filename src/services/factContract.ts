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


