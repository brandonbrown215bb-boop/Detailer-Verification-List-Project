import React, { useState } from 'react';
import { Fact, SpecialQuote, NormalizedXmlGraph } from '../types';
import {
  Layers,
  RotateCcw,
  Check,
  AlertTriangle,
  FileCheck,
  Plus,
  Trash2,
  ExternalLink,
  Edit2,
  Info,
  ShieldCheck,
  Building2,
  Ruler,
  Cpu,
  ShieldAlert
} from 'lucide-react';

interface GeneralUnitTabProps {
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  graph: NormalizedXmlGraph;
  generalComments: string;
  onUpdateFact: (key: string, value: any, note?: string) => void;
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
  const [newSqSkid, setNewSqSkid] = useState('all');

  // Helper to render provenance badge with no-wrap and crisp styling
  const renderProvenanceBadge = (fact: Fact) => {
    if (fact.status === 'ManuallyOverridden') {
      return (
        <div className="flex items-center gap-1 shrink-0">
          <span
            title="Overridden by detailer"
            className="text-[10px] font-mono px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40 whitespace-nowrap"
          >
            Overridden
          </span>
          <button
            onClick={() => onRevertFact(fact.key)}
            title="Revert to original Config.xml value"
            className="p-1 rounded hover:bg-slate-750 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      );
    }

    if (fact.confidence === 'RequiresConfirmation' || fact.status === 'Unknown') {
      return (
        <button
          onClick={onOpenResolutionCenter}
          className="flex items-center gap-1 text-[10px] font-mono px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 hover:bg-amber-500/30 whitespace-nowrap transition-all shadow-sm"
        >
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Confirm</span>
        </button>
      );
    }

    if (fact.status === 'Derived') {
      return (
        <span
          title="Derived from XML rules"
          className="text-[10px] font-mono px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30 whitespace-nowrap shrink-0"
        >
          Derived
        </span>
      );
    }

    return (
      <span
        title={`Source: ${fact.sourcePointer || 'Config.xml'}`}
        className="text-[10px] font-mono px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 font-medium border border-emerald-500/30 whitespace-nowrap shrink-0"
      >
        Auto: XML
      </span>
    );
  };

  const handleAddSq = () => {
    if (!newSqText.trim()) return;
    if (sqItems.length >= 22) {
      alert('Maximum of 22 Special Quote slots reached.');
      return;
    }

    // Find first available slot 1..22
    const usedSlots = new Set(sqItems.map(s => s.slot));
    let nextSlot = 1;
    while (nextSlot <= 22 && usedSlots.has(nextSlot)) {
      nextSlot++;
    }

    const newItem: SpecialQuote = {
      slot: nextSlot,
      id: `sq-${Date.now()}`,
      text: newSqText.trim(),
      linkedSkidId: newSqSkid === 'all' ? undefined : newSqSkid,
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

  // Group facts logically
  const orderFacts = ['unit.jobName', 'unit.comNumber', 'unit.detailer', 'unit.date'];
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
        className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg hover:bg-slate-800/50 border-b border-slate-800/40 last:border-0 transition-colors group"
      >
        {/* Label & Source Pointer */}
        <div className="flex flex-col min-w-0 flex-1 pr-2">
          <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
            {fact.label}
          </span>
          {fact.sourcePointer ? (
            <span
              className="text-[10px] font-mono text-slate-400 truncate max-w-[260px]"
              title={fact.sourcePointer}
            >
              {fact.sourcePointer.split('/').slice(-2).join('/')}
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-400">
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
            className="w-48 sm:w-56 px-3 py-1.5 text-xs font-mono bg-slate-950/70 hover:bg-slate-950 focus:bg-slate-950 border border-slate-700/80 focus:border-blue-500 rounded-md text-right text-slate-100 outline-none transition-all shadow-inner"
          />
          <div className="w-24 flex justify-end">
            {renderProvenanceBadge(fact)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-slate-900 border border-blue-800/40 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono text-xs font-bold tracking-wide border border-blue-500/30">
                CONFIG.XML INGESTION COMPLETE
              </span>
              <span className="text-xs font-mono text-slate-400">
                {graph.generatingSoftware} • Schema {graph.documentVersion}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {facts['unit.jobName']?.value || 'AHU Unit Specifications'}
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Auto-extracted 24 segments across 4 shipping skids. 9 unit bases evaluated with 2.0" upturned lip (UTL) detection.
              Authoritative parameters are pre-populated with active provenance tracking.
            </p>
          </div>

          <div className="flex items-center gap-6 bg-slate-950/60 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-mono">Total Unit Weight</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {graph.unitWeight.toLocaleString()} lbs
              </div>
            </div>
            <div className="text-right pl-6 border-l border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono">Enclosure Box</div>
              <div className="text-sm font-bold font-mono text-slate-100">
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
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Order & Identity
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                Verification List: D3..D6
              </span>
            </div>
            <div className="space-y-1">
              {orderFacts.map(renderField)}
            </div>
          </div>

          {/* Card 2: Geometry & Casing */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Geometry & Casing Dimensions
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
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
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Materials & Gauges
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                BOM Schedule
              </span>
            </div>
            <div className="space-y-1">
              {materialFacts.map(renderField)}
            </div>
          </div>

          {/* Card 4: Ratings & Regulatory */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Ratings, Certifications & Options
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800">
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              Special Quotes (SQs) & Detailing Deviations
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Mapped to official 22-slot table on 'Verification List' (Rows 4–25, Columns G & H). Linked SQs appear on Skid headers and rules.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-300">
              {sqItems.length} / 22 Slots Active
            </span>
          </div>
        </div>

        {/* Add SQ Form */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <input
            type="text"
            placeholder="Add new Special Quote (e.g. SQ-101: Custom drain pan depth 3.5 in)..."
            value={newSqText}
            onChange={(e) => setNewSqText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSq()}
            className="flex-1 w-full px-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
          />

          <select
            value={newSqSkid}
            onChange={(e) => setNewSqSkid(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-300 outline-none focus:border-blue-500 font-mono"
          >
            <option value="all">Tag: General Unit</option>
            {graph.skids.map(s => (
              <option key={s.id} value={s.id}>Tag: {s.name}</option>
            ))}
          </select>

          <button
            onClick={handleAddSq}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add SQ Slot</span>
          </button>
        </div>

        {/* SQ Slots Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-850 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-4 w-16 text-center">Slot</th>
                <th className="py-2.5 px-4">Description / Special Quote Text</th>
                <th className="py-2.5 px-4 w-44">Linked Scope</th>
                <th className="py-2.5 px-4 w-28 text-center">Status</th>
                <th className="py-2.5 px-4 w-20 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
              {sqItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-mono">
                    No Special Quotes added yet. Use the form above to add up to 22 detailing SQ items.
                  </td>
                </tr>
              ) : (
                sqItems.map((sq) => {
                  const linkedSkid = graph.skids.find(s => s.id === sq.linkedSkidId);

                  return (
                    <tr key={sq.id} className="hover:bg-slate-800/40 group transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block w-8 py-0.5 text-center font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded">
                          {sq.slot}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={sq.text}
                          onChange={(e) => handleUpdateSqText(sq.slot, e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 text-slate-200 focus:bg-slate-850 px-2 py-1 rounded outline-none text-xs"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold ${
                          linkedSkid
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {linkedSkid ? linkedSkid.name : 'General Unit'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleSqDone(sq.slot)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                            sq.isCompleted
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {sq.isCompleted ? <Check className="w-3 h-3 text-emerald-400" /> : null}
                          {sq.isCompleted ? 'Verified' : 'Pending'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteSq(sq.slot)}
                          title="Delete SQ slot"
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-2">
        <h3 className="text-sm font-bold text-white">
          General Additional Comments
        </h3>
        <p className="text-xs text-slate-400 leading-tight">
          Will be written to cell D22 of the official 'Verification List' workbook sheet.
        </p>
        <textarea
          rows={3}
          value={generalComments}
          onChange={(e) => onUpdateComments(e.target.value)}
          placeholder="Add general unit verification notes, checker remarks, or special manufacturing instructions..."
          className="w-full p-3.5 text-xs bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-400 focus:border-blue-500 outline-none transition-colors shadow-inner"
        />
      </div>
    </div>
  );
};
