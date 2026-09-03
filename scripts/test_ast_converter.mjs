import assert from 'assert';
import {
  visualTreeToAst,
  astToVisualTree,
  extractRequiredFactsFromTree,
  generateNodeId
} from '../src/ruleEditor/services/astConverter.ts';

console.log('======================================================================');
console.log(' AHU Verification - AST Converter Comprehensive Unit Test Suite');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Suite 1: Single Leaf Condition to AST Operators
// ---------------------------------------------------------------------------
console.log('[Suite 1/6] Single Condition Operators to AST...');

runTest('1.1 Numeric greater than (>): skid.weight > 4000', () => {
  const leaf = { type: 'condition', factKey: 'skid.weight', operator: '>', value: 4000 };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '>': [{ var: 'skid.weight' }, 4000] });
});

runTest('1.2 Numeric greater than or equal (>=): unit.totalStaticPressure >= 3.0', () => {
  const leaf = { type: 'condition', factKey: 'unit.totalStaticPressure', operator: '>=', value: 3.0 };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '>=': [{ var: 'unit.totalStaticPressure' }, 3.0] });
});

runTest('1.3 Numeric less than (<): unit.wallThickness < 2.0', () => {
  const leaf = { type: 'condition', factKey: 'unit.wallThickness', operator: '<', value: 2.0 };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '<': [{ var: 'unit.wallThickness' }, 2.0] });
});

runTest('1.4 Numeric less than or equal (<=): skid.length <= 120', () => {
  const leaf = { type: 'condition', factKey: 'skid.length', operator: '<=', value: 120 };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '<=': [{ var: 'skid.length' }, 120] });
});

runTest('1.5 Strict equality (===): unit.unitType === "Outdoor"', () => {
  const leaf = { type: 'condition', factKey: 'unit.unitType', operator: '===', value: 'Outdoor' };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '===': [{ var: 'unit.unitType' }, 'Outdoor'] });
});

runTest('1.6 Strict inequality (!==): unit.casingMaterial !== "GalvanizedSteel"', () => {
  const leaf = { type: 'condition', factKey: 'unit.casingMaterial', operator: '!==', value: 'GalvanizedSteel' };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '!==': [{ var: 'unit.casingMaterial' }, 'GalvanizedSteel'] });
});

runTest('1.7 Boolean is_true: unit.isSeismic is_true', () => {
  const leaf = { type: 'condition', factKey: 'unit.isSeismic', operator: 'is_true', value: true };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '===': [{ var: 'unit.isSeismic' }, true] });
});

runTest('1.8 Boolean is_false: unit.knockdown is_false', () => {
  const leaf = { type: 'condition', factKey: 'unit.knockdown', operator: 'is_false', value: false };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '===': [{ var: 'unit.knockdown' }, false] });
});

runTest('1.9 Defined check: unit.orderNumber is_defined', () => {
  const leaf = { type: 'condition', factKey: 'unit.orderNumber', operator: 'is_defined', value: null };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { '!==': [{ var: 'unit.orderNumber' }, null] });
});

runTest('1.10 In list (in): unit.casingMaterial in ["StainlessSteel", "MarineAluminum"]', () => {
  const leaf = { type: 'condition', factKey: 'unit.casingMaterial', operator: 'in', value: ['StainlessSteel', 'MarineAluminum'] };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { in: [{ var: 'unit.casingMaterial' }, ['StainlessSteel', 'MarineAluminum']] });
});

runTest('1.11 In comma-separated string parses into array', () => {
  const leaf = { type: 'condition', factKey: 'unit.fanType', operator: 'in', value: 'DirectDrive, BeltDrive, FanArray' };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { in: [{ var: 'unit.fanType' }, ['DirectDrive', 'BeltDrive', 'FanArray']] });
});

runTest('1.12 Includes operator: unit.options includes "HeatWheel"', () => {
  const leaf = { type: 'condition', factKey: 'unit.options', operator: 'includes', value: 'HeatWheel' };
  const ast = visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [leaf] });
  assert.deepStrictEqual(ast, { includes: [{ var: 'unit.options' }, 'HeatWheel'] });
});

// ---------------------------------------------------------------------------
// Suite 2: Compound Logical Trees (AND, OR, Mixed)
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/6] Compound Logical Trees...');

