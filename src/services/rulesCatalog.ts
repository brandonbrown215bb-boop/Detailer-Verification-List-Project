import { RuleDefinition, TemplateMap } from '../types';
import rulesData from '../rulepack/rules.json';
import templateMapData from '../rulepack/template_map.json';
import approvedMappingsData from '../rulepack/approved_mappings.json';

export const RULES_CATALOG: RuleDefinition[] = rulesData as RuleDefinition[];
export const TEMPLATE_MAP: TemplateMap = templateMapData as TemplateMap;
export const APPROVED_MAPPINGS = approvedMappingsData;
