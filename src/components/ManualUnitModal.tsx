import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  PlusCircle,
  Building,
  Hash,
  User,
  Layers,
  ShieldCheck,
  Box,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Sparkles,
  Sliders,
  Check,
  ChevronRight,
  Info,
  Gauge,
  Ruler,
  Wrench,
  Grid,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import {
  ManualUnitConfig,
  ManualSkidItem,
  ManualSegmentItem,
  AVAILABLE_SEGMENT_TEMPLATES,
  MANUAL_UNIT_PRESETS,
  SegmentTemplate
} from '../services/manualUnitFactory';

interface ManualUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateUnit: (config: ManualUnitConfig) => void;
}

const SEGMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  IP: { bg: 'bg-cyan-500/15 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/40' },
  MB: { bg: 'bg-orange-500/15 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500/40' },
  EE: { bg: 'bg-emerald-500/15 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/40' },
  FF: { bg: 'bg-emerald-500/15 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/40' },
  AF: { bg: 'bg-green-500/15 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-500/40' },
  RF: { bg: 'bg-teal-500/15 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/40' },
  HF: { bg: 'bg-teal-600/15 dark:bg-teal-600/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-600/40' },
  CC: { bg: 'bg-violet-500/15 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-500/40' },
  HC: { bg: 'bg-rose-500/15 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/40' },
  VC: { bg: 'bg-purple-500/15 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/40' },
  IC: { bg: 'bg-fuchsia-500/15 dark:bg-fuchsia-500/20', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-500/40' },
  FS: { bg: 'bg-sky-500/15 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/40' },
  FR: { bg: 'bg-indigo-500/15 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/40' },
  FE: { bg: 'bg-blue-600/15 dark:bg-blue-600/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-600/40' },
  HW: { bg: 'bg-amber-500/15 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/40' },
  HX: { bg: 'bg-amber-600/15 dark:bg-amber-600/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-600/40' },
  XA: { bg: 'bg-slate-200 dark:bg-slate-700/60', text: 'text-slate-700 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-600' },
  VB: { bg: 'bg-slate-200 dark:bg-slate-700/60', text: 'text-slate-700 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-600' },
  PC: { bg: 'bg-purple-500/15 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/40' },
  AT: { bg: 'bg-yellow-500/15 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-500/40' },
  DI: { bg: 'bg-sky-500/15 dark:bg-sky-500/20', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/40' },
  DP: { bg: 'bg-blue-500/15 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/40' },
  EH: { bg: 'bg-red-500/15 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-500/40' },
  IG: { bg: 'bg-red-600/15 dark:bg-red-600/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-600/40' },
  UV: { bg: 'bg-fuchsia-500/15 dark:bg-fuchsia-500/20', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-500/40' },
  HM: { bg: 'bg-cyan-600/15 dark:bg-cyan-600/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-600/40' }
};

export const ManualUnitModal: React.FC<ManualUnitModalProps> = ({
  isOpen,
  onClose,
  onCreateUnit
}) => {
  // Wizard Navigation Step
  const [activeStep, setActiveStep] = useState<'general' | 'skids' | 'segments' | 'review'>('general');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-standard-vav');

  // Step 1: General & Construction Specs
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

  // Casing Materials
  const [exteriorMaterialType, setExteriorMaterialType] = useState('STL GALV PPC');
  const [exteriorMaterialGauge, setExteriorMaterialGauge] = useState(18);
  const [interiorMaterialType, setInteriorMaterialType] = useState('STL GALV');
  const [interiorMaterialGauge, setInteriorMaterialGauge] = useState(22);
  const [floorMaterialType, setFloorMaterialType] = useState('STL GALV');
  const [floorMaterialGauge, setFloorMaterialGauge] = useState(16);
  const [insulationType, setInsulationType] = useState('Foam');

  // Step 2 & 3: Dynamic Skids & Segments
  const [skids, setSkids] = useState<ManualSkidItem[]>([]);
  const [segments, setSegments] = useState<ManualSegmentItem[]>([]);

  // Add Segment Helper states
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string>('FF');
  const [targetAddSkidId, setTargetAddSkidId] = useState<string>('');
  const [newInternalText, setNewInternalText] = useState<string>('');
  const [selectedSegmentForInternal, setSelectedSegmentForInternal] = useState<string | null>(null);

  // Initialize or reset with preset
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

  // Run initial preset load when modal opens
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

  // Keep targetAddSkidId valid if skids change
  useEffect(() => {
    if (skids.length > 0 && !skids.some(s => s.id === targetAddSkidId)) {
      setTargetAddSkidId(skids[0].id);
    }
  }, [skids, targetAddSkidId]);

  // --- SKID HANDLERS ---
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
    // Reassign any segments that belonged to deleted skid to the previous available skid
    const fallbackSkidId = remainingSkids[0]?.id || 'skid-1';

    setSegments(prev => prev.map(s => (s.skidId === skidId ? { ...s, skidId: fallbackSkidId } : s)));
    setSkids(remainingSkids);
  };

  const handleUpdateSkid = (skidId: string, updates: Partial<ManualSkidItem>) => {
    setSkids(prev => prev.map(s => (s.id === skidId ? { ...s, ...updates } : s)));
  };

  // --- SEGMENT HANDLERS ---
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

  // --- DERIVED METRICS ---
  const unitMetrics = useMemo(() => {
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Manual Unit Setup & Architecture Wizard
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30">
                  Custom Engineering
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure arbitrary skids, custom segment sequencing, dimensions, and materials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Preset Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Preset:
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => loadPreset(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {MANUAL_UNIT_PRESETS.map(p => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Wizard Step Navigation Bar */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 px-4 sm:px-6 overflow-x-auto">
          {[
            { id: 'general', label: '1. General Specs & Casing', icon: Building },
            { id: 'skids', label: `2. Shipping Skids (${skids.length})`, icon: Box },
            { id: 'segments', label: `3. Segment Sequence & Sizing (${segments.length})`, icon: Layers },
            { id: 'review', label: '4. Review & Confirm', icon: ShieldCheck }
          ].map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id as any)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white/60 dark:bg-slate-800/60 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Step Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* ================= STEP 1: GENERAL SPECS ================= */}
            {activeStep === 'general' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* 1. Identification */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    <span>Order & Unit Identification</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-blue-500" />
                        <span>Job Name</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={jobName}
                        onChange={(e) => setJobName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                        placeholder="e.g. Medical Center Phase 3"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-amber-500" />
                        <span>COM Number</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={comNumber}
                        onChange={(e) => setComNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono font-medium"
                        placeholder="e.g. COM-842910"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Detailer Name</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={detailerName}
                        onChange={(e) => setDetailerName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-medium"
                        placeholder="e.g. Tanner Dean"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Construction & Geometry Defaults */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Ruler className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Unit Environment & Baseline Geometry</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Environment</label>
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setUnitType('Outdoor')}
                          className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                            unitType === 'Outdoor'
                              ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          Outdoor
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnitType('Indoor')}
                          className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                            unitType === 'Indoor'
                              ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          Indoor
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Housing Style</label>
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setHousingStyle('ThermalBreak')}
                          className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                            housingStyle === 'ThermalBreak'
                              ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          Thermal Break
                        </button>
                        <button
                          type="button"
                          onClick={() => setHousingStyle('Standard')}
                          className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
                            housingStyle === 'Standard'
                              ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-sm'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          Standard
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Default Base Height</label>
                      <select
                        value={defaultBaseHeight}
                        onChange={(e) => setDefaultBaseHeight(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-medium"
                      >
                        <option value={6.0}>6.0" Channel Base</option>
                        <option value={8.0}>8.0" Structural Base</option>
                        <option value={10.0}>10.0" Standard Base</option>
                        <option value={12.0}>12.0" Heavy Base</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Wall Thickness</label>
                      <select
                        value={defaultWallThickness}
                        onChange={(e) => setDefaultWallThickness(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-medium"
                      >
                        <option value={2.0}>2.0" Standard</option>
                        <option value={3.0}>3.0" Enhanced</option>
                        <option value={4.0}>4.0" High Performance</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Default Unit Width (in)</label>
                      <input
                        type="number"
                        min={36}
                        max={300}
                        value={defaultUnitWidth}
                        onChange={(e) => setDefaultUnitWidth(parseFloat(e.target.value) || 84)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Default Unit Height (in)</label>
                      <input
                        type="number"
                        min={36}
                        max={300}
                        value={defaultUnitHeight}
                        onChange={(e) => setDefaultUnitHeight(parseFloat(e.target.value) || 96)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Total Static Pressure (in.wg)</label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        max={20}
                        value={totalStaticPressure}
                        onChange={(e) => setTotalStaticPressure(parseFloat(e.target.value) || 2.5)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Materials & Gauges */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Casing Materials & Gauges</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Exterior Skin</div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono">Material</label>
                        <select
                          value={exteriorMaterialType}
                          onChange={(e) => setExteriorMaterialType(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                        >
                          <option value="STL GALV PPC">STL GALV PPC (Standard)</option>
                          <option value="STL GALV">STL GALV (Bare)</option>
                          <option value="ALUM">Aluminum</option>
                          <option value="SS304">Stainless Steel 304</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono">Gauge</label>
                        <select
                          value={exteriorMaterialGauge}
                          onChange={(e) => setExteriorMaterialGauge(parseInt(e.target.value, 10))}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                        >
                          <option value={16}>16 GA</option>
                          <option value={18}>18 GA (Standard)</option>
                          <option value={20}>20 GA</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Interior Liner</div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono">Material</label>
                        <select
                          value={interiorMaterialType}
                          onChange={(e) => setInteriorMaterialType(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                        >
                          <option value="STL GALV">STL GALV (Standard)</option>
                          <option value="STL GALV PPC">STL GALV PPC</option>
                          <option value="ALUM">Aluminum</option>
                          <option value="SS304">Stainless Steel 304</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono">Gauge</label>
                        <select
                          value={interiorMaterialGauge}
                          onChange={(e) => setInteriorMaterialGauge(parseInt(e.target.value, 10))}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold"
                        >
                          <option value={18}>18 GA</option>
                          <option value={20}>20 GA</option>
                          <option value={22}>22 GA (Standard)</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Floor & Insulation</div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono">Floor Material</label>
                        <select
                          value={floorMaterialType}
                          onChange={(e) => setFloorMaterialType(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                        >
                          <option value="STL GALV">STL GALV (16 GA Standard)</option>
                          <option value="ALUM TREAD">Aluminum Tread Plate</option>
                          <option value="SS304">Stainless Steel 304</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-mono">Insulation Type</label>
                        <select
                          value={insulationType}
                          onChange={(e) => setInsulationType(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                        >
                          <option value="Foam">Injected Polyurethane Foam</option>
                          <option value="Fiberglass_3lb">3.0 lb Dual-Density Fiberglass</option>
                          <option value="Fiberglass_1.5lb">1.5 lb Fiberglass</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= STEP 2: SHIPPING SKIDS ================= */}
            {activeStep === 'skids' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                      <Box className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Shipping Skids & Base Structure</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Configure any number of skids ($N \ge 1$), custom skid names, and base profiles.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSkid}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all self-start"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Shipping Skid</span>
                  </button>
                </div>

                {/* Skids Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skids.map((skid, idx) => {
                    const assignedSegs = segments.filter(s => s.skidId === skid.id);
                    const calcLen = assignedSegs.reduce((acc, c) => acc + (Number(c.length) || 0), 0);
                    const calcWt = assignedSegs.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);

                    return (
                      <div
                        key={skid.id}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={skid.name}
                              onChange={(e) => handleUpdateSkid(skid.id, { name: e.target.value })}
                              className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                              placeholder={`Skid ${idx + 1}`}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSkid(skid.id)}
                            disabled={skids.length <= 1}
                            className={`p-1.5 rounded-lg transition-colors ${
                              skids.length <= 1
                                ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                : 'hover:bg-red-500/15 text-slate-400 hover:text-red-500'
                            }`}
                            title="Delete Skid"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Metrics Pills */}
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {assignedSegs.length} Segments
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold">
                            Length: {calcLen}"
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                            Weight: {calcWt.toLocaleString()} lbs
                          </span>
                        </div>

                        {/* Base Profile Controls */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 text-xs">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-500">Base Height</label>
                            <select
                              value={skid.baseHeight || defaultBaseHeight}
                              onChange={(e) => handleUpdateSkid(skid.id, { baseHeight: parseFloat(e.target.value) })}
                              className="w-full mt-0.5 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                            >
                              <option value={6.0}>6.0" Channel</option>
                              <option value={8.0}>8.0" Structural</option>
                              <option value={10.0}>10.0" Standard</option>
                              <option value={12.0}>12.0" Heavy</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-slate-500">Base Material</label>
                            <select
                              value={skid.baseMaterial || 'StructuralSteel'}
                              onChange={(e) => handleUpdateSkid(skid.id, { baseMaterial: e.target.value })}
                              className="w-full mt-0.5 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                            >
                              <option value="StructuralSteel">Structural Steel (A36)</option>
                              <option value="FormedSteel">Formed Galvanized</option>
                              <option value="Aluminum">Structural Aluminum</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= STEP 3: SEGMENT SEQUENCE & SIZING ================= */}
            {activeStep === 'segments' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Visual Unit Elevation & Flow Bar */}
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      Visual Unit Flow & Elevation Diagram
                    </span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400">
                      Total Length: {unitMetrics.totalLength}" ({unitMetrics.totalLengthFeet} ft)
                    </span>
                  </div>

                  {/* Flow Strip */}
                  <div className="w-full min-h-[72px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-stretch gap-1 overflow-x-auto">
                    {segments.length === 0 ? (
                      <div className="w-full flex items-center justify-center text-xs text-slate-400 font-mono italic">
                        No segments in unit sequence. Add segments below.
                      </div>
                    ) : (
                      segments.map((seg, idx) => {
                        const style = SEGMENT_COLORS[seg.typeCode] || { bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-700' };
                        const skid = skids.find(s => s.id === seg.skidId);
                        const isLastInSkid = idx === segments.length - 1 || segments[idx + 1]?.skidId !== seg.skidId;

                        return (
                          <React.Fragment key={seg.id || idx}>
                            <div
                              style={{ flexGrow: Math.max(1, Math.round(seg.length / 12)), minWidth: '76px' }}
                              className={`p-2 rounded-lg border flex flex-col justify-between text-center transition-all ${style.bg} ${style.border}`}
                              title={`${seg.name} (${seg.length}") - Assigned to ${skid?.name || 'Skid'}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[10px] font-mono font-bold px-1 rounded bg-black/10 dark:bg-white/10 ${style.text}`}>
                                  {seg.typeCode}
                                </span>
                                <span className="text-[9px] font-mono opacity-80">
                                  #{idx + 1}
                                </span>
                              </div>
                              <div className="text-[11px] font-bold truncate leading-tight my-0.5">
                                {seg.name}
                              </div>
                              <div className="flex items-center justify-between text-[10px] font-mono opacity-85">
                                <span>{seg.length}"L</span>
                                <span className="text-[9px] opacity-75">{skid?.name ? skid.name.replace('Skid ', 'S') : 'S1'}</span>
                              </div>
                            </div>

                            {/* Skid Boundary Marker */}
                            {isLastInSkid && idx < segments.length - 1 && (
                              <div className="flex flex-col items-center justify-center px-1 shrink-0" title="Shipping Split Junction">
                                <div className="h-full border-r-2 border-dashed border-indigo-400/80 dark:border-indigo-500/80" />
                                <span className="text-[8px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 px-1 rounded mt-0.5">
                                  SPLIT
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Add Segment Control Bar */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                      Add Segment:
                    </label>
                    <select
                      value={selectedTemplateCode}
                      onChange={(e) => setSelectedTemplateCode(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {AVAILABLE_SEGMENT_TEMPLATES.map(tmpl => (
                        <option key={tmpl.typeCode} value={tmpl.typeCode}>
                          [{tmpl.typeCode}] {tmpl.name} ({tmpl.defaultLength}") - {tmpl.category}
                        </option>
                      ))}
                    </select>

                    <span className="text-xs text-slate-400 font-mono">into</span>

                    <select
                      value={targetAddSkidId}
                      onChange={(e) => setTargetAddSkidId(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-semibold"
                    >
                      {skids.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddSegmentFromTemplate(selectedTemplateCode)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Insert Segment</span>
                  </button>
                </div>

                {/* Segment Sequence Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        <th className="py-2.5 px-3 w-16 text-center">Order</th>
                        <th className="py-2.5 px-3 w-20">Code</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Segment Name</th>
                        <th className="py-2.5 px-3 w-32">Assigned Skid</th>
                        <th className="py-2.5 px-2 w-20 text-center">Length (in)</th>
                        <th className="py-2.5 px-2 w-20 text-center">Width (in)</th>
                        <th className="py-2.5 px-2 w-20 text-center">Height (in)</th>
                        <th className="py-2.5 px-2 w-24 text-center">Weight (lbs)</th>
                        <th className="py-2.5 px-2 w-20 text-center">Pressure</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Internals & Features</th>
                        <th className="py-2.5 px-3 w-28 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                      {segments.map((seg, idx) => {
                        const style = SEGMENT_COLORS[seg.typeCode] || { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-200' };

                        return (
                          <tr key={seg.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {/* Sequence Controls */}
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-0.5 font-mono font-bold">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveSegment(idx, 'up')}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <span className="w-4 text-center text-xs">{idx + 1}</span>
                                <button
                                  type="button"
                                  disabled={idx === segments.length - 1}
                                  onClick={() => handleMoveSegment(idx, 'down')}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* Type Code */}
                            <td className="py-2 px-3 font-mono font-bold">
                              <span className={`px-2 py-0.5 rounded text-[11px] border ${style.bg} ${style.text} ${style.border}`}>
                                {seg.typeCode}
                              </span>
                            </td>

                            {/* Name */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={seg.name}
                                onChange={(e) => handleUpdateSegment(seg.id, { name: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 font-medium text-slate-900 dark:text-white"
                              />
                            </td>

                            {/* Assigned Skid */}
                            <td className="py-2 px-3">
                              <select
                                value={seg.skidId}
                                onChange={(e) => handleUpdateSegment(seg.id, { skidId: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400"
                              >
                                {skids.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Length */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={6}
                                max={300}
                                value={seg.length}
                                onChange={(e) => handleUpdateSegment(seg.id, { length: parseFloat(e.target.value) || 0 })}
                                className="w-16 px-1.5 py-1 text-center font-mono rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                              />
                            </td>

                            {/* Width */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={12}
                                max={300}
                                value={seg.width || defaultUnitWidth}
                                onChange={(e) => handleUpdateSegment(seg.id, { width: parseFloat(e.target.value) || defaultUnitWidth })}
                                className="w-16 px-1.5 py-1 text-center font-mono rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                              />
                            </td>

                            {/* Height */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={12}
                                max={300}
                                value={seg.height || defaultUnitHeight}
                                onChange={(e) => handleUpdateSegment(seg.id, { height: parseFloat(e.target.value) || defaultUnitHeight })}
                                className="w-16 px-1.5 py-1 text-center font-mono rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                              />
                            </td>

                            {/* Weight */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={50}
                                step={50}
                                value={seg.weight}
                                onChange={(e) => handleUpdateSegment(seg.id, { weight: parseFloat(e.target.value) || 0 })}
                                className="w-20 px-1.5 py-1 text-center font-mono rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                              />
                            </td>

                            {/* Pressure */}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleUpdateSegment(seg.id, { airPressureType: seg.airPressureType === 'Positive' ? 'Negative' : 'Positive' })}
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-colors ${
                                  seg.airPressureType === 'Positive'
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                                    : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                }`}
                              >
                                {seg.airPressureType === 'Positive' ? '+ Pos' : '- Neg'}
                              </button>
                            </td>

                            {/* Internals Tags */}
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap items-center gap-1">
                                {seg.internals.map((intern, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300"
                                  >
                                    <span className="truncate max-w-[120px]">{intern}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInternal(seg.id, iIdx)}
                                      className="hover:text-red-500"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const feature = prompt('Enter internal equipment name (e.g. "Drain Pan", "EBM Fan Wall", "HEPA Filter"):');
                                    if (feature?.trim()) {
                                      handleUpdateSegment(seg.id, { internals: [...seg.internals, feature.trim()] });
                                    }
                                  }}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-dashed border-slate-400 dark:border-slate-600 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                >
                                  + feature
                                </button>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1 text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateSegment(seg.id)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                                  title="Duplicate"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSegment(seg.id)}
                                  className="p-1 rounded hover:bg-red-500/15 hover:text-red-500"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ================= STEP 4: REVIEW & CONFIRM ================= */}
            {activeStep === 'review' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Scorecard */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Total Unit Length</div>
                    <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                      {unitMetrics.totalLength}"
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {unitMetrics.totalLengthFeet} feet
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Unit Dimensions (W × H)</div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {unitMetrics.maxW}" × {unitMetrics.totalHeightWithBase}"
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Includes {defaultBaseHeight}" base
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Calculated Weight</div>
                    <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      {unitMetrics.totalWeight.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      lbs (Dry Casing & Internals)
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Skids & Segments</div>
                    <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                      {skids.length} Skids
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {segments.length} Segments total
                    </div>
                  </div>
                </div>

                {/* Detailed Skid Breakdown Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Box className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Shipping Split Allocation Schedule</span>
                  </h4>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-500">
                          <th className="py-2.5 px-3">Skid Name</th>
                          <th className="py-2.5 px-3">Base Specs</th>
                          <th className="py-2.5 px-3">Segment Sequence</th>
                          <th className="py-2.5 px-3 text-center">Skid Length</th>
                          <th className="py-2.5 px-3 text-center">Skid Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                        {unitMetrics.skidBreakdown.map((skid) => (
                          <tr key={skid.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                              {skid.name}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {skid.baseHeight || defaultBaseHeight}" {skid.baseMaterial || 'StructuralSteel'}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {skid.segments.map((s, sIdx) => (
                                  <span
                                    key={s.id || sIdx}
                                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-mono"
                                  >
                                    <strong className="text-blue-600 dark:text-blue-400">{s.typeCode}</strong>: {s.name} ({s.length}")
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                              {skid.calculatedLength}"
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {skid.calculatedWeight.toLocaleString()} lbs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Confirmation Callout */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
                  <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-blue-900 dark:text-blue-200">
                      Ready to Initialize Verification Project
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">
                      The application will synthesize a fully-formed normalized XML model, register all domain facts with authoritative manual provenance, evaluate all AST verification rules across unit and skids, and generate compliant OpenXML deliverables.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {activeStep !== 'general' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep === 'review') setActiveStep('segments');
                    else if (activeStep === 'segments') setActiveStep('skids');
                    else if (activeStep === 'skids') setActiveStep('general');
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  Back
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              {activeStep !== 'review' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep === 'general') setActiveStep('skids');
                    else if (activeStep === 'skids') setActiveStep('segments');
                    else if (activeStep === 'segments') setActiveStep('review');
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Initialize Workspace</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
