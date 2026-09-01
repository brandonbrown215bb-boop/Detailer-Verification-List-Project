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

  // ==========================================
  // 1. Order & Identity Domain
  // ==========================================
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

  // ==========================================
  // 2. Baserail, Curb & Skid Domain
  // ==========================================
  facts['unit.baseHeight'] = createFact(
    'unit.baseHeight',
    'Base Height (in)',
    'Baserail & Skid',
    graph.unitOptions.defaultUnitBaseHeight || 10,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultUnitBaseHeight'
  );

  facts['unit.curbrest'] = createFact(
    'unit.curbrest',
    'Curbrest Option',
    'Baserail & Skid',
    graph.curbOptions.hasCurbRest,
    'Known',
    'Authoritative',
    '/root:AHU/curbOptions/hasCurbRest'
  );

  facts['unit.lipHeight'] = createFact(
    'unit.lipHeight',
    'Upturned Lip Height (in)',
    'Baserail & Skid',
    graph.unitOptions.lipHeight || 0,
    'Known',
    'Authoritative',
    '/root:AHU/unitBaseList/unitBase/upturnedLipHeight'
  );

  facts['unit.hasUTL'] = createFact(
    'unit.hasUTL',
    'Has Upturned Lip',
    'Baserail & Skid',
    graph.unitOptions.hasUTL,
    'Derived',
    'Authoritative',
    '/root:AHU/unitBaseList/unitBase/upturnedLipHeight',
    'LipHeight > 0'
  );

  facts['unit.isTiered'] = createFact(
    'unit.isTiered',
    'Is Tiered Unit',
    'Baserail & Skid',
    !!graph.isTiered,
    'Derived',
    'Authoritative',
    '/root:AHU/segmentList'
  );

  facts['unit.isStacked'] = createFact(
    'unit.isStacked',
    'Is Stacked Unit',
    'Baserail & Skid',
    !!graph.isStacked,
    'Derived',
    'Authoritative',
    '/root:AHU/unitBaseList'
  );

  facts['unit.hasFloorDrains'] = createFact(
    'unit.hasFloorDrains',
    'Unit Has Floor Drains',
    'Baserail & Skid',
    !!graph.hasFloorDrains,
    'Derived',
    'Authoritative',
    '/root:AHU/openingList'
  );

  // Per-Base Facts
  graph.bases.forEach((b) => {
    facts[`base.${b.id}.height`] = createFact(`base.${b.id}.height`, `${b.id} Height`, 'Baserail & Skid', b.height, 'Known', 'Authoritative', `/root:AHU/unitBaseList/unitBase[unitBaseID='${b.id}']/geometry/yLength`);
    facts[`base.${b.id}.lipHeight`] = createFact(`base.${b.id}.lipHeight`, `${b.id} Lip Height`, 'Baserail & Skid', b.lipHeight, 'Known', 'Authoritative', `/root:AHU/unitBaseList/unitBase[unitBaseID='${b.id}']/upturnedLipHeight`);
    facts[`base.${b.id}.hasSubFloor`] = createFact(`base.${b.id}.hasSubFloor`, `${b.id} Has Subfloor`, 'Baserail & Skid', b.hasSubFloor, 'Known', 'Authoritative', `/root:AHU/unitBaseList/unitBase[unitBaseID='${b.id}']/hasSubFloor`);
    facts[`base.${b.id}.subFloorMaterial`] = createFact(`base.${b.id}.subFloorMaterial`, `${b.id} Subfloor Material`, 'Baserail & Skid', b.subFloorMaterialType || b.subFloorMaterial, 'Known', 'Authoritative');
    facts[`base.${b.id}.subFloorGauge`] = createFact(`base.${b.id}.subFloorGauge`, `${b.id} Subfloor Gauge`, 'Baserail & Skid', b.subFloorMaterialGauge || 22, 'Known', 'Authoritative');
    facts[`base.${b.id}.subFloorPaint`] = createFact(`base.${b.id}.subFloorPaint`, `${b.id} Subfloor Paint`, 'Baserail & Skid', b.subFloorPaintType || 'None', 'Known', 'Authoritative');
    facts[`base.${b.id}.paintType`] = createFact(`base.${b.id}.paintType`, `${b.id} Paint Finish`, 'Baserail & Skid', b.paintType, 'Known', 'Authoritative');
    facts[`base.${b.id}.floorAttachment`] = createFact(`base.${b.id}.floorAttachment`, `${b.id} Floor Attachment`, 'Baserail & Skid', b.floorAttachmentType || 'StitchWeld', 'Known', 'Authoritative');
    facts[`base.${b.id}.isUpperBase`] = createFact(`base.${b.id}.isUpperBase`, `${b.id} Is Upper Base`, 'Baserail & Skid', !!b.isUpperBase, 'Derived', 'Authoritative');
  });

  // ==========================================
  // 3. Housing, Casing, Materials & Roof Domain
  // ==========================================
  const rawHousingStyle = graph.unitOptions.materials.housingStyle || 'ISG';
  const shellTypeVal = rawHousingStyle.toUpperCase() === 'CAD' ? 'CAD' : 'ISG';
  facts['unit.shellType'] = createFact(
    'unit.shellType',
    'Shell Type',
    'Housing & Materials',
    shellTypeVal,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/housingStyle'
  );

  facts['unit.unitType'] = createFact(
    'unit.unitType',
    'Unit Type',
    'Housing & Materials',
    graph.unitOptions.unitType || 'Outdoor',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/unitType'
  );

  facts['unit.thermalBreak'] = createFact(
    'unit.thermalBreak',
    'Thermal Break',
    'Housing & Materials',
    !!graph.unitOptions.thermalBreak,
    'Derived',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/housingStyle'
  );

  facts['unit.knockdown'] = createFact(
    'unit.knockdown',
    'Knockdown Construction',
    'Housing & Materials',
    graph.unitOptions.knockdown,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/knockdown'
  );

  facts['unit.shippingProtection'] = createFact(
    'unit.shippingProtection',
    'Shipping Protection',
    'Housing & Materials',
    graph.unitOptions.shippingProtection || 'ShrinkWrap',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/shippingProtection'
  );

  facts['casing.thicknessFront'] = createFact(
    'casing.thicknessFront',
    'Front Wall Thickness (in)',
    'Housing & Materials',
    graph.unitOptions.materials.housingThicknessFront || 2.0,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/housingThicknessFront'
  );

  facts['casing.thicknessTop'] = createFact(
    'casing.thicknessTop',
    'Roof Casing Thickness (in)',
    'Housing & Materials',
    graph.unitOptions.materials.housingThicknessTop || 2.0,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/housingThicknessTop'
  );

  facts['casing.exteriorMaterial'] = createFact(
    'casing.exteriorMaterial',
    'Skin Material',
    'Housing & Materials',
    graph.unitOptions.materials.exteriorMaterialType || 'STL GALV PPC',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialType'
  );

  facts['casing.exteriorGauge'] = createFact(
    'casing.exteriorGauge',
    'Skin Gauge',
    'Housing & Materials',
    graph.unitOptions.materials.exteriorMaterialGauge || 18,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/exteriorMaterialGauge'
  );

  facts['casing.interiorMaterial'] = createFact(
    'casing.interiorMaterial',
    'Liner Material',
    'Housing & Materials',
    graph.unitOptions.materials.interiorMaterialType || 'STL GALV',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialType'
  );

  facts['casing.interiorGauge'] = createFact(
    'casing.interiorGauge',
    'Liner Gauge',
    'Housing & Materials',
    graph.unitOptions.materials.interiorMaterialGauge || 22,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/interiorMaterialGauge'
  );

  facts['casing.floorMaterial'] = createFact(
    'casing.floorMaterial',
    'Floor Material',
    'Housing & Materials',
    graph.unitOptions.materials.floorMaterialType || 'STL GALV',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialType'
  );

  facts['casing.floorGauge'] = createFact(
    'casing.floorGauge',
    'Floor Gauge',
    'Housing & Materials',
    graph.unitOptions.materials.floorMaterialGauge || 16,
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialGauge'
  );

  facts['casing.floorGaugeString'] = createFact(
    'casing.floorGaugeString',
    'Floor Gauge String',
    'Housing & Materials',
    graph.unitOptions.materials.floorMaterialGaugeString || '16',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/floorMaterialGauge'
  );

  facts['casing.insulationType'] = createFact(
    'casing.insulationType',
    'Insulation Type',
    'Housing & Materials',
    graph.unitOptions.materials.insulationType || 'Foam',
    'Known',
    'Authoritative',
    '/root:AHU/unitOptions/defaultConstructionOptions/insulationType'
  );

  facts['roof.hasSlopedRoof'] = createFact(
    'roof.hasSlopedRoof',
    'Has Sloped Roof',
    'Housing & Materials',
    graph.roofOptions.hasSlopedRoof,
    'Known',
    'Authoritative',
    '/root:AHU/roofOptions/hasSlopedRoof'
  );

  const rawPeak = graph.roofOptions.roofPeak || 'Internal (Center)';
  const normalizedPeak = rawPeak.toLowerCase().includes('center') || rawPeak.toLowerCase().includes('internal')
    ? 'Internal (Center)'
    : (rawPeak.toLowerCase() === 'left' ? 'Left' : (rawPeak.toLowerCase() === 'right' ? 'Right' : rawPeak));

  facts['roof.roofPeak'] = createFact(
    'roof.roofPeak',
    'Roof Peak Style',
    'Housing & Materials',
    normalizedPeak,
    'Derived',
    'Authoritative',
    '/root:AHU/roofOptions/roofSlopeHighSide'
  );

  facts['roof.roofSlope'] = createFact(
    'roof.roofSlope',
    'Roof Slope (in/ft)',
    'Housing & Materials',
    graph.roofOptions.roofSlope || 0.25,
    'Known',
    'Authoritative',
    '/root:AHU/roofOptions/roofSlope'
  );

  facts['roof.roofPeakZDim'] = createFact(
    'roof.roofPeakZDim',
    'Roof Peak Z Coordinate (in)',
    'Housing & Materials',
    graph.roofOptions.roofPeakZDim || 97,
    'Known',
    'Authoritative',
    '/root:AHU/roofOptions/roofPeakZDim'
  );

  // ==========================================
  // 4. Opening Schedule Domain
  // ==========================================
  const doors = graph.doors || [];
  const dampers = graph.dampers || [];
  const floorDrains = graph.floorDrains || [];

  facts['opening.totalCount'] = createFact(
    'opening.totalCount',
    'Total Openings Count',
    'Opening Schedule',
    doors.length + dampers.length + floorDrains.length,
    'Derived',
    'Authoritative',
    '/root:AHU/openingList'
  );

  facts['door.totalCount'] = createFact('door.totalCount', 'Total Access Doors', 'Opening Schedule', doors.length, 'Derived', 'Authoritative');
  facts['damper.totalCount'] = createFact('damper.totalCount', 'Total Dampers', 'Opening Schedule', dampers.length, 'Derived', 'Authoritative');
  facts['floorDrain.totalCount'] = createFact('floorDrain.totalCount', 'Total Floor Drains', 'Opening Schedule', floorDrains.length, 'Derived', 'Authoritative');

  doors.forEach(d => {
    facts[`door.${d.id}.width`] = createFact(`door.${d.id}.width`, `${d.id} Width`, 'Opening Schedule', d.width, 'Known', 'Authoritative');
    facts[`door.${d.id}.height`] = createFact(`door.${d.id}.height`, `${d.id} Height`, 'Opening Schedule', d.height, 'Known', 'Authoritative');
    facts[`door.${d.id}.swing`] = createFact(`door.${d.id}.swing`, `${d.id} Swing`, 'Opening Schedule', d.swing, 'Known', 'Authoritative');
    facts[`door.${d.id}.hingeSide`] = createFact(`door.${d.id}.hingeSide`, `${d.id} Hinge Side`, 'Opening Schedule', d.hingeSide, 'Known', 'Authoritative');
    facts[`door.${d.id}.hasWindow`] = createFact(`door.${d.id}.hasWindow`, `${d.id} Has Window`, 'Opening Schedule', d.hasWindow, 'Known', 'Authoritative');
    facts[`door.${d.id}.segmentId`] = createFact(`door.${d.id}.segmentId`, `${d.id} Host Segment`, 'Opening Schedule', d.segmentId, 'Known', 'Authoritative');
  });

  dampers.forEach(d => {
    facts[`damper.${d.id}.type`] = createFact(`damper.${d.id}.type`, `${d.id} Type`, 'Opening Schedule', d.damperType, 'Known', 'Authoritative');
    facts[`damper.${d.id}.actuator`] = createFact(`damper.${d.id}.actuator`, `${d.id} Actuator`, 'Opening Schedule', d.actuatorType, 'Known', 'Authoritative');
    facts[`damper.${d.id}.width`] = createFact(`damper.${d.id}.width`, `${d.id} Width`, 'Opening Schedule', d.width, 'Known', 'Authoritative');
    facts[`damper.${d.id}.height`] = createFact(`damper.${d.id}.height`, `${d.id} Height`, 'Opening Schedule', d.height, 'Known', 'Authoritative');
  });

  floorDrains.forEach(fd => {
    facts[`floorDrain.${fd.id}.type`] = createFact(`floorDrain.${fd.id}.type`, `${fd.id} Drain Type`, 'Opening Schedule', fd.type, 'Known', 'Authoritative');
    facts[`floorDrain.${fd.id}.pipingMaterial`] = createFact(`floorDrain.${fd.id}.pipingMaterial`, `${fd.id} Piping Material`, 'Opening Schedule', fd.pipingMaterial, 'Known', 'Authoritative');
    facts[`floorDrain.${fd.id}.connectionDiameter`] = createFact(`floorDrain.${fd.id}.connectionDiameter`, `${fd.id} Connection Diameter`, 'Opening Schedule', fd.connectionDiameter, 'Known', 'Authoritative');
    facts[`floorDrain.${fd.id}.holeDiameter`] = createFact(`floorDrain.${fd.id}.holeDiameter`, `${fd.id} Floor Hole Diameter`, 'Opening Schedule', fd.holeDiameter, 'Derived', 'Authoritative');
    facts[`floorDrain.${fd.id}.segmentId`] = createFact(`floorDrain.${fd.id}.segmentId`, `${fd.id} Host Segment`, 'Opening Schedule', fd.segmentId, 'Known', 'Authoritative');
  });

  // ==========================================
  // 5. Component Sub-Trees Domain
  // ==========================================
  graph.segments.forEach(s => {
    if (s.fanConfig) {
      facts[`fan.${s.id}.isFanArray`] = createFact(`fan.${s.id}.isFanArray`, `${s.id} Is Fan Array`, 'Components', s.fanConfig.isFanArray, 'Known', 'Authoritative');
      facts[`fan.${s.id}.arrayGrid`] = createFact(`fan.${s.id}.arrayGrid`, `${s.id} Array Grid`, 'Components', s.fanConfig.arrayGrid, 'Known', 'Authoritative');
      facts[`fan.${s.id}.hasRedundancy`] = createFact(`fan.${s.id}.hasRedundancy`, `${s.id} Has Fan Redundancy`, 'Components', s.fanConfig.hasRedundancy, 'Known', 'Authoritative');
      facts[`fan.${s.id}.hasStand`] = createFact(`fan.${s.id}.hasStand`, `${s.id} Has Fan Stand`, 'Components', s.fanConfig.hasStand, 'Known', 'Authoritative');
      facts[`fan.${s.id}.hasRemovalRail`] = createFact(`fan.${s.id}.hasRemovalRail`, `${s.id} Has Removal Rail`, 'Components', s.fanConfig.hasMotorRemovalRail, 'Known', 'Authoritative');
      facts[`fan.${s.id}.isolationType`] = createFact(`fan.${s.id}.isolationType`, `${s.id} Isolation Type`, 'Components', s.fanConfig.isolationType, 'Known', 'Authoritative');
      facts[`fan.${s.id}.motorHp`] = createFact(`fan.${s.id}.motorHp`, `${s.id} Motor HP`, 'Components', s.fanConfig.motorHp, 'Known', 'Authoritative');
      facts[`fan.${s.id}.voltage`] = createFact(`fan.${s.id}.voltage`, `${s.id} Voltage`, 'Components', s.fanConfig.voltage, 'Known', 'Authoritative');
    }

    if (s.coilConfig) {
      facts[`coil.${s.id}.bulkheadMaterial`] = createFact(`coil.${s.id}.bulkheadMaterial`, `${s.id} Bulkhead Material`, 'Components', s.coilConfig.bulkheadMaterial, 'Known', 'Authoritative');
      facts[`coil.${s.id}.hasStackingRack`] = createFact(`coil.${s.id}.hasStackingRack`, `${s.id} Has Stacking Rack`, 'Components', s.coilConfig.hasStackingRack, 'Known', 'Authoritative');
      facts[`coil.${s.id}.dripPanMaterial`] = createFact(`coil.${s.id}.dripPanMaterial`, `${s.id} Drip Pan Material`, 'Components', s.coilConfig.dripPanMaterial, 'Known', 'Authoritative');
      facts[`coil.${s.id}.staggeredOverlap`] = createFact(`coil.${s.id}.staggeredOverlap`, `${s.id} Staggered Overlap`, 'Components', s.coilConfig.staggeredOverlap, 'Known', 'Authoritative');
      facts[`coil.${s.id}.connectionHand`] = createFact(`coil.${s.id}.connectionHand`, `${s.id} Connection Hand`, 'Components', s.coilConfig.connectionHand, 'Known', 'Authoritative');
    }

    if (s.filterConfig) {
      facts[`filter.${s.id}.loadMethod`] = createFact(`filter.${s.id}.loadMethod`, `${s.id} Load Method`, 'Components', s.filterConfig.loadMethod, 'Known', 'Authoritative');
      facts[`filter.${s.id}.bulkheadMaterial`] = createFact(`filter.${s.id}.bulkheadMaterial`, `${s.id} Bulkhead Material`, 'Components', s.filterConfig.bulkheadMaterial, 'Known', 'Authoritative');
      facts[`filter.${s.id}.gaugeType`] = createFact(`filter.${s.id}.gaugeType`, `${s.id} Gauge Type`, 'Components', s.filterConfig.gaugeType, 'Known', 'Authoritative');
      facts[`filter.${s.id}.gaugeDoorId`] = createFact(`filter.${s.id}.gaugeDoorId`, `${s.id} Gauge Door ID`, 'Components', s.filterConfig.gaugeDoorId, 'Known', 'Authoritative');
    }

    if (s.heatWheelConfig) {
      facts[`wheel.${s.id}.hasPurge`] = createFact(`wheel.${s.id}.hasPurge`, `${s.id} Has Purge`, 'Components', s.heatWheelConfig.hasPurge, 'Known', 'Authoritative');
      facts[`wheel.${s.id}.mediaType`] = createFact(`wheel.${s.id}.mediaType`, `${s.id} Media Type`, 'Components', s.heatWheelConfig.mediaType, 'Known', 'Authoritative');
      facts[`wheel.${s.id}.allowVariableSpeed`] = createFact(`wheel.${s.id}.allowVariableSpeed`, `${s.id} Variable Speed`, 'Components', s.heatWheelConfig.allowVariableSpeed, 'Known', 'Authoritative');
    }
  });

  // Motor Controls
  graph.motorControls.forEach(m => {
    facts[`motorControl.${m.name}.disconnectSize`] = createFact(`motorControl.${m.name}.disconnectSize`, `${m.name} Disconnect Size (A)`, 'Components', m.disconnectSize, 'Known', 'Authoritative');
    facts[`motorControl.${m.name}.fla`] = createFact(`motorControl.${m.name}.fla`, `${m.name} FLA`, 'Components', m.fla, 'Known', 'Authoritative');
    facts[`motorControl.${m.name}.voltage`] = createFact(`motorControl.${m.name}.voltage`, `${m.name} Voltage`, 'Components', m.voltage, 'Known', 'Authoritative');
    facts[`motorControl.${m.name}.hp`] = createFact(`motorControl.${m.name}.hp`, `${m.name} HP`, 'Components', m.hp, 'Known', 'Authoritative');
    facts[`motorControl.${m.name}.unitSide`] = createFact(`motorControl.${m.name}.unitSide`, `${m.name} Unit Side`, 'Components', m.unitSide, 'Known', 'Authoritative');
  });

  // ==========================================
  // 6. Ratings & Quality Domain
  // ==========================================
  facts['unit.isSeismic'] = createFact(
    'unit.isSeismic',
    'Seismic Certification Required',
    'Ratings & Options',
    !!graph.unitOptions.isSeismic,
    'Derived',
    'Authoritative',
    '/root:AHU/unitOptions/unitConstructionType'
  );

  facts['unit.noa'] = createFact(
    'unit.noa',
    'Notice of Acceptance (NOA)',
    'Ratings & Options',
    !!graph.unitOptions.noa,
    'Derived',
    'Authoritative',
    '/root:AHU/unitOptions/unitConstructionType'
  );

  facts['unit.deflectionTest'] = createFact(
    'unit.deflectionTest',
    'Deflection Testing Spec',
    'Ratings & Options',
    graph.testingOptions?.deflectionTest || 'None',
    'Known',
    'Authoritative',
    '/root:AHU/testingOptions/deflectionTest'
  );

  facts['unit.totalWeight'] = createFact(
    'unit.totalWeight',
    'Total Unit Weight (lbs)',
    'Ratings & Options',
    graph.unitWeight,
    'Known',
    'Authoritative',
    '/root:AHU/unitWeight'
  );

  facts['unit.totalStaticPressure'] = createFact(
    'unit.totalStaticPressure',
    'Total Static Pressure (in.w.g.)',
    'Ratings & Options',
    graph.totalStaticPressure,
    'Known',
    'Authoritative',
    '/root:AHU/totalStaticPressure'
  );

  // Per-Skid Facts
  graph.skids.forEach((skid) => {
    const skidSegs = graph.segments.filter(s => skid.segmentIds.includes(s.id));
    const hasSplit = graph.skids.length > 1;
    const hasDrainPan = skidSegs.some(s => s.tag === 'segment_CC' || s.internals.some(i => i.toLowerCase().includes('drain')));
    const hasFans = skidSegs.some(s => s.typeCode === 'FE' || s.typeCode === 'FR' || s.typeCode === 'FS');
    const hasCoils = skidSegs.some(s => s.typeCode === 'CC' || s.typeCode === 'HC');
    const hasFilters = skidSegs.some(s => s.typeCode === 'FF' || s.typeCode === 'RF' || s.typeCode === 'AF');
    const hasHeatWheel = skidSegs.some(s => s.typeCode === 'HW');

    const skidBases = graph.bases.filter(b => skid.baseIds.includes(b.id));
    const hasSubFloor = skidBases.some(b => b.hasSubFloor);
    const drainCount = skidSegs.reduce((acc, s) => acc + (s.floorDrains?.length || 0), 0);

    facts[`skid.${skid.id}.hasSplit`] = createFact(
      `skid.${skid.id}.hasSplit`,
      `${skid.name} Has Shipping Split`,
      skid.name,
      hasSplit,
      'Derived',
      'Authoritative'
    );

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

    facts[`skid.${skid.id}.hasSubFloor`] = createFact(
      `skid.${skid.id}.hasSubFloor`,
      `${skid.name} Has Subfloor`,
      skid.name,
      hasSubFloor,
      'Derived',
      'Authoritative'
    );

    facts[`skid.${skid.id}.floorDrainCount`] = createFact(
      `skid.${skid.id}.floorDrainCount`,
      `${skid.name} Floor Drain Count`,
      skid.name,
      drainCount,
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
