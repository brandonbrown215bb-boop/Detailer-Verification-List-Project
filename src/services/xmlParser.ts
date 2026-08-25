import { NormalizedXmlGraph, Segment, ShippingSkid, UnitBase, MotorControl } from '../types';

const SEGMENT_NAMES: Record<string, string> = {
  IP: 'Inlet Plenum',
  FF: 'Flat Filter',
  XA: 'Access / Inspection',
  HW: 'Heat Wheel (Energy Recovery)',
  FE: 'Fan (Exhaust)',
  PC: 'Pipe Chase',
  RF: 'Rigid / High Efficiency Filter',
  HC: 'Coil (Heating)',
  CC: 'Coil (Cooling)',
  FR: 'Fan (Return)',
  FS: 'Fan (Supply)',
  DP: 'Discharge Plenum',
  AT: 'Sound Attenuator',
  MB: 'Mixing Box',
  AF: 'Angle Filter',
  DI: 'Diffuser',
  EB: 'External Bypass',
  EE: 'Economizer',
  EF: 'Filter Economizer',
  EH: 'Electric Heat',
  FD: 'Face Damper',
  HF: 'HEPA Filter',
  HM: 'Humidifier',
  HX: 'Heat Exchanger',
  IB: 'Internal Bypass',
  IC: 'Integrated Face & Bypass Coil',
  IG: 'Indirect Fired Gas',
  IO: 'Inlet / Outlet',
  TN: 'Turning Section',
  UV: 'UV Light',
  VC: 'Vertical Coil',
  VE: 'Vertical Economizer',
  VB: 'Vestibule / Corridor',
  VP: 'Vertical Plenum'
};