runTest('2.1 Compound AND group with 3 conditions', () => {
  const tree = {
    type: 'group',
    logicalOperator: 'and',
    children: [
      { type: 'condition', factKey: 'unit.washdown', operator: 'is_true', value: true },
      { type: 'condition', factKey: 'unit.totalStaticPressure', operator: '>=', value: 3.0 },
      { type: 'condition', factKey: 'unit.unitType', operator: '===', value: 'Outdoor' }
    ]
  };
  const ast = visualTreeToAst(tree);
  assert.deepStrictEqual(ast, {
    and: [
      { '===': [{ var: 'unit.washdown' }, true] },
      { '>=': [{ var: 'unit.totalStaticPressure' }, 3.0] },
      { '===': [{ var: 'unit.unitType' }, 'Outdoor'] }
    ]
  });
});

runTest('2.2 Compound OR group with multiple branches', () => {
  const tree = {
    type: 'group',
    logicalOperator: 'or',
    children: [
      { type: 'condition', factKey: 'unit.housingStyle', operator: '===', value: 'ThermalBreak' },
      { type: 'condition', factKey: 'unit.housingStyle', operator: '===', value: 'Custom' }
    ]
  };
  const ast = visualTreeToAst(tree);
  assert.deepStrictEqual(ast, {
    or: [
      { '===': [{ var: 'unit.housingStyle' }, 'ThermalBreak'] },
      { '===': [{ var: 'unit.housingStyle' }, 'Custom'] }
    ]
  });
});

runTest('2.3 Deeply nested AND-of-ORs tree structure', () => {
  const tree = {
    type: 'group',
    logicalOperator: 'and',
    children: [
      { type: 'condition', factKey: 'unit.isSeismic', operator: 'is_true', value: true },
      {
        type: 'group',
        logicalOperator: 'or',
        children: [
          { type: 'condition', factKey: 'skid.baseHeight', operator: '>=', value: 12 },
          { type: 'condition', factKey: 'skid.baseMaterial', operator: '===', value: 'StructuralSteel' }
        ]
      }
    ]
  };
  const ast = visualTreeToAst(tree);
  assert.deepStrictEqual(ast, {
    and: [
      { '===': [{ var: 'unit.isSeismic' }, true] },
      {
        or: [
          { '>=': [{ var: 'skid.baseHeight' }, 12] },
          { '===': [{ var: 'skid.baseMaterial' }, 'StructuralSteel'] }
        ]
      }
    ]
  });
});

// ---------------------------------------------------------------------------
// Suite 3: AST to Visual Tree Parser
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/6] AST to Visual Tree Parsing...');

runTest('3.1 Parse single comparison AST to visual tree', () => {
  const ast = { '>=': [{ var: 'skid.weight' }, 5000] };
  const tree = astToVisualTree(ast);
  assert.strictEqual(tree.type, 'group');
  assert.strictEqual(tree.logicalOperator, 'and');
  assert.strictEqual(tree.children.length, 1);
  assert.strictEqual(tree.children[0].type, 'condition');
  assert.strictEqual(tree.children[0].factKey, 'skid.weight');
  assert.strictEqual(tree.children[0].operator, '>=');
  assert.strictEqual(tree.children[0].value, 5000);
});

runTest('3.2 Parse reversed AST operand { >=: [5000, { var: "skid.weight" }] }', () => {
  const ast = { '<=': [5000, { var: 'skid.weight' }] };
  const tree = astToVisualTree(ast);
  assert.strictEqual(tree.children.length, 1);
  assert.strictEqual(tree.children[0].factKey, 'skid.weight');
});

runTest('3.3 Parse boolean true into is_true operator', () => {
  const ast = { '===': [{ var: 'unit.washdown' }, true] };
  const tree = astToVisualTree(ast);
  assert.strictEqual(tree.children[0].operator, 'is_true');
  assert.strictEqual(tree.children[0].value, true);
});

runTest('3.4 Parse boolean false into is_false operator', () => {
  const ast = { '===': [{ var: 'unit.knockdown' }, false] };
  const tree = astToVisualTree(ast);
  assert.strictEqual(tree.children[0].operator, 'is_false');
  assert.strictEqual(tree.children[0].value, false);
});

runTest('3.5 Parse null check into is_defined operator', () => {
  const ast = { '!==': [{ var: 'unit.tag' }, null] };
  const tree = astToVisualTree(ast);
  assert.strictEqual(tree.children[0].operator, 'is_defined');
});

