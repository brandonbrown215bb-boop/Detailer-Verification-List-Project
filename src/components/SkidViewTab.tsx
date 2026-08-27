import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShippingSkid,
  Segment,
  UnitBase,
  ChecklistInstance,
  RuleDefinition,
  SpecialQuote,
  Fact,
  CheckStatus,
  SkidViewMode
} from '../types';
import {
  Box,
  Layers,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  LayoutGrid,
  Table,
  Keyboard,
  Info
} from 'lucide-react';
import { InlineFactPopover } from './InlineFactPopover';

interface SkidViewTabProps {
  skid: ShippingSkid;
  segments: Segment[];
  bases: UnitBase[];
  checklists: ChecklistInstance[];
  rules: RuleDefinition[];
  sqItems: SpecialQuote[];
  facts: Record<string, Fact>;
  onUpdateChecklistStatus: (instanceKey: string, status: CheckStatus) => void;
  onUpdateChecklistComment: (instanceKey: string, comment: string) => void;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  onOpenResolutionCenter: () => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  AB: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  AF: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
  AT: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  CC: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  DI: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  DP: 'bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-600/30',
  EB: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  EE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  EF: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  EH: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  FD: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  FE: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  FF: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  FM: 'bg-teal-600/15 text-teal-700 dark:text-teal-300 border-teal-600/30',
  FR: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  FS: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  HC: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  HD: 'bg-rose-600/15 text-rose-700 dark:text-rose-300 border-rose-600/30',
  HF: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30',
  HM: 'bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 border-cyan-600/30',
  HW: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  HX: 'bg-purple-600/15 text-purple-700 dark:text-purple-300 border-purple-600/30',
  IB: 'bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-600/30',
  IC: 'bg-violet-600/15 text-violet-700 dark:text-violet-300 border-violet-600/30',
  IG: 'bg-red-600/15 text-red-700 dark:text-red-300 border-red-600/30',
  IO: 'bg-slate-300 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-400 dark:border-slate-600/60',
  IP: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  MB: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  PC: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  RF: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  TN: 'bg-slate-300 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-400 dark:border-slate-600/60',
  UV: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
  VC: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  VE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  VB: 'bg-slate-300 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-400 dark:border-slate-600/60',
  VP: 'bg-cyan-600/15 text-cyan-700 dark:text-cyan-300 border-cyan-600/30',
  XA: 'bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600/60'
};

