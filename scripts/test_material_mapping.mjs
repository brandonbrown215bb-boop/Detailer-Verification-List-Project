import assert from 'node:assert/strict';
import {
  normalizeMaterialTokens,
  classifyApprovedMaterial,
  approvedFloorDrainHoleDiameter
} from '../src/services/materialMapping.ts';

// 1. Normalization tests
assert.equal(normalizeMaterialTokens('  ALM / DIA  '), 'ALM DIA');
assert.equal(normalizeMaterialTokens('STL_GALV-PPC'), 'STL GALV PPC');
assert.equal(normalizeMaterialTokens(''), '');
assert.equal(normalizeMaterialTokens(null), '');

// 2. Aluminum classification & drain hole diameter (3.125")
const aluminumCases = [
  'ALM DIA',
  'ALM DIA 0.125',
  'ALM DIA 0.188',
  'ALM EMB',
  'ALM SHT',
  'AL TREAD',
  'ALUM DIAMOND PLATE',
  'ALUMINUM',
  'AL 16GA',
  'ALUMINUM PLATE PPC'
];
for (const val of aluminumCases) {
  assert.equal(classifyApprovedMaterial(val), 'aluminum', `Failed for ${val}`);
  assert.equal(approvedFloorDrainHoleDiameter(val), 3.125, `Failed drain hole dia for ${val}`);
}

// 3. Stainless classification & drain hole diameter (1.5")
const stainlessCases = [
  'SST304',
  'SST 304',
  'SST',
  'SS',
  'SS304',
  'STAINLESS STEEL',
  'STAINLESS 316',
  'SS 18GA'
];
for (const val of stainlessCases) {
  assert.equal(classifyApprovedMaterial(val), 'stainless', `Failed for ${val}`);
  assert.equal(approvedFloorDrainHoleDiameter(val), 1.5, `Failed drain hole dia for ${val}`);
}

// 4. Galvanized classification & drain hole diameter (1.5")
const galvanizedCases = [
  'STL GALV',
  'STL GALV PPC',
  'STL GALV 16GA',
  'GALVANIZED STEEL',
  'GALVANIZED'
];
for (const val of galvanizedCases) {
  assert.equal(classifyApprovedMaterial(val), 'galvanized', `Failed for ${val}`);
  assert.equal(approvedFloorDrainHoleDiameter(val), 1.5, `Failed drain hole dia for ${val}`);
}

// 5. Unknown materials
const unknownCases = [
  'WOOD',
  'PLASTIC',
  'COPPER',
  'ALM MYSTERY',
  '',
  null,
  undefined
];
for (const val of unknownCases) {
  assert.equal(classifyApprovedMaterial(val), 'unknown', `Failed for ${val}`);
  assert.equal(approvedFloorDrainHoleDiameter(val), undefined, `Failed drain hole dia for ${val}`);
}

// 6. formatGauge tests (preserving decimal plate thickness vs steel gauge)
import { formatGauge } from '../src/utils/formatters.ts';
assert.equal(formatGauge(16), '16 GA');
assert.equal(formatGauge('16'), '16 GA');
assert.equal(formatGauge(18), '18 GA');
assert.equal(formatGauge(22), '22 GA');
assert.equal(formatGauge(0.125), '0.125"');
assert.equal(formatGauge('0.125'), '0.125"');
assert.equal(formatGauge(0.188), '0.188"');
assert.equal(formatGauge('0.188'), '0.188"');
assert.equal(formatGauge(0.250), '0.25"');
assert.equal(formatGauge(0, 0.125), '0.125"');
assert.equal(formatGauge('', 0.125), '0.125"');
assert.equal(formatGauge(null, 0.125), '0.125"');
assert.equal(formatGauge(undefined, 16), '16 GA');
assert.equal(formatGauge(0, 16), '16 GA');

console.log('All materialMapping and formatGauge assertions passed successfully!');
