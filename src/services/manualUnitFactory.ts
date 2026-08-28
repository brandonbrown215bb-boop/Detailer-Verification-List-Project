import { NormalizedXmlGraph, Fact, SpecialQuote, ChecklistInstance, ShippingSkid, UnitBase, Segment } from '../types';
import { extractFactsFromGraph, overrideFact } from './factRegistry';
import { RULES_CATALOG } from './rulesCatalog';
import { generateChecklists } from './ruleEvaluator';

export interface ManualSegmentItem {
  id: string;
  typeCode: string;
  name: string;
  skidId: string;
  length: number;       // xLength in inches
  width?: number;      // zLength in inches (defaults to unit width)
  height?: number;     // yLength in inches (defaults to unit height)
  weight: number;      // lbs
  airPressureType: 'Positive' | 'Negative';
  airVolume: number;   // CFM
  handOrientation?: string;
  internals: string[];
  hasFrontChannel?: boolean;
  hasRearChannel?: boolean;
  hasMotorRemovalRail?: boolean;
  casing?: {
    exteriorMaterial?: string;
    exteriorGauge?: number;
    interiorMaterial?: string;
    interiorGauge?: number;
    housingThickness?: number;
    housingStyle?: string;
    insulationType?: string;
  };
}

export interface ManualSkidItem {
  id: string;          // e.g. "skid-1"
  index: number;       // 1..N
  name: string;        // "Skid 1", "Skid 2", etc.
  baseHeight?: number; // per-skid base height override (default: unit base height)
  baseMaterial?: string;
  baseType?: string;
  hasSubFloor?: boolean;
  subFloorMaterial?: string;
  authoritativeWeight?: number;
  isWeightConfirmed?: boolean;
}

export interface ManualUnitConfig {
  jobName: string;
  comNumber: string;
  detailerName: string;
  unitType: 'Outdoor' | 'Indoor';
  housingStyle: 'ThermalBreak' | 'Standard';
  defaultUnitWidth?: number;     // default 84"
  defaultUnitHeight?: number;    // default 96"
  defaultBaseHeight?: number;    // default 10"
  defaultWallThickness?: number; // default 2.0"
  totalStaticPressure?: number;  // default 2.5 in. wg
  casingMaterials?: {
    exteriorMaterialType?: string;
    exteriorMaterialGauge?: number;
    interiorMaterialType?: string;
    interiorMaterialGauge?: number;
    floorMaterialType?: string;
    floorMaterialGauge?: number;
    insulationType?: string;
  };
  skids?: ManualSkidItem[];
  segments?: ManualSegmentItem[];

  // Legacy fields for backward compatibility
  skidCount?: number;
  wallThickness?: number;
  baseHeight?: number;
}

export interface SegmentTemplate {
  typeCode: string;
  name: string;
  category: 'Plenums & Inlets' | 'Filtration' | 'Coils & Heat Transfer' | 'Fans & Air Movement' | 'Energy Recovery' | 'Access & Service' | 'Acoustics & Airflow' | 'Auxiliary & Heaters';
  defaultLength: number;
  defaultWeight: number;
  defaultPressure: 'Positive' | 'Negative';
  defaultInternals: string[];
  description: string;
}

