import React, { useState, useEffect } from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import { ModalShell } from './common/ModalShell';
import { STORAGE_KEYS } from '../utils/constants';

interface DetailerNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentInitials?: string;
  onSaveName: (name: string, initials?: string) => void;
  isFirstLaunch?: boolean;
}

export const DetailerNameModal: React.FC<DetailerNameModalProps> = ({
  isOpen,
  onClose,
  currentName,
  currentInitials,
  onSaveName,
  isFirstLaunch = false
}) => {
  const deriveInitials = (fullName: string): string => {
    const trimmed = fullName.trim();
    if (!trimmed) return 'TD';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].length >= 2 ? parts[0].slice(0, 2).toUpperCase() : parts[0].toUpperCase();
    }
    return parts.map(part => part[0]).join('').slice(0, 4).toUpperCase();
  };

  const [name, setName] = useState(currentName || '');
  const [initials, setInitials] = useState(currentInitials || '');
  const [isInitialsOverridden, setIsInitialsOverridden] = useState(false);

  useEffect(() => {
    setName(currentName || '');
    const savedInitials = currentInitials || (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DETAILER_INITIALS) || '' : '');
    setInitials(savedInitials || deriveInitials(currentName || ''));
    setIsInitialsOverridden(Boolean(savedInitials));
  }, [currentName, currentInitials, isOpen]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!isInitialsOverridden) {
      setInitials(deriveInitials(newName));
    }
  };

  const handleInitialsChange = (newInitials: string) => {
    const formatted = newInitials.toUpperCase().slice(0, 5);
    setInitials(formatted);
    setIsInitialsOverridden(true);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    const finalInitials = initials.trim() || deriveInitials(name.trim());
    localStorage.setItem(STORAGE_KEYS.DETAILER_NAME, name.trim());
    localStorage.setItem(STORAGE_KEYS.DETAILER_INITIALS, finalInitials);
    onSaveName(name.trim(), finalInitials);
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
          <label htmlFor="detailer-full-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
            Detailer Full Name:
          </label>
          <input
            id="detailer-full-name-input"
            aria-label="Detailer Full Name"
            type="text"
            autoFocus
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Tanner Dean"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
          />
        </div>

        {/* Initials Input & Override */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="detailer-initials-input" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Sign-off Initials:
            </label>
            <div className="flex items-center gap-2">
              <input
                id="detailer-initials-input"
                aria-label="Detailer Sign-off Initials"
                type="text"
                maxLength={5}
                value={initials}
                onChange={e => handleInitialsChange(e.target.value)}
                placeholder={deriveInitials(name)}
                className="w-20 font-mono font-bold text-center uppercase px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 transition-colors"
              />
              {isInitialsOverridden && (
                <button
                  type="button"
                  onClick={() => {
                    setIsInitialsOverridden(false);
                    setInitials(deriveInitials(name));
                  }}
                  className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors underline"
                  title="Reset to auto-derived initials"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Auto-derived from your name. Edit to override with a custom signature code.
          </p>
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
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-700/30 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save & Continue</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
