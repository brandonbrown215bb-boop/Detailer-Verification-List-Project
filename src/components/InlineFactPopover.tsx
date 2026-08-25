import React, { useState, useRef, useEffect } from 'react';
import { Fact } from '../types';
import {
  AlertTriangle,
  Check,
  X,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  Scale
} from 'lucide-react';

interface InlineFactPopoverProps {
  factKey: string;
  fact?: Fact;
  label?: string;
  onUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  triggerButtonText?: string;
  compact?: boolean;
}

export const InlineFactPopover: React.FC<InlineFactPopoverProps> = ({
  factKey,
  fact,
  label,
  onUpdateFact,
  triggerButtonText,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState<string>(fact?.value ? String(fact.value) : '');
  const [note, setNote] = useState<string>('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectPredefined = (value: any, customNote?: string) => {
    onUpdateFact(factKey, value, 'Detailer', customNote || 'Confirmed inline');
    setIsOpen(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim() === '') return;
    onUpdateFact(factKey, customValue.trim(), 'Detailer', note.trim() || undefined);
    setIsOpen(false);
  };

  const isWeight = factKey.includes('weight');
  const isSeismic = factKey === 'unit.isSeismic';
  const isNoa = factKey === 'unit.noa';
  const isKnockdown = factKey === 'unit.knockdown';
  const isThermalBreak = factKey === 'unit.thermalBreak';

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          compact
            ? "flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm font-semibold whitespace-nowrap"
            : "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
        }
      >
        <AlertTriangle className={compact ? "w-3 h-3 text-amber-600 dark:text-amber-400" : "w-3.5 h-3.5 text-amber-600 dark:text-amber-400"} />
        <span>{triggerButtonText || 'Confirm Fact'}</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {label || fact?.label || factKey}
                </h4>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {factKey}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description / Prompt */}
          <div className="py-2.5 text-xs text-slate-600 dark:text-slate-300">
            {fact?.promptNote || 'Confirm this engineering parameter to resolve dependent checklist rules.'}
          </div>

          {/* Quick Option Buttons */}
          <div className="space-y-2 pt-1">
            {isSeismic && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectPredefined(false, 'Confirmed Standard Non-Seismic')}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors text-left"
                >
                  <div className="font-bold">Standard</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Non-Seismic</div>
                </button>
                <button
                  onClick={() => handleSelectPredefined(true, 'Confirmed Seismic Certified')}
                  className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-600/30 dark:hover:bg-indigo-600/40 text-indigo-700 dark:text-indigo-200 text-xs font-medium border border-indigo-200 dark:border-indigo-500/40 transition-colors text-left"
                >
                  <div className="font-bold text-indigo-600 dark:text-indigo-300">Seismic</div>
                  <div className="text-[10px] text-indigo-500/80 dark:text-indigo-300/70">Certified Spec</div>
                </button>
              </div>
            )}

            {isNoa && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectPredefined('N/A', 'Confirmed Standard Non-NOA')}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors text-left"
                >
                  <div className="font-bold">N/A</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Standard Unit</div>
                </button>
                <button
                  onClick={() => handleSelectPredefined('NOA 21-0428.03', 'Miami-Dade Approved NOA')}
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/30 dark:hover:bg-emerald-600/40 text-emerald-700 dark:text-emerald-200 text-xs font-medium border border-emerald-200 dark:border-emerald-500/40 transition-colors text-left"
                >
                  <div className="font-bold text-emerald-600 dark:text-emerald-300">Miami-Dade</div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-300/70">NOA 21-0428.03</div>
                </button>
              </div>
            )}

            {isKnockdown && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectPredefined('No', 'Standard Factory Assembled')}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors text-left"
                >
                  <div className="font-bold">No</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Factory Assembled</div>
                </button>
                <button
                  onClick={() => handleSelectPredefined('Yes', 'Knockdown field assembly')}
                  className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-600/30 dark:hover:bg-amber-600/40 text-amber-700 dark:text-amber-200 text-xs font-medium border border-amber-200 dark:border-amber-500/40 transition-colors text-left"
                >
                  <div className="font-bold text-amber-600 dark:text-amber-300">Yes</div>
                  <div className="text-[10px] text-amber-600/80 dark:text-amber-300/70">Field Knockdown</div>
                </button>
              </div>
            )}

            {isWeight && fact?.value && (
              <button
                onClick={() => handleSelectPredefined(fact.value, 'Approved Calculated Lifting Weight')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/25 dark:hover:bg-emerald-600/35 border border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Approve Calculated Weight</span>
                </div>
                <span className="font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                  {Number(fact.value).toLocaleString()} lbs
                </span>
              </button>
            )}

            {/* Custom Entry Form */}
            <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Or Specify Custom Value:
              </div>
              <input
                type="text"
                placeholder="Enter confirmed value..."
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Confirm Fact</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
