import type { RuleDefinition, TemplateMap } from '../types/index.ts';
import rulesData from '../../resources/rulepack/rules.json' with { type: 'json' };
import templateMapData from '../../resources/rulepack/template_map.json' with { type: 'json' };
import approvedMappingsData from '../../resources/rulepack/approved_mappings.json' with { type: 'json' };
import manifestData from '../../resources/rulepack/manifest.json' with { type: 'json' };

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
