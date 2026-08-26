import { RuleDefinition, RuleScope, RuleApplicability, Fact, FactStatus, FactConfidence, ASTPredicate, RulePackManifest, TemplateMap } from '../types';

export type ComparisonOperator =
  | '==='
  | '!=='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'includes'
  | 'in'
  | 'is_true'
  | 'is_false'
  | 'is_defined';

export interface VisualConditionLeaf {
  type: 'condition';
  id: string;
  factKey: string;
  operator: ComparisonOperator;
  value: any;
}

export interface VisualConditionGroup {
  type: 'group';
  id: string;
  logicalOperator: 'and' | 'or';
  children: Array<VisualConditionLeaf | VisualConditionGroup>;
}

export type VisualConditionNode = VisualConditionLeaf | VisualConditionGroup;

export interface FactFieldDefinition {
  key: string;
  label: string;
  scope: RuleScope | 'All';
  category: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  enumOptions?: Array<{ value: string; label: string }>;
  unit?: string;
  description?: string;
  sampleValue?: any;
}

export type RuleChangeType = 'added' | 'modified' | 'archived' | 'unarchived' | 'deleted' | 'reordered';

export interface RuleDiffItem {
  ruleId: string;
  semanticKey: string;
  category: string;
  changeType: RuleChangeType;
  before?: Partial<RuleDefinition>;
  after?: Partial<RuleDefinition>;
  fieldChanges?: Array<{
    field: keyof RuleDefinition;
    label: string;
    beforeVal: any;
    afterVal: any;
  }>;
}

export interface RulePackDraftState {
  version: string;
  rules: RuleDefinition[];
  templateMap: TemplateMap;
  approvedMappings: any;
  manifest: RulePackManifest;
  isDirty: boolean;
  selectedRuleId: string | null;
  searchQuery: string;
  filterCategory: string;
  filterScope: string;
  filterStatus: 'all' | 'active' | 'archived' | 'modified';
}

export interface SimulationResult {
  ruleId: string;
  applicability: RuleApplicability;
  reason: string;
  evaluatedContext: Record<string, any>;
  factTraces: Array<{
    key: string;
    label: string;
    value: any;
    status: FactStatus;
    confidence: FactConfidence;
  }>;
}
