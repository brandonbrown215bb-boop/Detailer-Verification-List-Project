import React, { useState, useEffect } from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import { ModalShell } from './common/ModalShell';
import { STORAGE_KEYS } from '../utils/constants';

interface DetailerNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSaveName: (name: string) => void;
  isFirstLaunch?: boolean;
}

export const DetailerNameModal: React.FC<DetailerNameModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onSaveName,
  isFirstLaunch = false
}) => {
  const [name, setName] = useState(currentName || '');

  useEffect(() => {
    setName(currentName || '');
  }, [currentName, isOpen]);

  const derivedInitials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map(part => part[0])
        .join('')
        .slice(0, 3)
        .toUpperCase()
    : 'TD';

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    localStorage.setItem(STORAGE_KEYS.DETAILER_NAME, name.trim());
    onSaveName(name.trim());
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={isFirstLaunch ? 'Welcome to AHU Verification' : 'Detailer Profile'}
      subtitle={
        isFirstLaunch
          ? 'Set your name for verification sign-offs'
          : 'Update detailer signature and initials'
      }
      icon={<User className="w-5 h-5" />}
      maxWidth="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Detailer Full Name:
          </label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Tanner Dean"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
          />
        </div>

        {/* Initials Preview */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-400">Generated Sign-off Initials:</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/30">
            {derivedInitials}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Your name is automatically stamped into cell D3 of the Excel deliverable and your initials are recorded on all verified checklist items.
        </p>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          {!isFirstLaunch && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save & Continue</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
