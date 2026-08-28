import assert from 'assert';
import { visualTreeToAst, astToVisualTree, extractRequiredFactsFromTree } from '../src/ruleEditor/services/astConverter.ts';

console.log('--- Running AST Converter Tests (Authoritative Source) ---');

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
const facts = extractRequiredFactsFromTree(parsedNestedTree);
assert.deepStrictEqual(facts, ['unit.shellType', 'unit.unitType'], 'Test 5 Failed: Fact extraction');
console.log('✓ Test 5: Required facts extracted across nested groups');

console.log('\nAll AST converter tests passed successfully against live TypeScript source!');
