import { NormalizedXmlGraph, Fact, SpecialQuote, ChecklistInstance, ShippingSkid, UnitBase, Segment } from '../types';
import { extractFactsFromGraph, overrideFact } from './factRegistry';
import { RULES_CATALOG } from './rulesCatalog';
import { generateChecklists } from './ruleEvaluator';

export interface ManualUnitConfig {
  jobName: string;
  comNumber: string;
  detailerName: string;
  unitType: 'Outdoor' | 'Indoor';
  housingStyle: 'ThermalBreak' | 'Standard';
  skidCount: number;
  wallThickness: number;
  baseHeight: number;
}

export function createManualUnit(config: ManualUnitConfig): {
  graph: NormalizedXmlGraph;
  facts: Record<string, Fact>;
  checklists: ChecklistInstance[];
  sqItems: SpecialQuote[];
  rawXml: string;
  generalComments: string;
} {
  const skids: ShippingSkid[] = [];
  const bases: UnitBase[] = [];
  const segments: Segment[] = [];

  for (let i = 1; i <= Math.max(1, config.skidCount); i++) {
    const skidId = `skid-${i}`;
    const baseId = `base-${i}`;
    const segId = `seg-${i}`;

    skids.push({
      id: skidId,
      index: i,
      name: `Skid ${i}`,
      segmentIds: [segId],
      baseIds: [baseId],
      calculatedWeight: 3500,
      authoritativeWeight: undefined,
      isWeightConfirmed: false,
      dimensions: { length: 120, width: 84, height: 96 }
    });

    bases.push({
      id: baseId,
      materialType: 'StructuralSteel',
      baseType: 'A36',
      paintType: 'ChampagneBase',
      height: config.baseHeight || 10,
      lipHeight: 0,
      insulationType: 'Foam_2Inch',
      housingStyle: config.housingStyle,
      hasSubFloor: true,
      subFloorMaterial: 'STL GALV 22ga',
      dimensions: { x: 0, y: 0, z: 0, xLength: 120, yLength: config.baseHeight || 10, zLength: 84 }
    });

    segments.push({
      id: segId,
      tag: i === 1 ? 'segment_IP' : (i === config.skidCount ? 'segment_FS' : 'segment_XA'),
      typeCode: i === 1 ? 'IP' : (i === config.skidCount ? 'FS' : 'XA'),
      name: i === 1 ? 'Inlet Plenum' : (i === config.skidCount ? 'Supply Fan Section' : `Access Section ${i}`),
      weight: 3500,
      airPressureType: 'Negative',
      airVolume: 15000,
      handOrientation: 'FrontToRear',
      dimensions: { x: 0, y: 0, z: 0, xLength: 120, yLength: 96, zLength: 84 },
      casing: {
        exteriorMaterial: 'STL GALV PPC',
        exteriorGauge: 18,
        interiorMaterial: 'STL GALV',
        interiorGauge: 22,
        housingThickness: config.wallThickness || 2,
        housingStyle: config.housingStyle,
        insulationType: 'Foam'
      },
      internals: i === config.skidCount ? ['Fan Array / Wall'] : [],
      hasFrontChannel: false,
      hasRearChannel: false,
      hasMotorRemovalRail: false
    });
  }

  const graph: NormalizedXmlGraph = {
    unitMOMID: '{00000000-0000-0000-0000-000000000000}',
    documentVersion: '2026.1.0.0',
    generatingSoftware: 'AHU Verification Workspace (Manual Entry)',
    unitWeight: config.skidCount * 3500,
    totalStaticPressure: 2.5,
    dimensions: {
      length: config.skidCount * 120,
      width: 84,
      height: 96 + (config.baseHeight || 10)
    },
    unitOptions: {
      unitType: config.unitType,
      brandOption: 'YORKCustom',
      unitConstructionType: 'Standard',
      washdown: false,
      knockdown: false,
      hasUTL: false,
      isSeismic: false,
      noaRating: 'N/A',
      primaryAccessSide: 'Left',
      defaultUnitBaseHeight: config.baseHeight || 10,
      materials: {
        exteriorMaterialType: 'STL GALV PPC',
        exteriorMaterialGauge: 18,
        interiorMaterialType: 'STL GALV',
        interiorMaterialGauge: 22,
        floorMaterialType: 'STL GALV',
        floorMaterialGauge: 16,
        housingStyle: config.housingStyle,
        insulationType: 'Foam'
      }
    },
    roofOptions: {
      hasSlopedRoof: config.unitType === 'Outdoor',
      roofSlope: 0.25,
      roofSlopeHighSide: 'Internal',
      roofPeakZDim: 97
    },
    curbOptions: {
      hasCurbRest: config.unitType === 'Outdoor',
      hasCurb: false,
      curbHeight: 0
    },
    skids,
    bases,
    segments,
    motorControls: []
  };

  let facts = extractFactsFromGraph(graph);

  // Apply user-specified values
  facts = overrideFact(facts, 'unit.jobName', config.jobName || 'Custom AHU Project', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.comNumber', config.comNumber || 'COM-000000', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.detailer', config.detailerName || 'Detailer', config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.wallThickness', config.wallThickness || 2, config.detailerName, 'Manual Project Creation');
  facts = overrideFact(facts, 'unit.baseHeight', config.baseHeight || 10, config.detailerName, 'Manual Project Creation');

  const checklists = generateChecklists(RULES_CATALOG, graph, facts);

  const rawXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Manually Created AHU Project: ${config.jobName} (${config.comNumber}) -->
<AHU>
  <unitOptions>
    <unitType>${config.unitType}</unitType>
    <defaultConstructionOptions>
      <housingStyle>${config.housingStyle}</housingStyle>
    </defaultConstructionOptions>
  </unitOptions>
</AHU>`;

  return {
    graph,
    facts,
    checklists,
    sqItems: [],
    rawXml,
    generalComments: 'Manual verification project created.'
  };
}
