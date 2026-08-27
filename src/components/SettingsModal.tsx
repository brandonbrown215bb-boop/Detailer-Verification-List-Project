import React, { useState, useEffect } from 'react';
import { ThemeMode } from '../types';
import {
  Settings,
  X,
  Sun,
  Moon,
  Laptop,
  Shield,
  Clock,
  User,
  HardDrive,
  Trash2,
  CheckCircle2,
  FolderSync
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  detailerName: string;
  onUpdateDetailerName: (name: string) => void;
  rulePackVersion: string;
  ruleCount: number;
  lastAutosavedAt?: string;
  onClearAutosave: () => void;
  sharedExportPath?: string;
  onUpdateSharedExportPath?: (path: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  onSetThemeMode,
  detailerName,
  onUpdateDetailerName,
  rulePackVersion,
  ruleCount,
  lastAutosavedAt,
  onClearAutosave,
  sharedExportPath = '',
  onUpdateSharedExportPath
}) => {
  const [exportPath, setExportPath] = useState(sharedExportPath);

  useEffect(() => {
    setExportPath(sharedExportPath || localStorage.getItem('dvl_shared_export_path') || '');
  }, [sharedExportPath, isOpen]);

  if (!isOpen) return null;

  const handleExportPathChange = (val: string) => {
    setExportPath(val);
    localStorage.setItem('dvl_shared_export_path', val.trim());
    onUpdateSharedExportPath?.(val.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Application Settings & Preferences
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailer defaults, appearance theme, and shared network paths
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Appearance Theme */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Interface Appearance Theme
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* System */}
              <button
                onClick={() => onSetThemeMode('system')}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                  themeMode === 'system'
                    ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-300 font-bold shadow-sm ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Laptop className="w-5 h-5" />
                <span className="text-xs">System Default</span>
                <span className="text-[10px] text-slate-400">Auto OS sync</span>
              </button>

              {/* Dark */}
              <button
                onClick={() => onSetThemeMode('dark')}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                  themeMode === 'dark'
                    ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-300 font-bold shadow-sm ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs">Dark Theme</span>
                <span className="text-[10px] text-slate-400">Zinc / High contrast</span>
              </button>

              {/* Light */}
              <button
                onClick={() => onSetThemeMode('light')}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                  themeMode === 'light'
                    ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-300 font-bold shadow-sm ring-1 ring-blue-500'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs">Light Theme</span>
                <span className="text-[10px] text-slate-400">Clean daytime</span>
              </button>
            </div>
          </div>

          {/* Section 2: Detailer Identity */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <User className="w-3.5 h-3.5" />
              <span>Detailer Signature Defaults</span>
            </label>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Default Detailer Full Name:
                </label>
                <input
                  type="text"
                  value={detailerName}
                  onChange={(e) => onUpdateDetailerName(e.target.value)}
                  placeholder="e.g. Tanner Dean"
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Initials will be auto-derived ({detailerName ? detailerName.slice(0, 2).toUpperCase() : 'TD'}) and written to cell Z of the Excel Verification List sheet.
              </p>
            </div>
          </div>

          {/* Section 3: Shared Network Drive & Export Location */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <FolderSync className="w-3.5 h-3.5 text-indigo-500" />
              <span>Shared Drive Deliverable Export Directory</span>
            </label>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-2.5">
              <div>
                <label className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Network Share or Folder Path:
                </label>
                <input
                  type="text"
                  value={exportPath}
                  onChange={(e) => handleExportPathChange(e.target.value)}
                  placeholder="e.g. S:\AHU_Verifications or \\server\share\Detailing_DVL"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                When specified, Excel exports and saved projects will automatically target and scan this shared directory for checking handoffs.
              </p>
            </div>
          </div>

          {/* Section 4: Active Rule Pack */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pinned Rule Pack</span>
            </label>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Rule Pack Version:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  v{rulePackVersion}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Total Verification Rules:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {ruleCount} Rules
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Template Integrity:</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>OpenXML 3.1.1 Verified</span>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex justify-end">
                <a
                  href="/rule-editor.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Open Rule & Logic Editor</span>
                </a>
              </div>
            </div>
          </div>

          {/* Section 5: Workspace Storage & Autosave */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-blue-500" />
              <span>Project Persistence & Crash Recovery</span>
            </label>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Continuous Local Autosave</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lastAutosavedAt ? `Last saved at ${new Date(lastAutosavedAt).toLocaleTimeString()}` : 'Active session autosaving enabled'}
                </p>
              </div>

              <button
                onClick={onClearAutosave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Autosave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
