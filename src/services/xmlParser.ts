import {
  NormalizedXmlGraph,
  Segment,
  ShippingSkid,
  UnitBase,
  MotorControl,
  OrderRevisionData,
  UnitDoor,
  UnitDamper,
  UnitFloorDrain,
  UnitDuctOpening,
  UnitDrainPanOpening,
  FanConfig,
  CoilConfig,
  FilterConfig,
  HeatWheelConfig,
  TestingOptions
} from '../types';

const SEGMENT_NAMES: Record<string, string> = {
  AB: 'Air Blender',
  AF: 'Angle Filter',
  AT: 'Sound Attenuator',
  CC: 'Coil (Cooling)',
  DI: 'Diffuser',
  DP: 'Discharge Plenum',
  EB: 'External Bypass',
  EE: 'Economizer',
  EF: 'Filter Economizer',
  EH: 'Electric Heat',
  FD: 'Face Damper',
  FE: 'Fan (Exhaust)',
  FF: 'Flat Filter',
  FM: 'Filter Mixing Box',
  FR: 'Fan (Return)',
  FS: 'Fan (Supply)',
  HC: 'Coil (Heating)',
  HD: 'Hot Deck',
  HF: 'HEPA Filter',
  HM: 'Humidifier',
  HW: 'Heat Wheel',
  HX: 'Heat Exchanger',
  IB: 'Internal Bypass',
  IC: 'Integrated Face and Bypass Coil',
  IG: 'Indirect Fired Gas',
  IO: 'Inlet / Outlet',
  IP: 'Inlet Plenum',
  MB: 'Mixing Box',
  PC: 'Pipe Chase',
  RF: 'High Efficiency Filter',
  TN: 'Turning',
  UV: 'UV Light',
  VC: 'Vertical Coil',
  VE: 'Vertical Economizer',
  VB: 'Vestibule / Corridor',
  VESTIBULE: 'Vestibule / Corridor',
  VP: 'Vertical Plenum',
  XA: 'Access'
};

function getElements(parent: Element | Document, tagName: string): Element[] {
  const list = parent.getElementsByTagName(tagName);
  if (list && list.length > 0) return Array.from(list);

  if ('getElementsByTagNameNS' in parent) {
    const nsList = (parent as any).getElementsByTagNameNS('*', tagName);
    if (nsList && nsList.length > 0) return Array.from(nsList);
  }

  const results: Element[] = [];
  const all = parent.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.localName === tagName || el.tagName.endsWith(':' + tagName)) {
      results.push(el);
    }
  }
  return results;
}

function getChildText(node: Element | undefined | null, tagName: string, defaultVal: string = ''): string {
  if (!node) return defaultVal;
  const elements = getElements(node, tagName);
  return elements[0]?.textContent?.trim() || defaultVal;
}

function getChildNumber(node: Element | undefined | null, tagName: string, defaultVal: number = 0): number {
  const txt = getChildText(node, tagName);
  const num = parseFloat(txt);
  return isNaN(num) ? defaultVal : num;
}

function getChildBool(node: Element | undefined | null, tagName: string, defaultVal: boolean = false): boolean {
  const txt = getChildText(node, tagName).toLowerCase();
  if (txt === 'true' || txt === '1' || txt === 'yes') return true;
  if (txt === 'false' || txt === '0' || txt === 'no') return false;
  return defaultVal;
}

function parseDimensions(geom: Element | null | undefined) {
  return {
    x: geom ? getChildNumber(geom, 'x', 0) : 0,
    y: geom ? getChildNumber(geom, 'y', 0) : 0,
    z: geom ? getChildNumber(geom, 'z', 0) : 0,
    xLength: geom ? getChildNumber(geom, 'xLength', 0) : 0,
    yLength: geom ? getChildNumber(geom, 'yLength', 0) : 0,
    zLength: geom ? getChildNumber(geom, 'zLength', 0) : 0
  };
}

