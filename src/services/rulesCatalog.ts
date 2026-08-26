import { RuleDefinition, TemplateMap } from '../types';
import rulesData from '../rulepack/rules.json';
import templateMapData from '../rulepack/template_map.json';
import approvedMappingsData from '../rulepack/approved_mappings.json';
import manifestData from '../rulepack/manifest.json';

interface RulePackManifestData {
  name: string;
  version: string;
  generatedAt: string;
  bundleSha256: string;
  files: Record<string, { sha256: string }>;
}

export const RULES_CATALOG: RuleDefinition[] = rulesData as RuleDefinition[];
export const TEMPLATE_MAP: TemplateMap = templateMapData as TemplateMap;
export const APPROVED_MAPPINGS = approvedMappingsData;
export const RULE_PACK_MANIFEST = manifestData as RulePackManifestData;
export const RULE_PACK_IDENTITY = {
  version: RULE_PACK_MANIFEST.version,
  sha256: RULE_PACK_MANIFEST.bundleSha256
};