export const AVAILABLE_SEGMENT_TEMPLATES: SegmentTemplate[] = [
  // Plenums & Inlets
  {
    typeCode: 'IP',
    name: 'Inlet Plenum',
    category: 'Plenums & Inlets',
    defaultLength: 48,
    defaultWeight: 1200,
    defaultPressure: 'Negative',
    defaultInternals: [],
    description: 'Intake air entrance section with optional bottom or side openings'
  },
  {
    typeCode: 'MB',
    name: 'Mixing Box',
    category: 'Plenums & Inlets',
    defaultLength: 60,
    defaultWeight: 2200,
    defaultPressure: 'Negative',
    defaultInternals: ['Damper Wall (Return & Outside Air)'],
    description: 'Outside air and return air mixing plenum with opposing damper blades'
  },
  {
    typeCode: 'EE',
    name: 'Economizer Section',
    category: 'Plenums & Inlets',
    defaultLength: 48,
    defaultWeight: 1600,
    defaultPressure: 'Negative',
    defaultInternals: ['Economizer Dampers'],
    description: 'Full air economizer damper section for free-cooling operation'
  },
  {
    typeCode: 'DP',
    name: 'Discharge Plenum',
    category: 'Plenums & Inlets',
    defaultLength: 48,
    defaultWeight: 1400,
    defaultPressure: 'Positive',
    defaultInternals: [],
    description: 'Final discharge section with top, front, or side supply duct collar'
  },

  // Filtration
  {
    typeCode: 'FF',
    name: 'Flat Filter',
    category: 'Filtration',
    defaultLength: 24,
    defaultWeight: 800,
    defaultPressure: 'Negative',
    defaultInternals: ['Flat Filter (2" MERV 8 Pre-Filters)'],
    description: 'Standard flat pre-filter rack with slide-out side access'
  },
  {
    typeCode: 'AF',
    name: 'Angle Filter',
    category: 'Filtration',
    defaultLength: 36,
    defaultWeight: 1100,
    defaultPressure: 'Negative',
    defaultInternals: ['Angle Filter (V-Bank Filter Rack)'],
    description: 'V-bank angled filter arrangement offering increased face area'
  },
  {
    typeCode: 'RF',
    name: 'Rigid / Bag Filter',
    category: 'Filtration',
    defaultLength: 36,
    defaultWeight: 1200,
    defaultPressure: 'Negative',
    defaultInternals: ['Rigid Filter (MERV 13-14 Final Filters)'],
    description: 'High-efficiency 12" rigid cartridge or multi-pocket bag filters'
  },
  {
    typeCode: 'HF',
    name: 'HEPA Filter',
    category: 'Filtration',
    defaultLength: 36,
    defaultWeight: 1400,
    defaultPressure: 'Negative',
    defaultInternals: ['HEPA Filter Wall (99.97% DOP)'],
    description: 'Gel-seal or gasket-seal HEPA filter bank for critical healthcare applications'
  },

  // Coils & Heat Transfer
  {
    typeCode: 'CC',
    name: 'Coil (Cooling)',
    category: 'Coils & Heat Transfer',
    defaultLength: 48,
    defaultWeight: 2800,
    defaultPressure: 'Negative',
    defaultInternals: ['Coil (Cooling)', 'Stainless Steel Drain Pan', 'Moisture Eliminator'],
    description: 'Chilled water or DX cooling coil section with sloped drain pan'
  },
  {
    typeCode: 'HC',
    name: 'Coil (Heating)',
    category: 'Coils & Heat Transfer',
    defaultLength: 36,
    defaultWeight: 2200,
    defaultPressure: 'Negative',
    defaultInternals: ['Coil (Heating)'],
    description: 'Hot water or steam distribution coil with intermediate bulkhead'
  },
  {
    typeCode: 'VC',
    name: 'Vertical Coil',
    category: 'Coils & Heat Transfer',
    defaultLength: 48,
    defaultWeight: 2600,
    defaultPressure: 'Negative',
    defaultInternals: ['Vertical Coil', 'Stacked Drain Pan'],
    description: 'Multi-deck vertical face-split cooling or heating coil section'
  },
  {
    typeCode: 'IC',
    name: 'Integrated Face & Bypass Coil',
    category: 'Coils & Heat Transfer',
    defaultLength: 54,
    defaultWeight: 3000,
    defaultPressure: 'Negative',
    defaultInternals: ['IFB Coil (Face & Bypass Dampers)'],
    description: 'Freeze-resistant coil with internal proportional bypass dampers'
  },

  // Fans & Air Movement
  {
    typeCode: 'FS',
    name: 'Fan (Supply)',
    category: 'Fans & Air Movement',
    defaultLength: 72,
    defaultWeight: 3800,
    defaultPressure: 'Positive',
    defaultInternals: ['EBM Fan Wall Array', 'Backdraft Dampers', 'Service Light'],
    description: 'Supply fan array plenum with ECM direct-drive fans and piezometer rings'
  },
  {
    typeCode: 'FR',
    name: 'Fan (Return)',
    category: 'Fans & Air Movement',
    defaultLength: 60,
    defaultWeight: 3400,
    defaultPressure: 'Negative',
    defaultInternals: ['EBM Fan Wall Array'],
    description: 'Return air fan array configured for building static pressure relief'
  },
  {
    typeCode: 'FE',
    name: 'Fan (Exhaust)',
    category: 'Fans & Air Movement',
    defaultLength: 60,
    defaultWeight: 3400,
    defaultPressure: 'Negative',
    defaultInternals: ['EBM Fan Wall Array'],
    description: 'Dedicated exhaust / spill fan section for 100% outside air systems'
  },

  // Energy Recovery
  {
    typeCode: 'HW',
    name: 'Heat Wheel',
    category: 'Energy Recovery',
    defaultLength: 48,
    defaultWeight: 3500,
    defaultPressure: 'Negative',
    defaultInternals: ['Heat Wheel (Total Energy Recovery Rotor)', 'Purge Sector'],
    description: 'Rotary desiccant or sensible energy recovery heat wheel cassette'
  },
  {
    typeCode: 'HX',
    name: 'Plate Heat Exchanger',
    category: 'Energy Recovery',
    defaultLength: 48,
    defaultWeight: 3200,
    defaultPressure: 'Negative',
    defaultInternals: ['Fixed Plate Heat Exchanger Core'],
    description: 'Cross-flow or counter-flow fixed aluminum plate air-to-air heat exchanger'
  },

  // Access & Service
  {
    typeCode: 'XA',
    name: 'Access Section',
    category: 'Access & Service',
    defaultLength: 30,
    defaultWeight: 900,
    defaultPressure: 'Negative',
    defaultInternals: ['Access Door & Service Space', 'Marine Inspection Window'],
    description: 'Walk-in service access corridor between coils and fan sections'
  },
  {
    typeCode: 'VB',
    name: 'Vestibule / Service Corridor',
    category: 'Access & Service',
    defaultLength: 48,
    defaultWeight: 1400,
    defaultPressure: 'Negative',
    defaultInternals: ['Service Corridor', 'Electrical Raceway Channel'],
    description: 'Enclosed weather-tight service vestibule for piping and controls'
  },
  {
    typeCode: 'PC',
    name: 'Pipe Chase',
    category: 'Access & Service',
    defaultLength: 24,
    defaultWeight: 700,
    defaultPressure: 'Negative',
    defaultInternals: ['Internal Piping Chase'],
    description: 'Dedicated insulated vertical/horizontal internal enclosure for water and refrigerant headers'
  },

  // Acoustics & Airflow
  {
    typeCode: 'AT',
    name: 'Sound Attenuator',
    category: 'Acoustics & Airflow',
    defaultLength: 48,
    defaultWeight: 2000,
    defaultPressure: 'Positive',
    defaultInternals: ['Sound Attenuator Baffles (Acoustic Silencer)'],
    description: 'Silencer section with perforated acoustic splitters for supply noise reduction'
  },
  {
    typeCode: 'DI',
    name: 'Diffuser',
    category: 'Acoustics & Airflow',
    defaultLength: 36,
    defaultWeight: 1100,
    defaultPressure: 'Positive',
    defaultInternals: ['Perforated Air Distribution Baffle'],
    description: 'Airflow velocity equalization diffuser plate behind fan discharge'
  },

  // Auxiliary & Heaters
  {
    typeCode: 'EH',
    name: 'Electric Heat',
    category: 'Auxiliary & Heaters',
    defaultLength: 36,
    defaultWeight: 1500,
    defaultPressure: 'Negative',
    defaultInternals: ['Electric Heater Grid', 'High-Limit Thermal Cutout'],
    description: 'Open-coil or finned tubular electric resistance heating element section'
  },
  {
    typeCode: 'IG',
    name: 'Indirect Gas Burner',
    category: 'Auxiliary & Heaters',
    defaultLength: 60,
    defaultWeight: 3200,
    defaultPressure: 'Negative',
    defaultInternals: ['Indirect Gas Heat Exchanger Drum & Tubes', 'Power Burner Assembly'],
    description: 'High-turndown stainless steel drum and tube indirect gas heating section'
  },
  {
    typeCode: 'UV',
    name: 'UV-C Disinfection',
    category: 'Auxiliary & Heaters',
    defaultLength: 24,
    defaultWeight: 600,
    defaultPressure: 'Negative',
    defaultInternals: ['UV-C Germicidal Light Array', 'Door Interlock Safety Switches'],
    description: 'Ultraviolet surface and airstream irradiation array downstream of cooling coil'
  },
  {
    typeCode: 'HM',
    name: 'Humidifier',
    category: 'Auxiliary & Heaters',
    defaultLength: 36,
    defaultWeight: 1200,
    defaultPressure: 'Positive',
    defaultInternals: ['Steam Dispersion Tube Grid', 'Condensate Drain'],
    description: 'Direct steam injection or evaporative media humidification section'
  }
];

