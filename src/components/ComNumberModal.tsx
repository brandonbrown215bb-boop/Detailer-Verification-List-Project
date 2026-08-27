import React, { useState, useEffect } from 'react';
import { Hash, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ComNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentComNumber: string;
  jobName: string;
  onSaveComNumber: (comNumber: string) => void;
}

export const ComNumberModal: React.FC<ComNumberModalProps> = ({
  isOpen,
  onClose,
  currentComNumber,
  jobName,
  onSaveComNumber
}) => {
  const [com, setCom] = useState(currentComNumber || '');

  useEffect(() => {
    setCom(currentComNumber || '');
  }, [currentComNumber, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!com.trim()) return;

    onSaveComNumber(com.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Enter COM Number
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {jobName || 'AHU Project'}
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-200">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              Please enter the MAPICS COM# from your order revision package to associate with this unit verification project.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              COM Number (MAPICS):
            </label>
            <input
              type="text"
              autoFocus
              value={com}
              onChange={e => setCom(e.target.value)}
              placeholder="e.g. COM-123456 or 123456"
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={!com.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save COM#</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
