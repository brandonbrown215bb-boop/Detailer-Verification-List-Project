import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  AVAILABLE_SEGMENT_TEMPLATES,
  MANUAL_UNIT_PRESETS,
  type ManualSegmentItem,
  type ManualSkidItem,
  type ManualUnitConfig
} from '../types/manual';

export type ManualWizardStep = 'general' | 'skids' | 'segments' | 'review';

export interface ManualUnitMetrics {
  totalLength: number;
  totalLengthFeet: string;
  totalWeight: number;
  maxW: number;
  maxH: number;
  totalHeightWithBase: number;
  skidBreakdown: Array<ManualSkidItem & {
    segments: ManualSegmentItem[];
    calculatedLength: number;
    calculatedWeight: number;
  }>;
}

export interface UseManualUnitWizardOptions {
  isOpen: boolean;
  onClose: () => void;
  onCreateUnit: (config: ManualUnitConfig) => void;
}

export interface UseManualUnitWizardResult {
  activeStep: ManualWizardStep;
  selectedPresetId: string;
  jobName: string;
  comNumber: string;
  detailerName: string;
  unitType: 'Outdoor' | 'Indoor';
  housingStyle: 'ThermalBreak' | 'Standard';
  defaultUnitWidth: number;
  defaultUnitHeight: number;
  defaultBaseHeight: number;
  defaultWallThickness: number;
  totalStaticPressure: number;
  exteriorMaterialType: string;
  exteriorMaterialGauge: number;
  interiorMaterialType: string;
  interiorMaterialGauge: number;
  floorMaterialType: string;
  floorMaterialGauge: number;
  insulationType: string;
  skids: ManualSkidItem[];
  segments: ManualSegmentItem[];
  selectedTemplateCode: string;
  targetAddSkidId: string;
  newInternalText: string;
  unitMetrics: ManualUnitMetrics;
  setJobName: Dispatch<SetStateAction<string>>;
  setComNumber: Dispatch<SetStateAction<string>>;
  setDetailerName: Dispatch<SetStateAction<string>>;
  setUnitType: Dispatch<SetStateAction<'Outdoor' | 'Indoor'>>;
  setHousingStyle: Dispatch<SetStateAction<'ThermalBreak' | 'Standard'>>;
  setDefaultUnitWidth: Dispatch<SetStateAction<number>>;
  setDefaultUnitHeight: Dispatch<SetStateAction<number>>;
  setDefaultBaseHeight: Dispatch<SetStateAction<number>>;
  setDefaultWallThickness: Dispatch<SetStateAction<number>>;
  setTotalStaticPressure: Dispatch<SetStateAction<number>>;
  setExteriorMaterialType: Dispatch<SetStateAction<string>>;
  setExteriorMaterialGauge: Dispatch<SetStateAction<number>>;
  setInteriorMaterialType: Dispatch<SetStateAction<string>>;
  setInteriorMaterialGauge: Dispatch<SetStateAction<number>>;
  setFloorMaterialType: Dispatch<SetStateAction<string>>;
  setFloorMaterialGauge: Dispatch<SetStateAction<number>>;
  setInsulationType: Dispatch<SetStateAction<string>>;
  setSelectedTemplateCode: Dispatch<SetStateAction<string>>;
  setTargetAddSkidId: Dispatch<SetStateAction<string>>;
  setNewInternalText: Dispatch<SetStateAction<string>>;
  loadPreset: (presetId: string) => void;
  selectStep: (step: ManualWizardStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  handleAddSkid: () => void;
  handleRemoveSkid: (skidId: string) => void;
  handleUpdateSkid: (skidId: string, updates: Partial<ManualSkidItem>) => void;
  handleAddSegmentFromTemplate: (templateCode: string) => void;
  handleRemoveSegment: (segId: string) => void;
  handleDuplicateSegment: (segId: string) => void;
  handleMoveSegment: (index: number, direction: 'up' | 'down') => void;
  handleUpdateSegment: (segId: string, updates: Partial<ManualSegmentItem>) => void;
  handleAddInternal: (segId: string) => void;
  handleRemoveInternal: (segId: string, internalIdx: number) => void;
  handleSubmit: (event: FormEvent) => void;
}

export function useManualUnitWizard({
  isOpen,
  onClose,
  onCreateUnit
}: UseManualUnitWizardOptions): UseManualUnitWizardResult {
  const [activeStep, setActiveStep] = useState<ManualWizardStep>('general');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-standard-vav');

  const [jobName, setJobName] = useState('New AHU Project');
  const [comNumber, setComNumber] = useState('');
  const [detailerName, setDetailerName] = useState(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('dvl_detailer_name') || '' : '';
  });
  const [unitType, setUnitType] = useState<'Outdoor' | 'Indoor'>('Outdoor');
  const [housingStyle, setHousingStyle] = useState<'ThermalBreak' | 'Standard'>('ThermalBreak');
  const [defaultUnitWidth, setDefaultUnitWidth] = useState<number>(84);
  const [defaultUnitHeight, setDefaultUnitHeight] = useState<number>(96);
  const [defaultBaseHeight, setDefaultBaseHeight] = useState<number>(10.0);
  const [defaultWallThickness, setDefaultWallThickness] = useState<number>(2.0);
  const [totalStaticPressure, setTotalStaticPressure] = useState<number>(2.5);

