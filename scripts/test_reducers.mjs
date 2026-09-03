#!/usr/bin/env node

/**
 * State Reducers, Fact Transitions & Project Model Unit Test Suite
 * Tests pure state transitions, immutability, fact override history,
 * DVL integrity inspection, manual unit synthesis, and rule evaluation.
 */

import assert from 'assert';
import { createFact, overrideFact, revertFact } from '../src/services/factRegistry.ts';
import { createDvlProject, inspectDvlIntegrity } from '../src/services/projectStorage.ts';
import { createManualUnit, MANUAL_UNIT_PRESETS } from '../src/services/manualUnitFactory.ts';
import { evaluateAstPredicate, generateChecklists } from '../src/services/ruleEvaluator.ts';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from '../src/services/rulesCatalog.ts';

console.log('======================================================================');
console.log(' AHU Verification - State Reducers & Domain Logic Unit Tests');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error('Async tests must be awaited');
    }
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function main() {
  // ---------------------------------------------------------------------------
  // Suite 1: Fact Registry Reducers & History Tracking
  // ---------------------------------------------------------------------------
  console.log('[Suite 1/4] Fact Registry Reducers & Provenance History...');

  runTest('1.1 createFact initializes baseline state with empty history', () => {
    const fact = createFact('unit.weight', 'Unit Weight', 'Physical', 4500, 'Derived', 'Authoritative', '/root:AHU/weight');
    assert.strictEqual(fact.key, 'unit.weight');
    assert.strictEqual(fact.value, 4500);
    assert.strictEqual(fact.sourceRawValue, 4500);
    assert.strictEqual(fact.status, 'Derived');
    assert.strictEqual(fact.confidence, 'Authoritative');
    assert.deepStrictEqual(fact.overrideHistory, []);
  });

  runTest('1.2 overrideFact produces immutable updated registry with audit history', () => {
    const initialRegistry = {
      'unit.weight': createFact('unit.weight', 'Unit Weight', 'Physical', 4500, 'Derived', 'RequiresConfirmation')
    };

    const updatedRegistry = overrideFact(initialRegistry, 'unit.weight', 5200, 'Senior Detailer', 'Field scale verification');

    // Immutability: original is unchanged
    assert.strictEqual(initialRegistry['unit.weight'].value, 4500);
    assert.strictEqual(initialRegistry['unit.weight'].overrideHistory.length, 0);

    // Updated record has new value and history entry
    const updatedFact = updatedRegistry['unit.weight'];
    assert.strictEqual(updatedFact.value, 5200);
    assert.strictEqual(updatedFact.status, 'ManuallyOverridden');
    assert.strictEqual(updatedFact.confidence, 'Authoritative');
    assert.strictEqual(updatedFact.overrideHistory.length, 1);
    assert.strictEqual(updatedFact.overrideHistory[0].previousValue, 4500);
    assert.strictEqual(updatedFact.overrideHistory[0].overriddenBy, 'Senior Detailer');
    assert.strictEqual(updatedFact.overrideHistory[0].note, 'Field scale verification');
    assert.ok(typeof updatedFact.overrideHistory[0].timestamp === 'string');
  });

  runTest('1.3 Sequential overrides append chronological history records', () => {
    let registry = {
      'unit.comNumber': createFact('unit.comNumber', 'COM #', 'Order', null, 'Unknown', 'RequiresConfirmation')
    };

    registry = overrideFact(registry, 'unit.comNumber', 'COM-111111', 'Detailer A', 'Draft COM');
    registry = overrideFact(registry, 'unit.comNumber', 'COM-222222', 'Detailer B', 'Official ERP COM');

    const finalFact = registry['unit.comNumber'];
    assert.strictEqual(finalFact.value, 'COM-222222');
    assert.strictEqual(finalFact.overrideHistory.length, 2);
    assert.strictEqual(finalFact.overrideHistory[0].previousValue, null);
    assert.strictEqual(finalFact.overrideHistory[0].overriddenBy, 'Detailer A');
    assert.strictEqual(finalFact.overrideHistory[1].previousValue, 'COM-111111');
    assert.strictEqual(finalFact.overrideHistory[1].overriddenBy, 'Detailer B');
  });

  runTest('1.4 revertFact restores sourceRawValue and original status', () => {
    const initialRegistry = {
      'unit.weight': createFact('unit.weight', 'Unit Weight', 'Physical', 4500, 'Known', 'Authoritative', '/root:AHU/weight')
    };

    const overridden = overrideFact(initialRegistry, 'unit.weight', 9999, 'Detailer');
    assert.strictEqual(overridden['unit.weight'].value, 9999);

    const reverted = revertFact(overridden, 'unit.weight');
    assert.strictEqual(reverted['unit.weight'].value, 4500);
    assert.strictEqual(reverted['unit.weight'].status, 'Known');
  });

  runTest('1.5 overrideFact on non-existent key returns registry safely unchanged', () => {
    const initialRegistry = { 'unit.tag': createFact('unit.tag', 'Tag', 'Order', 'AHU-1', 'Known', 'Authoritative') };
    const res = overrideFact(initialRegistry, 'non.existent.key', 123);
    assert.strictEqual(res, initialRegistry);
  });

  // ---------------------------------------------------------------------------
  // Suite 2: Manual Unit Factory Reducer & Presets
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 2/4] Manual Unit Factory & Geometry Synthesis...');

  runTest('2.1 createManualUnit synthesizes valid segments, skids, and metrics', () => {
    const config = {
      jobName: 'Hospital Tower Phase 2',
      comNumber: 'COM-987654',
      detailerName: 'Lead Engineer',
      unitType: 'Outdoor',
      housingStyle: 'ThermalBreak',
      defaultUnitWidth: 96,
      defaultUnitHeight: 108,
      defaultBaseHeight: 12,
      skids: [
        { id: 'skid-1', index: 1, name: 'Skid 1', baseHeight: 12, baseMaterial: 'StructuralSteel' },
        { id: 'skid-2', index: 2, name: 'Skid 2', baseHeight: 12, baseMaterial: 'StructuralSteel' }
      ],
      segments: [
        { id: 'seg-1', typeCode: 'IP', name: 'Inlet Plenum', skidId: 'skid-1', length: 48, weight: 1500, airPressureType: 'Negative', airVolume: 20000, internals: [] },
        { id: 'seg-2', typeCode: 'FS', name: 'Supply Fan', skidId: 'skid-2', length: 72, weight: 3500, airPressureType: 'Positive', airVolume: 20000, internals: ['Fan Array'] }
      ]
    };

    const result = createManualUnit(config);
    assert.strictEqual(result.graph.segments.length, 2);
    assert.strictEqual(result.graph.skids.length, 2);
    assert.strictEqual(result.graph.bases.length, 2);
    assert.strictEqual(result.graph.unitWeight, 5000); // 1500 + 3500
    assert.strictEqual(result.graph.dimensions.length, 120); // 48 + 72
    assert.strictEqual(result.graph.dimensions.width, 96);
    assert.strictEqual(result.graph.dimensions.height, 120); // 108 + 12 base
  });

  runTest('2.2 createManualUnit builds full project with facts, checklists, and XML', () => {
    const config = {
      jobName: 'Cleanroom AHU',
      comNumber: 'COM-100200',
      detailerName: 'Detailer Alpha',
      unitType: 'Outdoor',
      housingStyle: 'ThermalBreak',
      skids: [{ id: 'skid-1', index: 1, name: 'Skid 1' }],
      segments: [{ id: 'seg-1', typeCode: 'IP', name: 'Inlet', skidId: 'skid-1', length: 48, weight: 2000, airPressureType: 'Negative', airVolume: 15000, internals: [] }]
    };

    const project = createManualUnit(config);
    assert.ok(project.graph);
    assert.ok(project.facts);
    assert.ok(Array.isArray(project.checklists));
    assert.ok(project.rawXml.includes('<AHU>'));
    assert.ok(project.rawXml.includes('Cleanroom AHU'));
    assert.strictEqual(project.facts['unit.jobName']?.value, 'Cleanroom AHU');
  });

  runTest('2.3 All standard manual unit presets generate valid projects', () => {
    for (const preset of MANUAL_UNIT_PRESETS) {
      const config = {
        jobName: preset.name,
        comNumber: 'COM-PRESET',
        detailerName: 'Preset Validator',
        unitType: 'Outdoor',
        housingStyle: 'ThermalBreak',
        skids: preset.skids,
        segments: preset.segments.map((s, idx) => ({ ...s, id: `seg-${idx + 1}` }))
      };
      const project = createManualUnit(config);
      assert.strictEqual(project.graph.skids.length, preset.skidCount, `Preset ${preset.name} skid count match`);
      const expectedSegments = preset.segments.length > 0 ? preset.segments.length : 1;
      assert.strictEqual(project.graph.segments.length, expectedSegments, `Preset ${preset.name} segment count match`);
      assert.ok(project.checklists.length > 0, `Preset ${preset.name} generated checklists`);
    }
  });

  // ---------------------------------------------------------------------------
  // Suite 3: AST Evaluation & Rule Engine Reducer
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 3/4] AST Rule Evaluation & Checklist Synthesis...');

  runTest('3.1 evaluateAstPredicate with null predicate returns always applicable', () => {
    const res = evaluateAstPredicate(undefined, {}, [], {});
    assert.strictEqual(res.result, true);
    assert.strictEqual(res.needsInput, false);
  });

  runTest('3.2 evaluateAstPredicate blocks when required fact is unknown', () => {
    const predicate = { '>=': [{ var: 'unit.totalStaticPressure' }, 3.0] };
    const facts = {
      'unit.totalStaticPressure': createFact('unit.totalStaticPressure', 'Static Pressure', 'Physical', null, 'Unknown', 'RequiresConfirmation')
    };
    const res = evaluateAstPredicate(predicate, { 'unit.totalStaticPressure': null }, ['unit.totalStaticPressure'], facts);
    assert.strictEqual(res.result, false);
    assert.strictEqual(res.needsInput, true);
  });

  runTest('3.3 evaluateAstPredicate evaluates comparison correctly when facts are known', () => {
    const predicate = { '>=': [{ var: 'unit.totalStaticPressure' }, 3.0] };
    const facts = {
      'unit.totalStaticPressure': createFact('unit.totalStaticPressure', 'Static Pressure', 'Physical', 3.5, 'Known', 'Authoritative')
    };
    const resPass = evaluateAstPredicate(predicate, { 'unit.totalStaticPressure': 3.5 }, ['unit.totalStaticPressure'], facts);
    assert.strictEqual(resPass.result, true);
    assert.strictEqual(resPass.needsInput, false);

    const resFail = evaluateAstPredicate(predicate, { 'unit.totalStaticPressure': 2.0 }, ['unit.totalStaticPressure'], facts);
    assert.strictEqual(resFail.result, false);
    assert.strictEqual(resFail.needsInput, false);
  });

  runTest('3.4 generateChecklists correctly partitions unit and skid level checklists', () => {
    const config = {
      jobName: 'Test Unit',
      comNumber: 'COM-001',
      detailerName: 'QA',
      unitType: 'Outdoor',
      housingStyle: 'ThermalBreak',
      skids: [
        { id: 'skid-1', index: 1, name: 'Skid 1' },
        { id: 'skid-2', index: 2, name: 'Skid 2' }
      ],
      segments: [
        { id: 'seg-1', typeCode: 'IP', name: 'Inlet', skidId: 'skid-1', length: 48, weight: 2000, airPressureType: 'Negative', airVolume: 15000, internals: [] },
        { id: 'seg-2', typeCode: 'FS', name: 'Fan', skidId: 'skid-2', length: 72, weight: 3000, airPressureType: 'Positive', airVolume: 15000, internals: [] }
      ]
    };

    const manual = createManualUnit(config);
    const facts = {
      'unit.isSeismic': createFact('unit.isSeismic', 'Seismic', 'Unit', false, 'Derived', 'Authoritative'),
      'unit.thermalBreak': createFact('unit.thermalBreak', 'Thermal Break', 'Unit', true, 'Derived', 'Authoritative'),
      'skid.skid-1.weight': createFact('skid.skid-1.weight', 'Weight 1', 'Skid', 2000, 'Derived', 'Authoritative'),
      'skid.skid-2.weight': createFact('skid.skid-2.weight', 'Weight 2', 'Skid', 3000, 'Derived', 'Authoritative')
    };

    const checklists = generateChecklists(RULES_CATALOG, manual.graph, facts);
    assert.ok(checklists.length > 0);
    const unitChecks = checklists.filter(c => c.scopeTargetId === 'unit');
    const skidChecks = checklists.filter(c => c.scopeTargetId !== 'unit');
    assert.ok(unitChecks.length > 0, 'Contains unit-scoped checks');
    assert.ok(skidChecks.length > 0, 'Contains skid-scoped checks');
  });

  // ---------------------------------------------------------------------------
  // Suite 4: DVL Project Model & Cryptographic Integrity Reducer
  // ---------------------------------------------------------------------------
  console.log('\n[Suite 4/4] DVL Project Model & SHA-256 Integrity Verification...');

  await runAsyncTest('4.1 createDvlProject hashes source XML and pins active RulePack SHA-256', async () => {
    const rawXml = '<AHU><unitWeight>4000</unitWeight></AHU>';
    const graph = {
      unitMOMID: '{00000000-0000-0000-0000-000000000000}',
      jobName: 'Test Job',
      unitWeight: 4000,
      totalStaticPressure: 2.5,
      dimensions: { length: 120, width: 84, height: 96 },
      skids: [],
      bases: [],
      segments: [],
      motorControls: [],
      documentVersion: '2018.9.14.1003'
    };
    const facts = {
      'unit.jobName': createFact('unit.jobName', 'Job Name', 'Order', 'Test Job', 'Known', 'Authoritative'),
      'unit.comNumber': createFact('unit.comNumber', 'COM #', 'Order', 'COM-777', 'Known', 'Authoritative'),
      'unit.detailer': createFact('unit.detailer', 'Detailer', 'Order', 'John Doe', 'Known', 'Authoritative')
    };

    const project = await createDvlProject(graph, facts, [], [], rawXml, 'Test comments');
    assert.strictEqual(project.formatVersion, '1.0');
    assert.strictEqual(project.jobName, 'Test Job');
    assert.strictEqual(project.comNumber, 'COM-777');
    assert.strictEqual(project.author, 'John Doe');
    assert.strictEqual(project.rulePack.version, RULE_PACK_IDENTITY.version);
    assert.strictEqual(project.rulePack.sha256, RULE_PACK_IDENTITY.sha256);
    assert.strictEqual(typeof project.sourceXml.fileSha256, 'string');
    assert.strictEqual(project.sourceXml.fileSha256.length, 64);

    // Test inspectDvlIntegrity returns verified
    const integrity = await inspectDvlIntegrity(project);
    assert.strictEqual(integrity.status, 'verified');
  });

  await runAsyncTest('4.2 inspectDvlIntegrity detects tampered XML contents', async () => {
    const rawXml = '<AHU><unitWeight>4000</unitWeight></AHU>';
    const graph = { unitMOMID: '{0000}', jobName: 'Test', unitWeight: 4000, totalStaticPressure: 2.5, dimensions: { length: 100, width: 80, height: 80 }, skids: [], bases: [], segments: [], motorControls: [] };
    const facts = {};

    const project = await createDvlProject(graph, facts, [], [], rawXml);
    // Tamper with rawXml without updating fileSha256
    project.sourceXml.rawXml = '<AHU><unitWeight>999999</unitWeight></AHU>';

    const integrity = await inspectDvlIntegrity(project);
    assert.strictEqual(integrity.status, 'unverified');
    assert.ok(integrity.message?.includes('embedded Config.xml hash does not match'));
  });

  await runAsyncTest('4.3 inspectDvlIntegrity detects stale or mismatched RulePack hash', async () => {
    const rawXml = '<AHU><unitWeight>4000</unitWeight></AHU>';
    const graph = { unitMOMID: '{0000}', jobName: 'Test', unitWeight: 4000, totalStaticPressure: 2.5, dimensions: { length: 100, width: 80, height: 80 }, skids: [], bases: [], segments: [], motorControls: [] };
    const facts = {};

    const project = await createDvlProject(graph, facts, [], [], rawXml);
    // Tamper with rulePack sha
    project.rulePack.sha256 = '0000000000000000000000000000000000000000000000000000000000000000';

    const integrity = await inspectDvlIntegrity(project);
    assert.strictEqual(integrity.status, 'unverified');
    assert.ok(integrity.message?.includes('not the active'));
  });

  console.log('\n======================================================================');
  console.log(` [SUCCESS] All ${passedTests} / ${totalTests} state reducer & domain logic unit tests passed!`);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
