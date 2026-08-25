import React from 'react';
import { NormalizedXmlGraph, ChecklistInstance, SpecialQuote } from '../types';
import { Box, Layers, ShieldCheck, AlertTriangle, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeTab: string; // 'general' | 'skid-1' | 'skid-2' | etc.
  onSelectTab: (tabId: string) => void;
  graph: NormalizedXmlGraph | null;
  checklists: ChecklistInstance[];
  sqItems: SpecialQuote[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  graph,
  checklists,
  sqItems
}) => {
  if (!graph) return null;

  // Compute unit level checklist progress
  const unitChecks = checklists.filter(c => c.scopeTargetId === 'unit');
  const unitApplicable = unitChecks.filter(c => c.applicability === 'Applicable');
  const unitPassed = unitApplicable.filter(c => c.status === 'Passed').length;
  const unitNeedsInput = unitChecks.filter(c => c.applicability === 'NeedsInput').length;

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-base tracking-wider shrink-0">
          AHU
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
            Verification Suite
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono font-bold">v3.0</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono truncate">
            {graph.unitOptions.brandOption} • {graph.unitOptions.unitType}
          </p>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Main Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Unit Overview
          </div>
          
          <button
            onClick={() => onSelectTab('general')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'general' ? 'text-white' : 'text-blue-400'}`} />
              <span className="whitespace-nowrap">General Unit Specs</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {unitNeedsInput > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 font-mono font-bold whitespace-nowrap">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {unitNeedsInput}
                </span>
              )}
              <span className="text-xs font-mono opacity-90 whitespace-nowrap">
                {unitPassed}/{unitApplicable.length}
              </span>
            </div>
          </button>
        </div>

        {/* Shipping Skids Section */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Shipping Skids ({graph.skids.length})</span>
            <span className="text-[10px] font-mono text-slate-400 lowercase">
              {graph.segments.length} segments
            </span>
          </div>

          <div className="space-y-1.5">
            {graph.skids.map((skid) => {
              const skidChecks = checklists.filter(c => c.scopeTargetId === skid.id);
              const applicable = skidChecks.filter(c => c.applicability === 'Applicable');
              const passed = applicable.filter(c => c.status === 'Passed').length;
              const needsInput = skidChecks.filter(c => c.applicability === 'NeedsInput').length;
              const isSelected = activeTab === skid.id;

              const percent = applicable.length > 0 ? Math.round((passed / applicable.length) * 100) : 0;

              return (
                <button
                  key={skid.id}
                  onClick={() => onSelectTab(skid.id)}
                  className={`w-full flex flex-col px-3.5 py-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5 font-semibold text-sm">
                      <Box className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-400'}`} />
                      <span className="whitespace-nowrap">{skid.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {needsInput > 0 && (
                        <span
                          title={`${needsInput} checks need fact confirmation`}
                          className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold whitespace-nowrap ${
                            isSelected ? 'bg-amber-400/30 text-amber-100' : 'bg-amber-500/25 text-amber-300'
                          }`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {needsInput}
                        </span>
                      )}
                      {percent === 100 && (
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-green-200' : 'text-green-400'}`} />
                      )}
                      <span className="text-xs font-mono opacity-90 whitespace-nowrap">{percent}%</span>
                    </div>
                  </div>

                  {/* Skid Subtitle */}
                  <div className="flex items-center justify-between text-[11px] opacity-80 mt-1.5 font-mono">
                    <span className="truncate">{skid.segmentIds.length} Segs • {skid.baseIds.length} Bases</span>
                    <span className="shrink-0 font-semibold">{skid.calculatedWeight.toLocaleString()} lbs</span>
                  </div>

                  {/* Mini Progress Bar */}
                  <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full transition-all duration-300 ${
                        percent === 100 ? 'bg-emerald-400' : isSelected ? 'bg-white' : 'bg-blue-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Special Quotes (SQ) Summary */}
        <div className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Special Quotes (SQs)
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-300">
              {sqItems.length} / 22
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Mapped dynamically to Verification List sheet columns G & H.
          </p>
        </div>
      </div>

      {/* Footer XML Metadata */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center justify-between font-mono">
          <span>Schema Ver:</span>
          <span className="text-slate-300 font-semibold">{graph.documentVersion}</span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span>Total Weight:</span>
          <span className="text-slate-300 font-semibold">{graph.unitWeight.toLocaleString()} lbs</span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span>Dimensions:</span>
          <span className="text-slate-300 font-semibold">{graph.dimensions.length}"L × {graph.dimensions.width}"W</span>
        </div>
      </div>
    </aside>
  );
};