  const [exteriorMaterialType, setExteriorMaterialType] = useState('STL GALV PPC');
  const [exteriorMaterialGauge, setExteriorMaterialGauge] = useState(18);
  const [interiorMaterialType, setInteriorMaterialType] = useState('STL GALV');
  const [interiorMaterialGauge, setInteriorMaterialGauge] = useState(22);
  const [floorMaterialType, setFloorMaterialType] = useState('STL GALV');
  const [floorMaterialGauge, setFloorMaterialGauge] = useState(16);
  const [insulationType, setInsulationType] = useState('Foam');

  const [skids, setSkids] = useState<ManualSkidItem[]>([]);
  const [segments, setSegments] = useState<ManualSegmentItem[]>([]);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('FF');
  const [targetAddSkidId, setTargetAddSkidId] = useState<string>('');
  const [newInternalText, setNewInternalText] = useState<string>('');
  const [selectedSegmentForInternal] = useState<string | null>(null);

  const loadPreset = (presetId: string) => {
    const preset = MANUAL_UNIT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setSelectedPresetId(presetId);
    setSkids(preset.skids.map(s => ({ ...s })));

    const newSegments: ManualSegmentItem[] = preset.segments.map((seg, idx) => ({
      ...seg,
      id: `seg-${Date.now()}-${idx + 1}`,
      width: defaultUnitWidth,
      height: defaultUnitHeight
    }));

    setSegments(newSegments);
    if (preset.skids.length > 0) {
      setTargetAddSkidId(preset.skids[0].id);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('dvl_detailer_name') || '';
        setDetailerName(saved);
      }
      loadPreset('preset-standard-vav');
      setActiveStep('general');
    }
  }, [isOpen]);

  useEffect(() => {
    if (skids.length > 0 && !skids.some(s => s.id === targetAddSkidId)) {
      setTargetAddSkidId(skids[0].id);
    }
  }, [skids, targetAddSkidId]);

  const selectStep = (step: ManualWizardStep) => setActiveStep(step);

  const goToNextStep = () => {
    if (activeStep === 'general') setActiveStep('skids');
    else if (activeStep === 'skids') setActiveStep('segments');
    else if (activeStep === 'segments') setActiveStep('review');
  };

  const goToPreviousStep = () => {
    if (activeStep === 'review') setActiveStep('segments');
    else if (activeStep === 'segments') setActiveStep('skids');
    else if (activeStep === 'skids') setActiveStep('general');
  };

  const handleAddSkid = () => {
    const nextIndex = skids.length + 1;
    const nextId = `skid-${nextIndex}`;
    const newSkid: ManualSkidItem = {
      id: nextId,
      index: nextIndex,
      name: `Skid ${nextIndex}`,
      baseHeight: defaultBaseHeight,
      baseMaterial: 'StructuralSteel',
      baseType: 'A36',
      hasSubFloor: true,
      subFloorMaterial: 'STL GALV 22ga'
    };
    setSkids([...skids, newSkid]);
    setTargetAddSkidId(nextId);
  };

  const handleRemoveSkid = (skidId: string) => {
    if (skids.length <= 1) {
      alert('A unit must have at least 1 shipping skid.');
      return;
    }

    const remainingSkids = skids.filter(s => s.id !== skidId);
    const fallbackSkidId = remainingSkids[0]?.id || 'skid-1';
    setSegments(prev => prev.map(s => (s.skidId === skidId ? { ...s, skidId: fallbackSkidId } : s)));
    setSkids(remainingSkids);
  };

  const handleUpdateSkid = (skidId: string, updates: Partial<ManualSkidItem>) => {
    setSkids(prev => prev.map(s => (s.id === skidId ? { ...s, ...updates } : s)));
  };

  const handleAddSegmentFromTemplate = (templateCode: string) => {
    const template = AVAILABLE_SEGMENT_TEMPLATES.find(t => t.typeCode === templateCode);
    if (!template) return;

    const assignedSkid = targetAddSkidId || skids[0]?.id || 'skid-1';
    const newSeg: ManualSegmentItem = {
      id: `seg-${Date.now()}-${segments.length + 1}`,
      typeCode: template.typeCode,
      name: template.name,
      skidId: assignedSkid,
      length: template.defaultLength,
      width: defaultUnitWidth,
      height: defaultUnitHeight,
      weight: template.defaultWeight,
      airPressureType: template.defaultPressure,
      airVolume: 18000,
      internals: [...template.defaultInternals]
    };

    setSegments([...segments, newSeg]);
  };

  const handleRemoveSegment = (segId: string) => {
    setSegments(prev => prev.filter(s => s.id !== segId));
  };

  const handleDuplicateSegment = (segId: string) => {
    const segIdx = segments.findIndex(s => s.id === segId);
    if (segIdx === -1) return;

    const source = segments[segIdx];
    const clone: ManualSegmentItem = {
      ...source,
      id: `seg-${Date.now()}`,
      name: `${source.name} (Copy)`,
      internals: [...source.internals]
    };

    const newSegments = [...segments];
    newSegments.splice(segIdx + 1, 0, clone);
    setSegments(newSegments);
  };

  const handleMoveSegment = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === segments.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const next = [...segments];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setSegments(next);
  };

  const handleUpdateSegment = (segId: string, updates: Partial<ManualSegmentItem>) => {
    setSegments(prev => prev.map(s => (s.id === segId ? { ...s, ...updates } : s)));
  };

  const handleAddInternal = (segId: string) => {
    if (!newInternalText.trim()) return;
    setSegments(prev => prev.map(s => {
      if (s.id === segId) {
        return { ...s, internals: [...s.internals, newInternalText.trim()] };
      }
      return s;
    }));
    setNewInternalText('');
  };

  const handleRemoveInternal = (segId: string, internalIdx: number) => {
    setSegments(prev => prev.map(s => {
      if (s.id === segId) {
        const next = [...s.internals];
        next.splice(internalIdx, 1);
        return { ...s, internals: next };
      }
      return s;
    }));
  };

  const unitMetrics = useMemo<ManualUnitMetrics>(() => {
    let totalLength = 0;
    let totalWeight = 0;
    let maxW = defaultUnitWidth;
    let maxH = defaultUnitHeight;

    segments.forEach(seg => {
      totalLength += Number(seg.length) || 0;
      totalWeight += Number(seg.weight) || 0;
      maxW = Math.max(maxW, Number(seg.width) || defaultUnitWidth);
      maxH = Math.max(maxH, Number(seg.height) || defaultUnitHeight);
    });

    const skidBreakdown = skids.map(skid => {
      const segs = segments.filter(s => s.skidId === skid.id);
      const sLen = segs.reduce((acc, curr) => acc + (Number(curr.length) || 0), 0);
      const sWt = segs.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
      return {
        ...skid,
        segments: segs,
        calculatedLength: sLen,
        calculatedWeight: sWt
      };
    });

    return {
      totalLength,
      totalLengthFeet: (totalLength / 12).toFixed(1),
      totalWeight,
      maxW,
      maxH,
      totalHeightWithBase: maxH + defaultBaseHeight,
      skidBreakdown
    };
  }, [segments, skids, defaultUnitWidth, defaultUnitHeight, defaultBaseHeight]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (skids.length === 0) {
      alert('Please configure at least 1 shipping skid.');
      return;
    }

    if (segments.length === 0) {
      alert('Please add at least 1 segment to the unit sequence.');
      return;
    }

    onCreateUnit({
      jobName: jobName.trim() || 'Custom AHU Project',
      comNumber: comNumber.trim() || 'COM-000000',
      detailerName: detailerName.trim() || 'Detailer',
      unitType,
      housingStyle,
      defaultUnitWidth,
      defaultUnitHeight,
      defaultBaseHeight,
      defaultWallThickness,
      totalStaticPressure,
      casingMaterials: {
        exteriorMaterialType,
        exteriorMaterialGauge,
        interiorMaterialType,
        interiorMaterialGauge,
        floorMaterialType,
        floorMaterialGauge,
        insulationType
      },
      skids,
      segments
    });
    onClose();
  };

  return {
    activeStep,
    selectedPresetId,
    jobName,
    comNumber,
    detailerName,
    unitType,
    housingStyle,
    defaultUnitWidth,
    defaultUnitHeight,
    defaultBaseHeight,
    defaultWallThickness,
    totalStaticPressure,
    exteriorMaterialType,
    exteriorMaterialGauge,
    interiorMaterialType,
    interiorMaterialGauge,
    floorMaterialType,
    floorMaterialGauge,
    insulationType,
    skids,
    segments,
    selectedTemplateCode,
    targetAddSkidId,
    newInternalText,
    unitMetrics,
    setJobName,
    setComNumber,
    setDetailerName,
    setUnitType,
    setHousingStyle,
    setDefaultUnitWidth,
    setDefaultUnitHeight,
    setDefaultBaseHeight,
    setDefaultWallThickness,
    setTotalStaticPressure,
    setExteriorMaterialType,
    setExteriorMaterialGauge,
    setInteriorMaterialType,
    setInteriorMaterialGauge,
    setFloorMaterialType,
    setFloorMaterialGauge,
    setInsulationType,
    setSelectedTemplateCode,
    setTargetAddSkidId,
    setNewInternalText,
    loadPreset,
    selectStep,
    goToNextStep,
    goToPreviousStep,
    handleAddSkid,
    handleRemoveSkid,
    handleUpdateSkid,
    handleAddSegmentFromTemplate,
    handleRemoveSegment,
    handleDuplicateSegment,
    handleMoveSegment,
    handleUpdateSegment,
    handleAddInternal,
    handleRemoveInternal,
    handleSubmit
  };
}
