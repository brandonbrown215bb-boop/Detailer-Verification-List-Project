import React from 'react';
import { NormalizedXmlGraph, ChecklistInstance, SpecialQuote, Fact } from '../types';
import { UnitReadiness, computeUnitReadiness, computeScopeReadiness } from '../utils/readiness';
import {
  Box,
  Layers,
  AlertTriangle,
  FileText,
  CheckCircle2,
  PanelLeftClose,
  PanelLeftOpen,
  Snowflake,
  CheckSquare,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activeTab: string; // 'general' | 'unit-checks' | 'skid-1' | 'skid-2' | etc.
  onSelectTab: (tabId: string) => void;
  graph: NormalizedXmlGraph | null;
  facts?: Record<string, Fact>;
  checklists: ChecklistInstance[];
  sqItems: SpecialQuote[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  readiness?: UnitReadiness;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  graph,
  facts,
  checklists,
  sqItems,
  isCollapsed,
  onToggleCollapse,
  readiness
}) => {
  if (!graph) return null;

  // Global centralized readiness
  const unitReadiness = readiness || computeUnitReadiness(facts || {}, checklists);
  const {
    totalApplicableChecksCount,
    completedChecksCount,
    blockedChecksCount,
    unconfirmedFactsCount,
    percentComplete: overallPercent
  } = unitReadiness;

  const unitScope = unitReadiness.scopeReadinessMap['unit'] || computeScopeReadiness(facts || {}, checklists, 'unit');
  const unitPassed = unitScope.completedChecksCount;
  const unitApplicableCount = unitScope.totalApplicableChecksCount;
  const unitNeedsInput = unitScope.blockedChecksCount;

  return (
    <aside
      className={`bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full select-none shrink-0 transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Brand Header with York AHU Snowflake Logo */}
      <div
        className={`border-b border-slate-200 dark:border-slate-800 flex items-center ${
          isCollapsed ? 'p-3 flex-col gap-2 justify-center' : 'p-4 justify-between'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/25 text-white font-bold shrink-0">
            <Snowflake className="w-5 h-5 text-cyan-100" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                York AHU
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono font-bold">
                  Verification
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                {graph.unitOptions.brandOption} • {graph.unitOptions.unitType}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors shrink-0"
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Overall Progress Tracker Card */}
      {!isCollapsed ? (
        <div className="mx-3 mt-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              Overall Progress
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
              {overallPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-750 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                overallPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600 dark:bg-blue-500'
              }`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span>{completedChecksCount} / {totalApplicableChecksCount} Verified</span>
            {blockedChecksCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5" title={`${blockedChecksCount} rules blocked by missing facts`}>
                <AlertTriangle className="w-2.5 h-2.5" />
                {blockedChecksCount} input needed
              </span>
            ) : unconfirmedFactsCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5" title={`${unconfirmedFactsCount} project facts require confirmation`}>
                <AlertTriangle className="w-2.5 h-2.5" />
                {unconfirmedFactsCount} facts pending
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          title={`Overall Progress: ${overallPercent}% (${completedChecksCount}/${totalApplicableChecksCount} verified)`}
          className="mx-2 mt-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-1 cursor-default"
        >
          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
            {overallPercent}%
          </span>
          <div className="w-full bg-slate-200 dark:bg-slate-750 h-1 rounded-full overflow-hidden">
            <div
              className={`h-full ${overallPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-4 sm:space-y-5">
        {/* Unit Section */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Unit Configuration
            </div>
          )}

          <div className="space-y-1">
            {/* Button 1: General Unit Specs */}
            <button
              onClick={() => onSelectTab('general')}
              title={isCollapsed ? 'General Unit Specs' : undefined}
              className={`w-full flex items-center rounded-xl font-medium transition-all ${
                isCollapsed
                  ? 'p-2.5 justify-center'
                  : 'justify-between px-3 py-2 text-sm'
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
            </button>

            {/* Button 2: Unit Verifications Checklist */}
            <button
              onClick={() => onSelectTab('unit-checks')}
              title={isCollapsed ? `Unit Verifications (${unitPassed}/${unitApplicableCount} verified)` : undefined}
              className={`w-full flex items-center rounded-xl font-medium transition-all ${
                isCollapsed
                  ? 'p-2.5 justify-center'
                  : 'justify-between px-3 py-2 text-sm'
              } ${
                activeTab === 'unit-checks'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className={`w-4 h-4 shrink-0 ${activeTab === 'unit-checks' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                {!isCollapsed && <span className="whitespace-nowrap">Unit Verifications</span>}
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
                    {unitPassed}/{unitApplicableCount}
                  </span>
                </div>
              )}

              {isCollapsed && unitNeedsInput > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>
          </div>
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
              const skidScope = unitReadiness.scopeReadinessMap[skid.id] || computeScopeReadiness(facts || {}, checklists, skid.id);
              const applicableCount = skidScope.totalApplicableChecksCount;
              const passed = skidScope.completedChecksCount;
              const needsInput = skidScope.blockedChecksCount;
              const percent = skidScope.percentComplete;
              const isSelected = activeTab === skid.id;

              return (
                <button
                  key={skid.id}
                  onClick={() => onSelectTab(skid.id)}
                  title={
                    isCollapsed
                      ? `${skid.name}: ${percent}% (${passed}/${applicableCount} checks)`
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
                        <span className="truncate">{skid.segmentIds.length} Segments • {skid.baseIds.length} Bases</span>
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
                {sqItems.length} Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Project special quotes and detailing deviations mapped to deliverable.
            </p>
          </div>
        ) : (
          <div
            title={`Special Quotes: ${sqItems.length} active`}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-1"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-300">
              {sqItems.length}
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
            <span>Dimensions:</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">
              {graph.dimensions.length}"L × {graph.dimensions.width}"W × {graph.dimensions.height}"H
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
