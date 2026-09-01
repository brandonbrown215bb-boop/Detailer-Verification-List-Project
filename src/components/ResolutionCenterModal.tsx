import React, { useState } from 'react';
import { Fact, ChecklistInstance, RuleDefinition } from '../types';
import {
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Scale,
  ArrowRight,
  Check
} from 'lucide-react';
import { ModalShell } from './common/ModalShell';
import { UnitReadiness, computeUnitReadiness } from '../utils/readiness';
import { formatEnumLabel } from '../utils/formatters';

interface ResolutionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  facts: Record<string, Fact>;
  checklists?: ChecklistInstance[];
  rules?: RuleDefinition[];
  readiness?: UnitReadiness;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  onBatchResolveDefaults: () => void;
  onNavigateToRule?: (scopeTargetId: string, ruleId: string) => void;
}

export const ResolutionCenterModal: React.FC<ResolutionCenterModalProps> = ({
  isOpen,
  onClose,
  facts,
  checklists = [],
  rules = [],
  readiness,
  onUpdateFact,
  onBatchResolveDefaults,
  onNavigateToRule
}) => {
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Derive readiness strictly from centralized predicate
  const unitReadiness = readiness || computeUnitReadiness(facts, checklists);
  const {
    unconfirmedFacts,
    blockedRules,
    unconfirmedFactsCount,
    blockedChecksCount
  } = unitReadiness;

  const isFullyResolved = unconfirmedFactsCount === 0 && blockedChecksCount === 0;

  const handleCustomInputChange = (key: string, value: string) => {
    setCustomInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Fact & Verification Resolution Center"
      subtitle="Confirm engineering parameters, regulatory certifications, and unblock verification rules."
      icon={<ShieldAlert className="w-5 h-5" />}
      maxWidth="4xl"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            Done & Return to Workspace
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {isFullyResolved ? (
          <div className="py-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">All Facts Confirmed & Checks Unblocked!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              All engineering parameters and order identity values are authoritative, and zero verification rules are blocked awaiting input.
            </p>
          </div>
        ) : (
          <>
            {/* Batch Resolve Helper Banner */}
            {unconfirmedFactsCount > 0 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800/40">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Quick Action: Resolve standard factory defaults (Non-Seismic, Non-NOA, Factory Assembled)
                  </span>
                </div>
                <button
                  onClick={onBatchResolveDefaults}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors shrink-0"
                >
                  Approve Defaults
                </button>
              </div>
            )}

            {/* Section 1: Pending Project Facts */}
            {unconfirmedFactsCount > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                    Pending Project Facts ({unconfirmedFactsCount})
                  </h5>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Requires detailer confirmation or input
                  </span>
                </div>

                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {unconfirmedFacts.map((fact) => {
                    const isSeismic = fact.key === 'unit.isSeismic';
                    const isNoa = fact.key === 'unit.noa';
                    const isKnockdown = fact.key === 'unit.knockdown';
                    const isUtl = fact.key === 'unit.utl';
                    const isCom = fact.key === 'unit.comNumber';
                    const isWeight = fact.key.includes('weight');

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
                                {formatEnumLabel(fact.category)}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold border border-amber-500/30">
                                {formatEnumLabel(fact.status)} • {formatEnumLabel(fact.confidence)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                              {fact.promptNote || 'Requires explicit detailer confirmation.'}
                            </p>
                          </div>

                          {fact.value !== null && fact.value !== undefined && (
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-200 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shrink-0">
                              {typeof fact.value === 'boolean' ? (fact.value ? 'Yes' : 'No') : typeof fact.value === 'string' ? formatEnumLabel(fact.value) : String(fact.value)}
                            </span>
                          )}
                        </div>

                        {/* Resolution Quick Controls */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
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
                              <span className="text-[11px] font-mono text-slate-400">Press Enter</span>
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

                          {isWeight && (
                            <div className="flex flex-wrap items-center gap-2 w-full">
                              {fact.value !== null && fact.value !== undefined && Number(fact.value) > 0 ? (
                                <button
                                  onClick={() => onUpdateFact(fact.key, Number(fact.value), 'Detailer', 'Approved Calculated Weight')}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                  <Scale className="w-3.5 h-3.5" />
                                  <span>Approve Calculated ({Number(fact.value).toLocaleString()} lbs)</span>
                                </button>
                              ) : null}

                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="Custom weight lbs..."
                                  value={customInputs[fact.key] ?? ''}
                                  onChange={(e) => handleCustomInputChange(fact.key, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = Number((e.target as HTMLInputElement).value);
                                      if (val > 0) {
                                        onUpdateFact(fact.key, val, 'Detailer', 'Authoritative Weight');
                                      }
                                    }
                                  }}
                                  className="w-36 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                                />
                                <button
                                  onClick={() => {
                                    const val = Number(customInputs[fact.key]);
                                    if (val > 0) {
                                      onUpdateFact(fact.key, val, 'Detailer', 'Authoritative Weight');
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                                >
                                  Confirm Weight
                                </button>
                              </div>
                            </div>
                          )}

                          {!isCom && !isSeismic && !isNoa && !isKnockdown && !isUtl && !isWeight && (
                            <div className="flex items-center gap-2 w-full">
                              <input
                                type="text"
                                placeholder={`Enter ${fact.label}...`}
                                defaultValue={fact.value ? String(fact.value) : ''}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    onUpdateFact(fact.key, (e.target as HTMLInputElement).value, 'Detailer', 'Manually confirmed fact');
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.target.value.trim()) {
                                    onUpdateFact(fact.key, e.target.value.trim(), 'Detailer', 'Manually confirmed fact');
                                  }
                                }}
                                className="flex-1 px-3 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                              />
                              <button
                                onClick={(e) => {
                                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                  if (input?.value.trim()) {
                                    onUpdateFact(fact.key, input.value.trim(), 'Detailer', 'Manually confirmed fact');
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shrink-0"
                              >
                                Confirm
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Blocked Verification Rules */}
            {blockedChecksCount > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider font-mono">
                      Blocked Verification Rules ({blockedChecksCount})
                    </h5>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Awaiting dependent domain fact resolution
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {blockedRules.map((item) => {
                    const ruleDef = rules.find(r => r.id === item.ruleId);
                    return (
                      <div
                        key={item.instanceKey}
                        className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-700/40 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{item.ruleId}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                              {item.scopeTargetId === 'unit' ? 'General Unit' : item.scopeTargetId.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 text-[11px] line-clamp-1">
                            {ruleDef?.text || item.instanceKey}
                          </p>
                          <p className="text-amber-700 dark:text-amber-300 text-[10px] font-mono">
                            {item.applicabilityReason}
                          </p>
                        </div>

                        {onNavigateToRule && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigateToRule(item.scopeTargetId, item.ruleId);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors flex items-center gap-1 shrink-0"
                          >
                            <span>Jump</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
};
