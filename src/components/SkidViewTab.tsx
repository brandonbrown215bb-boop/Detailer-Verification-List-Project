import React, { useState, useMemo } from 'react';
import {
  ShippingSkid,
  Segment,
  UnitBase,
  ChecklistInstance,
  RuleDefinition,
  SpecialQuote,
  Fact,
  CheckStatus
} from '../types';
import {
  Box,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  X,
  ExternalLink
} from 'lucide-react';

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
  onOpenResolutionCenter: () => void;
}

const SEGMENT_COLORS: Record<string, string> = {
  IP: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  FF: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  RF: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  AF: 'bg-green-500/20 text-green-300 border-green-500/40',
  XA: 'bg-slate-700/60 text-slate-200 border-slate-600/60',
  HW: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  FE: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  FR: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  FS: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  CC: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  HC: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  PC: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  DP: 'bg-blue-600/20 text-blue-300 border-blue-600/40',
  AT: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  MB: 'bg-orange-500/20 text-orange-300 border-orange-500/40'
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
  onOpenResolutionCenter
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Base: true,
    Housing: true,
    'Drain Pan': true,
    Fans: true,
    Internals: true,
    Reconnects: true,
    UTL: true,
    MOM: true,
    ISG: true
  });

  // Get segments and bases on this skid
  const skidSegments = segments.filter(s => skid.segmentIds.includes(s.id));
  const skidBases = bases.filter(b => skid.baseIds.includes(b.id));

  // Get linked SQs for this skid
  const linkedSqs = sqItems.filter(sq => sq.linkedSkidId === skid.id);

  // Get checklist instances for this skid
  const skidChecklists = checklists.filter(c => c.scopeTargetId === skid.id);

  // Group by category
  const categorizedRules = useMemo(() => {
    const map: Record<string, Array<{ rule: RuleDefinition; instance: ChecklistInstance }>> = {};

    skidChecklists.forEach((instance) => {
      const rule = rules.find(r => r.id === instance.ruleId);
      if (!rule) return;

      // Apply filter
      if (filterStatus === 'incomplete' && instance.status !== 'Incomplete') return;
      if (filterStatus === 'needsInput' && instance.applicability !== 'NeedsInput') return;
      if (filterStatus === 'applicable' && instance.applicability !== 'Applicable') return;
      if (filterStatus === 'passed' && instance.status !== 'Passed') return;

      const cat = rule.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push({ rule, instance });
    });

    return map;
  }, [skidChecklists, rules, filterStatus]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Progress metrics for this skid
  const applicableChecks = skidChecklists.filter(c => c.applicability === 'Applicable');
  const passedCount = applicableChecks.filter(c => c.status === 'Passed').length;
  const needsInputCount = skidChecklists.filter(c => c.applicability === 'NeedsInput').length;
  const percentComplete = applicableChecks.length > 0 ? Math.round((passedCount / applicableChecks.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Skid Summary Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-base font-mono">
                {skid.index}
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {skid.name} Overview & Verification
              </h2>
              {percentComplete === 100 && (
                <span className="flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  100% Complete
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 font-mono">
              Boundary: {skidSegments.length} Segments • {skidBases.length} Bases • Dimensions: {skid.dimensions.length}"L × {skid.dimensions.width}"W × {skid.dimensions.height}"H
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 shrink-0">
            {/* Weight Status */}
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 justify-end">
                <span>Aggregate Weight</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                  Derived
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {skid.calculatedWeight.toLocaleString()} lbs
              </div>
            </div>

            {/* Progress Badge */}
            <div className="text-right pl-4 border-l border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono">Checks Passed</div>
              <div className="text-lg font-bold font-mono text-blue-400">
                {passedCount} / {applicableChecks.length}
                <span className="text-xs text-slate-400 ml-1 font-normal">({percentComplete}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Segments Palette */}
        <div>
          <div className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-2">
            Mapped Segments ({skidSegments.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {skidSegments.map((seg) => {
              const colorClass = SEGMENT_COLORS[seg.typeCode] || 'bg-slate-800 text-slate-300 border-slate-700';
              return (
                <div
                  key={seg.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono shadow-sm ${colorClass}`}
                >
                  <span className="font-bold text-sm">{seg.typeCode}</span>
                  <span className="opacity-90 font-medium">{seg.name}</span>
                  <span className="text-[11px] opacity-75">({seg.weight} lbs)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linked SQs */}
        {linkedSqs.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold font-mono mb-1.5">
              <Layers className="w-4 h-4" />
              <span>Special Quotes Tagged to {skid.name}:</span>
            </div>
            <ul className="space-y-1 list-disc list-inside text-slate-300">
              {linkedSqs.map(sq => (
                <li key={sq.id}>
                  <span className="font-mono font-bold text-amber-300">Slot {sq.slot}:</span> {sq.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Filter Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 font-mono font-semibold">Filter:</span>
          {['all', 'incomplete', 'needsInput', 'applicable', 'passed'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
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

        {needsInputCount > 0 && (
          <button
            onClick={onOpenResolutionCenter}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold whitespace-nowrap transition-all shrink-0 shadow-sm"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{needsInputCount} facts require confirmation</span>
          </button>
        )}
      </div>

      {/* Categorized Checklists Accordions */}
      <div className="space-y-4">
        {Object.entries(categorizedRules).map(([category, items]) => {
          const isExpanded = expandedCategories[category] ?? true;
          const catApplicable = items.filter(i => i.instance.applicability === 'Applicable');
          const catPassed = catApplicable.filter(i => i.instance.status === 'Passed').length;
          const catNeedsInput = items.filter(i => i.instance.applicability === 'NeedsInput').length;

          return (
            <div key={category} className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              {/* Category Header Accordion */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 bg-slate-850 hover:bg-slate-800 border-b border-slate-800 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white tracking-tight">
                    {category} Verification Group
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ({items.length} rules)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {catNeedsInput > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 whitespace-nowrap">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {catNeedsInput} Needs Input
                    </span>
                  )}
                  <span className="text-xs font-mono font-semibold text-slate-300 whitespace-nowrap">
                    {catPassed} / {catApplicable.length} Complete
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </div>
              </button>

              {/* Rules List */}
              {isExpanded && (
                <div className="p-4 space-y-3 divide-y divide-slate-800/60">
                  {items.map(({ rule, instance }) => {
                    const isPassed = instance.status === 'Passed';
                    const isNA = instance.status === 'NA' || instance.applicability === 'NotApplicable';
                    const isNeedsInput = instance.applicability === 'NeedsInput';

                    return (
                      <div
                        key={instance.instanceKey}
                        className={`pt-3 first:pt-0 flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 rounded-xl transition-all ${
                          isPassed
                            ? 'bg-emerald-950/20 border border-emerald-800/30'
                            : isNeedsInput
                            ? 'bg-amber-950/20 border border-amber-800/30'
                            : isNA
                            ? 'opacity-60 bg-slate-950/30 border border-slate-800/50'
                            : 'hover:bg-slate-800/40 border border-transparent'
                        }`}
                      >
                        {/* Rule Description & AST Trace */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-xs font-bold whitespace-nowrap">
                              {rule.id}
                            </span>
                            {rule.subgroup && (
                              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                                {rule.subgroup}
                              </span>
                            )}

                            {/* Applicability Badge */}
                            {instance.applicability === 'Applicable' && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                Applicable
                              </span>
                            )}
                            {instance.applicability === 'NotApplicable' && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 whitespace-nowrap">
                                Not Applicable
                              </span>
                            )}
                            {instance.applicability === 'NeedsInput' && (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                Needs Input
                              </span>
                            )}
                          </div>

                          {/* Rule Text */}
                          <p className="text-xs text-slate-200 font-medium leading-relaxed">
                            {rule.text}
                          </p>

                          {/* Reference Standard */}
                          {rule.reference && (
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span>Ref:</span>
                              <span className="text-slate-300 font-medium">{rule.reference}</span>
                            </div>
                          )}

                          {/* AST Evaluation Trace */}
                          <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[10px]">
                              <Sparkles className="w-3 h-3 text-blue-400" />
                              <span>Rule Logic Trace:</span>
                            </div>
                            <p className="text-slate-300">{instance.applicabilityReason}</p>
                          </div>

                          {/* Detailer Comment Box */}
                          <div className="flex items-center gap-2 pt-1">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={instance.detailerComment}
                              onChange={(e) => onUpdateChecklistComment(instance.instanceKey, e.target.value)}
                              placeholder="Add detailer comment / verification note..."
                              className="flex-1 text-xs bg-slate-800/80 border border-slate-700/80 focus:border-blue-500 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-500 outline-none transition-colors shadow-inner"
                            />
                          </div>
                        </div>

                        {/* Status Checkbox Controls */}
                        <div className="flex items-center gap-2 shrink-0 md:flex-col md:items-end">
                          {isNeedsInput ? (
                            <button
                              onClick={onOpenResolutionCenter}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-colors whitespace-nowrap"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Resolve Fact</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Mark Verified / Passed */}
                              <button
                                onClick={() => onUpdateChecklistStatus(instance.instanceKey, isPassed ? 'Incomplete' : 'Passed')}
                                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                  isPassed
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
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
                                      ? 'bg-slate-700 text-slate-200 border border-slate-600 font-bold'
                                      : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/80'
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
    </div>
  );
};