runTest('3.6 Parse nested AST with both AND and OR groups', () => {
  const ast = {
    and: [
      { '===': [{ var: 'unit.unitType' }, 'Outdoor'] },
      {
        or: [
          { '===': [{ var: 'unit.shellType' }, 'ThermalBreak'] },
          { '===': [{ var: 'unit.shellType' }, 'Custom'] }
        ]
      }
    ]
  };
  const tree = astToVisualTree(ast);
  assert.strictEqual(tree.logicalOperator, 'and');
  assert.strictEqual(tree.children.length, 2);
  assert.strictEqual(tree.children[0].type, 'condition');
  assert.strictEqual(tree.children[1].type, 'group');
  assert.strictEqual(tree.children[1].logicalOperator, 'or');
  assert.strictEqual(tree.children[1].children.length, 2);
});

// ---------------------------------------------------------------------------
// Suite 4: Bidirectional Roundtrip Integrity
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/6] Bidirectional Roundtrip Integrity...');

runTest('4.1 Visual Tree -> AST -> Visual Tree -> AST Roundtrip (Complex Domain Rule)', () => {
  const originalAst = {
    and: [
      { '===': [{ var: 'unit.isSeismic' }, true] },
      { '>=': [{ var: 'unit.totalStaticPressure' }, 2.5] },
      {
        or: [
          { '>': [{ var: 'skid.weight' }, 4500] },
          { in: [{ var: 'unit.casingMaterial' }, ['StainlessSteel', 'MarineAluminum']] }
        ]
      }
    ]
  };

  const parsedTree = astToVisualTree(originalAst);
  const regeneratedAst = visualTreeToAst(parsedTree);
  assert.deepStrictEqual(regeneratedAst, originalAst);
});

// ---------------------------------------------------------------------------
// Suite 5: Required Fact Extraction
// ---------------------------------------------------------------------------
console.log('\n[Suite 5/6] Required Facts Extraction...');

runTest('5.1 Deduplicates and sorts facts across deeply nested groups', () => {
  const tree = {
    type: 'group',
    logicalOperator: 'and',
    children: [
      { type: 'condition', factKey: 'unit.isSeismic', operator: 'is_true', value: true },
      { type: 'condition', factKey: 'unit.totalStaticPressure', operator: '>=', value: 2.5 },
      {
        type: 'group',
        logicalOperator: 'or',
        children: [
          { type: 'condition', factKey: 'unit.isSeismic', operator: 'is_true', value: true }, // Duplicate
          { type: 'condition', factKey: 'skid.weight', operator: '>', value: 4000 },
          { type: 'condition', factKey: 'unit.casingMaterial', operator: '===', value: 'StainlessSteel' }
        ]
      }
    ]
  };

  const facts = extractRequiredFactsFromTree(tree);
  assert.deepStrictEqual(facts, ['skid.weight', 'unit.casingMaterial', 'unit.isSeismic', 'unit.totalStaticPressure']);
});

runTest('5.2 Extracts zero facts from empty condition group', () => {
  const tree = { type: 'group', logicalOperator: 'and', children: [] };
  const facts = extractRequiredFactsFromTree(tree);
  assert.deepStrictEqual(facts, []);
});

// ---------------------------------------------------------------------------
// Suite 6: Edge Cases & Boundary Handling
// ---------------------------------------------------------------------------
console.log('\n[Suite 6/6] Edge Cases & Error Resilience...');

runTest('6.1 visualTreeToAst returns undefined for empty children array', () => {
  assert.strictEqual(visualTreeToAst({ type: 'group', logicalOperator: 'and', children: [] }), undefined);
});

runTest('6.2 visualTreeToAst skips blank condition leaves without factKey', () => {
  const tree = {
    type: 'group',
    logicalOperator: 'and',
    children: [
      { type: 'condition', factKey: '', operator: '===', value: 'Test' },
      { type: 'condition', factKey: 'unit.jobName', operator: 'is_defined', value: null }
    ]
  };
  const ast = visualTreeToAst(tree);
  assert.deepStrictEqual(ast, { '!==': [{ var: 'unit.jobName' }, null] });
});

runTest('6.3 astToVisualTree returns empty group when passed undefined or empty object', () => {
  const treeUndef = astToVisualTree(undefined);
  assert.strictEqual(treeUndef.type, 'group');
  assert.strictEqual(treeUndef.children.length, 0);

  const treeEmpty = astToVisualTree({});
  assert.strictEqual(treeEmpty.type, 'group');
  assert.strictEqual(treeEmpty.children.length, 0);
});

runTest('6.4 generateNodeId produces unique IDs across iterations', () => {
  const id1 = generateNodeId();
  const id2 = generateNodeId();
  assert.notStrictEqual(id1, id2);
});

console.log('\n======================================================================');
console.log(` [SUCCESS] All ${passedTests} / ${totalTests} AST converter unit tests passed cleanly!`);
console.log('======================================================================\n');
