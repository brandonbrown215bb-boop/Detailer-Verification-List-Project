import type { ASTPredicate } from '../../types/index.ts';
import type { VisualConditionGroup, VisualConditionLeaf, VisualConditionNode, ComparisonOperator } from '../types.ts';

let idCounter = 1;
export function generateNodeId(): string {
  return `node_${Date.now()}_${idCounter++}`;
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
      } else {
        return subGroupToAst(child);
      }
    })
    .filter(Boolean) as ASTPredicate[];

  if (convertedChildren.length === 0) {
    return undefined;
  }

  if (convertedChildren.length === 1 && root.logicalOperator === 'and' && root.children[0].type === 'condition') {
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

  switch (leaf.operator) {
    case '>':
      return { '>': [varRef, Number(leaf.value) || 0] };
    case '>=':
      return { '>=': [varRef, Number(leaf.value) || 0] };
    case '<':
      return { '<': [varRef, Number(leaf.value) || 0] };
    case '<=':
      return { '<=': [varRef, Number(leaf.value) || 0] };
    case '===':
      return { '===': [varRef, leaf.value] };
    case '!==':
      return { '!==': [varRef, leaf.value] };
    case 'includes':
      return { includes: [varRef, String(leaf.value || '')] };
    case 'in': {
      const list = Array.isArray(leaf.value)
        ? leaf.value
        : String(leaf.value || '')
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
      return { '===': [varRef, leaf.value] };
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
    root.children = predicate.and.map(sub => parseSubPredicate(sub)).filter(Boolean) as VisualConditionNode[];
    return root;
  }

  // Handle 'or'
  if ('or' in predicate && Array.isArray(predicate.or)) {
    root.logicalOperator = 'or';
    root.children = predicate.or.map(sub => parseSubPredicate(sub)).filter(Boolean) as VisualConditionNode[];
    return root;
  }

  // Single condition
  const single = parseLeaf(predicate);
  if (single) {
    root.children.push(single);
  }

  return root;
}

function parseSubPredicate(sub: ASTPredicate): VisualConditionNode | undefined {
  if ('and' in sub && Array.isArray(sub.and)) {
    return {
      type: 'group',
      id: generateNodeId(),
      logicalOperator: 'and',
      children: sub.and.map(s => parseSubPredicate(s)).filter(Boolean) as VisualConditionNode[]
    };
  }

  if ('or' in sub && Array.isArray(sub.or)) {
    return {
      type: 'group',
      id: generateNodeId(),
      logicalOperator: 'or',
      children: sub.or.map(s => parseSubPredicate(s)).filter(Boolean) as VisualConditionNode[]
    };
  }

  return parseLeaf(sub);
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
      let factKey = '';
      let value: any = right;

      if (left && typeof left === 'object' && 'var' in left) {
        factKey = left.var;
      } else if (right && typeof right === 'object' && 'var' in right) {
        factKey = right.var;
        value = left;
      }

      if (factKey) {
        // Special case booleans and defined
        if (op === '===' && value === true) {
          return { type: 'condition', id: generateNodeId(), factKey, operator: 'is_true', value: true };
        }
        if (op === '===' && value === false) {
          return { type: 'condition', id: generateNodeId(), factKey, operator: 'is_false', value: false };
        }
        if (op === '!==' && value === null) {
          return { type: 'condition', id: generateNodeId(), factKey, operator: 'is_defined', value: null };
        }

        return {
          type: 'condition',
          id: generateNodeId(),
          factKey,
          operator: op,
          value
        };
      }
    }
  }

  return undefined;
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
    } else if (node.type === 'group' && node.children) {
      node.children.forEach(collect);
    }
  }

  collect(group);
  return Array.from(facts).sort();
}
