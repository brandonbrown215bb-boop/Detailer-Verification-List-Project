import React from 'react';
import { Fact } from '../types';
import {
  X,
  CheckCircle2,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface ResolutionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: Record<string, Fact>;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
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

  // Filter pending facts (exclude informational weight facts)
  const pendingFacts = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300 font-bold">
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
                Confirm order identity, regulatory certifications (Seismic, NOA), and casing options.
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
                All engineering parameters and order identity values are populated with authoritative status.
              </p>
            </div>
          ) : (
            <>
              {/* Batch Resolve Helper */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/40">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Quick Action: Resolve with Standard Factory Defaults
                  </span>
                </div>
                <button
                  onClick={onBatchResolveDefaults}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  Approve All Defaults
                </button>
              </div>

              {/* List of Pending Facts */}
              <div className="space-y-3">
                {pendingFacts.map((fact) => {
                  const isSeismic = fact.key === 'unit.isSeismic';
                  const isNoa = fact.key === 'unit.noa';
                  const isKnockdown = fact.key === 'unit.knockdown';
                  const isUtl = fact.key === 'unit.utl';
                  const isCom = fact.key === 'unit.comNumber';

                  return (
                    <div
                      key={fact.key}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
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
                            {fact.promptNote || 'Requires explicit detailer confirmation.'}
                          </p>
                        </div>

                        {fact.value !== null && fact.value !== undefined && (
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-200 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                            {String(fact.value)}
                          </span>
                        )}
                      </div>

                      {/* Resolution Quick Buttons or Input */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        {isCom && (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              placeholder="Enter COM# (e.g. COM-123456)..."
                              defaultValue={fact.value ? String(fact.value) : ''}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onUpdateFact('unit.comNumber', (e.target as HTMLInputElement).value, 'Detailer', 'Manually entered COM#');
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value.trim()) {
                                  onUpdateFact('unit.comNumber', e.target.value.trim(), 'Detailer', 'Manually entered COM#');
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                            />
                            <span className="text-[11px] font-mono text-slate-400">Press Tab/Enter</span>
                          </div>
                        )}

                        {isSeismic && (
                          <>
                            <button
                              onClick={() => onUpdateFact('unit.isSeismic', false, 'Detailer', 'Standard Non-Seismic')}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              Standard (Non-Seismic)
                            </button>
                            <button
                              onClick={() => onUpdateFact('unit.isSeismic', true, 'Detailer', 'Confirmed Seismic Spec')}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                            >
                              Seismic Certified
                            </button>
                          </>
                        )}

                        {isNoa && (
                          <>
                            <button
                              onClick={() => onUpdateFact('unit.noa', false, 'Detailer', 'Standard Non-NOA')}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              Standard (No NOA)
                            </button>
                            <button
                              onClick={() => onUpdateFact('unit.noa', true, 'Detailer', 'NOA Certified')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                            >
                              NOA Certified
                            </button>
                          </>
                        )}

                        {isKnockdown && (
                          <>
                            <button
                              onClick={() => onUpdateFact('unit.knockdown', false, 'Detailer', 'Factory Assembled')}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              Factory Assembled (No)
                            </button>
                            <button
                              onClick={() => onUpdateFact('unit.knockdown', true, 'Detailer', 'Knockdown Construction')}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
                            >
                              Knockdown (Yes)
                            </button>
                          </>
                        )}

                        {isUtl && (
                          <>
                            <button
                              onClick={() => onUpdateFact('unit.utl', 'No', 'Detailer', 'Standard Base without UTL')}
                              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-300 dark:border-slate-700 transition-colors"
                            >
                              No (Standard Base)
                            </button>
                            <button
                              onClick={() => onUpdateFact('unit.utl', 'Yes (2.0" Lip)', 'Detailer', 'Upturned Lip Detected')}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                            >
                              Yes (2.0" Lip)
                            </button>
                          </>
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
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            Done & Return to Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
