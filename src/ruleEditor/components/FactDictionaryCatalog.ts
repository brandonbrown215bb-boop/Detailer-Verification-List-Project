import { FactFieldDefinition } from '../types';

export const FACT_DICTIONARY: FactFieldDefinition[] = [
  // ==========================================
  // UNIT SCOPE FACTS
  // ==========================================
  {
    key: 'unit.shellType',
    label: 'Shell Type',
    scope: 'Unit',
    category: 'Geometry & Casing',
    dataType: 'enum',
    enumOptions: [
      { value: 'ISG', label: 'ISG' },
      { value: 'CAD', label: 'CAD' }
    ],
    sampleValue: 'ISG',
    description: 'Unit casing shell system design standard (ISG vs CAD).'
  },
  {
    key: 'roof.roofPeak',
    label: 'Roof Peak Orientation',
    scope: 'Unit',
    category: 'Geometry & Casing',
    dataType: 'enum',
    enumOptions: [
      { value: 'Internal (Center)', label: 'Internal (Center)' },
      { value: 'Left', label: 'Left' },
      { value: 'Right', label: 'Right' }
    ],
    sampleValue: 'Internal (Center)',
    description: 'Roof slope apex peak style for outdoor units.'
  },
  {
    key: 'unit.unitType',
    label: 'Unit Installation Type',
    scope: 'Unit',
    category: 'Geometry & Casing',
    dataType: 'enum',
    enumOptions: [
      { value: 'Outdoor', label: 'Outdoor (Roof/Pad Mounted)' },
      { value: 'Indoor', label: 'Indoor (Mechanical Room)' }
    ],
    sampleValue: 'Outdoor',
    description: 'Whether the unit is designed for outdoor or indoor installation.'
  },
  {
    key: 'unit.wallThickness',
    label: 'Wall Thickness',
    scope: 'Unit',
    category: 'Geometry & Casing',
    dataType: 'number',
    unit: 'inches',
    sampleValue: 2,
    description: 'Casing panel nominal wall thickness (typically 2, 3, or 4 inches).'
  },
  {
    key: 'unit.baseHeight',
    label: 'Base Channel Height',
    scope: 'Unit',
    category: 'Geometry & Casing',
    dataType: 'number',
    unit: 'inches',
    sampleValue: 10,
    description: 'Structural base channel height (e.g. 6", 8", 10", 12").'
  },
  {
    key: 'unit.thermalBreak',
    label: 'Thermal Break Construction',
    scope: 'Unit',
    category: 'Geometry & Casing',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Whether unit utilizes thermal-break framing profiles.'
  },
  {
    key: 'unit.knockdown',
    label: 'Knockdown Construction (KD)',
    scope: 'Unit',
    category: 'Construction Options',
    dataType: 'boolean',
    sampleValue: false,
    description: 'Flag indicating whether unit ships disassembled for field assembly.'
  },
  {
    key: 'unit.washdown',
    label: 'Washdown Construction',
    scope: 'Unit',
    category: 'Construction Options',
    dataType: 'boolean',
    sampleValue: false,
    description: 'Hygienic washdown construction with continuous welds and sloped floors.'
  },
  {
    key: 'unit.hasUTL',
    label: 'Upturned Lip (UTL)',
    scope: 'Unit',
    category: 'Construction Options',
    dataType: 'boolean',
    sampleValue: false,
    description: 'Whether the unit contains base perimeter upturned lips (UTL height > 0).'
  },
  {
    key: 'unit.isSeismic',
    label: 'Seismic Certification Requirement',
    scope: 'Unit',
    category: 'Ratings & Compliance',
    dataType: 'boolean',
    sampleValue: false,
    description: 'Whether unit requires IBC / OSHPD structural seismic anchoring calculations.'
  },
  {
    key: 'unit.unitConstructionType',
    label: 'Construction Specification Code',
    scope: 'Unit',
    category: 'Ratings & Compliance',
    dataType: 'enum',
    enumOptions: [
      { value: 'Standard', label: 'Standard Commercial' },
      { value: 'IBC', label: 'IBC (Seismic Compliant)' },
      { value: 'OSHPD', label: 'OSHPD (California Healthcare)' },
      { value: 'NOA', label: 'Miami-Dade NOA Wind Load' }
    ],
    sampleValue: 'Standard',
    description: 'Governing structural specification.'
  },
  {
    key: 'unit.noa',
    label: 'Miami-Dade NOA Wind Certification',
    scope: 'Unit',
    category: 'Ratings & Compliance',
    dataType: 'boolean',
    sampleValue: false,
    description: 'Notice of Acceptance hurricane rating.'
  },
  {
    key: 'unit.totalStaticPressure',
    label: 'Total Static Pressure (TSP)',
    scope: 'Unit',
    category: 'Airflow & Pressure',
    dataType: 'number',
    unit: 'in. w.g.',
    sampleValue: 2.5,
    description: 'Total design static pressure across unit.'
  },
  {
    key: 'unit.floorMaterial',
    label: 'Floor Material Type',
    scope: 'Unit',
    category: 'Materials & Finishes',
    dataType: 'enum',
    enumOptions: [
      { value: 'Galvanized', label: 'Galvanized Steel' },
      { value: 'Aluminum', label: 'Aluminum' },
      { value: 'Aluminum Diamond Plate', label: 'Aluminum Diamond Plate (Tread)' },
      { value: 'Stainless 304', label: 'Stainless Steel 304' },
      { value: 'Stainless 316', label: 'Stainless Steel 316' }
    ],
    sampleValue: 'Galvanized',
    description: 'Floor skin sheet material.'
  },
  {
    key: 'unit.floorMaterialGauge',
    label: 'Floor Material Gauge',
    scope: 'Unit',
    category: 'Materials & Finishes',
    dataType: 'number',
    unit: 'ga',
    sampleValue: 14,
    description: 'Floor metal thickness gauge.'
  },
  {
    key: 'unit.exteriorMaterial',
    label: 'Exterior Casing Material',
    scope: 'Unit',
    category: 'Materials & Finishes',
    dataType: 'enum',
    enumOptions: [
      { value: 'Galvanized', label: 'Galvanized Steel' },
      { value: 'Pre-Painted', label: 'Pre-Painted Steel' },
      { value: 'Aluminum', label: 'Aluminum' },
      { value: 'Stainless 304', label: 'Stainless Steel 304' },
      { value: 'Stainless 316', label: 'Stainless Steel 316' }
    ],
    sampleValue: 'Galvanized',
    description: 'Outer skin metal type.'
  },
  {
    key: 'unit.interiorMaterial',
    label: 'Interior Liner Material',
    scope: 'Unit',
    category: 'Materials & Finishes',
    dataType: 'enum',
    enumOptions: [
      { value: 'Galvanized', label: 'Galvanized Steel' },
      { value: 'Aluminum', label: 'Aluminum' },
      { value: 'Perforated Galvanized', label: 'Perforated Galvanized' },
      { value: 'Perforated Aluminum', label: 'Perforated Aluminum' },
      { value: 'Stainless 304', label: 'Stainless Steel 304' },
      { value: 'Stainless 316', label: 'Stainless Steel 316' }
    ],
    sampleValue: 'Galvanized',
    description: 'Inner liner sheet material.'
  },
  {
    key: 'unit.insulationType',
    label: 'Insulation Type',
    scope: 'Unit',
    category: 'Materials & Finishes',
    dataType: 'enum',
    enumOptions: [
      { value: 'Injected Foam (R-13)', label: 'Injected Polyurethane Foam (R-13)' },
      { value: 'Injected Foam (R-20)', label: 'Injected Polyurethane Foam (R-20)' },
      { value: 'Fiberglass', label: 'Fiberglass' },
      { value: 'Mineral Wool', label: 'Mineral Wool' }
    ],
    sampleValue: 'Injected Foam (R-13)',
    description: 'Panel insulation core material.'
  },
  {
    key: 'unit.slopedRoof',
    label: 'Sloped Roof Option',
    scope: 'Unit',
    category: 'Roof & Curb',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Whether unit roof is sloped for water drainage.'
  },
  {
    key: 'unit.roofSlope',
    label: 'Roof Slope Pitch',
    scope: 'Unit',
    category: 'Roof & Curb',
    dataType: 'number',
    unit: 'in/ft',
    sampleValue: 0.25,
    description: 'Pitch slope in inches per foot.'
  },
  {
    key: 'unit.curbrest',
    label: 'Roof Curb Rest Provided',
    scope: 'Unit',
    category: 'Roof & Curb',
    dataType: 'enum',
    enumOptions: [
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' }
    ],
    sampleValue: 'Yes',
    description: 'Whether unit base rests on a roof curb.'
  },
  {
    key: 'unit.brandOption',
    label: 'Brand / Family Series',
    scope: 'Unit',
    category: 'Order & Identity',
    dataType: 'enum',
    enumOptions: [
      { value: 'York Custom AHU', label: 'York Custom AHU' },
      { value: 'Solution XT', label: 'Solution XT' },
      { value: 'AirMatrix', label: 'AirMatrix' }
    ],
    sampleValue: 'York Custom AHU',
    description: 'Manufacturing product brand family.'
  },
  {
    key: 'unit.productType',
    label: 'Product Type Code',
    scope: 'Unit',
    category: 'Order & Identity',
    dataType: 'string',
    sampleValue: 'YORK-CUSTOM',
    description: 'Product line code from OrderRevision.xml.'
  },

  // ==========================================
  // SKID SCOPE FACTS
  // ==========================================
  {
    key: 'skid.weight',
    label: 'Skid Shipping Weight',
    scope: 'Skid',
    category: 'Skid Logistics',
    dataType: 'number',
    unit: 'lbs',
    sampleValue: 4500,
    description: 'Total weight of shipping section (determines lifting lugs & transport requirements).'
  },
  {
    key: 'skid.segmentCount',
    label: 'Segments on Skid',
    scope: 'Skid',
    category: 'Skid Logistics',
    dataType: 'number',
    sampleValue: 3,
    description: 'Number of air handling segments assembled onto this base skid.'
  },
  {
    key: 'skid.length',
    label: 'Skid Length',
    scope: 'Skid',
    category: 'Skid Dimensions',
    dataType: 'number',
    unit: 'inches',
    sampleValue: 180,
    description: 'Total length of skid base steel.'
  },
  {
    key: 'skid.width',
    label: 'Skid Width',
    scope: 'Skid',
    category: 'Skid Dimensions',
    dataType: 'number',
    unit: 'inches',
    sampleValue: 96,
    description: 'Total width across skid base.'
  },
  {
    key: 'skid.height',
    label: 'Skid Height',
    scope: 'Skid',
    category: 'Skid Dimensions',
    dataType: 'number',
    unit: 'inches',
    sampleValue: 108,
    description: 'Overall height from bottom of base channel to top of casing/roof.'
  },
  {
    key: 'skid.hasDrainPan',
    label: 'Skid Contains Drain Pan',
    scope: 'Skid',
    category: 'Skid Features',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Indicates whether a drain pan exists on this skid.'
  },
  {
    key: 'skid.hasFans',
    label: 'Skid Contains Fan Section',
    scope: 'Skid',
    category: 'Skid Features',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Indicates whether supply, return, or exhaust fans are located on this skid.'
  },
  {
    key: 'skid.hasCoils',
    label: 'Skid Contains Coils',
    scope: 'Skid',
    category: 'Skid Features',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Indicates whether heating or cooling coils exist on this skid.'
  },
  {
    key: 'skid.hasFilters',
    label: 'Skid Contains Filter Section',
    scope: 'Skid',
    category: 'Skid Features',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Indicates whether filter racks/banks exist on this skid.'
  },
  {
    key: 'skid.hasHeatWheel',
    label: 'Skid Contains Heat Recovery Wheel',
    scope: 'Skid',
    category: 'Skid Features',
    dataType: 'boolean',
    sampleValue: false,
    description: 'Indicates whether an energy recovery wheel is mounted on this skid.'
  },
  {
    key: 'skid.hasBaseSteel',
    label: 'Skid Has Base Structural Steel',
    scope: 'Skid',
    category: 'Skid Structural',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Whether skid has structural channel base.'
  },

  // ==========================================
  // SEGMENT SCOPE FACTS
  // ==========================================
  {
    key: 'segment.typeCode',
    label: 'Segment Type Code',
    scope: 'Segment',
    category: 'Segment Details',
    dataType: 'enum',
    enumOptions: [
      { value: 'FS', label: 'FS - Fan (Supply)' },
      { value: 'FR', label: 'FR - Fan (Return)' },
      { value: 'FE', label: 'FE - Fan (Exhaust)' },
      { value: 'CC', label: 'CC - Coil (Cooling)' },
      { value: 'HC', label: 'HC - Coil (Heating)' },
      { value: 'FF', label: 'FF - Flat Filter' },
      { value: 'AF', label: 'AF - Angle Filter' },
      { value: 'RF', label: 'RF - Rigid/High Efficiency Filter' },
      { value: 'HF', label: 'HF - HEPA Filter' },
      { value: 'IP', label: 'IP - Inlet Plenum' },
      { value: 'DP', label: 'DP - Discharge Plenum' },
      { value: 'MB', label: 'MB - Mixing Box' },
      { value: 'XA', label: 'XA - Access' },
      { value: 'HW', label: 'HW - Heat Wheel' },
      { value: 'HX', label: 'HX - Heat Exchanger' },
      { value: 'EH', label: 'EH - Electric Heat' },
      { value: 'IG', label: 'IG - Indirect Gas Heat' },
      { value: 'AT', label: 'AT - Sound Attenuator' },
      { value: 'UV', label: 'UV - UV Light Wall' },
      { value: 'PC', label: 'PC - Pipe Chase' },
      { value: 'VB', label: 'VB - Vestibule' }
    ],
    sampleValue: 'FS',
    description: 'Two-letter AHU segment functional code.'
  },
  {
    key: 'segment.airPressureType',
    label: 'Air Pressure Regime',
    scope: 'Segment',
    category: 'Segment Details',
    dataType: 'enum',
    enumOptions: [
      { value: 'Positive', label: 'Positive Pressure' },
      { value: 'Negative', label: 'Negative Pressure (Draw-Through)' }
    ],
    sampleValue: 'Positive',
    description: 'Whether segment is under positive or negative static pressure.'
  },
  {
    key: 'segment.airVolume',
    label: 'Design Airflow Volume',
    scope: 'Segment',
    category: 'Segment Details',
    dataType: 'number',
    unit: 'CFM',
    sampleValue: 12000,
    description: 'Airflow quantity passing through segment.'
  },
  {
    key: 'segment.hasMotorRemovalRail',
    label: 'Motor Removal I-Beam / Rail',
    scope: 'Segment',
    category: 'Segment Internals',
    dataType: 'boolean',
    sampleValue: true,
    description: 'Whether an overhead motor removal trolley beam is installed.'
  },
  {
    key: 'segment.internals',
    label: 'Segment Internals List',
    scope: 'Segment',
    category: 'Segment Internals',
    dataType: 'string',
    sampleValue: 'EBM Fan Wall',
    description: 'Installed subcomponents (e.g. Fan Wall, Drain Pan, Coil, Perf Basket).'
  },

  // ==========================================
  // COMPONENT SCOPE FACTS
  // ==========================================
  {
    key: 'motorControl.motorControlType',
    label: 'Motor Controller / Starter Type',
    scope: 'Component',
    category: 'Electrical & Controls',
    dataType: 'enum',
    enumOptions: [
      { value: 'VFD', label: 'Variable Frequency Drive (VFD)' },
      { value: 'Starter', label: 'Across-the-Line Starter' },
      { value: 'DisconnectOnly', label: 'Disconnect Switch Only' }
    ],
    sampleValue: 'VFD',
    description: 'Electrical motor starter/drive configuration.'
  },
  {
    key: 'motorControl.fla',
    label: 'Full Load Amps (FLA)',
    scope: 'Component',
    category: 'Electrical & Controls',
    dataType: 'number',
    unit: 'Amps',
    sampleValue: 28.5,
    description: 'Total motor full load amperes.'
  },
  {
    key: 'motorControl.hp',
    label: 'Motor Horsepower (HP)',
    scope: 'Component',
    category: 'Electrical & Controls',
    dataType: 'number',
    unit: 'HP',
    sampleValue: 20,
    description: 'Fan motor horsepower rating.'
  },
  {
    key: 'motorControl.voltage',
    label: 'Motor Operating Voltage',
    scope: 'Component',
    category: 'Electrical & Controls',
    dataType: 'number',
    unit: 'Volts',
    sampleValue: 460,
    description: 'Electrical supply voltage (208, 230, 460, 575V).'
  }
];

export function getFactsByScope(scope: string): FactFieldDefinition[] {
  if (scope === 'All') return FACT_DICTIONARY;
  return FACT_DICTIONARY.filter(f => f.scope === scope || f.scope === 'Unit');
}

export function getFactDefinition(key: string): FactFieldDefinition | undefined {
  return FACT_DICTIONARY.find(f => f.key === key);
}