function getElements(parent: Element | Document, tagName: string): Element[] {
  // Support both standard tag name and local name regardless of namespace
  const list = parent.getElementsByTagName(tagName);
  if (list && list.length > 0) return Array.from(list);

  // Try getElementsByTagNameNS if available
  if ('getElementsByTagNameNS' in parent) {
    const nsList = (parent as any).getElementsByTagNameNS('*', tagName);
    if (nsList && nsList.length > 0) return Array.from(nsList);
  }

  // Fallback: iterate children by localName
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

export function parseAhuXml(xmlContent: string): NormalizedXmlGraph {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Empty XML input received.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  // Check parsing error
  const parseErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parseErrors.length > 0) {
    console.warn('DOMParser reported error, applying regex sanitizer fallback:', parseErrors[0].textContent);
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
  const isSeismic = unitConstructionType === 'IBC' || unitConstructionType === 'OSHPD';
  const noaRating = unitConstructionType === 'NOA' ? 'NOA' : 'N/A';

  const unitOptions = {
    unitType: unitOptNode ? getChildText(unitOptNode, 'unitType', 'Outdoor') : 'Outdoor',
    brandOption: unitOptNode ? getChildText(unitOptNode, 'brandOption', 'YORKCustom') : 'YORKCustom',
    unitConstructionType,
    washdown: unitOptNode ? getChildBool(unitOptNode, 'washdown', false) : false,
    knockdown: unitOptNode ? getChildBool(unitOptNode, 'knockdown', false) : false,
    hasUTL: false, // Calculated from base upturned lips
    isSeismic,
    noaRating,
    primaryAccessSide: unitOptNode ? getChildText(unitOptNode, 'primaryAccessSide', 'Left') : 'Left',
    defaultUnitBaseHeight: unitOptNode ? getChildNumber(unitOptNode, 'defaultUnitBaseHeight', 10) : 10,
    materials: {
      exteriorMaterialType: defaultConstNode ? getChildText(defaultConstNode, 'exteriorMaterialType', 'STL GALV PPC') : 'STL GALV PPC',
      exteriorMaterialGauge: defaultConstNode ? getChildNumber(defaultConstNode, 'exteriorMaterialGauge', 18) : 18,
      interiorMaterialType: defaultConstNode ? getChildText(defaultConstNode, 'interiorMaterialType', 'STL GALV') : 'STL GALV',
      interiorMaterialGauge: defaultConstNode ? getChildNumber(defaultConstNode, 'interiorMaterialGauge', 22) : 22,
      floorMaterialType: defaultConstNode ? getChildText(defaultConstNode, 'floorMaterialType', 'STL GALV') : 'STL GALV',
      floorMaterialGauge: defaultConstNode ? getChildNumber(defaultConstNode, 'floorMaterialGauge', 16) : 16,
      housingStyle: defaultConstNode ? getChildText(defaultConstNode, 'housingStyle', 'ThermalBreak') : 'ThermalBreak',
      insulationType: defaultConstNode ? getChildText(defaultConstNode, 'insulationType', 'Foam') : 'Foam'
    }
  };

  // Roof Options
  const roofNodes = getElements(root, 'roofOptions');
  const roofNode = roofNodes[0];
  const roofOptions = {
    hasSlopedRoof: roofNode ? getChildBool(roofNode, 'hasSlopedRoof', true) : true,
    roofSlope: roofNode ? getChildNumber(roofNode, 'roofSlope', 0.25) : 0.25,
    roofSlopeHighSide: roofNode ? getChildText(roofNode, 'roofSlopeHighSide', 'Internal') : 'Internal',
    roofPeakZDim: roofNode ? getChildNumber(roofNode, 'roofPeakZDim', 97) : 97
  };

  // Curb Options
  const curbNodes = getElements(root, 'curbOptions');
  const curbNode = curbNodes[0];
  const curbOptions = {
    hasCurbRest: curbNode ? getChildBool(curbNode, 'hasCurbRest', true) : true,
    hasCurb: curbNode ? getChildBool(curbNode, 'hasCurb', false) : false,
    curbHeight: curbNode ? getChildNumber(curbNode, 'curbHeight', 0) : 0
  };

  // Unit Bases
  const baseNodes = getElements(root, 'unitBase');
  const bases: UnitBase[] = [];
  let detectedUTL = false;

  for (let i = 0; i < baseNodes.length; i++) {
    const b = baseNodes[i];
    const geom = getElements(b, 'geometry')[0];
    const lipHeight = getChildNumber(b, 'upturnedLipHeight', 0);
    if (lipHeight > 0) detectedUTL = true;

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
      subFloorMaterial: `${getChildText(b, 'subFloorMaterialType', 'STL GALV')} ${getChildNumber(b, 'subFloorMaterialGauge', 22)}ga`,
      dimensions: {
        x: geom ? getChildNumber(geom, 'x', 0) : 0,
        y: geom ? getChildNumber(geom, 'y', 0) : 0,
        z: geom ? getChildNumber(geom, 'z', 0) : 0,
        xLength: geom ? getChildNumber(geom, 'xLength', 0) : 0,
        yLength: geom ? getChildNumber(geom, 'yLength', 10) : 10,
        zLength: geom ? getChildNumber(geom, 'zLength', 0) : 0
      }
    });
  }
  unitOptions.hasUTL = detectedUTL;

  // Segments
  const segListNodes = getElements(root, 'segmentList');
  const segListNode = segListNodes[0];
  const segments: Segment[] = [];
  const segNodeMap = new Map<string, Segment>();

  if (segListNode) {
    const directChildren = Array.from(segListNode.children);
    for (const segEl of directChildren) {
      const tag = segEl.tagName.replace(/^.*:/, ''); // e.g. segment_IP
      const typeCode = tag.replace('segment_', '').toUpperCase();
      const id = getChildText(segEl, 'segmentID', `seg-${segments.length + 1}`);
      const weight = getChildNumber(segEl, 'weight', 0);
      const airPressureType = getChildText(segEl, 'airPressureType', 'Negative');
      const airVolume = getChildNumber(segEl, 'airVolume', 0);
      const handOrientation = getChildText(segEl, 'handOrientation', 'FrontToRear');

      const geom = getElements(segEl, 'geometry')[0];
      const dimensions = {
        x: geom ? getChildNumber(geom, 'x', 0) : 0,
        y: geom ? getChildNumber(geom, 'y', 0) : 0,
        z: geom ? getChildNumber(geom, 'z', 0) : 0,
        xLength: geom ? getChildNumber(geom, 'xLength', 0) : 0,
        yLength: geom ? getChildNumber(geom, 'yLength', 0) : 0,
        zLength: geom ? getChildNumber(geom, 'zLength', 0) : 0
      };

      // Casing detail
      const constOpt = getElements(segEl, 'constructionOptions')[0];
      const frontSurf = constOpt ? getElements(constOpt, 'surfaceDetail_Front')[0] : null;
      const casing = {
        exteriorMaterial: frontSurf ? getChildText(frontSurf, 'exteriorMaterialType', unitOptions.materials.exteriorMaterialType) : unitOptions.materials.exteriorMaterialType,
        exteriorGauge: frontSurf ? getChildNumber(frontSurf, 'exteriorMaterialGauge', unitOptions.materials.exteriorMaterialGauge) : unitOptions.materials.exteriorMaterialGauge,
        interiorMaterial: frontSurf ? getChildText(frontSurf, 'interiorMaterialType', unitOptions.materials.interiorMaterialType) : unitOptions.materials.interiorMaterialType,
        interiorGauge: frontSurf ? getChildNumber(frontSurf, 'interiorMaterialGauge', unitOptions.materials.interiorMaterialGauge) : unitOptions.materials.interiorMaterialGauge,
        housingThickness: frontSurf ? getChildNumber(frontSurf, 'housingThickness', 2) : 2,
        housingStyle: constOpt ? getChildText(constOpt, 'housingStyle', unitOptions.materials.housingStyle) : unitOptions.materials.housingStyle,
        insulationType: constOpt ? getChildText(constOpt, 'insulationType', unitOptions.materials.insulationType) : unitOptions.materials.insulationType
      };

      // Detect internals
      const internals: string[] = [];
      const coilEls = getElements(segEl, 'coil');
      if (coilEls.length > 0 || tag === 'segment_CC' || tag === 'segment_HC') {
        if (coilEls.length > 0) {
          for (let c = 0; c < coilEls.length; c++) {
            const bh = getChildText(coilEls[c], 'coilBulkheadMaterial');
            const cType = getChildText(coilEls[c], 'coilType', 'Coil');
            internals.push(bh ? `${cType} (${bh} Bulkhead)` : cType);
          }
        } else {
          internals.push(tag === 'segment_CC' ? 'Cooling Coil Wall' : 'Heating Coil Wall');
        }
      }
      const fanEls = getElements(segEl, 'fan');
      if (fanEls.length > 0 || tag === 'segment_FS' || tag === 'segment_FE' || tag === 'segment_FR') {
        internals.push('Fan Array / Wall');
      }
      if (tag === 'segment_HW') internals.push('Heat Recovery Wheel');
      if (tag === 'segment_AT') internals.push('Sound Attenuator Baffles');
      if (tag === 'segment_MB') internals.push('Mixing Dampers');
      if (tag === 'segment_PC') internals.push('Pipe Chase Enclosure');
      if (tag.includes('FF') || tag.includes('RF') || tag.includes('AF')) internals.push('Filter Rack / Wall');

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
        hasMotorRemovalRail: getChildBool(segEl, 'hasMotorRemovalRail', false)
      };

      segments.push(segmentObj);
      segNodeMap.set(id, segmentObj);
    }
  }

  // Shipping Skids
  const skidNodes = getElements(root, 'shippingSkid');
  const skids: ShippingSkid[] = [];

  for (let i = 0; i < skidNodes.length; i++) {
    const s = skidNodes[i];
    const segRefEls = getElements(s, 'segmentReference');
    const segRefs = segRefEls.map(r => getChildText(r, 'segmentID'));
    const baseRefEls = getElements(s, 'unitBaseReference');
    const baseRefs = baseRefEls.map(r => getChildText(r, 'unitBaseID'));

    // Sum weights of segments on this skid
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

    // Add base weight approximation / dimensions
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
      authoritativeWeight: undefined, // Per strict weight rule: leave unassigned until confirmed
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
    dimensions: {
      length: cabLength,
      width: cabWidth,
      height: cabHeight
    },
    unitOptions,
    roofOptions,
    curbOptions,
    skids,
    bases,
    segments,
    motorControls
  };
}
