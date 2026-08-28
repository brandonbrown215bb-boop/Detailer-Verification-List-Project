import React, { useState, useEffect } from 'react';
import { Hash, CheckCircle2, AlertCircle } from 'lucide-react';
import { ModalShell } from './common/ModalShell';

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

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!com.trim()) return;

    onSaveComNumber(com.trim());
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Enter COM Number"
      subtitle={jobName || 'AHU Project'}
      icon={<Hash className="w-5 h-5" />}
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
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
    </ModalShell>
  );
};
