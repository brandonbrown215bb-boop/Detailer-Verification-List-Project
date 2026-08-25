import React from 'react';
import { Fact } from '../types';
import {
  AlertCircle,
  X,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface ResolutionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: Record<string, Fact>;
  onUpdateFact: (key: string, value: any, note?: string) => void;
  onBatchResolveDefaults: () => void;
}

export const ResolutionCenterModal: React.FC<ResolutionCenterModalProps> = ({
  isOpen,
  onClose,
  facts,
  onUpdateFact,
  onBatchResolveDefaults
}) => {
  if (!isOpen) return null;

  // Filter pending facts
  const pendingFacts = Object.values(facts).filter(
    f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Fact Resolution Center
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono text-xs font-semibold">
                  {pendingFacts.length} Pending
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm engineering certifications and skid weights to resolve all 'Needs Input' rules.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {pendingFacts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed!</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                All engineering parameters and skid weights have authoritative status. Dependent rules have evaluated to Applicable.
              </p>
            </div>
          ) : (
            <>
              {/* Batch Resolve Helper */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/40">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Quick Action: Resolve with Standard Engineering Defaults
                  </span>
                </div>
                <button
                  onClick={onBatchResolveDefaults}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  Approve All Defaults
                </button>
              </div>

              {/* List of Pending Facts */}
              <div className="space-y-3">
                {pendingFacts.map((fact) => {
                  const isWeight = fact.key.includes('weight');
                  const isSeismic = fact.key === 'unit.isSeismic';
                  const isNoa = fact.key === 'unit.noa';

                  return (
                    <div
                      key={fact.key}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {fact.label}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                              {fact.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {fact.promptNote || 'Requires explicit engineering confirmation.'}
                          </p>
                        </div>

                        {fact.value !== null && (
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-200 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                            {String(fact.value)} {isWeight ? 'lbs' : ''}
                          </span>
                        )}
                      </div>

                      {/* Resolution Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {isSeismic && (
                          <>
                            <button
                              onClick={() => onUpdateFact('unit.isSeismic', false, 'Confirmed Non-Seismic')}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              Standard (Non-Seismic)
                            </button>
                            <button
                              onClick={() => onUpdateFact('unit.isSeismic', true, 'Confirmed Seismic Spec')}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                            >
                              Seismic Certified
                            </button>
                          </>
                        )}

                        {isNoa && (
                          <>
                            <button
                              onClick={() => onUpdateFact('unit.noa', 'N/A', 'Standard No NOA')}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              Not Applicable
                            </button>
                            <button
                              onClick={() => onUpdateFact('unit.noa', 'NOA 21-0428.03', 'Miami-Dade Approved')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                            >
                              NOA 21-0428.03
                            </button>
                          </>
                        )}

                        {isWeight && (
                          <button
                            onClick={() => onUpdateFact(fact.key, fact.value, 'Approved Calculated Lifting Weight')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Calculated Weight ({Number(fact.value).toLocaleString()} lbs)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Done & Return to Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
