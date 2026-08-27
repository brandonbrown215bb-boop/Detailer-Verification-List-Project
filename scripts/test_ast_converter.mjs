import assert from 'assert';

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

function subGroupToAst(group) {
  if (!group.children || group.children.length === 0) return undefined;

  const convertedChildren = group.children
    .map(child => {
      if (child.type === 'condition') {
        return leafToAst(child);
      } else {
        return subGroupToAst(child);
      }
    })
    .filter(Boolean);

  if (convertedChildren.length === 0) return undefined;
  if (group.logicalOperator === 'or') return { or: convertedChildren };
  return { and: convertedChildren };
}

function visualTreeToAst(root) {
  if (!root.children || root.children.length === 0) return undefined;

  const convertedChildren = root.children
    .map(child => {
      if (child.type === 'condition') {
        return leafToAst(child);
      } else {
        return subGroupToAst(child);
      }
    })
    .filter(Boolean);

  if (convertedChildren.length === 0) return undefined;
  if (convertedChildren.length === 1 && root.logicalOperator === 'and' && root.children[0].type === 'condition') {
    return convertedChildren[0];
  }
  if (root.logicalOperator === 'or') return { or: convertedChildren };
  return { and: convertedChildren };
}

function parseLeaf(predicate) {
  const operators = [
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
        if (op === '!==' && value === null) return { type: 'condition', factKey, operator: 'is_defined', value: null };
        return { type: 'condition', factKey, operator: op, value };
      }
    }
  }
  return undefined;
}

function parseSubPredicate(sub) {
  if ('and' in sub && Array.isArray(sub.and)) {
    return {
      type: 'group',
      logicalOperator: 'and',
      children: sub.and.map(parseSubPredicate).filter(Boolean)
    };
  }
  if ('or' in sub && Array.isArray(sub.or)) {
    return {
      type: 'group',
      logicalOperator: 'or',
      children: sub.or.map(parseSubPredicate).filter(Boolean)
    };
  }
  return parseLeaf(sub);
}

function astToVisualTree(predicate) {
  const root = { type: 'group', logicalOperator: 'and', children: [] };
  if (!predicate || Object.keys(predicate).length === 0) return root;

  if ('and' in predicate && Array.isArray(predicate.and)) {
    root.logicalOperator = 'and';
    root.children = predicate.and.map(parseSubPredicate).filter(Boolean);
    return root;
  }
  if ('or' in predicate && Array.isArray(predicate.or)) {
    root.logicalOperator = 'or';
    root.children = predicate.or.map(parseSubPredicate).filter(Boolean);
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

// Test 3: Nested Component / SubGroup Conversion
const nestedSubGroup = {
  type: 'group',
  logicalOperator: 'or',
  children: [
    { type: 'condition', factKey: 'unit.shellType', operator: '===', value: 'ThermalBreak' },
    { type: 'condition', factKey: 'unit.shellType', operator: '===', value: 'Custom' }
  ]
};
const treeWithNested = {
  type: 'group',
  logicalOperator: 'and',
  children: [
    { type: 'condition', factKey: 'unit.unitType', operator: '===', value: 'Outdoor' },
    nestedSubGroup
  ]
};
const astNested = visualTreeToAst(treeWithNested);
assert.deepStrictEqual(astNested, {
  and: [
    { '===': [{ var: 'unit.unitType' }, 'Outdoor'] },
    {
      or: [
        { '===': [{ var: 'unit.shellType' }, 'ThermalBreak'] },
        { '===': [{ var: 'unit.shellType' }, 'Custom'] }
      ]
    }
  ]
}, 'Test 3 Failed: Nested group AST conversion');
console.log('✓ Test 3: Nested group converts cleanly to nested AST');

// Test 4: Nested Group AST to Visual Tree Roundtrip
const parsedNestedTree = astToVisualTree(astNested);
assert.strictEqual(parsedNestedTree.logicalOperator, 'and');
assert.strictEqual(parsedNestedTree.children.length, 2);
assert.strictEqual(parsedNestedTree.children[0].type, 'condition');
assert.strictEqual(parsedNestedTree.children[0].factKey, 'unit.unitType');
assert.strictEqual(parsedNestedTree.children[1].type, 'group');
assert.strictEqual(parsedNestedTree.children[1].logicalOperator, 'or');
assert.strictEqual(parsedNestedTree.children[1].children.length, 2);
assert.strictEqual(parsedNestedTree.children[1].children[0].factKey, 'unit.shellType');
console.log('✓ Test 4: Nested group AST parses back into intact visual tree');

// Test 5: Required Facts Extraction with Nested Groups
const facts = extractRequiredFacts(parsedNestedTree);
assert.deepStrictEqual(facts, ['unit.shellType', 'unit.unitType'], 'Test 5 Failed: Fact extraction');
console.log('✓ Test 5: Required facts extracted across nested groups');

console.log('\nAll AST converter tests passed successfully!');

