import type { RuleDefinition, TemplateMap } from '../types/index.ts';
import rulesData from '../../resources/rulepack/rules.json' with { type: 'json' };
import templateMapData from '../../resources/rulepack/template_map.json' with { type: 'json' };
import approvedMappingsData from '../../resources/rulepack/approved_mappings.json' with { type: 'json' };
import manifestData from '../../resources/rulepack/manifest.json' with { type: 'json' };
import factContractData from '../../resources/rulepack/fact_contract.json' with { type: 'json' };
import { normalizeRuleDefinition, validateRulePackData } from './factContract.ts';

interface RulePackManifestData {
  name: string;
  version: string;
  generatedAt: string;
  bundleSha256: string;
  files: Record<string, { sha256: string }>;
}

export const TEMPLATE_MAP: TemplateMap = templateMapData as TemplateMap;
export const FACT_CONTRACT = factContractData;
export const RULES_CATALOG: RuleDefinition[] = (rulesData as RuleDefinition[]).map(normalizeRuleDefinition);
// Browser-preview evaluation is non-certifying, but it still refuses to run a
// malformed or contract-incompatible pack instead of silently treating it as
// an empty/default catalog.
validateRulePackData(RULES_CATALOG, TEMPLATE_MAP);
export const APPROVED_MAPPINGS = approvedMappingsData;
export const RULE_PACK_MANIFEST = manifestData as RulePackManifestData;
export const RULE_PACK_IDENTITY = {
  version: RULE_PACK_MANIFEST.version,
  sha256: RULE_PACK_MANIFEST.bundleSha256,
  templateSha256: RULE_PACK_MANIFEST.files['template.xlsx']?.sha256,
  templateMapSha256: RULE_PACK_MANIFEST.files['template_map.json']?.sha256,
  approvedMappingsSha256: RULE_PACK_MANIFEST.files['approved_mappings.json']?.sha256,
  templateRetrievable: Boolean(RULE_PACK_MANIFEST.files['template.xlsx']?.sha256)
};
