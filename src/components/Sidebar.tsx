import React from 'react';
import { NormalizedXmlGraph, ChecklistInstance, SpecialQuote } from '../types';
import {
  Box,
  Layers,
  AlertTriangle,
  FileText,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  activeTab: string; // 'general' | 'skid-1' | 'skid-2' | etc.
  onSelectTab: (tabId: string) => void;
  graph: NormalizedXmlGraph | null;
  checklists: ChecklistInstance[];
  sqItems: SpecialQuote[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  graph,
  checklists,
  sqItems,
  isCollapsed,
  onToggleCollapse
}) => {
  if (!graph) return null;

  // Compute unit level checklist progress
  const unitChecks = checklists.filter(c => c.scopeTargetId === 'unit');
  const unitApplicable = unitChecks.filter(c => c.applicability === 'Applicable');
  const unitPassed = unitApplicable.filter(c => c.status === 'Passed').length;
  const unitNeedsInput = unitChecks.filter(c => c.applicability === 'NeedsInput').length;

  return (
    <aside
      className={`bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full select-none shrink-0 transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Brand Header */}
      <div className={`border-b border-slate-200 dark:border-slate-800 flex items-center ${
        isCollapsed ? 'p-3 flex-col gap-2 justify-center' : 'p-4 justify-between'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-base tracking-wider shrink-0">
            AHU
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                Verification
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono font-bold">v3.0</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                {graph.unitOptions.brandOption} • {graph.unitOptions.unitType}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors shrink-0"
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-4 sm:space-y-6">
        {/* Main Section */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Unit Overview
            </div>
          )}
          
          <button
            onClick={() => onSelectTab('general')}
            title={isCollapsed ? `General Unit Specs (${unitPassed}/${unitApplicable.length} verified)` : undefined}
            className={`w-full flex items-center rounded-xl font-medium transition-all ${
              isCollapsed
                ? 'p-2.5 justify-center'
                : 'justify-between px-3 py-2.5 text-sm'
            } ${
              activeTab === 'general'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'general' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
              {!isCollapsed && <span className="whitespace-nowrap">General Unit Specs</span>}
            </div>

            {!isCollapsed && (
              <div className="flex items-center gap-1.5 shrink-0">
                {unitNeedsInput > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-700 dark:text-amber-300 font-mono font-bold whitespace-nowrap">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {unitNeedsInput}
                  </span>
                )}
                <span className="text-xs font-mono opacity-90 whitespace-nowrap">
                  {unitPassed}/{unitApplicable.length}
                </span>
              </div>
            )}

            {isCollapsed && unitNeedsInput > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        </div>

        {/* Shipping Skids Section */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Shipping Skids ({graph.skids.length})</span>
              <span className="text-[10px] font-mono text-slate-400 lowercase">
                {graph.segments.length} segments
              </span>
            </div>
          )}

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
                  title={
                    isCollapsed
                      ? `${skid.name}: ${percent}% (${passed}/${applicable.length} checks, ${skid.calculatedWeight.toLocaleString()} lbs)`
                      : undefined
                  }
                  className={`w-full flex flex-col rounded-xl text-left transition-all relative ${
                    isCollapsed ? 'p-2.5 items-center justify-center' : 'px-3.5 py-3'
                  } ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-slate-300 dark:hover:border-slate-800'
                  }`}
                >
                  {isCollapsed ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <Box className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                        {needsInput > 0 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                        {percent === 100 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold leading-none">
                        {skid.index}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5 font-semibold text-sm">
                          <Box className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                          <span className="whitespace-nowrap">{skid.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {needsInput > 0 && (
                            <span
                              title={`${needsInput} checks need fact confirmation`}
                              className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold whitespace-nowrap ${
                                isSelected ? 'bg-amber-400/30 text-amber-100' : 'bg-amber-500/25 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {needsInput}
                            </span>
                          )}
                          {percent === 100 && (
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-green-200' : 'text-green-500'}`} />
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
                      <div className="w-full bg-slate-200 dark:bg-black/30 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full transition-all duration-300 ${
                            percent === 100 ? 'bg-emerald-500' : isSelected ? 'bg-white' : 'bg-blue-600 dark:bg-blue-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Special Quotes (SQ) Summary */}
        {!isCollapsed ? (
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Special Quotes (SQs)
              </span>
              <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-300">
                {sqItems.length} / 22
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Mapped dynamically to Verification List sheet columns G & H.
            </p>
          </div>
        ) : (
          <div
            title={`Special Quotes: ${sqItems.length} / 22 used`}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-1"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-300">
              {sqItems.length}/22
            </span>
          </div>
        )}
      </div>

      {/* Footer XML Metadata */}
      {!isCollapsed && (
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
          <div className="flex items-center justify-between font-mono">
            <span>Schema Ver:</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{graph.documentVersion}</span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span>Total Weight:</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{graph.unitWeight.toLocaleString()} lbs</span>
          </div>
          <div className="flex items-center justify-between font-mono">
            <span>Dimensions:</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">{graph.dimensions.length}"L × {graph.dimensions.width}"W</span>
          </div>
        </div>
      )}
    </aside>
  );
};
