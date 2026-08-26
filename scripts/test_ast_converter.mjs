import assert from 'assert';

// Mock implementations matching astConverter logic for node test verification
function leafToAst(leaf) {
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

function visualTreeToAst(root) {
  if (!root.children || root.children.length === 0) return undefined;

  const convertedChildren = root.children
    .map(child => {
      if (child.type === 'condition') {
        return leafToAst(child);
      } else {
        return visualTreeToAst(child);
      }
    })
    .filter(Boolean);

  if (convertedChildren.length === 0) return undefined;
  if (convertedChildren.length === 1 && root.logicalOperator === 'and') return convertedChildren[0];
  if (root.logicalOperator === 'or') return { or: convertedChildren };
  return { and: convertedChildren };
}

function parseLeaf(predicate) {
  const operators = [
    { key: '>', op: '>' },
    { key: '>=', op: '>=' },
    { key: '<', op: '<' },
    { key: '<=', op: '<=' },
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
      let value = right;

      if (left && typeof left === 'object' && 'var' in left) {
        factKey = left.var;
      } else if (right && typeof right === 'object' && 'var' in right) {
        factKey = right.var;
        value = left;
      }

      if (factKey) {
        if (op === '===' && value === true) return { type: 'condition', factKey, operator: 'is_true', value: true };
        if (op === '===' && value === false) return { type: 'condition', factKey, operator: 'is_false', value: false };
        return { type: 'condition', factKey, operator: op, value };
      }
    }
  }
  return undefined;
}

function astToVisualTree(predicate) {
  const root = { type: 'group', logicalOperator: 'and', children: [] };
  if (!predicate || Object.keys(predicate).length === 0) return root;

  if ('and' in predicate && Array.isArray(predicate.and)) {
    root.logicalOperator = 'and';
    root.children = predicate.and.map(parseLeaf).filter(Boolean);
    return root;
  }
  if ('or' in predicate && Array.isArray(predicate.or)) {
    root.logicalOperator = 'or';
    root.children = predicate.or.map(parseLeaf).filter(Boolean);
    return root;
  }

  const single = parseLeaf(predicate);
  if (single) root.children.push(single);
  return root;
}

function extractRequiredFacts(node) {
  const facts = new Set();
  function collect(n) {
    if (n.type === 'condition' && n.factKey?.trim()) {
      facts.add(n.factKey.trim());
    } else if (n.type === 'group' && n.children) {
      n.children.forEach(collect);
    }
  }
  collect(node);
  return Array.from(facts).sort();
}

console.log('--- Running AST Converter Tests ---');

// Test 1: Single Numeric Comparison
const numLeaf = {
  type: 'condition',
  factKey: 'skid.weight',
  operator: '>',
  value: 4000
};
const ast1 = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [numLeaf] });
assert.deepStrictEqual(ast1, { '>': [{ var: 'skid.weight' }, 4000] }, 'Test 1 Failed: Numeric comparison AST');
console.log('✓ Test 1: Numeric comparison converts to AST');

// Test 2: Compound AND Predicate
const leaf2a = { type: 'condition', factKey: 'unit.washdown', operator: 'is_true', value: true };
const leaf2b = { type: 'condition', factKey: 'unit.totalStaticPressure', operator: '>=', value: 3.0 };
const ast2 = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf2a, leaf2b] });
assert.deepStrictEqual(ast2, {
  and: [
    { '===': [{ var: 'unit.washdown' }, true] },
    { '>=': [{ var: 'unit.totalStaticPressure' }, 3.0] }
  ]
}, 'Test 2 Failed: Compound AND AST');
console.log('✓ Test 2: Compound AND converts to AST');

// Test 3: AST to Visual Tree Roundtrip
const parsedTree = astToVisualTree(ast2);
assert.strictEqual(parsedTree.logicalOperator, 'and');
assert.strictEqual(parsedTree.children.length, 2);
assert.strictEqual(parsedTree.children[0].factKey, 'unit.washdown');
assert.strictEqual(parsedTree.children[0].operator, 'is_true');
assert.strictEqual(parsedTree.children[1].factKey, 'unit.totalStaticPressure');
console.log('✓ Test 3: AST to Visual Tree roundtrip matches');

// Test 4: Required Facts Extraction
const facts = extractRequiredFacts(parsedTree);
assert.deepStrictEqual(facts, ['unit.totalStaticPressure', 'unit.washdown'], 'Test 4 Failed: Fact extraction');
console.log('✓ Test 4: Required facts correctly derived');

console.log('\nAll AST converter tests passed successfully!');
