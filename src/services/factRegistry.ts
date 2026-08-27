import { NormalizedXmlGraph, Fact, FactStatus, FactConfidence, OrderRevisionData } from '../types';

export function createFact<T>(
  key: string,
  label: string,
  category: string,
  value: T | null,
  status: FactStatus,
  confidence: FactConfidence,
  sourcePointer?: string,
  promptNote?: string
): Fact<T> {
  return {
    key,
    label,
    category,
    value,
    status,
    confidence,
    sourcePointer,
    sourceRawValue: value,
    promptNote,
    overrideHistory: []
  };
}

export function extractFactsFromGraph(
  graph: NormalizedXmlGraph,
  orderRev?: OrderRevisionData | null
): Record<string, Fact> {
  const facts: Record<string, Fact> = {};

  // Order & Identity
  const hasJobName = !!orderRev?.jobName?.trim();
  facts['unit.jobName'] = createFact(
    'unit.jobName',
    'Job Name',
    'Order & Identity',
    hasJobName ? orderRev!.jobName.trim() : 'Medical Center Phase 3',
    'Known',
    'Authoritative',
    hasJobName ? '/root:OrderRevision/jobName' : undefined,
    hasJobName ? undefined : 'Enter Job Name from Order Packet'
  );

  facts['unit.comNumber'] = createFact(
    'unit.comNumber',
    'COM #',
    'Order & Identity',
    null,
    'Unknown',
    'RequiresConfirmation',
    undefined,
    'Enter COM# from MAPICS (e.g. COM-123456)'
  );

  const hasOrderNum = !!orderRev?.orderNumber?.trim();
  if (hasOrderNum) {
    facts['unit.orderNumber'] = createFact(
      'unit.orderNumber',
      'Order Number',
      'Order & Identity',
      orderRev!.orderNumber.trim(),
      'Known',
      'Authoritative',
      '/root:OrderRevision/orderNumber'
    );
  }

  const tag = orderRev?.primaryTag || orderRev?.tagList?.[0];
  if (tag) {
    facts['unit.tag'] = createFact(
      'unit.tag',
      'Unit Tag',
      'Order & Identity',
      tag.trim(),
      'Known',
      'Authoritative',
      '/root:OrderRevision/tagList/tag'
    );
  }

  if (orderRev?.productType) {
    facts['unit.productType'] = createFact(
      'unit.productType',
      'Product Type',
      'Order & Identity',
      orderRev.productType.trim(),
      'Known',
      'Authoritative',
      '/root:OrderRevision/productType'
    );
  }



  const savedDetailer = typeof localStorage !== 'undefined' ? localStorage.getItem('dvl_detailer_name') : null;
  facts['unit.detailer'] = createFact(
    'unit.detailer',
    'Detailer Name',
    'Order & Identity',
    savedDetailer || null,
    savedDetailer ? 'Known' : 'Unknown',
    savedDetailer ? 'Authoritative' : 'RequiresConfirmation',
    undefined,
    'Enter Detailer Name'
  );

  facts['unit.date'] = createFact(
    'unit.date',
    'Verification Date',
    'Order & Identity',
    new Date().toISOString().split('T')[0],
    'Known',
    'Authoritative'
  );

  // Geometry & Casing
  facts['unit.shellType'] = createFact(
    'unit.shellType',
    'Shell Type',
    'Geometry & Casing',
    graph.unitOptions.materials.housingStyle || 'ThermalBreak',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/housingStyle'
  );

  facts['unit.unitType'] = createFact(
    'unit.unitType',
    'Unit Type',
    'Geometry & Casing',
    graph.unitOptions.unitType || 'Outdoor',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/unitType'
  );

  facts['unit.baseHeight'] = createFact(
    'unit.baseHeight',
    'Base Height (in)',
    'Geometry & Casing',
    graph.unitOptions.defaultUnitBaseHeight || 10,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultUnitBaseHeight'
  );

  facts['unit.wallThickness'] = createFact(
    'unit.wallThickness',
    'Wall Thickness (in)',
    'Geometry & Casing',
    graph.unitOptions.materials.housingStyle === 'ThermalBreak' ? 2 : 2,
    'Derived',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/surfaceDetail_Front/housingThickness'
  );

  facts['unit.thermalBreak'] = createFact(
    'unit.thermalBreak',
    'Thermal Break',
    'Geometry & Casing',
    graph.unitOptions.materials.housingStyle.includes('ThermalBreak') ? 'Yes' : 'No',
    'Derived',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/housingStyle'
  );

  facts['unit.roofPeak'] = createFact(
    'unit.roofPeak',
    'Roof Peak (in)',
    'Geometry & Casing',
    graph.roofOptions.hasSlopedRoof ? `${graph.roofOptions.roofPeakZDim}" (${graph.roofOptions.roofSlope}"/ft)` : 'Flat',
    'Derived',
    'Authoritative',
    '/root:AHU/roofOptions'
  );

  facts['unit.curbrest'] = createFact(
    'unit.curbrest',
    'Curbrest Option',
    'Geometry & Casing',
    graph.curbOptions.hasCurbRest ? 'Yes' : 'No',
    'Known',
    'Authoritative',
    '/root:AHU/curbOptions/hasCurbRest'
  );

  // Regulatory & Ratings (Derived from unitConstructionType: Standard, IBC, OSHPD, NOA)
  const constType = graph.unitOptions.unitConstructionType || 'Standard';
  const isSeismic = constType === 'IBC' || constType === 'OSHPD';
  const isNoa = constType === 'NOA';
  const isRecognized = ['Standard', 'IBC', 'OSHPD', 'NOA'].includes(constType);

  facts['unit.noa'] = createFact(
    'unit.noa',
    'Notice of Acceptance (NOA)',
    'Ratings & Options',
    isNoa ? 'NOA' : 'N/A',
    isRecognized ? 'Derived' : 'Unknown',
    isRecognized ? 'Authoritative' : 'RequiresConfirmation',
    '/root:AHU/unitOptions/unitConstructionType',
    isRecognized ? undefined : `Unrecognized construction type '${constType}'. Specify Florida/Miami-Dade NOA wind load rating if applicable.`
  );

  facts['unit.isSeismic'] = createFact(
    'unit.isSeismic',
    'Seismic Certification Required',
    'Ratings & Options',
    isSeismic,
    isRecognized ? 'Derived' : 'Unknown',
    isRecognized ? 'Authoritative' : 'RequiresConfirmation',
    '/root:AHU/unitOptions/unitConstructionType',
    isRecognized ? undefined : `Unrecognized construction type '${constType}'. Verify if seismic IBC/OSHPD compliance and seismic reconnects are specified.`
  );

  facts['unit.location'] = createFact(
    'unit.location',
    'Installation Location',
    'Ratings & Options',
    graph.unitOptions.unitType === 'Outdoor' ? 'Rooftop / Exterior' : 'Mechanical Room',
    'Derived',
    'Authoritative',
    '/root:AHU/unitOptions/unitType'
  );

  facts['unit.knockdown'] = createFact(
    'unit.knockdown',
    'Knockdown Construction',
    'Ratings & Options',
    graph.unitOptions.knockdown ? 'Yes' : 'No',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/knockdown'
  );

  facts['unit.utl'] = createFact(
    'unit.utl',
    'Upturned Lip (UTL)',
    'Geometry & Casing',
    graph.unitOptions.hasUTL ? 'Yes (2.0" Lip)' : 'No',
    'Derived',
    'Authoritative',
    '/root:AHU/unitBaseList/unitBase/upturnedLipHeight'
  );

  // Materials & Gauges
  facts['unit.linerMaterial'] = createFact(
    'unit.linerMaterial',
    'Liner Material',
    'Materials & Gauges',
    graph.unitOptions.materials.interiorMaterialType || 'STL GALV',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialType'
  );

  facts['unit.linerGauge'] = createFact(
    'unit.linerGauge',
    'Liner Gauge',
    'Materials & Gauges',
    graph.unitOptions.materials.interiorMaterialGauge || 22,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialGauge'
  );

  facts['unit.skinMaterial'] = createFact(
    'unit.skinMaterial',
    'Skin Material',
    'Materials & Gauges',
    graph.unitOptions.materials.exteriorMaterialType || 'STL GALV PPC',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialType'
  );

  facts['unit.skinGauge'] = createFact(
    'unit.skinGauge',
    'Skin Gauge',
    'Materials & Gauges',
    graph.unitOptions.materials.exteriorMaterialGauge || 18,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialGauge'
  );

  facts['unit.floorMaterial'] = createFact(
    'unit.floorMaterial',
    'Floor Material',
    'Materials & Gauges',
    graph.unitOptions.materials.floorMaterialType || 'STL GALV',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialType'
  );

  facts['unit.floorGauge'] = createFact(
    'unit.floorGauge',
    'Floor Gauge',
    'Materials & Gauges',
    graph.unitOptions.materials.floorMaterialGauge || 16,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialGauge'
  );

  facts['unit.totalWeight'] = createFact(
    'unit.totalWeight',
    'Total Unit Weight (lbs)',
    'Geometry & Casing',
    graph.unitWeight,
    'Known',
    'Authoritative',
    '/root:AHU/unitWeight'
  );

  facts['unit.totalStaticPressure'] = createFact(
    'unit.totalStaticPressure',
    'Total Static Pressure (in.w.g.)',
    'Geometry & Casing',
    graph.totalStaticPressure,
    'Known',
    'Authoritative',
    '/root:AHU/totalStaticPressure'
  );

  // Per-Skid Facts
  graph.skids.forEach((skid) => {
    const skidSegs = graph.segments.filter(s => skid.segmentIds.includes(s.id));
    const hasDrainPan = skidSegs.some(s => s.tag === 'segment_CC' || s.internals.some(i => i.toLowerCase().includes('drain')));
    const hasFans = skidSegs.some(s => s.typeCode === 'FE' || s.typeCode === 'FR' || s.typeCode === 'FS');
    const hasCoils = skidSegs.some(s => s.typeCode === 'CC' || s.typeCode === 'HC');
    const hasFilters = skidSegs.some(s => s.typeCode === 'FF' || s.typeCode === 'RF' || s.typeCode === 'AF');
    const hasHeatWheel = skidSegs.some(s => s.typeCode === 'HW');

    // Skid aggregate weight is informational (detailers do not approve weight)
    facts[`skid.${skid.id}.weight`] = createFact(
      `skid.${skid.id}.weight`,
      `${skid.name} Aggregate Weight`,
      skid.name,
      skid.calculatedWeight,
      'Derived',
      'Authoritative',
      `/root:AHU/shippingSkidList/shippingSkid[${skid.index}]`
    );

    facts[`skid.${skid.id}.segmentCount`] = createFact(
      `skid.${skid.id}.segmentCount`,
      `${skid.name} Segments Count`,
      skid.name,
      skid.segmentIds.length,
      'Known',
      'Authoritative'
    );

    facts[`skid.${skid.id}.hasDrainPan`] = createFact(
      `skid.${skid.id}.hasDrainPan`,
      `${skid.name} Has Drain Pan`,
      skid.name,
      hasDrainPan,
      'Derived',
      'Authoritative'
    );

    facts[`skid.${skid.id}.hasFans`] = createFact(
      `skid.${skid.id}.hasFans`,
      `${skid.name} Has Fans`,
      skid.name,
      hasFans,
      'Derived',
      'Authoritative'
    );

    facts[`skid.${skid.id}.hasCoils`] = createFact(
      `skid.${skid.id}.hasCoils`,
      `${skid.name} Has Coils`,
      skid.name,
      hasCoils,
      'Derived',
      'Authoritative'
    );

    facts[`skid.${skid.id}.hasFilters`] = createFact(
      `skid.${skid.id}.hasFilters`,
      `${skid.name} Has Filters`,
      skid.name,
      hasFilters,
      'Derived',
      'Authoritative'
    );

    facts[`skid.${skid.id}.hasHeatWheel`] = createFact(
      `skid.${skid.id}.hasHeatWheel`,
      `${skid.name} Has Heat Wheel`,
      skid.name,
      hasHeatWheel,
      'Derived',
      'Authoritative'
    );
  });

  return facts;
}

export function overrideFact<T>(
  registry: Record<string, Fact>,
  key: string,
  newValue: T,
  author: string = 'Detailer',
  note?: string
): Record<string, Fact> {
  const current = registry[key];
  if (!current) return registry;

  const history = [...(current.overrideHistory || [])];
  history.push({
    previousValue: current.value,
    overriddenBy: author,
    timestamp: new Date().toISOString(),
    note
  });

  return {
    ...registry,
    [key]: {
      ...current,
      value: newValue,
      status: 'ManuallyOverridden',
      confidence: 'Authoritative',
      overrideHistory: history
    }
  };
}

export function revertFact(
  registry: Record<string, Fact>,
  key: string
): Record<string, Fact> {
  const current = registry[key];
  if (!current) return registry;

  return {
    ...registry,
    [key]: {
      ...current,
      value: current.sourceRawValue,
      status: current.sourcePointer ? 'Known' : 'Derived',
      confidence: 'Authoritative'
    }
  };
}