export const SkidViewTab: React.FC<SkidViewTabProps> = ({
  skid,
  segments,
  bases,
  checklists,
  rules,
  sqItems,
  facts,
  onUpdateChecklistStatus,
  onUpdateChecklistComment,
  onUpdateFact,
  onOpenResolutionCenter
}) => {
  const [viewMode, setViewMode] = useState<SkidViewMode>(() => {
    return (localStorage.getItem('dvl_skid_view_mode') as SkidViewMode) || 'grid';
  });
  const [filterStatus, setFilterStatus] = useState<string>('applicable');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Category accordions start collapsed by default in Card View
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem('dvl_skid_view_mode', viewMode);
  }, [viewMode]);

  // Get segments and bases on this skid
  const skidSegments = segments.filter(s => skid.segmentIds.includes(s.id));
  const skidBases = bases.filter(b => skid.baseIds.includes(b.id));

  // Get linked SQs for this skid
  const linkedSqs = sqItems.filter(sq => sq.linkedSkidId === skid.id);

  // Get checklist instances for this skid
  const skidChecklists = checklists.filter(c => c.scopeTargetId === skid.id);

  // Flattened visible items list for roving keyboard navigation
  const visibleItems = useMemo(() => {
    const list: Array<{ rule: RuleDefinition; instance: ChecklistInstance }> = [];
    skidChecklists.forEach((instance) => {
      const rule = rules.find(r => r.id === instance.ruleId);
      if (!rule) return;

      if (filterStatus === 'incomplete' && instance.status !== 'Incomplete') return;
      if (filterStatus === 'needsInput' && instance.applicability !== 'NeedsInput') return;
      if (filterStatus === 'applicable' && instance.applicability !== 'Applicable') return;
      if (filterStatus === 'passed' && instance.status !== 'Passed') return;

      list.push({ rule, instance });
    });
    return list;
  }, [skidChecklists, rules, filterStatus]);

  // Group by category
  const categorizedRules = useMemo(() => {
    const map: Record<string, Array<{ rule: RuleDefinition; instance: ChecklistInstance }>> = {};
    visibleItems.forEach(item => {
      const cat = item.rule.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    });
    return map;
  }, [visibleItems]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Keyboard navigation for Space, N, C, ArrowUp, ArrowDown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (visibleItems.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, visibleItems.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === ' ') {
        e.preventDefault();
        const active = visibleItems[focusedIndex];
        if (active) {
          const isPassed = active.instance.status === 'Passed';
          onUpdateChecklistStatus(active.instance.instanceKey, isPassed ? 'Incomplete' : 'Passed');
        }
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const active = visibleItems[focusedIndex];
        if (active && active.rule.allowNA) {
          const isNA = active.instance.status === 'NA';
          onUpdateChecklistStatus(active.instance.instanceKey, isNA ? 'Incomplete' : 'NA');
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const active = visibleItems[focusedIndex];
        if (active) {
          const input = commentInputRefs.current[active.instance.instanceKey];
          input?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleItems, focusedIndex, onUpdateChecklistStatus]);

  // Progress metrics for this skid
  const applicableChecks = skidChecklists.filter(c => c.applicability === 'Applicable');
  const passedCount = applicableChecks.filter(c => c.status === 'Passed').length;
  const needsInputCount = skidChecklists.filter(c => c.applicability === 'NeedsInput').length;
  const percentComplete = applicableChecks.length > 0 ? Math.round((passedCount / applicableChecks.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-slate-800 dark:text-slate-100">
      {/* Skid Summary Card */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-base font-mono">
                {skid.index}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {skid.name} Overview & Verification
              </h2>
              {percentComplete === 100 && (
                <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  100% Complete
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
              Boundary: {skidSegments.length} Segments • {skidBases.length} Bases • Dimensions: {skid.dimensions.length}"L × {skid.dimensions.width}"W × {skid.dimensions.height}"H
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            {/* Progress Badge */}
            <div className="text-right">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Checks Passed</div>
              <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                {passedCount} / {applicableChecks.length}
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1 font-normal">({percentComplete}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Segments Palette (Segment weights removed) */}
        <div>
          <div className="text-[11px] font-bold font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Mapped Segments ({skidSegments.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {skidSegments.map((seg) => {
              const colorClass = SEGMENT_COLORS[seg.typeCode] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
              return (
                <div
                  key={seg.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono shadow-sm ${colorClass}`}
                >
                  <span className="font-bold text-sm">{seg.typeCode}</span>
                  <span className="opacity-90 font-medium">{seg.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linked SQs Banner */}
        {linkedSqs.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-xs">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold font-mono mb-1.5">
              <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Special Quotes Tagged to {skid.name}:</span>
            </div>
            <ul className="space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
              {linkedSqs.map(sq => (
                <li key={sq.id}>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300">Slot {sq.slot}:</span> {sq.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Filter and View Mode Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-semibold">Filter:</span>
          {['all', 'incomplete', 'needsInput', 'applicable', 'passed'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setFilterStatus(st);
                setFocusedIndex(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {st === 'all' && `All (${skidChecklists.length})`}
              {st === 'incomplete' && `Incomplete`}
              {st === 'needsInput' && `Needs Input (${needsInputCount})`}
              {st === 'applicable' && `Applicable (${applicableChecks.length})`}
              {st === 'passed' && `Passed (${passedCount})`}
            </button>
          ))}
        </div>

        {/* Right Tools: View Mode Toggle & Keyboard Hint */}
        <div className="flex items-center gap-3">
          {/* Keyboard Navigation Tooltip / Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-mono border border-slate-200 dark:border-slate-700">
            <Keyboard className="w-3.5 h-3.5 text-blue-500" />
            <span>Nav: <kbd className="font-bold">↑/↓</kbd> • Check: <kbd className="font-bold">Space</kbd> • N/A: <kbd className="font-bold">N</kbd> • Note: <kbd className="font-bold">C</kbd></span>
          </div>

          {/* View Mode Toggle: Cards vs Dense Spreadsheet Grid */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('cards')}
              title="Rich Card View (detailed context and AST traces)"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card View</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              title="Dense Spreadsheet Grid (high-density rapid review)"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Dense Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- RENDER VIEW 1: DENSE SPREADSHEET GRID VIEW --- */}
      {viewMode === 'grid' && (
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 w-40">Rule ID / Scope</th>
                  <th className="py-3 px-4 min-w-[280px]">Verification Description</th>
                  <th className="py-3 px-3 w-36 text-center">Applicability</th>
                  <th className="py-3 px-3 w-28 text-center">Check Off</th>
                  <th className="py-3 px-3 w-16 text-center">N/A</th>
                  <th className="py-3 px-4 min-w-[220px]">Detailer Comments</th>
                  <th className="py-3 px-3 w-28 text-center">SQ Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/60">
                {visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500 font-mono">
                      No verification checks match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  visibleItems.map(({ rule, instance }, index) => {
                    const isFocused = focusedIndex === index;
                    const isPassed = instance.status === 'Passed';
                    const isNA = instance.status === 'NA' || instance.applicability === 'NotApplicable';
                    const isNeedsInput = instance.applicability === 'NeedsInput';

                    // Find linked SQ for this rule
                    const linkedRuleSq = sqItems.find(s => s.linkedRuleId === rule.id);

                    return (
                      <tr
                        key={instance.instanceKey}
                        onClick={() => setFocusedIndex(index)}
                        className={`transition-colors ${
                          isFocused ? 'bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-inset ring-blue-500' : ''
                        } ${
                          isPassed
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/15'
                            : isNeedsInput
                            ? 'bg-amber-50/40 dark:bg-amber-950/20'
                            : isNA
                            ? 'opacity-60 bg-slate-50/50 dark:bg-slate-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Index */}
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 dark:text-slate-500 text-[11px]">
                          {index + 1}
                        </td>

                        {/* Rule ID & Scope */}
                        <td className="py-2.5 px-3 font-mono">
                          <div className="font-bold text-slate-900 dark:text-white text-xs">{rule.id}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {rule.category} {rule.subgroup ? `• ${rule.subgroup}` : ''}
                          </div>
                        </td>

                        {/* Description */}
                        <td className="py-2.5 px-4">
                          <div className="text-slate-800 dark:text-slate-200 text-xs font-medium line-clamp-2">
                            {rule.text}
                          </div>
                          {rule.reference && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              Ref: {rule.reference}
                            </div>
                          )}
                        </td>

                        {/* Applicability */}
                        <td className="py-2.5 px-3 text-center">
                          {instance.applicability === 'Applicable' && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                              Applicable
                            </span>
                          )}
                          {instance.applicability === 'NotApplicable' && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              N/A
                            </span>
                          )}
                          {instance.applicability === 'NeedsInput' && (
                            <div className="flex justify-center">
                              <InlineFactPopover
                                factKey={rule.requiredFacts[0] || 'unknown'}
                                fact={facts[rule.requiredFacts[0]]}
                                onUpdateFact={onUpdateFact}
                                triggerButtonText="Needs Input"
                                compact={true}
                              />
                            </div>
                          )}
                        </td>

                        {/* Check Off Button */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => onUpdateChecklistStatus(instance.instanceKey, isPassed ? 'Incomplete' : 'Passed')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                              isPassed
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>{isPassed ? 'Verified' : 'Check'}</span>
                          </button>
                        </td>

                        {/* N/A Toggle */}
                        <td className="py-2.5 px-3 text-center">
                          {rule.allowNA ? (
                            <button
                              onClick={() => onUpdateChecklistStatus(instance.instanceKey, isNA ? 'Incomplete' : 'NA')}
                              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                                isNA && !isPassed
                                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold'
                                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                              }`}
                            >
                              N/A
                            </button>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-mono">-</span>
                          )}
                        </td>

                        {/* Comments */}
                        <td className="py-2.5 px-4">
                          <input
                            ref={el => (commentInputRefs.current[instance.instanceKey] = el)}
                            type="text"
                            value={instance.detailerComment}
                            onChange={(e) => onUpdateChecklistComment(instance.instanceKey, e.target.value)}
                            placeholder="Add comment..."
                            className="w-full text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded px-2 py-1 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none transition-colors"
                          />
                        </td>

                        {/* SQ Badge */}
                        <td className="py-2.5 px-3 text-center">
                          {linkedRuleSq ? (
                            <span
                              title={`Slot ${linkedRuleSq.slot}: ${linkedRuleSq.text}`}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30 whitespace-nowrap inline-block"
                            >
                              SQ-{linkedRuleSq.slot}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- RENDER VIEW 2: RICH CARD VIEW --- */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {Object.entries(categorizedRules).map(([category, items]) => {
            const isExpanded = !!expandedCategories[category];
            const catApplicable = items.filter(i => i.instance.applicability === 'Applicable');
            const catPassed = catApplicable.filter(i => i.instance.status === 'Passed').length;
            const catNeedsInput = items.filter(i => i.instance.applicability === 'NeedsInput').length;

            return (
              <div key={category} className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {/* Category Header Accordion */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-200 dark:border-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      {category} Verification Group
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      ({items.length} rules)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {catNeedsInput > 0 && (
                      <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        {catNeedsInput} Needs Input
                      </span>
                    )}
                    <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {catPassed} / {catApplicable.length} Complete
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </div>
                </button>

                {/* Rules List */}
                {isExpanded && (
                  <div className="p-4 space-y-3 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map(({ rule, instance }) => {
                      const globalIdx = visibleItems.findIndex(v => v.instance.instanceKey === instance.instanceKey);
                      const isFocused = focusedIndex === globalIdx;
                      const isPassed = instance.status === 'Passed';
                      const isNA = instance.status === 'NA' || instance.applicability === 'NotApplicable';
                      const isNeedsInput = instance.applicability === 'NeedsInput';

                      // Find linked SQ for this rule
                      const linkedRuleSq = sqItems.find(s => s.linkedRuleId === rule.id);

                      return (
                        <div
                          key={instance.instanceKey}
                          onClick={() => setFocusedIndex(globalIdx)}
                          className={`pt-3 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 rounded-xl transition-all ${
                            isFocused ? 'ring-2 ring-blue-500 shadow-md' : ''
                          } ${
                            isPassed
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30'
                              : isNeedsInput
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30'
                              : isNA
                              ? 'opacity-60 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40'
                          }`}
                        >
                          {/* Rule Description & AST Trace */}
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-xs font-bold whitespace-nowrap">
                                {rule.id}
                              </span>
                              {rule.subgroup && (
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {rule.subgroup}
                                </span>
                              )}

                              {/* Applicability Badge */}
                              {instance.applicability === 'Applicable' && (
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                  Applicable
                                </span>
                              )}
                              {instance.applicability === 'NotApplicable' && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  Not Applicable
                                </span>
                              )}
                              {instance.applicability === 'NeedsInput' && (
                                <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  Needs Input
                                </span>
                              )}

                              {/* Linked SQ Badge */}
                              {linkedRuleSq && (
                                <span
                                  title={`Linked to Special Quote Slot ${linkedRuleSq.slot}: ${linkedRuleSq.text}`}
                                  className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap"
                                >
                                  <Layers className="w-3 h-3 text-amber-500" />
                                  <span>SQ Slot {linkedRuleSq.slot}</span>
                                </span>
                              )}
                            </div>

                            {/* Rule Text */}
                            <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                              {rule.text}
                            </p>

                            {/* Reference Standard */}
                            {rule.reference && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                                <span>Ref:</span>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">{rule.reference}</span>
                              </div>
                            )}

                            {/* AST Evaluation Trace */}
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
                              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-300 font-semibold text-[10px]">
                                <Sparkles className="w-3 h-3 text-blue-500" />
                                <span>Rule Logic Trace:</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300">{instance.applicabilityReason}</p>
                            </div>

                            {/* Detailer Comment Box */}
                            <div className="flex items-center gap-2 pt-1">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <input
                                ref={el => (commentInputRefs.current[instance.instanceKey] = el)}
                                type="text"
                                value={instance.detailerComment}
                                onChange={(e) => onUpdateChecklistComment(instance.instanceKey, e.target.value)}
                                placeholder="Add detailer comment / verification note..."
                                className="flex-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 focus:border-blue-500 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-200 placeholder-slate-400 outline-none transition-colors shadow-inner"
                              />
                            </div>
                          </div>

                          {/* Status Checkbox Controls */}
                          <div className="flex items-center gap-2 shrink-0 md:flex-col md:items-end">
                            {isNeedsInput ? (
                              <InlineFactPopover
                                factKey={rule.requiredFacts[0] || 'unknown'}
                                fact={facts[rule.requiredFacts[0]]}
                                onUpdateFact={onUpdateFact}
                                triggerButtonText="Resolve Fact"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                {/* Mark Verified / Passed */}
                                <button
                                  onClick={() => onUpdateChecklistStatus(instance.instanceKey, isPassed ? 'Incomplete' : 'Passed')}
                                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                    isPassed
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isPassed ? 'Verified' : 'Check Off'}</span>
                                </button>

                                {/* Mark N/A */}
                                {rule.allowNA && (
                                  <button
                                    onClick={() => onUpdateChecklistStatus(instance.instanceKey, isNA ? 'Incomplete' : 'NA')}
                                    className={`px-3 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all ${
                                      isNA && !isPassed
                                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-200 border border-slate-400 dark:border-slate-600 font-bold'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700/80'
                                    }`}
                                  >
                                    N/A
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
