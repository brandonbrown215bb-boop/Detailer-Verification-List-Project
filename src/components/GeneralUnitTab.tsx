import React, { useState } from 'react';
import { Fact, SpecialQuote, NormalizedXmlGraph } from '../types';
import {
  Layers,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Ruler,
  Cpu,
  GripVertical,
  ShieldCheck,
  Box,
  Wrench,
  Zap,
  CheckCircle2,
  X,
  ChevronDown,
  Sliders
} from 'lucide-react';
import { InlineFactPopover } from './InlineFactPopover';
import { SegmentMaterialsTable } from './SegmentMaterialsTable';

interface GeneralUnitTabProps {
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  graph: NormalizedXmlGraph;
  generalComments: string;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  onRevertFact: (key: string) => void;
  onUpdateSqItems: (items: SpecialQuote[]) => void;
  onUpdateComments: (comments: string) => void;
  onOpenResolutionCenter: () => void;
  onOpenDetailerModal?: () => void;
}

const ONLY_SHOW_WHEN_TRUE_FACTS = [
  { key: 'unit.curbrest', label: 'Curbrest Option', icon: CheckCircle2, description: 'Roof curb rest channel' },
  { key: 'unit.isTiered', label: 'Tiered Unit', icon: Layers, description: 'Multi-level upper tier segments' },
  { key: 'unit.isStacked', label: 'Stacked Unit', icon: Box, description: 'Upper base stacked unit assembly' },
  { key: 'unit.knockdown', label: 'Knockdown Construction', icon: Wrench, description: 'Ships field-disassembled' },
  { key: 'unit.noa', label: 'NOA Certified', icon: ShieldCheck, description: 'Miami-Dade Notice of Acceptance' },
  { key: 'unit.isSeismic', label: 'Seismic Certified', icon: Zap, description: 'IBC / OSHPD seismic compliance' }
];

