import React, { useState } from 'react';
import { Fact, SpecialQuote, NormalizedXmlGraph, RuleDefinition } from '../types';
import {
  Layers,
  RotateCcw,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  Building2,
  Ruler,
  Cpu,
  ShieldAlert,
  GripVertical
} from 'lucide-react';
import { InlineFactPopover } from './InlineFactPopover';
import { RULES_CATALOG } from '../services/rulesCatalog';

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
}

export const GeneralUnitTab: React.FC<GeneralUnitTabProps> = ({
  facts,
  sqItems,
  graph,
  generalComments,
  onUpdateFact,
  onRevertFact,
  onUpdateSqItems,
  onUpdateComments,
  onOpenResolutionCenter
}) => {
  const [newSqText, setNewSqText] = useState('');
  const [newSqScope, setNewSqScope] = useState('all');
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);

  // Helper to render provenance badge with no-wrap and crisp styling
  const renderProvenanceBadge = (fact: Fact) => {
    if (fact.status === 'ManuallyOverridden') {
      return (
        <div className="flex items-center gap-1 shrink-0">
          <span
            title="Overridden by detailer"
            className="text-[10px] font-mono px-2 py-1 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30 whitespace-nowrap"
          >
            Overridden
          </span>
          <button
            onClick={() => onRevertFact(fact.key)}
            title="Revert to original Config.xml value"
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
          triggerButtonText="Confirm"
          compact={true}
        />
      );
    }

    if (fact.status === 'Derived') {
      return (
        <span
          title="Derived from XML rules"
          className="text-[10px] font-mono px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-500/30 whitespace-nowrap shrink-0"
        >
          Derived
        </span>
      );
    }

    return (
      <span
        title={`Source: ${fact.sourcePointer || 'Config.xml'}`}
        className="text-[10px] font-mono px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-500/30 whitespace-nowrap shrink-0"
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

    const isRuleTag = newSqScope.startsWith('rule:');
    const isSkidTag = newSqScope.startsWith('skid:');

    const newItem: SpecialQuote = {
      slot: nextSlot,
      id: `sq-${Date.now()}`,
      text: newSqText.trim(),
      linkedSkidId: isSkidTag ? newSqScope.replace('skid:', '') : undefined,
      linkedRuleId: isRuleTag ? newSqScope.replace('rule:', '') : undefined,
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
      // Swap slots
      updated = sqItems.map(s => {
        if (s.slot === draggedSlot) return { ...s, slot: targetSlot };
        if (s.slot === targetSlot) return { ...s, slot: draggedSlot };
        return s;
      });
    } else {
      // Move to empty slot
      updated = sqItems.map(s => (s.slot === draggedSlot ? { ...s, slot: targetSlot } : s));
    }

    onUpdateSqItems(updated.sort((a, b) => a.slot - b.slot));
    setDraggedSlot(null);
  };

  // Group facts logically
  const orderFacts = [
    'unit.jobName',
    'unit.orderNumber',
    'unit.comNumber',
    'unit.tag',
    'unit.productType',
    'unit.detailer',
    'unit.date'
  ];
  const geometryFacts = [
    'unit.shellType',
    'unit.unitType',
    'unit.baseHeight',
    'unit.wallThickness',
    'unit.thermalBreak',
    'unit.roofPeak',
    'unit.curbrest',
    'unit.utl',
    'unit.totalWeight',
    'unit.totalStaticPressure'
  ];
  const materialFacts = [
    'unit.skinMaterial',
    'unit.skinGauge',
    'unit.linerMaterial',
    'unit.linerGauge',
    'unit.floorMaterial',
    'unit.floorGauge'
  ];
  const ratingFacts = [
    'unit.noa',
    'unit.isSeismic',
    'unit.location',
    'unit.knockdown'
  ];

  const renderField = (key: string) => {
    const fact = facts[key];
    if (!fact) return null;

    return (
      <div
        key={key}
        className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/40 last:border-0 transition-colors group"
      >
        {/* Label & Source Pointer */}
        <div className="flex flex-col min-w-0 flex-1 pr-2">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
            {fact.label}
          </span>
          {fact.sourcePointer ? (
            <span
              className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[260px]"
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

        {/* Value Input & Provenance Badge */}
        <div className="flex items-center gap-2.5 shrink-0">
          <input
            type="text"
            value={fact.value !== null && fact.value !== undefined ? String(fact.value) : ''}
            placeholder={fact.promptNote || 'Enter value...'}
            onChange={(e) => onUpdateFact(key, e.target.value)}
            className="w-48 sm:w-56 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-950/70 hover:bg-slate-50 dark:hover:bg-slate-950 focus:bg-white dark:focus:bg-slate-950 border border-slate-300 dark:border-slate-700/80 focus:border-blue-500 rounded-md text-right text-slate-900 dark:text-slate-100 outline-none transition-all shadow-inner"
          />
          <div className="min-w-[90px] flex justify-end">
            {renderProvenanceBadge(fact)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-slate-800 dark:text-slate-100">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 dark:from-blue-900/30 dark:via-indigo-900/20 dark:to-slate-900 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-6 shadow-sm dark:shadow-xl transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold tracking-wide border border-blue-500/30">
                CONFIG.XML INGESTION COMPLETE
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {graph.generatingSoftware} • Schema {graph.documentVersion}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {facts['unit.jobName']?.value || 'AHU Unit Specifications'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed">
              Auto-extracted {graph.segments.length} segments across {graph.skids.length} shipping skids. {graph.bases.length} unit bases evaluated with upturned lip (UTL) detection.
              Authoritative parameters are pre-populated with active provenance tracking.
            </p>
          </div>

          <div className="flex items-center gap-6 bg-white dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Total Unit Weight</div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {graph.unitWeight.toLocaleString()} lbs
              </div>
            </div>
            <div className="text-right pl-6 border-l border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Enclosure Box</div>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                {graph.dimensions.length}"L × {graph.dimensions.width}"W × {graph.dimensions.height}"H
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Balanced Specifications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Card 1: Order & Identity */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Order & Identity
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                Verification List: D3..D6
              </span>
            </div>
            <div className="space-y-1">
              {orderFacts.map(renderField)}
            </div>
          </div>

          {/* Card 2: Geometry & Casing */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Geometry & Casing Dimensions
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                CAD Dimensions
              </span>
            </div>
            <div className="space-y-1">
              {geometryFacts.map(renderField)}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Card 3: Materials & Gauges */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Materials & Gauges
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                BOM Schedule
              </span>
            </div>
            <div className="space-y-1">
              {materialFacts.map(renderField)}
            </div>
          </div>

          {/* Card 4: Ratings & Regulatory */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Ratings, Certifications & Options
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                Detailer Action
              </span>
            </div>
            <div className="space-y-1">
              {ratingFacts.map(renderField)}
            </div>
          </div>
        </div>
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
              Notated project Special Quotes and deviations. Drag handles to reorder items.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {sqItems.length} SQs Active
            </span>
          </div>
        </div>

        {/* Add SQ Form */}
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
            className="w-full lg:w-64 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 font-mono"
          >
            <option value="all">Tag: General Unit</option>
            <optgroup label="Shipping Skids">
              {graph.skids.map(s => (
                <option key={s.id} value={`skid:${s.id}`}>Tag: {s.name}</option>
              ))}
            </optgroup>
            <optgroup label="Specific Rules">
              {RULES_CATALOG.slice(0, 15).map(r => (
                <option key={r.id} value={`rule:${r.id}`}>Tag Rule: {r.id}</option>
              ))}
            </optgroup>
          </select>

          <button
            onClick={handleAddSq}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add SQ Slot</span>
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
                <th className="py-2.5 px-4 w-48">Linked Scope</th>
                <th className="py-2.5 px-4 w-28 text-center">Status</th>
                <th className="py-2.5 px-4 w-20 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
              {sqItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 font-mono">
                    No Special Quotes added yet. Use the form above to add up to 22 detailing SQ items.
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
                      <td className="py-3 px-2 text-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <GripVertical className="w-4 h-4 mx-auto" />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block w-8 py-0.5 text-center font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded">
                          {sq.slot}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={sq.text}
                          onChange={(e) => handleUpdateSqText(sq.slot, e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 text-slate-900 dark:text-slate-200 focus:bg-slate-50 dark:focus:bg-slate-850 px-2 py-1 rounded outline-none text-xs"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold ${
                          linkedSkid
                            ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                            : sq.linkedRuleId
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {linkedSkid ? linkedSkid.name : sq.linkedRuleId ? `Rule: ${sq.linkedRuleId}` : 'General Unit'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleSqDone(sq.slot)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                            sq.isCompleted
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {sq.isCompleted ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : null}
                          {sq.isCompleted ? 'Verified' : 'Pending'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteSq(sq.slot)}
                          title="Delete SQ slot"
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
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
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
