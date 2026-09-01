import React from 'react';
import { ChecklistInstance, RuleDefinition, Fact, SpecialQuote } from '../types';
import {
  FileSpreadsheet,
  AlertTriangle,
  Save,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { ModalShell } from './common/ModalShell';
import { UnitReadiness, computeUnitReadiness } from '../utils/readiness';

interface PreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklists: ChecklistInstance[];
  rules: RuleDefinition[];
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  onExportExcel: (isDraft?: boolean) => void;
  onExportDvl: () => void;
  onNavigateToRule: (scopeTargetId: string, ruleId: string) => void;
  onOpenResolutionCenter: () => void;
  readiness?: UnitReadiness;
}

export const PreFlightModal: React.FC<PreFlightModalProps> = ({
  isOpen,
  onClose,
  checklists,
  rules,
  facts,
  sqItems,
  onExportExcel,
  onExportDvl,
  onNavigateToRule,
  onOpenResolutionCenter,
  readiness
}) => {
  if (!isOpen) return null;

  // Single centralized readiness predicate derivation
  const unitReadiness = readiness || computeUnitReadiness(facts, checklists);
  const {
    totalApplicableChecksCount,
    completedChecksCount,
    incompleteChecksCount,
    blockedChecksCount,
    unconfirmedFactsCount,
    isReadyForFinal,
    incompleteRules,
    blockedRules
  } = unitReadiness;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Pre-Flight Verification Audit"
      subtitle="Auditing rule completion, special quotes table, and fact confirmations before deliverable export."
      icon={<ShieldCheck className="w-5 h-5" />}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Readiness Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Applicable Checks</div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              {totalApplicableChecksCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Verified Checks</div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {completedChecksCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Pending Checks</div>
            <div className={`text-xl font-bold font-mono mt-1 ${incompleteChecksCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {incompleteChecksCount}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-center">
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">SQs Populated</div>
            <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
              {sqItems.length} / 22
            </div>
          </div>
        </div>

        {/* Pending Items Jump Links */}
        {incompleteChecksCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 font-mono">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Incomplete Applicable Verification Checks ({incompleteChecksCount}):
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {incompleteRules.map((inst) => {
                const rule = rules.find(r => r.id === inst.ruleId);
                return (
                  <button
                    key={inst.instanceKey}
                    onClick={() => {
                      onClose();
                      onNavigateToRule(inst.scopeTargetId, inst.ruleId);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-between text-xs transition-all group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{inst.ruleId}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                          {inst.scopeTargetId === 'unit' ? 'General Unit' : inst.scopeTargetId.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-1">{rule?.text || inst.instanceKey}</p>
                    </div>

                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                      <span>Jump</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Blocked Checks Awaiting Input Jump Links */}
        {blockedChecksCount > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 font-mono">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Checks Blocked by Missing Input ({blockedChecksCount}):
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {blockedRules.map((inst) => {
                const rule = rules.find(r => r.id === inst.ruleId);
                return (
                  <button
                    key={inst.instanceKey}
                    onClick={() => {
                      onClose();
                      onNavigateToRule(inst.scopeTargetId, inst.ruleId);
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/80 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between text-xs transition-all group"
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{inst.ruleId}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200">
                          {inst.scopeTargetId === 'unit' ? 'General Unit' : inst.scopeTargetId.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-[11px] line-clamp-1">{rule?.text || inst.instanceKey}</p>
                      <p className="text-amber-800 dark:text-amber-300 text-[10px] font-mono">{inst.applicabilityReason}</p>
                    </div>

                    <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                      <span>Jump</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Facts Warning Banner */}
        {(unconfirmedFactsCount > 0 || blockedChecksCount > 0) && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs text-amber-800 dark:text-amber-200 truncate">
                {unconfirmedFactsCount > 0 && `${unconfirmedFactsCount} project facts require confirmation.`}
                {unconfirmedFactsCount > 0 && blockedChecksCount > 0 && ' • '}
                {blockedChecksCount > 0 && `${blockedChecksCount} verification checks are blocked awaiting input.`}
              </span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenResolutionCenter();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors shrink-0"
            >
              Resolve Items
            </button>
          </div>
        )}

        {/* Export Actions Box */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-850 dark:to-slate-900 border border-slate-200 dark:border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Official Excel Deliverable
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Patches 'Detailing Verification List.xlsx' preserving all formulas and cell coordinates.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => {
                onExportDvl();
                onClose();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Save Project (.dvl)</span>
            </button>

            <button
              onClick={() => {
                onExportExcel(!isReadyForFinal);
                onClose();
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isReadyForFinal ? 'Export Final .xlsx' : 'Export Draft .xlsx'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