export const GeneralUnitTab: React.FC<GeneralUnitTabProps> = ({
  facts,
  sqItems,
  graph,
  generalComments,
  onUpdateFact,
  onRevertFact,
  onUpdateSqItems,
  onUpdateComments,
  onOpenResolutionCenter,
  onOpenDetailerModal
}) => {
  const [newSqText, setNewSqText] = useState('');
  const [newSqScope, setNewSqScope] = useState('all');
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [isAddOptionOpen, setIsAddOptionOpen] = useState(false);

  // Helper to render provenance badge
  const renderProvenanceBadge = (fact: Fact) => {
    if (fact.status === 'ManuallyOverridden') {
      return (
        <div className="flex items-center gap-1 shrink-0">
          <span
            title="Overridden by detailer"
            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30 whitespace-nowrap"
          >
            Overridden
          </span>
          <button
            onClick={() => onRevertFact(fact.key)}
            title="Revert to original value"
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      );
    }

    if (fact.confidence === 'RequiresConfirmation' || fact.status === 'Unknown') {
      return (
        <InlineFactPopover
          factKey={fact.key}
          fact={fact}
          label={fact.label}
          onUpdateFact={onUpdateFact}
          triggerButtonText="Enter"
          compact={true}
        />
      );
    }

    if (fact.status === 'Derived') {
      return (
        <span
          title="Derived from XML structure"
          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-500/30 whitespace-nowrap shrink-0"
        >
          Derived
        </span>
      );
    }

    return (
      <span
        title={`Source: ${fact.sourcePointer || 'Config.xml'}`}
        className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-500/30 whitespace-nowrap shrink-0"
      >
        Auto: XML
      </span>
    );
  };

  const handleAddSq = () => {
    if (!newSqText.trim()) return;

    // Find next available slot 1..N
    const usedSlots = new Set(sqItems.map(s => s.slot));
    let nextSlot = 1;
    while (usedSlots.has(nextSlot)) {
      nextSlot++;
    }

    const isSkidTag = newSqScope.startsWith('skid:');

    const newItem: SpecialQuote = {
      slot: nextSlot,
      id: `sq-${Date.now()}`,
      text: newSqText.trim(),
      linkedSkidId: isSkidTag ? newSqScope.replace('skid:', '') : undefined,
      initials: 'TD',
      isCompleted: false
    };

    onUpdateSqItems([...sqItems, newItem].sort((a, b) => a.slot - b.slot));
    setNewSqText('');
  };

  const handleDeleteSq = (slot: number) => {
    onUpdateSqItems(sqItems.filter(s => s.slot !== slot));
  };

  const handleUpdateSqText = (slot: number, text: string) => {
    onUpdateSqItems(
      sqItems.map(s => (s.slot === slot ? { ...s, text } : s))
    );
  };

  const handleToggleSqDone = (slot: number) => {
    onUpdateSqItems(
      sqItems.map(s => (s.slot === slot ? { ...s, isCompleted: !s.isCompleted } : s))
    );
  };

  // Drag and Drop reordering
  const handleDragStart = (slot: number) => {
    setDraggedSlot(slot);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnSlot = (targetSlot: number) => {
    if (draggedSlot === null || draggedSlot === targetSlot) return;

    const sourceItem = sqItems.find(s => s.slot === draggedSlot);
    const targetItem = sqItems.find(s => s.slot === targetSlot);

    if (!sourceItem) return;

    let updated: SpecialQuote[];
    if (targetItem) {
      updated = sqItems.map(s => {
        if (s.slot === draggedSlot) return { ...s, slot: targetSlot };
        if (s.slot === targetSlot) return { ...s, slot: draggedSlot };
        return s;
      });
    } else {
      updated = sqItems.map(s => (s.slot === draggedSlot ? { ...s, slot: targetSlot } : s));
    }

    onUpdateSqItems(updated.sort((a, b) => a.slot - b.slot));
    setDraggedSlot(null);
  };

  const unitTypeVal = String(facts['unit.unitType']?.value || graph.unitOptions.unitType || 'Outdoor');
  const isOutdoor = unitTypeVal !== 'Indoor';

  // Unit Specifications Facts (core geometry & general casing specs)
  const unitSpecFacts = [
    'unit.unitType',
    'unit.shellType',
    'unit.thermalBreak',
    'unit.baseHeight',
    'unit.lipHeight',
    ...(isOutdoor ? ['roof.roofPeak'] : []),
    'unit.totalStaticPressure'
  ];

  const activeFeatures = ONLY_SHOW_WHEN_TRUE_FACTS.filter(item => {
    const fact = facts[item.key];
    return Boolean(fact?.value === true || fact?.value === 'true' || fact?.value === 'Yes');
  });

  const renderField = (key: string) => {
    const fact = facts[key];
    if (!fact) return null;

    const isDetailerField = key === 'unit.detailer';
    const displayValue = typeof fact.value === 'boolean'
      ? (fact.value ? 'Yes' : 'No')
      : (fact.value !== null && fact.value !== undefined ? String(fact.value) : '');

    return (
      <div
        key={key}
        className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/40 last:border-0 transition-colors group"
      >
        {/* Label & Source Pointer */}
        <div className="flex flex-col min-w-0 flex-1 pr-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
            {fact.label}
          </span>
          {fact.sourcePointer ? (
            <span
              className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[240px]"
              title={fact.sourcePointer}
            >
              {fact.sourcePointer.split('/').slice(-2).join('/')}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              {fact.promptNote ? 'User Specified' : 'General Specification'}
            </span>
          )}
        </div>

        {/* Value Input / Custom Controls & Provenance Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {isDetailerField && onOpenDetailerModal ? (
            <button
              onClick={onOpenDetailerModal}
              title="Click to edit Detailer Name profile"
              className="w-44 sm:w-52 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-right text-slate-900 dark:text-slate-100 hover:border-blue-500 transition-all shadow-inner"
            >
              {fact.value ? String(fact.value) : <span className="text-amber-500 font-bold">Set Detailer Name</span>}
            </button>
          ) : key === 'unit.unitType' ? (
            <select
              value={String(fact.value || 'Outdoor')}
              onChange={(e) => onUpdateFact(key, e.target.value, 'Detailer')}
              className="w-44 sm:w-52 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-700/80 focus:border-blue-500 rounded-md text-right text-slate-900 dark:text-slate-100 outline-none transition-all shadow-inner font-semibold"
            >
              <option value="Outdoor">Outdoor</option>
              <option value="Indoor">Indoor</option>
            </select>
          ) : key === 'unit.shellType' ? (
            <select
              value={String(fact.value || 'ISG').toUpperCase() === 'CAD' ? 'CAD' : 'ISG'}
              onChange={(e) => onUpdateFact(key, e.target.value, 'Detailer')}
              className="w-44 sm:w-52 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-700/80 focus:border-blue-500 rounded-md text-right text-slate-900 dark:text-slate-100 outline-none transition-all shadow-inner font-semibold"
            >
              <option value="ISG">ISG</option>
              <option value="CAD">CAD</option>
            </select>
          ) : key === 'unit.thermalBreak' ? (
            <button
              type="button"
              onClick={() => onUpdateFact(key, !Boolean(fact.value), 'Detailer')}
              className={`w-44 sm:w-52 px-3 py-1.5 text-xs font-mono rounded-md border text-center font-bold transition-all shadow-inner flex items-center justify-between ${
                Boolean(fact.value)
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750'
              }`}
            >
              <span className="text-[10px] text-slate-400 font-normal">State:</span>
              <span>{Boolean(fact.value) ? 'Yes (Thermal Break)' : 'No (Standard)'}</span>
            </button>
          ) : key === 'roof.roofPeak' ? (
            <select
              value={String(fact.value || 'Internal (Center)')}
              onChange={(e) => onUpdateFact(key, e.target.value, 'Detailer')}
              className="w-44 sm:w-52 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-700/80 focus:border-blue-500 rounded-md text-right text-slate-900 dark:text-slate-100 outline-none transition-all shadow-inner font-semibold"
            >
              <option value="Internal (Center)">Internal (Center)</option>
              <option value="Left">Left</option>
              <option value="Right">Right</option>
            </select>
          ) : (
            <input
              type="text"
              value={displayValue}
              placeholder={fact.promptNote || 'Enter value...'}
              onChange={(e) => onUpdateFact(key, e.target.value)}
              className="w-44 sm:w-52 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-700/80 focus:border-blue-500 rounded-md text-right text-slate-900 dark:text-slate-100 outline-none transition-all shadow-inner"
            />
          )}
          <div className="min-w-[80px] flex justify-end">
            {renderProvenanceBadge(fact)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-slate-800 dark:text-slate-100">
      {/* Active Features & Options Bar (Only Show When True) */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Active Unit Features & Options
            </h3>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              Only True Attributes Shown
            </span>
          </div>

          {/* Add / Toggle Feature Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsAddOptionOpen(!isAddOptionOpen)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Toggle Option</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isAddOptionOpen && (
              <div
                className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl shadow-xl z-30 p-2 space-y-1"
                onMouseLeave={() => setIsAddOptionOpen(false)}
              >
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 uppercase tracking-wider">
                  Enable Unit Features
                </div>
                {ONLY_SHOW_WHEN_TRUE_FACTS.map(item => {
                  const fact = facts[item.key];
                  const isCurrentlyActive = Boolean(fact?.value === true || fact?.value === 'true' || fact?.value === 'Yes');
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onUpdateFact(item.key, !isCurrentlyActive, 'Detailer', isCurrentlyActive ? 'Turned off' : 'Activated option');
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                        isCurrentlyActive
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isCurrentlyActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                        <div>
                          <div>{item.label}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{item.description}</div>
                        </div>
                      </div>
                      {isCurrentlyActive ? (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">+ Enable</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Feature Badges Display */}
        {activeFeatures.length === 0 ? (
          <div className="py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 font-mono">
            No special construction features active (Standard commercial configuration).
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5 pt-1">
            {activeFeatures.map(item => {
              const fact = facts[item.key];
              const Icon = item.icon;
              if (!fact) return null;

              return (
                <div
                  key={item.key}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-blue-500/40 transition-colors group"
                >
                  <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      Active: Yes
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                    {renderProvenanceBadge(fact)}
                    <button
                      onClick={() => onUpdateFact(item.key, false, 'Detailer', 'Disabled feature')}
                      title="Disable feature"
                      className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unit Casing Specifications & Ratings Full-Width Card with 2-Column Grid */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Unit Casing Specifications & Ratings
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
            Verification List: D7..D18
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
          {unitSpecFacts.map(renderField)}
        </div>
      </div>

      {/* Segment-Based Materials & Gauges Schedule Breakdown */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Materials & Gauges Schedule (Segment Breakdown)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
            {graph.segments.length} Segments Evaluated
          </span>
        </div>

        <SegmentMaterialsTable graph={graph} />
      </div>

      {/* Special Quotes (SQ) & Deviation Manager */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              Special Quotes (SQs) & Detailing Deviations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Notated project Special Quotes and deviations mapped to Excel deliverable columns G & H.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {sqItems.length} SQs Active
            </span>
          </div>
        </div>

        {/* Add SQ Form (Rules removed from dropdown) */}
        <div className="flex flex-col lg:flex-row items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <input
            type="text"
            placeholder="Add new Special Quote (e.g. SQ-101: Custom drain pan depth 3.5 in)..."
            value={newSqText}
            onChange={(e) => setNewSqText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSq()}
            className="flex-1 w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
          />

          <select
            value={newSqScope}
            onChange={(e) => setNewSqScope(e.target.value)}
            className="w-full lg:w-56 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 font-mono"
          >
            <option value="all">Tag: General Unit</option>
            <optgroup label="Shipping Skids">
              {graph.skids.map(s => (
                <option key={s.id} value={`skid:${s.id}`}>Tag: {s.name}</option>
              ))}
            </optgroup>
          </select>

          <button
            onClick={handleAddSq}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Special Quote</span>
          </button>
        </div>

        {/* SQ Slots Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center"></th>
                <th className="py-2.5 px-3 w-16 text-center">Slot</th>
                <th className="py-2.5 px-4">Description / Special Quote Text</th>
                <th className="py-2.5 px-4 w-44">Linked Scope</th>
                <th className="py-2.5 px-4 w-28 text-center">Status</th>
                <th className="py-2.5 px-4 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
              {sqItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 font-mono">
                    No Special Quotes added. Use the form above to add detailing SQ items.
                  </td>
                </tr>
              ) : (
                sqItems.map((sq) => {
                  const linkedSkid = graph.skids.find(s => s.id === sq.linkedSkidId);

                  return (
                    <tr
                      key={sq.id}
                      draggable
                      onDragStart={() => handleDragStart(sq.slot)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnSlot(sq.slot)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 group transition-colors cursor-move ${
                        draggedSlot === sq.slot ? 'opacity-40 bg-blue-50 dark:bg-blue-950/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2 text-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <GripVertical className="w-4 h-4 mx-auto" />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block w-8 py-0.5 text-center font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded">
                          {sq.slot}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={sq.text}
                          onChange={(e) => handleUpdateSqText(sq.slot, e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 text-slate-900 dark:text-slate-200 focus:bg-slate-50 dark:focus:bg-slate-850 px-2 py-1 rounded outline-none text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold ${
                          linkedSkid
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {linkedSkid ? linkedSkid.name : 'General Unit'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleSqDone(sq.slot)}
                          className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-all ${
                            sq.isCompleted
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {sq.isCompleted ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                          {sq.isCompleted ? 'Verified' : 'Pending'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleDeleteSq(sq.slot)}
                          title="Delete SQ item"
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Detailer Comments */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          General Additional Comments
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
          Will be written to cell D22 of the official 'Verification List' workbook sheet.
        </p>
        <textarea
          rows={3}
          value={generalComments}
          onChange={(e) => onUpdateComments(e.target.value)}
          placeholder="Add general unit verification notes, checker remarks, or special manufacturing instructions..."
          className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none transition-colors shadow-inner"
        />
      </div>
    </div>
  );
};
