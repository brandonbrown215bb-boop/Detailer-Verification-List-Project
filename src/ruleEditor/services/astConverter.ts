import type { ASTPredicate } from '../../types/index.ts';
import type {
  VisualConditionGroup,
  VisualConditionLeaf,
  VisualConditionNode,
  VisualConditionUnsupported,
  ComparisonOperator
} from '../types.ts';

let idCounter = 1;
export function generateNodeId(): string {
  return `node_${Date.now()}_${idCounter++}`;
}

/**
 * Inverts relational operators when a variable is on the right-hand side.
 * e.g. 4000 > x <=> x < 4000
 */
export function invertOperator(op: ComparisonOperator): ComparisonOperator {
  switch (op) {
    case '>':
      return '<';
    case '>=':
      return '<=';
    case '<':
      return '>';
    case '<=':
      return '>=';
    default:
      return op; // === and !== are symmetric
  }
}

/**
 * Coerces numeric inputs safely without silent fallback to 0.
 */
function parseNumericValue(val: any): any {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
    return Number(val);
  }
  return val;
}

/**
 * Converts a Visual Condition Tree into an AST JSON Predicate for rules.json
 */
export function visualTreeToAst(root: VisualConditionGroup): ASTPredicate | undefined {
  if (!root.children || root.children.length === 0) {
    return undefined;
  }

  const convertedChildren = root.children
    .map(child => {
      if (child.type === 'condition') {
        return leafToAst(child);
      } else if (child.type === 'unsupported') {
        return child.rawPredicate;
      } else {
        return subGroupToAst(child);
      }
    })
    .filter(Boolean) as ASTPredicate[];

  if (convertedChildren.length === 0) {
    return undefined;
  }

  if (convertedChildren.length === 1 && root.logicalOperator === 'and' && (root.children[0].type === 'condition' || root.children[0].type === 'unsupported')) {
    return convertedChildren[0];
  }

  if (root.logicalOperator === 'or') {
    return { or: convertedChildren };
  }

  return { and: convertedChildren };
}

function subGroupToAst(group: VisualConditionGroup): ASTPredicate | undefined {
  if (!group.children || group.children.length === 0) {
    return undefined;
  }

  const convertedChildren = group.children
    .map(child => {
      if (child.type === 'condition') {
        return leafToAst(child);
      } else if (child.type === 'unsupported') {
        return child.rawPredicate;
      } else {
        return subGroupToAst(child);
      }
    })
    .filter(Boolean) as ASTPredicate[];

  if (convertedChildren.length === 0) {
    return undefined;
  }

  if (group.logicalOperator === 'or') {
    return { or: convertedChildren };
  }

  return { and: convertedChildren };
}