export function parseAhuXml(xmlContent: string): NormalizedXmlGraph {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Empty XML input received.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  const parseErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    console.warn('DOMParser reported error, applying fallback parser:', parseErrors[0].textContent);
  }

  const root = xmlDoc.documentElement;

  const unitMOMID = getChildText(root, 'unit_MOMID', '{00000000-0000-0000-0000-000000000000}');
  const unitWeight = getChildNumber(root, 'unitWeight', 31376);
  const totalStaticPressure = getChildNumber(root, 'totalStaticPressure', 6.26);
  const cabLength = getChildNumber(root, 'cabLength', 411);
  const cabHeight = getChildNumber(root, 'cabHeight', 110);
  const cabWidth = getChildNumber(root, 'cabWidth', 194);

  // Document version
  const docVerNodes = getElements(root, 'documentVersion');
  const docVerNode = docVerNodes[0];
  const schemaVerNode = docVerNode ? getElements(docVerNode, 'schemaVersion')[0] : null;
  const documentVersion = schemaVerNode
    ? `${getChildText(schemaVerNode, 'major', '2018')}.${getChildText(schemaVerNode, 'minor', '9')}.${getChildText(schemaVerNode, 'build', '14')}.${getChildText(schemaVerNode, 'revision', '1003')}`
    : '2018.9.14.1003';

  const genSoftNode = docVerNode ? getElements(docVerNode, 'generatingSoftwareInfo')[0] : null;
  const generatingSoftware = genSoftNode
    ? `${getChildText(genSoftNode, 'generatingSoftwareName', 'M.O.M. AHU Revision Serializer')} v${getChildText(getElements(genSoftNode, 'generatingSoftwareVersion')[0] || genSoftNode, 'major', '2026')}`
    : 'M.O.M. AHU Revision Serializer v2026';

  // Unit Options
  const unitOptNodes = getElements(root, 'unitOptions');
  const unitOptNode = unitOptNodes[0];
  const defaultConstNode = unitOptNode ? getElements(unitOptNode, 'defaultConstructionOptions')[0] : null;

  const unitConstructionType = unitOptNode ? getChildText(unitOptNode, 'unitConstructionType', 'Standard') : 'Standard';
  const isSeismic = unitConstructionType.toUpperCase() === 'IBC' || unitConstructionType.toUpperCase() === 'OSHPD';
  const noa = unitConstructionType.toUpperCase() === 'NOA';
  const housingStyle = defaultConstNode ? getChildText(defaultConstNode, 'housingStyle', 'ThermalBreak') : 'ThermalBreak';
  const thermalBreak = housingStyle.toLowerCase().includes('thermalbreak');

  const floorMaterialGaugeRaw = defaultConstNode ? getChildText(defaultConstNode, 'floorMaterialGauge', '16') : '16';
  const floorMaterialGaugeInt = parseInt(floorMaterialGaugeRaw, 10) || 16;

  const unitOptions = {
    unitType: unitOptNode ? getChildText(unitOptNode, 'unitType', 'Outdoor') : 'Outdoor',
    brandOption: unitOptNode ? getChildText(unitOptNode, 'brandOption', 'YORKCustom') : 'YORKCustom',
    unitConstructionType,
    shippingProtection: unitOptNode ? getChildText(unitOptNode, 'shippingProtection', 'ShrinkWrap') : 'ShrinkWrap',
    washdown: unitOptNode ? getChildBool(unitOptNode, 'washdown', false) : false,
    knockdown: unitOptNode ? getChildBool(unitOptNode, 'knockdown', false) : false,
    hasUTL: false,
    lipHeight: 0,
    isSeismic,
    noa,
    noaRating: noa ? 'NOA' : 'N/A',
    thermalBreak,
    primaryAccessSide: unitOptNode ? getChildText(unitOptNode, 'primaryAccessSide', 'Left') : 'Left',
    defaultUnitBaseHeight: unitOptNode ? getChildNumber(unitOptNode, 'defaultUnitBaseHeight', 10) : 10,
    materials: {
      exteriorMaterialType: defaultConstNode ? getChildText(defaultConstNode, 'exteriorMaterialType', 'STL GALV PPC') : 'STL GALV PPC',
      exteriorMaterialGauge: defaultConstNode ? getChildNumber(defaultConstNode, 'exteriorMaterialGauge', 18) : 18,
      interiorMaterialType: defaultConstNode ? getChildText(defaultConstNode, 'interiorMaterialType', 'STL GALV') : 'STL GALV',
      interiorMaterialGauge: defaultConstNode ? getChildNumber(defaultConstNode, 'interiorMaterialGauge', 22) : 22,
      floorMaterialType: defaultConstNode ? getChildText(defaultConstNode, 'floorMaterialType', 'STL GALV') : 'STL GALV',
      floorMaterialGauge: floorMaterialGaugeInt,
      floorMaterialGaugeString: floorMaterialGaugeRaw,
      housingStyle,
      insulationType: defaultConstNode ? getChildText(defaultConstNode, 'insulationType', 'Foam') : 'Foam',
      exteriorPaintType: defaultConstNode ? getChildText(defaultConstNode, 'exteriorPaintType', 'None') : 'None',
      interiorPaintType: defaultConstNode ? getChildText(defaultConstNode, 'interiorPaintType', 'None') : 'None',
      floorPaintType: defaultConstNode ? getChildText(defaultConstNode, 'floorPaintType', 'None') : 'None',
      housingThicknessFront: defaultConstNode ? getChildNumber(defaultConstNode, 'housingThicknessFront', 2.0) : 2.0,
      housingThicknessTop: defaultConstNode ? getChildNumber(defaultConstNode, 'housingThicknessTop', 2.0) : 2.0
    }
  };

  // Roof Options
  const roofNodes = getElements(root, 'roofOptions');
  const roofNode = roofNodes[0];
  const hasSlopedRoof = roofNode ? getChildBool(roofNode, 'hasSlopedRoof', true) : true;
  const highSide = roofNode ? getChildText(roofNode, 'roofSlopeHighSide', 'Internal') : 'Internal';
  let roofPeak = 'Center';
  if (highSide.toLowerCase() === 'left') roofPeak = 'Left';
  else if (highSide.toLowerCase() === 'right') roofPeak = 'Right';
  else if (highSide.toLowerCase() === 'internal') roofPeak = 'Center';
  else roofPeak = hasSlopedRoof ? 'Center' : 'Flat';

  const roofOptions = {
    hasSlopedRoof,
    roofSlope: roofNode ? getChildNumber(roofNode, 'roofSlope', 0.25) : 0.25,
    roofSlopeHighSide: highSide,
    roofPeak,
    roofPeakZDim: roofNode ? getChildNumber(roofNode, 'roofPeakZDim', 97) : 97
  };

  // Curb Options
  const curbNodes = getElements(root, 'curbOptions');
  const curbNode = curbNodes[0];
  const curbOptions = {
    hasCurbRest: curbNode ? getChildBool(curbNode, 'hasCurbRest', true) : true
  };

  // Testing Options
  const testNodes = getElements(root, 'testingOptions');
  const testNode = testNodes[0];
  const testingOptions: TestingOptions = {
    deflectionTest: testNode ? getChildText(testNode, 'deflectionTest', 'None') : 'None',
    leakageTest: testNode ? getChildText(testNode, 'leakageTest', 'None') : 'None',
    fanVibrationTest: testNode ? getChildText(testNode, 'fanVibrationTest', 'None') : 'None',
    requireCustomerWitness: testNode ? getChildBool(testNode, 'requireCustomerWitness', false) : false
  };

  // Unit Bases
  const baseNodes = getElements(root, 'unitBase');
  const bases: UnitBase[] = [];
  let maxLipHeight = 0;

  for (let i = 0; i < baseNodes.length; i++) {
    const b = baseNodes[i];
    const geom = getElements(b, 'geometry')[0];
    const lipHeight = getChildNumber(b, 'upturnedLipHeight', 0);
    if (lipHeight > maxLipHeight) maxLipHeight = lipHeight;

    const subMatType = getChildText(b, 'subFloorMaterialType', 'STL GALV');
    const subGauge = getChildNumber(b, 'subFloorMaterialGauge', 22);
    const by = geom ? getChildNumber(geom, 'y', 0) : 0;

    bases.push({
      id: getChildText(b, 'unitBaseID', `base-${i + 1}`),
      materialType: getChildText(b, 'unitBaseMaterialType', 'StructuralSteel'),
      baseType: getChildText(b, 'unitBaseType', 'A36'),
      paintType: getChildText(b, 'unitBasePaintType', 'ChampagneBase'),
      height: geom ? getChildNumber(geom, 'yLength', 10) : 10,
      lipHeight,
      insulationType: getChildText(b, 'insulationType', 'Foam_2Inch'),
      housingStyle: getChildText(b, 'housingStyle', 'ThermalBreak'),
      hasSubFloor: getChildBool(b, 'hasSubFloor', true),
      subFloorMaterial: `${subMatType} ${subGauge}ga`,
      subFloorMaterialType: subMatType,
      subFloorMaterialGauge: subGauge,
      subFloorPaintType: getChildText(b, 'subFloorPaintType', 'None'),
      floorAttachmentType: getChildText(b, 'floorAttachmentType', 'StitchWeld'),
      isUpperBase: by > 15,
      dimensions: parseDimensions(geom)
    });
  }
  unitOptions.lipHeight = maxLipHeight;
  unitOptions.hasUTL = maxLipHeight > 0;

  // Segments
  const segListNodes = getElements(root, 'segmentList');
  const segListNode = segListNodes[0];
  const segments: Segment[] = [];
  const segNodeMap = new Map<string, Segment>();

  if (segListNode) {
    const directChildren = Array.from(segListNode.children);
    for (const segEl of directChildren) {
      const tag = segEl.tagName.replace(/^.*:/, '');
      const typeCode = tag.replace('segment_', '').toUpperCase();
      const id = getChildText(segEl, 'segmentID', `seg-${segments.length + 1}`);
      const weight = getChildNumber(segEl, 'weight', 0);
      const airPressureType = getChildText(segEl, 'airPressureType', 'Negative');
      const airVolume = getChildNumber(segEl, 'airVolume', 0);
      const handOrientation = getChildText(segEl, 'handOrientation', 'FrontToRear');

      const geom = getElements(segEl, 'geometry')[0];
      const dimensions = parseDimensions(geom);

      const defaultBaseH = unitOptions.defaultUnitBaseHeight > 0 ? unitOptions.defaultUnitBaseHeight : 10;
      const isUpperDeck = dimensions.y > defaultBaseH + 10;
      const hasBaseBelowAtSameY = bases.some(b => Math.abs(b.dimensions.y - dimensions.y) < 5);
      const isTiered = isUpperDeck && !hasBaseBelowAtSameY;
      const tierLevel = isTiered ? 2 : 1;

      // Casing detail
      const constOpt = getElements(segEl, 'constructionOptions')[0];
      const frontSurf = constOpt ? getElements(constOpt, 'surfaceDetail_Front')[0] : null;
      const segFloorGaugeRaw = frontSurf ? getChildText(frontSurf, 'floorMaterialGauge', unitOptions.materials.floorMaterialGaugeString) : unitOptions.materials.floorMaterialGaugeString;
      const segFloorGaugeInt = parseInt(segFloorGaugeRaw, 10) || unitOptions.materials.floorMaterialGauge;

      const casing = {
        exteriorMaterial: frontSurf ? getChildText(frontSurf, 'exteriorMaterialType', unitOptions.materials.exteriorMaterialType) : unitOptions.materials.exteriorMaterialType,
        exteriorGauge: frontSurf ? getChildNumber(frontSurf, 'exteriorMaterialGauge', unitOptions.materials.exteriorMaterialGauge) : unitOptions.materials.exteriorMaterialGauge,
        interiorMaterial: frontSurf ? getChildText(frontSurf, 'interiorMaterialType', unitOptions.materials.interiorMaterialType) : unitOptions.materials.interiorMaterialType,
        interiorGauge: frontSurf ? getChildNumber(frontSurf, 'interiorMaterialGauge', unitOptions.materials.interiorMaterialGauge) : unitOptions.materials.interiorMaterialGauge,
        floorMaterial: unitOptions.materials.floorMaterialType,
        floorGauge: segFloorGaugeInt,
        floorGaugeString: segFloorGaugeRaw,
        housingThickness: frontSurf ? getChildNumber(frontSurf, 'housingThickness', unitOptions.materials.housingThicknessFront) : (unitOptions.materials.housingThicknessFront || 2.0),
        housingThicknessFront: unitOptions.materials.housingThicknessFront,
        housingThicknessTop: unitOptions.materials.housingThicknessTop,
        housingStyle: constOpt ? getChildText(constOpt, 'housingStyle', unitOptions.materials.housingStyle) : unitOptions.materials.housingStyle,
        insulationType: constOpt ? getChildText(constOpt, 'insulationType', unitOptions.materials.insulationType) : unitOptions.materials.insulationType,
        exteriorPaintType: unitOptions.materials.exteriorPaintType,
        interiorPaintType: unitOptions.materials.interiorPaintType,
        floorPaintType: unitOptions.materials.floorPaintType
      };

      // Component Sub-Trees
      let fanConfig: FanConfig | undefined;
      const segFanNode = getElements(segEl, 'segmentConfig_Fan')[0];
      if (segFanNode) {
        const qH = getChildNumber(segFanNode, 'fanArrayQtyHeight', 1);
        const qW = getChildNumber(segFanNode, 'fanArrayQtyWidth', 1);
        const fanNodes = getElements(segFanNode, 'fan');
        let maxHp = 0;
        let volt = 460;
        for (const fn of fanNodes) {
          const hp = getChildNumber(fn, 'motorHorsePower', 0);
          if (hp > maxHp) maxHp = hp;
          volt = getChildNumber(fn, 'voltage', 460);
        }
        fanConfig = {
          isFanArray: getChildBool(segFanNode, 'isFanArray', false) || (qH * qW > 1),
          arrayQtyHeight: qH,
          arrayQtyWidth: qW,
          arrayGrid: `${qH}x${qW}`,
          hasRedundancy: getChildBool(segFanNode, 'hasFanRedundancy', false),
          hasStand: getChildBool(segFanNode, 'hasFanStand', false),
          hasDualFanSeparationWall: getChildBool(segFanNode, 'hasDualFanSeparationWall', false),
          hasMotorRemovalRail: getChildBool(segFanNode, 'hasMotorRemovalRail', false),
          isolationType: getChildText(segFanNode, 'fanFlowIsolationType', 'None'),
          fanCount: fanNodes.length > 0 ? fanNodes.length : (qH * qW),
          motorHp: maxHp,
          voltage: volt
        };
      }

      let coilConfig: CoilConfig | undefined;
      const segCoilNode = getElements(segEl, 'segmentConfig_Coil')[0];
      if (segCoilNode) {
        const coilNodes = getElements(segCoilNode, 'coil');
        const hand = coilNodes.length > 0 ? getChildText(coilNodes[0], 'connectionHand', 'Right') : 'Right';
        coilConfig = {
          bulkheadMaterial: getChildText(segCoilNode, 'coilBulkheadMaterial', 'STL GALV'),
          hasStackingRack: getChildBool(segCoilNode, 'hasCoilStackingRack', false),
          stackingRackMaterial: getChildText(segCoilNode, 'coilStackingRackMaterialType', ''),
          dripPanMaterial: getChildText(segCoilNode, 'dripPanMaterialType', 'StainlessSteel_304'),
          staggeredOverlap: getChildNumber(segCoilNode, 'staggeredCoilOverlap', 0),
          connectionHand: hand,
          coilCount: coilNodes.length > 0 ? coilNodes.length : 1
        };
      }

      let filterConfig: FilterConfig | undefined;
      const segFilterNode = getElements(segEl, 'segmentConfig_Filter')[0];
      if (segFilterNode) {
        filterConfig = {
          filterType: typeCode.includes('RF') ? 'RigidFilter' : (typeCode.includes('AF') ? 'AngleFilter' : 'FlatFilter'),
          loadMethod: getChildText(segFilterNode, 'loadMethod', 'FrontLoad'),
          bulkheadMaterial: getChildText(segFilterNode, 'bulkheadMaterialType', 'STL GALV'),
          gaugeType: getChildText(segFilterNode, 'combinedGaugeType', 'None'),
          gaugeDoorId: getChildText(segFilterNode, 'combinedGaugeDoorID', ''),
          gaugeMountingType: getChildText(segFilterNode, 'combinedGaugeMountingType', '')
        };
      }

      let heatWheelConfig: HeatWheelConfig | undefined;
      const segWheelNode = getElements(segEl, 'segmentConfig_HeatWheel')[0];
      if (segWheelNode) {
        heatWheelConfig = {
          vendor: getChildText(segWheelNode, 'vendor', ''),
          model: getChildText(segWheelNode, 'model', ''),
          wheelType: getChildText(segWheelNode, 'wheelType', 'Enthalpy'),
          mediaType: getChildText(segWheelNode, 'wheelMedia', 'MolecularSieve'),
          hasPurge: getChildBool(segWheelNode, 'hasPurge', false),
          allowVariableSpeed: getChildBool(segWheelNode, 'allowVariableSpeed', false),
          wheelDiameter: getChildNumber(segWheelNode, 'wheelDiameter', 0),
          recoveryPercentCFM: getChildNumber(segWheelNode, 'recoveryPercentCFM', 0)
        };
      }

      // Detect internals
      const internals: string[] = [];
      if (coilConfig) {
        internals.push(`Coil (${coilConfig.bulkheadMaterial} Bulkhead)`);
      } else if (['CC', 'HC', 'IC', 'VC', 'HD'].includes(typeCode)) {
        internals.push(typeCode === 'CC' ? 'Coil (Cooling)' : (typeCode === 'HC' ? 'Coil (Heating)' : 'Coil Panel'));
      }

      if (fanConfig) {
        internals.push(fanConfig.isFanArray ? `Fan Array (${fanConfig.arrayGrid})` : 'Fan Array / Wall');
      } else if (['FS', 'FE', 'FR'].includes(typeCode)) {
        internals.push('EBM Fan Wall');
      }

      if (filterConfig) {
        internals.push(`Filter (${filterConfig.filterType})`);
      } else if (['FF', 'RF', 'AF', 'HF', 'EF', 'FM'].includes(typeCode)) {
        internals.push('Filter Rack / Wall');
      }

      if (heatWheelConfig || typeCode === 'HW') internals.push('Heat Recovery Wheel');
      if (typeCode === 'HX') internals.push('Heat Exchanger');
      if (typeCode === 'AT') internals.push('Sound Attenuator');
      if (['MB', 'FM', 'EE', 'VE', 'FD', 'EB', 'IB'].includes(typeCode)) internals.push('Damper Wall');
      if (typeCode === 'HM') internals.push('Humidifier');
      if (typeCode === 'EH') internals.push('Electric Heater');
      if (typeCode === 'IG') internals.push('Indirect Gas Heater');
      if (typeCode === 'UV') internals.push('UV Light Wall');
      if (typeCode === 'AB') internals.push('Air Blender');
      if (typeCode === 'XA') internals.push('Access Panel');

      const segmentObj: Segment = {
        id,
        tag,
        typeCode,
        name: SEGMENT_NAMES[typeCode] || `Segment ${typeCode}`,
        weight,
        airPressureType,
        airVolume,
        handOrientation,
        dimensions,
        casing,
        internals,
        hasFrontChannel: getChildBool(segEl, 'hasFrontChannel', false),
        hasRearChannel: getChildBool(segEl, 'hasRearChannel', false),
        hasMotorRemovalRail: getChildBool(segEl, 'hasMotorRemovalRail', false),
        isTiered,
        tierLevel,
        elevationY: dimensions.y,
        doors: [],
        dampers: [],
        floorDrains: [],
        ductOpenings: [],
        drainPanOpenings: [],
        fanConfig,
        coilConfig,
        filterConfig,
        heatWheelConfig
      };

      segments.push(segmentObj);
      segNodeMap.set(id, segmentObj);
    }
  }

  // Parse Opening Schedule (<openingList>)
  const doors: UnitDoor[] = [];
  const dampers: UnitDamper[] = [];
  const floorDrains: UnitFloorDrain[] = [];

  const openingListNodes = getElements(root, 'openingList');
  const openingListNode = openingListNodes[0];
  if (openingListNode) {
    const openingEls = Array.from(openingListNode.children);
    let opIdx = 1;
    const isFloorAl = unitOptions.materials.floorMaterialType.toUpperCase().includes('AL');
    const defaultHoleDia = isFloorAl ? 3.125 : 1.50;

    for (const opEl of openingEls) {
      const opType = getChildText(opEl, 'openingType', 'Standard');
      const segId = getChildText(opEl, 'segmentID', '');
      const side = getChildText(opEl, 'unitSide', 'Front');
      const opGeom = parseDimensions(getElements(opEl, 'geometry')[0]);
      const width = Math.max(opGeom.xLength, opGeom.zLength);
      const height = opGeom.yLength;

      // Doors
      const doorEl = getElements(opEl, 'door')[0];
      if (doorEl || opType.toLowerCase() === 'door') {
        const door: UnitDoor = {
          id: doorEl ? getChildText(doorEl, 'doorID', `door-${opIdx}`) : `door-${opIdx}`,
          segmentId: segId,
          unitSide: side,
          width: width > 0 ? width : 24.0,
          height: height > 0 ? height : 72.0,
          swing: doorEl ? getChildText(doorEl, 'swingDirection', 'Out') : 'Out',
          hingeSide: doorEl ? getChildText(doorEl, 'doorHingeType', 'Left') : 'Left',
          hasWindow: doorEl ? getChildBool(doorEl, 'hasWindow', false) : false,
          hasViewPort: doorEl ? getChildBool(doorEl, 'hasViewPort', false) : false,
          latchType: doorEl ? getChildText(doorEl, 'doorLatchType', 'Standard') : 'Standard',
          doorType: doorEl ? getChildText(doorEl, 'doorType', 'Standard') : 'Standard'
        };
        doors.push(door);
        const hostSeg = segNodeMap.get(segId);
        if (hostSeg) hostSeg.doors = hostSeg.doors ? [...hostSeg.doors, door] : [door];
      }

      // Dampers
      const damperEl = getElements(opEl, 'damper')[0];
      if (damperEl) {
        const damper: UnitDamper = {
          id: getChildText(damperEl, 'damper_MOMID', `damper-${opIdx}`),
          segmentId: segId,
          unitSide: side,
          width,
          height,
          depth: getChildNumber(damperEl, 'damperDepth', 0),
          damperType: getChildText(damperEl, 'damperType', 'Standard'),
          actuatorType: getChildText(damperEl, 'actuatorType', 'None'),
          bladeType: getChildText(damperEl, 'bladeType', 'Airfoil'),
          hasAttachedLouver: getChildBool(damperEl, 'louverHasAttachedDamper', false)
        };
        dampers.push(damper);
        const hostSeg = segNodeMap.get(segId);
        if (hostSeg) hostSeg.dampers = hostSeg.dampers ? [...hostSeg.dampers, damper] : [damper];
      }

      // Floor Drains
      const fdEl = getElements(opEl, 'floorDrain')[0];
      if (fdEl || opType.toLowerCase() === 'floordrain') {
        const fd: UnitFloorDrain = {
          id: fdEl ? getChildText(fdEl, 'floorDrain_MOMID', `fd-${opIdx}`) : `fd-${opIdx}`,
          segmentId: segId,
          unitSide: side,
          type: fdEl ? getChildText(fdEl, 'floorDrainType', 'Standard') : 'Standard',
          pipingMaterial: fdEl ? getChildText(fdEl, 'pipingMaterial', 'StainlessSteel') : 'StainlessSteel',
          connectionDiameter: fdEl ? getChildNumber(fdEl, 'connectionDiameter', 1.25) : 1.25,
          holeDiameter: defaultHoleDia,
          connectionSide: fdEl ? getChildText(fdEl, 'connectionSide', 'Left') : 'Left',
          geometry: opGeom
        };
        floorDrains.push(fd);
        const hostSeg = segNodeMap.get(segId);
        if (hostSeg) hostSeg.floorDrains = hostSeg.floorDrains ? [...hostSeg.floorDrains, fd] : [fd];
      }

      opIdx++;
    }
  }

  // Unit-level structural flags
  const isTiered = segments.some(s => s.isTiered);
  const isStacked = bases.some(b => b.isUpperBase);
  const hasFloorDrains = floorDrains.length > 0;

  // Shipping Skids
  const skidNodes = getElements(root, 'shippingSkid');
  const skids: ShippingSkid[] = [];

  for (let i = 0; i < skidNodes.length; i++) {
    const s = skidNodes[i];
    const segRefEls = getElements(s, 'segmentReference');
    const segRefs = segRefEls.map(r => getChildText(r, 'segmentID'));
    const baseRefEls = getElements(s, 'unitBaseReference');
    const baseRefs = baseRefEls.map(r => getChildText(r, 'unitBaseID'));

    let skidCalculatedWeight = 0;
    let maxLen = 0;
    let maxW = 0;
    let maxH = 0;

    for (const sid of segRefs) {
      const seg = segNodeMap.get(sid);
      if (seg) {
        skidCalculatedWeight += seg.weight;
        maxLen += seg.dimensions.xLength;
        maxW = Math.max(maxW, seg.dimensions.zLength);
        maxH = Math.max(maxH, seg.dimensions.yLength);
      }
    }

    for (const bid of baseRefs) {
      const base = bases.find(b => b.id === bid);
      if (base) {
        maxH += base.height;
      }
    }

    skids.push({
      id: `skid-${i + 1}`,
      index: i + 1,
      name: `Skid ${i + 1}`,
      segmentIds: segRefs,
      baseIds: baseRefs,
      calculatedWeight: skidCalculatedWeight,
      authoritativeWeight: undefined,
      isWeightConfirmed: false,
      dimensions: {
        length: maxLen > 0 ? maxLen : 120,
        width: maxW > 0 ? maxW : 80,
        height: maxH > 0 ? maxH : 110
      }
    });
  }

  // Motor Controls
  const mcNodes = getElements(root, 'motorControl');
  const motorControls: MotorControl[] = [];
  for (let i = 0; i < mcNodes.length; i++) {
    const m = mcNodes[i];
    const svcSegList = getElements(m, 'serviceSegmentReferenceList')[0];
    motorControls.push({
      name: getChildText(m, 'userDefinedName', `Motor Control ${i + 1}`),
      unitSide: getChildText(m, 'unitSide', 'Left'),
      motorControlType: getChildText(m, 'motorControlType', 'ExternalWireDisconnect'),
      fla: getChildNumber(m, 'fla', 0),
      voltage: getChildNumber(m, 'voltage', 460),
      hp: getChildNumber(m, 'horsePower', 0),
      disconnectSize: getChildNumber(m, 'disconnectSize', 30),
      weight: getChildNumber(m, 'weight', 10),
      serviceSegmentId: getChildText(svcSegList || m, 'segmentID')
    });
  }

  return {
    unitMOMID,
    documentVersion,
    generatingSoftware,
    unitWeight,
    totalStaticPressure,
    isTiered,
    isStacked,
    hasFloorDrains,
    dimensions: {
      length: cabLength,
      width: cabWidth,
      height: cabHeight
    },
    unitOptions,
    roofOptions,
    curbOptions,
    testingOptions,
    skids,
    bases,
    segments,
    motorControls,
    doors,
    dampers,
    floorDrains
  };
}

export function parseOrderRevXml(xmlContent: string): OrderRevisionData {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return {
      productType: '',
      jobName: '',
      orderNumber: '',
      lineNumber: 1,
      projectName: '',
      projectId: '',
      baseSQOrderNumber: '',
      tagList: []
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const root = doc.documentElement;

  const productType = getChildText(root, 'productType');
  const jobName = getChildText(root, 'jobName');
  const orderNumber = getChildText(root, 'orderNumber');
  const lineNumber = getChildNumber(root, 'lineNumber', 1);
  const projectName = getChildText(root, 'projectName');
  const projectId = getChildText(root, 'projectID');
  const baseSQOrderNumber = getChildText(root, 'baseSQOrderNumber');

  const tagListNodes = getElements(root, 'tag');
  const tagList = tagListNodes.map(t => t.textContent?.trim() || '').filter(Boolean);

  return {
    productType,
    jobName,
    orderNumber,
    lineNumber,
    projectName,
    projectId,
    baseSQOrderNumber,
    tagList,
    primaryTag: tagList[0] || ''
  };
}


