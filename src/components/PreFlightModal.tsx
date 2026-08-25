import React from 'react';
import { ChecklistInstance, RuleDefinition, Fact, SpecialQuote } from '../types';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Download,
  ExternalLink,
  ShieldCheck,
  FileCode,
  ArrowRight
} from 'lucide-react';

interface PreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklists: ChecklistInstance[];
  rules: RuleDefinition[];
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  onExportExcel: () => void;
  onExportDvl: () => void;
  onNavigateToRule: (scopeTargetId: string, ruleId: string) => void;
  onOpenResolutionCenter: () => void;
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
  onOpenResolutionCenter
}) => {
  if (!isOpen) return null;

  const applicableChecks = checklists.filter(c => c.applicability === 'Applicable');
  const passedChecks = applicableChecks.filter(c => c.status === 'Passed');
  const incompleteChecks = applicableChecks.filter(c => c.status === 'Incomplete');
  const needsInputChecks = checklists.filter(c => c.applicability === 'NeedsInput');
  const pendingFacts = Object.values(facts).filter(
    f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
  );

  const percentComplete = applicableChecks.length > 0
    ? Math.round((passedChecks.length / applicableChecks.length) * 100)
    : 0;

  const isReadyForFinal = incompleteChecks.length === 0 && needsInputChecks.length === 0 && pendingFacts.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isReadyForFinal
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Pre-Flight Verification Audit
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
                  isReadyForFinal
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {percentComplete}% Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Auditing rule completion, special quotes table, and fact confirmations before deliverable export.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Readiness Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-center">
              <div className="text-[11px] font-mono text-slate-400">Applicable Checks</div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {applicableChecks.length}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-center">
              <div className="text-[11px] font-mono text-slate-400">Verified Checks</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {passedChecks.length}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-center">
              <div className="text-[11px] font-mono text-slate-400">Pending Checks</div>
              <div className={`text-xl font-bold font-mono mt-1 ${incompleteChecks.length > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {incompleteChecks.length}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-850 border border-slate-800 text-center">
              <div className="text-[11px] font-mono text-slate-400">SQs Populated</div>
              <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                {sqItems.length} / 22
              </div>
            </div>
          </div>

          {/* Pending Items Jump Links */}
          {incompleteChecks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-300 font-mono">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Incomplete Applicable Verification Checks ({incompleteChecks.length}):
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {incompleteChecks.map((inst) => {
                  const rule = rules.find(r => r.id === inst.ruleId);
                  return (
                    <button
                      key={inst.instanceKey}
                      onClick={() => {
                        onClose();
                        onNavigateToRule(inst.scopeTargetId, inst.ruleId);
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-xs transition-all group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-400">{inst.ruleId}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {inst.scopeTargetId === 'unit' ? 'General Unit' : inst.scopeTargetId.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] line-clamp-1">{rule?.text}</p>
                      </div>

                      <span className="text-[10px] font-mono text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <span>Jump</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Facts Warning */}
          {pendingFacts.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-200">
                  {pendingFacts.length} business facts require engineering confirmation.
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenResolutionCenter();
                }}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Resolve Facts
              </button>
            </div>
          )}

          {/* Export Actions Box */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-850 to-slate-900 border border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Official Excel Deliverable
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Patches 'Detailing Verification List.xlsx' preserving all formulas and cell coordinates.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => {
                  onExportDvl();
                  onClose();
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download .dvl</span>
              </button>

              <button
                onClick={() => {
                  onExportExcel();
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
      </div>
    </div>
  );
};