function leafToAst(leaf: VisualConditionLeaf): ASTPredicate | undefined {
  if (!leaf.factKey) return undefined;

  const varRef = { var: leaf.factKey };
  const isVarValue = leaf.value && typeof leaf.value === 'object' && 'var' in leaf.value;
  const rightOperand = isVarValue
    ? { var: leaf.value.var }
    : leaf.operator === '>' || leaf.operator === '>=' || leaf.operator === '<' || leaf.operator === '<='
      ? parseNumericValue(leaf.value)
      : leaf.value;

  switch (leaf.operator) {
    case '>':
      return { '>': [varRef, rightOperand] };
    case '>=':
      return { '>=': [varRef, rightOperand] };
    case '<':
      return { '<': [varRef, rightOperand] };
    case '<=':
      return { '<=': [varRef, rightOperand] };
    case '===':
      return { '===': [varRef, rightOperand] };
    case '!==':
      return { '!==': [varRef, rightOperand] };
    case 'includes':
      return { includes: [varRef, String(leaf.value ?? '')] };
    case 'in': {
      const list = Array.isArray(leaf.value)
        ? leaf.value
        : String(leaf.value ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
      return { in: [varRef, list] };
    }
    case 'is_true':
      return { '===': [varRef, true] };
    case 'is_false':
      return { '===': [varRef, false] };
    case 'is_defined':
      return { '!==': [varRef, null] };
    default:
      return { '===': [varRef, rightOperand] };
  }
}

/**
 * Converts an AST Predicate from rules.json into a Visual Condition Tree
 */
export function astToVisualTree(predicate: ASTPredicate | undefined): VisualConditionGroup {
  const root: VisualConditionGroup = {
    type: 'group',
    id: generateNodeId(),
    logicalOperator: 'and',
    children: []
  };

  if (!predicate || Object.keys(predicate).length === 0) {
    return root;
  }

  // Handle 'and'
  if ('and' in predicate && Array.isArray(predicate.and)) {
    root.logicalOperator = 'and';
    root.children = predicate.and.map(sub => parseSubPredicate(sub));
    return root;
  }

  // Handle 'or'
  if ('or' in predicate && Array.isArray(predicate.or)) {
    root.logicalOperator = 'or';
    root.children = predicate.or.map(sub => parseSubPredicate(sub));
    return root;
  }

  // Single condition or unsupported structure
  const single = parseSubPredicate(predicate);
  root.children.push(single);

  return root;
}

function parseSubPredicate(sub: ASTPredicate): VisualConditionNode {
  if ('and' in sub && Array.isArray(sub.and)) {
    return {
      type: 'group',
      id: generateNodeId(),
      logicalOperator: 'and',
      children: sub.and.map(s => parseSubPredicate(s))
    };
  }

  if ('or' in sub && Array.isArray(sub.or)) {
    return {
      type: 'group',
      id: generateNodeId(),
      logicalOperator: 'or',
      children: sub.or.map(s => parseSubPredicate(s))
    };
  }

  const leaf = parseLeaf(sub);
  if (leaf) {
    return leaf;
  }

  // Preserve unsupported structure verbatim without dropping
  return {
    type: 'unsupported',
    id: generateNodeId(),
    rawPredicate: sub,
    diagnostic: `Complex predicate structure preserved (${Object.keys(sub).join(', ') || 'unknown'})`
  };
}

function parseLeaf(predicate: ASTPredicate): VisualConditionLeaf | undefined {
  const operators: Array<{ key: string; op: ComparisonOperator }> = [
    { key: '>=', op: '>=' },
    { key: '<=', op: '<=' },
    { key: '>', op: '>' },
    { key: '<', op: '<' },
    { key: '===', op: '===' },
    { key: '==', op: '===' },
    { key: '!==', op: '!==' },
    { key: '!=', op: '!==' },
    { key: 'includes', op: 'includes' },
    { key: 'in', op: 'in' }
  ];

  for (const { key, op } of operators) {
    if (key in predicate && Array.isArray(predicate[key]) && predicate[key].length >= 2) {
      const [left, right] = predicate[key];
      const leftIsVar = Boolean(left && typeof left === 'object' && 'var' in left && typeof (left as any).var === 'string');
      const rightIsVar = Boolean(right && typeof right === 'object' && 'var' in right && typeof (right as any).var === 'string');

      let factKey = '';
      let value: any = right;
      let effectiveOp = op;

      if (leftIsVar && rightIsVar) {
        // Variable-to-variable comparison
        factKey = (left as any).var;
        value = { var: (right as any).var };
      } else if (leftIsVar) {
        // Standard variable on left
        factKey = (left as any).var;
        value = right;
      } else if (rightIsVar) {
        // Variable on right: invert operator for relational comparisons
        if (op === 'includes' || op === 'in') {
          return undefined;
        }
        factKey = (right as any).var;
        value = left;
        effectiveOp = invertOperator(op);
      }

      if (factKey) {
        // Special case booleans and defined
        if (effectiveOp === '===' && value === true) {
          return { type: 'condition', id: generateNodeId(), factKey, operator: 'is_true', value: true };
        }
        if (effectiveOp === '===' && value === false) {
          return { type: 'condition', id: generateNodeId(), factKey, operator: 'is_false', value: false };
        }
        if (effectiveOp === '!==' && value === null) {
          return { type: 'condition', id: generateNodeId(), factKey, operator: 'is_defined', value: null };
        }

        return {
          type: 'condition',
          id: generateNodeId(),
          factKey,
          operator: effectiveOp,
          value
        };
      }
    }
  }

  return undefined;
}

function extractVarsFromRaw(obj: any, facts: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;
  if ('var' in obj && typeof obj.var === 'string' && obj.var.trim()) {
    facts.add(obj.var.trim());
  }
  for (const key of Object.keys(obj)) {
    extractVarsFromRaw(obj[key], facts);
  }
}

/**
 * Extracts all unique factKeys referenced in a Visual Condition Tree
 */
export function extractRequiredFactsFromTree(group: VisualConditionGroup): string[] {
  const facts = new Set<string>();

  function collect(node: VisualConditionNode) {
    if (node.type === 'condition') {
      if (node.factKey && node.factKey.trim()) {
        facts.add(node.factKey.trim());
      }
      if (node.value && typeof node.value === 'object' && 'var' in node.value && typeof (node.value as any).var === 'string') {
        facts.add((node.value as any).var.trim());
      }
    } else if (node.type === 'unsupported') {
      extractVarsFromRaw(node.rawPredicate, facts);
    } else if (node.type === 'group' && node.children) {
      node.children.forEach(collect);
    }
  }

  collect(group);
  return Array.from(facts).sort();
}
