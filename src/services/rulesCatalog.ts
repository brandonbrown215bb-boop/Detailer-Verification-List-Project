import { RuleDefinition } from '../types';

export const RULES_CATALOG: RuleDefinition[] = [
  // --- BASE VERIFICATIONS ---
  {
    id: 'BASE-01',
    semanticKey: 'BASE_LIFTING_LUG_SUPPORT',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Features',
    order: 1,
    text: 'Lifting lugs have proper support when the skid is over 4,000 lbs (Ref ASSY Manual page 391-40206-003)',
    reference: 'ASSY Manual p.391-40206-003',
    excelRow: 29,
    requiredFacts: ['skid.weight'],
    predicate: {
      '>': [{ var: 'skid.weight' }, 4000]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'BASE-02',
    semanticKey: 'BASE_LIFTING_LUG_CLEARANCE',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Features',
    order: 2,
    text: 'Lifting lugs are free of obstruction/interference around drains, coil connections, VFDs, etc. (Standard 6" minimum).',
    reference: 'Standard Assembly Spec Sec 4.2',
    excelRow: 30,
    requiredFacts: [],
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'BASE-03',
    semanticKey: 'BASE_FLOOR_DRAINS_PRESENT',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Features',
    order: 3,
    text: 'Floor drains are present and located as shown on the Unit Editor.',
    reference: 'Unit Editor Layout Plan',
    excelRow: 31,
    requiredFacts: [],
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'BASE-04',
    semanticKey: 'BASE_FLOOR_DRAIN_HOLE_SIZE',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Features',
    order: 4,
    text: 'Floor drain hole sizes are correct: 3.125" dia for AL Drains; 1.50" dia for Steel Drains.',
    reference: 'Base Fab Drawing 391-10001-002',
    excelRow: 32,
    requiredFacts: ['unit.floorMaterial'],
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'BASE-05',
    semanticKey: 'BASE_DRAIN_PAN_HANDING',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Features',
    order: 5,
    text: 'Drain Pan Drains are located on the correct hand per the Unit Editor.',
    reference: 'Engineering Submittal Sheet',
    excelRow: 33,
    requiredFacts: ['skid.hasDrainPan'],
    predicate: {
      '===': [{ var: 'skid.hasDrainPan' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'BASE-06',
    semanticKey: 'BASE_FILLER_PLATE_MATERIAL',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Features',
    order: 6,
    text: 'Filler plate material is correct on aluminum base units.',
    reference: 'Base Fab Std 12.1',
    excelRow: 34,
    requiredFacts: ['unit.floorMaterial'],
    predicate: {
      'includes': [{ var: 'unit.floorMaterial' }, 'AL']
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'BASE-07',
    semanticKey: 'BASE_SPLITS_LOCATIONS',
    scope: 'Skid',
    category: 'Base',
    subgroup: 'Base Structural',
    order: 7,
    text: 'Construction splits and unit splits are located where necessary and aligned with shipping boundaries.',
    reference: 'General Arrangement Drawing',
    excelRow: 35,
    requiredFacts: ['unit.knockdown'],
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },

  // --- HOUSING & CASING ---
  {
    id: 'HOUS-01',
    semanticKey: 'HOUSING_THERMAL_BREAK_SETTING',
    scope: 'Unit',
    category: 'Housing',
    subgroup: 'Casing Construction',
    order: 1,
    text: 'Panels for thermal break units have Thermal Break parameter set to Yes in CAD models.',
    reference: 'Housing Design Standard H-201',
    excelRow: 204,
    requiredFacts: ['unit.thermalBreak'],
    predicate: {
      '===': [{ var: 'unit.thermalBreak' }, 'Yes']
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'HOUS-02',
    semanticKey: 'HOUSING_WALL_GAUGES_MATCH',
    scope: 'Unit',
    category: 'Housing',
    subgroup: 'Casing Construction',
    order: 2,
    text: 'Skin and liner gauges match specification: 18ga exterior / 22ga interior standard.',
    reference: 'Engineering Schedule Spec',
    excelRow: 159,
    requiredFacts: ['unit.skinGauge', 'unit.linerGauge'],
    allowNA: false,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'HOUS-03',
    semanticKey: 'HOUSING_FILTER_DOOR_CLEARANCE',
    scope: 'Skid',
    category: 'Housing',
    subgroup: 'Access & Openings',
    order: 3,
    text: 'Slide-in (side-load) filters have sufficient door and corridor opening clearance for pull-out.',
    reference: 'Service Clearance Guidelines p.14',
    excelRow: 181,
    requiredFacts: ['skid.hasFilters'],
    predicate: {
      '===': [{ var: 'skid.hasFilters' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },

  // --- DRAIN PAN ---
  {
    id: 'DPAN-01',
    semanticKey: 'DPAN_BASE_OPENING_FIT',
    scope: 'Skid',
    category: 'Drain Pan',
    subgroup: 'Pan Dimensions',
    order: 1,
    text: 'Drain pan fits in length of base opening and matches opening dimensions in UE.',
    reference: 'Drain Pan Layout MM# 391-10006-021',
    excelRow: 214,
    requiredFacts: ['skid.hasDrainPan'],
    predicate: {
      '===': [{ var: 'skid.hasDrainPan' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'DPAN-02',
    semanticKey: 'DPAN_SUPPORTS_RISERS_QTY',
    scope: 'Skid',
    category: 'Drain Pan',
    subgroup: 'Supports & Risers',
    order: 2,
    text: 'Drain pan has correct qty and location of supports and risers for SQ\'ed drain pans.',
    reference: 'Engineering Coil Pan Standard',
    excelRow: 215,
    requiredFacts: ['skid.hasDrainPan'],
    predicate: {
      '===': [{ var: 'skid.hasDrainPan' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'DPAN-03',
    semanticKey: 'DPAN_SLOPE_VERIFICATION',
    scope: 'Skid',
    category: 'Drain Pan',
    subgroup: 'Slope & Drainage',
    order: 3,
    text: 'All sections of 3-piece drain pan slope properly toward the drain connection.',
    reference: 'ASHRAE 62.1 Drainage Standard',
    excelRow: 220,
    requiredFacts: ['skid.hasDrainPan'],
    predicate: {
      '===': [{ var: 'skid.hasDrainPan' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'DPAN-04',
    semanticKey: 'DPAN_MASTER_MODEL_VERIFICATION',
    scope: 'Skid',
    category: 'Drain Pan',
    subgroup: 'Master Model',
    order: 4,
    text: 'Drain pan is using Master Model # 391-10006-021.',
    reference: 'Master Model Index',
    excelRow: 223,
    requiredFacts: ['skid.hasDrainPan'],
    predicate: {
      '===': [{ var: 'skid.hasDrainPan' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },

  // --- FANS & ELECTRICAL ---
  {
    id: 'FAN-01',
    semanticKey: 'FAN_EBM_SEISMIC_MM',
    scope: 'Skid',
    category: 'Fans',
    subgroup: 'Fan Walls',
    order: 1,
    text: 'If unit is Seismic with an EBM fan (or EBM fan larger than 630), MM#: 391-10004-012 is used.',
    reference: 'Fan Selection Std 391-10004-012',
    excelRow: 171,
    requiredFacts: ['skid.hasFans', 'unit.isSeismic'],
    predicate: {
      'and': [
        { '===': [{ var: 'skid.hasFans' }, true] },
        { '===': [{ var: 'unit.isSeismic' }, true] }
      ]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'FAN-02',
    semanticKey: 'FAN_EBM_STANDARD_MM',
    scope: 'Skid',
    category: 'Fans',
    subgroup: 'Fan Walls',
    order: 2,
    text: 'If you have an EBM fan smaller than 560 and unit is not Seismic, MM#: 391-10004-013 is used.',
    reference: 'Fan Selection Std 391-10004-013',
    excelRow: 172,
    requiredFacts: ['skid.hasFans', 'unit.isSeismic'],
    predicate: {
      'and': [
        { '===': [{ var: 'skid.hasFans' }, true] },
        { '!==': [{ var: 'unit.isSeismic' }, true] }
      ]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'FAN-03',
    semanticKey: 'FAN_WALL_GENERATION_PARAM',
    scope: 'Skid',
    category: 'Fans',
    subgroup: 'Fan Parameters',
    order: 3,
    text: 'EBM Fan Wall has the correct fan generation selected in the parameters.',
    reference: 'MOM Fan Selection Guide',
    excelRow: 173,
    requiredFacts: ['skid.hasFans'],
    predicate: {
      '===': [{ var: 'skid.hasFans' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },

  // --- COILS & INTERNALS ---
  {
    id: 'COIL-01',
    semanticKey: 'COIL_PANEL_MASTER_MODEL',
    scope: 'Skid',
    category: 'Internals',
    subgroup: 'Coil Panels',
    order: 1,
    text: 'Coil Panels use Master Model # 391-100006-026.',
    reference: 'Master Model Catalog',
    excelRow: 198,
    requiredFacts: ['skid.hasCoils'],
    predicate: {
      '===': [{ var: 'skid.hasCoils' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'COIL-02',
    semanticKey: 'COIL_BULKHEAD_MATERIAL_MATCH',
    scope: 'Skid',
    category: 'Internals',
    subgroup: 'Bulkheads',
    order: 2,
    text: 'Bulkhead materials match the Unit Editor / Spec Sheet (e.g. Stainless Steel SST304 for cooling coils).',
    reference: 'Component Spec Sheet',
    excelRow: 178,
    requiredFacts: ['skid.hasCoils'],
    predicate: {
      '===': [{ var: 'skid.hasCoils' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'COIL-03',
    semanticKey: 'COIL_AIRFLOW_DIRECTION',
    scope: 'Skid',
    category: 'Internals',
    subgroup: 'Coil Panels',
    order: 3,
    text: 'Coil Panels have the correct airflow direction and pipe connection hand.',
    reference: 'Submittal Piping Schedule',
    excelRow: 201,
    requiredFacts: ['skid.hasCoils'],
    predicate: {
      '===': [{ var: 'skid.hasCoils' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },

  // --- RECONNECTS ---
  {
    id: 'RECON-01',
    semanticKey: 'RECONNECT_SEISMIC_MM',
    scope: 'Unit',
    category: 'Reconnects',
    subgroup: 'Shipping Splits',
    order: 1,
    text: 'Reconnect MM#: 391-10002-004 is used when unit is Seismic.',
    reference: 'Seismic Structural Standard S-104',
    excelRow: 208,
    requiredFacts: ['unit.isSeismic'],
    predicate: {
      '===': [{ var: 'unit.isSeismic' }, true]
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'RECON-02',
    semanticKey: 'RECONNECT_LINER_MATERIAL_MATCH',
    scope: 'Unit',
    category: 'Reconnects',
    subgroup: 'Shipping Splits',
    order: 2,
    text: 'All Reconnects match the liner material of the segment they are in. Aluminum liner sections must have Stainless Reconnects.',
    reference: 'Materials Specification Sec 2',
    excelRow: 210,
    requiredFacts: ['unit.linerMaterial'],
    allowNA: false,
    verificationMode: 'ManualCheckbox'
  },

  // --- UPTURNED LIP (UTL) ---
  {
    id: 'UTL-01',
    semanticKey: 'UTL_NOTCH_SPLIT_CLEARANCE',
    scope: 'Unit',
    category: 'UTL',
    subgroup: 'Base Lips',
    order: 1,
    text: 'Perimeter angles with upturned lips are notched at unit splits for reconnects (1.56" notch for Baseline; 2.06" notch for Seismic).',
    reference: 'UTL Detail Standard 391-30002',
    excelRow: 186,
    requiredFacts: ['unit.utl', 'unit.isSeismic'],
    predicate: {
      'includes': [{ var: 'unit.utl' }, 'Yes']
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'UTL-02',
    semanticKey: 'UTL_INTERNAL_BLANKOFF_NOTCH',
    scope: 'Unit',
    category: 'UTL',
    subgroup: 'Internal Blankoffs',
    order: 2,
    text: 'All internals have a notch cut out of the bottom of the left and right blankoffs for the upturned lip.',
    reference: 'UTL Internal Clearance Standard',
    excelRow: 188,
    requiredFacts: ['unit.utl'],
    predicate: {
      'includes': [{ var: 'unit.utl' }, 'Yes']
    },
    allowNA: true,
    verificationMode: 'ManualCheckbox'
  },

  // --- MOM & ISG ---
  {
    id: 'MOM-01',
    semanticKey: 'MOM_DOCUMENT_UPLOADED',
    scope: 'Unit',
    category: 'MOM',
    subgroup: 'Documentation',
    order: 1,
    text: 'The detailer information document is uploaded to the CAD/MAPICS document section.',
    reference: 'Detailing Release Checklist',
    excelRow: 164,
    requiredFacts: [],
    allowNA: false,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'MOM-02',
    semanticKey: 'MOM_MAPICS_BOM_CLEAN',
    scope: 'Unit',
    category: 'MOM',
    subgroup: 'BOM Validation',
    order: 2,
    text: 'The MAPICS BOM is uploaded, verified clean, and matches the release packet.',
    reference: 'MAPICS Process Guide',
    excelRow: 165,
    requiredFacts: [],
    allowNA: false,
    verificationMode: 'ManualCheckbox'
  },
  {
    id: 'ISG-01',
    semanticKey: 'ISG_PART_SELECT_RUN',
    scope: 'Unit',
    category: 'ISG',
    subgroup: 'Surface & Part Generation',
    order: 1,
    text: 'Post ISG part select has been ran, unnecessary parts removed, and all parts are built in MAPICS.',
    reference: 'ISG Automation Guide',
    excelRow: 168,
    requiredFacts: [],
    allowNA: false,
    verificationMode: 'ManualCheckbox'
  }
];