export interface ManualUnitPreset {
  id: string;
  name: string;
  description: string;
  skidCount: number;
  skids: ManualSkidItem[];
  segments: Omit<ManualSegmentItem, 'id'>[];
}

export const MANUAL_UNIT_PRESETS: ManualUnitPreset[] = [
  {
    id: 'preset-standard-vav',
    name: 'Standard 2-Skid VAV Unit',
    description: 'Intake, Pre-filter, Heating, and Access on Skid 1; Cooling Coil, Supply Fan Wall, and Discharge on Skid 2.',
    skidCount: 2,
    skids: [
      { id: 'skid-1', index: 1, name: 'Skid 1 (Intake & Pre-Treatment)', baseHeight: 10, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' },
      { id: 'skid-2', index: 2, name: 'Skid 2 (Cooling & Supply Fan)', baseHeight: 10, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' }
    ],
    segments: [
      { typeCode: 'IP', name: 'Inlet Plenum', skidId: 'skid-1', length: 48, weight: 1200, airPressureType: 'Negative', airVolume: 18000, internals: [] },
      { typeCode: 'FF', name: 'Flat Filter', skidId: 'skid-1', length: 24, weight: 800, airPressureType: 'Negative', airVolume: 18000, internals: ['Flat Filter (2" MERV 8 Pre-Filters)'] },
      { typeCode: 'HC', name: 'Coil (Heating)', skidId: 'skid-1', length: 36, weight: 2200, airPressureType: 'Negative', airVolume: 18000, internals: ['Coil (Heating)'] },
      { typeCode: 'XA', name: 'Access Section', skidId: 'skid-1', length: 30, weight: 900, airPressureType: 'Negative', airVolume: 18000, internals: ['Access Door & Service Space'] },
      { typeCode: 'CC', name: 'Coil (Cooling)', skidId: 'skid-2', length: 48, weight: 2800, airPressureType: 'Negative', airVolume: 18000, internals: ['Coil (Cooling)', 'Stainless Steel Drain Pan'] },
      { typeCode: 'FS', name: 'Fan (Supply)', skidId: 'skid-2', length: 72, weight: 3800, airPressureType: 'Positive', airVolume: 18000, internals: ['EBM Fan Wall Array', 'Backdraft Dampers'] },
      { typeCode: 'DP', name: 'Discharge Plenum', skidId: 'skid-2', length: 48, weight: 1400, airPressureType: 'Positive', airVolume: 18000, internals: [] }
    ]
  },
  {
    id: 'preset-3skid-energy-recovery',
    name: '3-Skid Custom Air Handler with Energy Recovery',
    description: 'Mixing Box & Heat Wheel on Skid 1; Access, Cooling & Heating on Skid 2; Fan Array, Silencer & Discharge on Skid 3.',
    skidCount: 3,
    skids: [
      { id: 'skid-1', index: 1, name: 'Skid 1 (Mixing & Energy Recovery)', baseHeight: 10, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' },
      { id: 'skid-2', index: 2, name: 'Skid 2 (Conditioning & Access)', baseHeight: 10, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' },
      { id: 'skid-3', index: 3, name: 'Skid 3 (Fan Array & Discharge)', baseHeight: 10, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' }
    ],
    segments: [
      { typeCode: 'MB', name: 'Mixing Box', skidId: 'skid-1', length: 60, weight: 2200, airPressureType: 'Negative', airVolume: 24000, internals: ['Damper Wall (Return & Outside Air)'] },
      { typeCode: 'AF', name: 'Angle Filter', skidId: 'skid-1', length: 36, weight: 1100, airPressureType: 'Negative', airVolume: 24000, internals: ['Angle Filter (V-Bank Filter Rack)'] },
      { typeCode: 'HW', name: 'Heat Wheel', skidId: 'skid-1', length: 48, weight: 3500, airPressureType: 'Negative', airVolume: 24000, internals: ['Heat Wheel (Total Energy Recovery Rotor)'] },
      { typeCode: 'XA', name: 'Access Section', skidId: 'skid-2', length: 30, weight: 900, airPressureType: 'Negative', airVolume: 24000, internals: ['Access Door & Service Space'] },
      { typeCode: 'CC', name: 'Coil (Cooling)', skidId: 'skid-2', length: 48, weight: 2800, airPressureType: 'Negative', airVolume: 24000, internals: ['Coil (Cooling)', 'Stainless Steel Drain Pan'] },
      { typeCode: 'HC', name: 'Coil (Heating)', skidId: 'skid-2', length: 36, weight: 2200, airPressureType: 'Negative', airVolume: 24000, internals: ['Coil (Heating)'] },
      { typeCode: 'FS', name: 'Fan (Supply)', skidId: 'skid-3', length: 72, weight: 3800, airPressureType: 'Positive', airVolume: 24000, internals: ['EBM Fan Wall Array'] },
      { typeCode: 'AT', name: 'Sound Attenuator', skidId: 'skid-3', length: 48, weight: 2000, airPressureType: 'Positive', airVolume: 24000, internals: ['Sound Attenuator Baffles'] },
      { typeCode: 'DP', name: 'Discharge Plenum', skidId: 'skid-3', length: 48, weight: 1400, airPressureType: 'Positive', airVolume: 24000, internals: [] }
    ]
  },
  {
    id: 'preset-4skid-hospital',
    name: '4-Skid Hospital Cleanroom Air Handler',
    description: 'High-spec 4-skid configuration featuring Heat Wheel, UV Disinfection, Final HEPA filtration, and Sound Attenuation.',
    skidCount: 4,
    skids: [
      { id: 'skid-1', index: 1, name: 'Skid 1 (Intake & Pre-Filter)', baseHeight: 12, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' },
      { id: 'skid-2', index: 2, name: 'Skid 2 (Heat Wheel & Service)', baseHeight: 12, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' },
      { id: 'skid-3', index: 3, name: 'Skid 3 (Coils & UV Disinfection)', baseHeight: 12, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' },
      { id: 'skid-4', index: 4, name: 'Skid 4 (Fan Wall, HEPA & Silencer)', baseHeight: 12, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' }
    ],
    segments: [
      { typeCode: 'MB', name: 'Mixing Box', skidId: 'skid-1', length: 60, weight: 2400, airPressureType: 'Negative', airVolume: 30000, internals: ['Damper Wall'] },
      { typeCode: 'AF', name: 'Angle Filter', skidId: 'skid-1', length: 36, weight: 1200, airPressureType: 'Negative', airVolume: 30000, internals: ['Angle Filter'] },
      { typeCode: 'HW', name: 'Heat Wheel', skidId: 'skid-2', length: 48, weight: 3600, airPressureType: 'Negative', airVolume: 30000, internals: ['Heat Wheel'] },
      { typeCode: 'XA', name: 'Access Section', skidId: 'skid-2', length: 30, weight: 950, airPressureType: 'Negative', airVolume: 30000, internals: ['Access Door'] },
      { typeCode: 'CC', name: 'Coil (Cooling)', skidId: 'skid-3', length: 48, weight: 3000, airPressureType: 'Negative', airVolume: 30000, internals: ['Coil (Cooling)', 'Stainless Steel Drain Pan'] },
      { typeCode: 'UV', name: 'UV-C Disinfection', skidId: 'skid-3', length: 24, weight: 650, airPressureType: 'Negative', airVolume: 30000, internals: ['UV-C Germicidal Light Array'] },
      { typeCode: 'HC', name: 'Coil (Heating)', skidId: 'skid-3', length: 36, weight: 2300, airPressureType: 'Negative', airVolume: 30000, internals: ['Coil (Heating)'] },
      { typeCode: 'FS', name: 'Fan (Supply)', skidId: 'skid-4', length: 72, weight: 4200, airPressureType: 'Positive', airVolume: 30000, internals: ['EBM Fan Wall Array'] },
      { typeCode: 'HF', name: 'HEPA Filter', skidId: 'skid-4', length: 36, weight: 1600, airPressureType: 'Positive', airVolume: 30000, internals: ['HEPA Filter Wall (99.97% DOP)'] },
      { typeCode: 'AT', name: 'Sound Attenuator', skidId: 'skid-4', length: 48, weight: 2200, airPressureType: 'Positive', airVolume: 30000, internals: ['Sound Attenuator Baffles'] },
      { typeCode: 'DP', name: 'Discharge Plenum', skidId: 'skid-4', length: 48, weight: 1500, airPressureType: 'Positive', airVolume: 30000, internals: [] }
    ]
  },
  {
    id: 'preset-1skid-compact',
    name: '1-Skid Compact Packaged Unit',
    description: 'Monolithic single-skid rooftop package with pre-filter, cooling, fan wall, and top discharge.',
    skidCount: 1,
    skids: [
      { id: 'skid-1', index: 1, name: 'Skid 1 (Monolithic Unit)', baseHeight: 8, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' }
    ],
    segments: [
      { typeCode: 'FF', name: 'Flat Filter', skidId: 'skid-1', length: 24, weight: 800, airPressureType: 'Negative', airVolume: 12000, internals: ['Flat Filter (2" MERV 8 Pre-Filters)'] },
      { typeCode: 'CC', name: 'Coil (Cooling)', skidId: 'skid-1', length: 48, weight: 2600, airPressureType: 'Negative', airVolume: 12000, internals: ['Coil (Cooling)', 'Stainless Steel Drain Pan'] },
      { typeCode: 'FS', name: 'Fan (Supply)', skidId: 'skid-1', length: 60, weight: 3200, airPressureType: 'Positive', airVolume: 12000, internals: ['EBM Fan Wall Array'] },
      { typeCode: 'DP', name: 'Discharge Plenum', skidId: 'skid-1', length: 36, weight: 1100, airPressureType: 'Positive', airVolume: 12000, internals: [] }
    ]
  },
  {
    id: 'preset-custom-blank',
    name: 'Custom / Blank Unit (Build Your Own)',
    description: 'Start with 1 skid and add your own custom segment sequence from scratch.',
    skidCount: 1,
    skids: [
      { id: 'skid-1', index: 1, name: 'Skid 1', baseHeight: 10, baseMaterial: 'StructuralSteel', baseType: 'A36', hasSubFloor: true, subFloorMaterial: 'STL GALV 22ga' }
    ],
    segments: []
  }
];

export function createManualUnit(config: ManualUnitConfig): {
  graph: NormalizedXmlGraph;
  facts: Record<string, Fact>;
  checklists: ChecklistInstance[];
  sqItems: SpecialQuote[];
  rawXml: string;
  generalComments: string;
} {
  const defaultBaseHeight = config.defaultBaseHeight || config.baseHeight || 10;
  const defaultWallThickness = config.defaultWallThickness || config.wallThickness || 2.0;
  const defaultWidth = config.defaultUnitWidth || 84;
  const defaultHeight = config.defaultUnitHeight || 96;
  const totalStaticPressure = config.totalStaticPressure || 2.5;

  const casingMaterials = {
    exteriorMaterialType: config.casingMaterials?.exteriorMaterialType || 'STL GALV PPC',
    exteriorMaterialGauge: config.casingMaterials?.exteriorMaterialGauge || 18,
    interiorMaterialType: config.casingMaterials?.interiorMaterialType || 'STL GALV',
    interiorMaterialGauge: config.casingMaterials?.interiorMaterialGauge || 22,
    floorMaterialType: config.casingMaterials?.floorMaterialType || 'STL GALV',
    floorMaterialGauge: config.casingMaterials?.floorMaterialGauge || 16,
    housingStyle: config.housingStyle || 'ThermalBreak',
    insulationType: config.casingMaterials?.insulationType || 'Foam'
  };

  // Determine skids configuration
  let rawSkids: ManualSkidItem[] = config.skids && config.skids.length > 0 ? config.skids : [];
  if (rawSkids.length === 0) {
    const count = Math.max(1, config.skidCount || 2);
    rawSkids = Array.from({ length: count }, (_, i) => ({
      id: `skid-${i + 1}`,
      index: i + 1,
      name: `Skid ${i + 1}`,
      baseHeight: defaultBaseHeight,
      baseMaterial: 'StructuralSteel',
      baseType: 'A36',
      hasSubFloor: true,
      subFloorMaterial: 'STL GALV 22ga'
    }));
  }

  // Determine segments configuration
  let rawSegments: ManualSegmentItem[] = config.segments || [];
  if (rawSegments.length === 0 && (!config.segments || config.segments.length === 0)) {
    // Generate default segment set distributed across skids
    rawSegments = rawSkids.map((skid, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === rawSkids.length - 1;
      const typeCode = isFirst ? 'IP' : (isLast ? 'FS' : 'XA');
      const name = isFirst ? 'Inlet Plenum' : (isLast ? 'Supply Fan Section' : `Access Section ${idx + 1}`);
      return {
        id: `seg-${idx + 1}`,
        typeCode,
        name,
        skidId: skid.id,
        length: isLast ? 72 : 48,
        width: defaultWidth,
        height: defaultHeight,
        weight: isLast ? 3800 : 2200,
        airPressureType: isLast ? 'Positive' : 'Negative',
        airVolume: 18000,
        internals: isLast ? ['EBM Fan Wall Array'] : []
      };
    });
  }

  // 1. Process Segments and calculate cumulative X positions
  let currentCumulativeX = 0;
  const segments: Segment[] = [];
  const skidSegmentMap = new Map<string, string[]>();
  rawSkids.forEach(s => skidSegmentMap.set(s.id, []));

  rawSegments.forEach((item, idx) => {
    const segId = item.id || `seg-${idx + 1}`;
    const segLength = Number(item.length) || 48;
    const segWidth = Number(item.width) || defaultWidth;
    const segHeight = Number(item.height) || defaultHeight;
    const segWeight = Number(item.weight) || 2000;

    // Track skid assignment
    const targetSkidId = item.skidId && skidSegmentMap.has(item.skidId)
      ? item.skidId
      : rawSkids[0]?.id || 'skid-1';

    if (!skidSegmentMap.has(targetSkidId)) {
      skidSegmentMap.set(targetSkidId, []);
    }
    skidSegmentMap.get(targetSkidId)!.push(segId);

    const casing = {
      exteriorMaterial: item.casing?.exteriorMaterial || casingMaterials.exteriorMaterialType,
      exteriorGauge: item.casing?.exteriorGauge || casingMaterials.exteriorMaterialGauge,
      interiorMaterial: item.casing?.interiorMaterial || casingMaterials.interiorMaterialType,
      interiorGauge: item.casing?.interiorGauge || casingMaterials.interiorMaterialGauge,
      housingThickness: item.casing?.housingThickness || defaultWallThickness,
      housingStyle: item.casing?.housingStyle || casingMaterials.housingStyle,
      insulationType: item.casing?.insulationType || casingMaterials.insulationType
    };

    const defaultSurface = {
      exteriorMaterial: casing.exteriorMaterial,
      exteriorGauge: casing.exteriorGauge,
      exteriorPaint: 'None',
      interiorMaterial: casing.interiorMaterial,
      interiorGauge: casing.interiorGauge,
      interiorPaint: 'None',
      housingThickness: casing.housingThickness
    };

    const surfaces = {
      left: { ...defaultSurface },
      front: { ...defaultSurface },
      right: { ...defaultSurface },
      rear: { ...defaultSurface },
      top: { ...defaultSurface },
      bottom: {
        ...defaultSurface,
        exteriorGauge: casingMaterials.floorMaterialGauge || 16,
        interiorMaterial: casingMaterials.floorMaterialType || casing.interiorMaterial,
        interiorGauge: casingMaterials.floorMaterialGauge || 16,
        housingThickness: 0
      }
    };

    segments.push({
      id: segId,
      tag: `segment_${item.typeCode}`,
      typeCode: item.typeCode,
      name: item.name || `Segment ${item.typeCode}`,
      weight: segWeight,
      airPressureType: item.airPressureType || 'Negative',
      airVolume: item.airVolume || 18000,
      handOrientation: item.handOrientation || 'FrontToRear',
      dimensions: {
        x: currentCumulativeX,
        y: 0,
        z: 0,
        xLength: segLength,
        yLength: segHeight,
        zLength: segWidth
      },
      casing,
      surfaces,
      internals: item.internals || [],
      hasFrontChannel: item.hasFrontChannel || false,
      hasRearChannel: item.hasRearChannel || false,
      hasMotorRemovalRail: item.hasMotorRemovalRail || false
    });

    currentCumulativeX += segLength;
  });

  // 2. Build Bases and Shipping Skids
  const bases: UnitBase[] = [];
  const skids: ShippingSkid[] = [];

  rawSkids.forEach((skidItem, idx) => {
    const skidId = skidItem.id || `skid-${idx + 1}`;
    const baseId = `base-${idx + 1}`;
    const baseHeight = skidItem.baseHeight || defaultBaseHeight;
    const assignedSegIds = skidSegmentMap.get(skidId) || [];
    const assignedSegments = segments.filter(s => assignedSegIds.includes(s.id));

    // Calculate skid dimensions from contained segments
    let skidLength = 0;
    let maxSegWidth = defaultWidth;
    let maxSegHeight = defaultHeight;
    let calculatedWeight = 0;

    assignedSegments.forEach(seg => {
      skidLength += seg.dimensions.xLength;
      maxSegWidth = Math.max(maxSegWidth, seg.dimensions.zLength);
      maxSegHeight = Math.max(maxSegHeight, seg.dimensions.yLength);
      calculatedWeight += seg.weight;
    });

    if (skidLength === 0) skidLength = 48; // fallback min length

    bases.push({
      id: baseId,
      materialType: skidItem.baseMaterial || 'StructuralSteel',
      baseType: skidItem.baseType || 'A36',
      paintType: 'ChampagneBase',
      height: baseHeight,
      lipHeight: 0,
      insulationType: 'Foam_2Inch',
      housingStyle: config.housingStyle,
      hasSubFloor: skidItem.hasSubFloor ?? true,
      subFloorMaterial: skidItem.subFloorMaterial || 'STL GALV 22ga',
      dimensions: {
        x: 0,
        y: 0,
        z: 0,
        xLength: skidLength,
        yLength: baseHeight,
        zLength: maxSegWidth
      }
    });

    skids.push({
      id: skidId,
      index: idx + 1,
      name: skidItem.name || `Skid ${idx + 1}`,
      segmentIds: assignedSegIds,
      baseIds: [baseId],
      calculatedWeight,
      authoritativeWeight: skidItem.authoritativeWeight,
      isWeightConfirmed: skidItem.isWeightConfirmed || false,
      dimensions: {
        length: skidLength,
        width: maxSegWidth,
        height: maxSegHeight + baseHeight
      }
    });
  });

  // Calculate overall unit metrics
  let totalUnitLength = 0;
  let maxUnitWidth = defaultWidth;
  let maxUnitHeight = defaultHeight;
  let totalUnitWeight = 0;

  segments.forEach(seg => {
    totalUnitLength += seg.dimensions.xLength;
    maxUnitWidth = Math.max(maxUnitWidth, seg.dimensions.zLength);
    maxUnitHeight = Math.max(maxUnitHeight, seg.dimensions.yLength);
    totalUnitWeight += seg.weight;
  });

  const graph: NormalizedXmlGraph = {
    unitMOMID: '{00000000-0000-0000-0000-000000000000}',
    documentVersion: '2026.1.0.0',
    generatingSoftware: 'AHU Verification Workspace (Manual Entry)',
    unitWeight: totalUnitWeight > 0 ? totalUnitWeight : skids.length * 3500,
    totalStaticPressure,
    dimensions: {
      length: totalUnitLength > 0 ? totalUnitLength : skids.length * 120,
      width: maxUnitWidth,
      height: maxUnitHeight + defaultBaseHeight
    },
    unitOptions: {
      unitType: config.unitType || 'Outdoor',
      brandOption: 'YORKCustom',
      unitConstructionType: 'Standard',
      shippingProtection: 'ShrinkWrap',
      washdown: false,
      knockdown: false,
      hasUTL: false,
      lipHeight: 0,
      isSeismic: false,
      noa: false,
      noaRating: 'N/A',
      thermalBreak: casingMaterials.housingStyle === 'ThermalBreak',
      primaryAccessSide: 'Left',
      defaultUnitBaseHeight: defaultBaseHeight,
      materials: casingMaterials
    },
    roofOptions: {
      hasSlopedRoof: config.unitType === 'Outdoor',
      roofSlope: 0.25,
      roofSlopeHighSide: 'Internal',
      roofPeak: config.unitType === 'Outdoor' ? 'Center' : 'Flat',
      roofPeakZDim: 97
    },
    curbOptions: {
      hasCurbRest: config.unitType === 'Outdoor'
    },
    skids,
    bases,
    segments,
    motorControls: []
  };

  // 3. Extract Fact Registry
  let facts = extractFactsFromGraph(graph);

  // Apply authoritative manual provenance overrides
  facts = overrideFact(facts, 'unit.jobName', config.jobName || 'Custom AHU Project', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.comNumber', config.comNumber || 'COM-000000', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.detailer', config.detailerName || 'Detailer', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.unitType', config.unitType || 'Outdoor', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.shellType', 'ISG', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.wallThickness', defaultWallThickness, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.baseHeight', defaultBaseHeight, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.totalStaticPressure', totalStaticPressure, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.skinMaterial', casingMaterials.exteriorMaterialType, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.skinGauge', casingMaterials.exteriorMaterialGauge, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.linerMaterial', casingMaterials.interiorMaterialType, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.linerGauge', casingMaterials.interiorMaterialGauge, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.floorMaterial', casingMaterials.floorMaterialType, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.floorGauge', casingMaterials.floorMaterialGauge, config.detailerName, 'Manual Project Creation');

  // 4. Generate Rule Checklists
  const checklists = generateChecklists(RULES_CATALOG, graph, facts);

  // 5. Synthesize XML Representation for .dvl persistence
  const segmentsXml = segments.map(s => `      <segment_${s.typeCode}>
        <segmentID>${s.id}</segmentID>
        <weight>${s.weight}</weight>
        <airPressureType>${s.airPressureType}</airPressureType>
        <airVolume>${s.airVolume}</airVolume>
        <geometry>
          <xLength>${s.dimensions.xLength}</xLength>
          <yLength>${s.dimensions.yLength}</yLength>
          <zLength>${s.dimensions.zLength}</zLength>
        </geometry>
        <constructionOptions>
          <housingStyle>${s.casing.housingStyle}</housingStyle>
          <insulationType>${s.casing.insulationType}</insulationType>
          <surfaceDetail_Front>
            <exteriorMaterialType>${s.casing.exteriorMaterial}</exteriorMaterialType>
            <exteriorMaterialGauge>${s.casing.exteriorGauge}</exteriorMaterialGauge>
            <interiorMaterialType>${s.casing.interiorMaterial}</interiorMaterialType>
            <interiorMaterialGauge>${s.casing.interiorGauge}</interiorMaterialGauge>
            <housingThickness>${s.casing.housingThickness}</housingThickness>
          </surfaceDetail_Front>
        </constructionOptions>
        ${s.internals.map(i => `<internalFeature>${i}</internalFeature>`).join('\n        ')}
      </segment_${s.typeCode}>`).join('\n');

  const skidsXml = skids.map(sk => `      <shippingSkid>
        <skidID>${sk.id}</skidID>
        <name>${sk.name}</name>
        ${sk.segmentIds.map(sid => `<segmentReference><segmentID>${sid}</segmentID></segmentReference>`).join('\n        ')}
        ${sk.baseIds.map(bid => `<unitBaseReference><unitBaseID>${bid}</unitBaseID></unitBaseReference>`).join('\n        ')}
      </shippingSkid>`).join('\n');

  const basesXml = bases.map(b => `      <unitBase>
        <unitBaseID>${b.id}</unitBaseID>
        <unitBaseMaterialType>${b.materialType}</unitBaseMaterialType>
        <unitBaseType>${b.baseType}</unitBaseType>
        <subFloorMaterialType>${b.subFloorMaterial}</subFloorMaterialType>
        <geometry>
          <yLength>${b.height}</yLength>
          <xLength>${b.dimensions.xLength}</xLength>
          <zLength>${b.dimensions.zLength}</zLength>
        </geometry>
      </unitBase>`).join('\n');

  const rawXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Manually Created AHU Project: ${config.jobName || 'Custom AHU'} (${config.comNumber || 'COM-000000'}) -->
<AHU>
  <unitWeight>${graph.unitWeight}</unitWeight>
  <totalStaticPressure>${graph.totalStaticPressure}</totalStaticPressure>
  <unitOptions>
    <unitType>${config.unitType || 'Outdoor'}</unitType>
    <brandOption>YORKCustom</brandOption>
    <defaultUnitBaseHeight>${defaultBaseHeight}</defaultUnitBaseHeight>
    <defaultConstructionOptions>
      <housingStyle>${casingMaterials.housingStyle}</housingStyle>
      <insulationType>${casingMaterials.insulationType}</insulationType>
      <exteriorMaterialType>${casingMaterials.exteriorMaterialType}</exteriorMaterialType>
      <exteriorMaterialGauge>${casingMaterials.exteriorMaterialGauge}</exteriorMaterialGauge>
      <interiorMaterialType>${casingMaterials.interiorMaterialType}</interiorMaterialType>
      <interiorMaterialGauge>${casingMaterials.interiorMaterialGauge}</interiorMaterialGauge>
      <floorMaterialType>${casingMaterials.floorMaterialType}</floorMaterialType>
      <floorMaterialGauge>${casingMaterials.floorMaterialGauge}</floorMaterialGauge>
    </defaultConstructionOptions>
  </unitOptions>
  <shippingSkidList>
${skidsXml}
  </shippingSkidList>
  <unitBaseList>
${basesXml}
  </unitBaseList>
  <segmentList>
${segmentsXml}
  </segmentList>
</AHU>`;

  return {
    graph,
    facts,
    checklists,
    sqItems: [],
    rawXml,
    generalComments: `Manually configured AHU unit with ${skids.length} shipping skids and ${segments.length} segments.`
  };
}

