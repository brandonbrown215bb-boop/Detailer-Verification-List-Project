import React, { useRef } from 'react';
import {
  FileCode,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Search,
  Moon,
  Sun,
  Laptop,
  Shield,
  Save,
  Home,
  Settings,
  CheckCircle2
} from 'lucide-react';
import { Fact, ThemeMode } from '../types';

interface HeaderProps {
  jobName: string;
  comNumber: string;
  facts: Record<string, Fact>;
  onGoHome: () => void;
  onOpenResolutionCenter: () => void;
  onOpenPreFlight: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onLoadSample: () => void;
  onFileUpload: (file: File) => void;
  onSaveDvl: () => void;
  themeMode: ThemeMode;
  onCycleThemeMode: () => void;
  lastSavedAt?: string;
  hasUnsavedChanges?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  jobName,
  comNumber,
  facts,
  onGoHome,
  onOpenResolutionCenter,
  onOpenPreFlight,
  onOpenSearch,
  onOpenSettings,
  onLoadSample,
  onFileUpload,
  onSaveDvl,
  themeMode,
  onCycleThemeMode,
  lastSavedAt,
  hasUnsavedChanges
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Count pending unconfirmed facts
  const pendingFactsCount = Object.values(facts).filter(
    f => f.status === 'Unknown' || f.confidence === 'RequiresConfirmation'
  ).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const getThemeIcon = () => {
    if (themeMode === 'system') return <Laptop className="w-4 h-4 text-blue-500" />;
    if (themeMode === 'light') return <Sun className="w-4 h-4 text-amber-500" />;
    return <Moon className="w-4 h-4 text-indigo-400" />;
  };

  const getThemeTitle = () => {
    if (themeMode === 'system') return 'Theme: System Default (Click to switch)';
    if (themeMode === 'light') return 'Theme: Light Mode (Click to switch)';
    return 'Theme: Dark Mode (Click to switch)';
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 transition-colors">
      {/* Left: Home Trigger + Job Identity & Pinned Rule Pack */}
      <div className="flex items-center gap-3">
        <button
          onClick={onGoHome}
          title="Return to Home Landing Page"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm flex items-center gap-1.5 text-xs font-semibold"
        >
          <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden md:inline">Home</span>
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight truncate max-w-[180px] sm:max-w-[260px]">
              {jobName || 'AHU Detailing Project'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-blue-600 dark:text-blue-400 font-semibold">
              {comNumber || 'COM-PENDING'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>Detailer Workspace</span>
            {lastSavedAt && (
              <span className="hidden lg:inline text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                • <CheckCircle2 className="w-3 h-3" /> Autosaved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Rule Pack Tag */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-medium ml-2">
          <Shield className="w-3.5 h-3.5" />
          <span>Rule Pack v13.1.0</span>
        </div>
      </div>

      {/* Center: Omni-Search Trigger */}
      <button
        onClick={onOpenSearch}
        className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all w-48 lg:w-64 justify-between group"
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
          <span className="truncate">Search rules, specs, SQs...</span>
        </span>
        <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-500 dark:text-slate-400">
          Ctrl+K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xml,.dvl"
          className="hidden"
        />

        {/* Load Sample Config.xml */}
        <button
          onClick={onLoadSample}
          title="Reload demo Config.xml"
          className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
        >
          <FileCode className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden lg:inline">Sample XML</span>
        </button>

        {/* Upload XML */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload custom Config.xml or .dvl project"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        {/* Save .dvl Project */}
        <button
          onClick={onSaveDvl}
          title="Save self-contained .dvl project file (Ctrl+S)"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
        >
          <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Save .dvl</span>
        </button>

        {/* Resolution Center */}
        <button
          onClick={onOpenResolutionCenter}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            pendingFactsCount > 0
              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-800 dark:text-amber-300'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Facts</span>
          {pendingFactsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-900 dark:text-amber-200 font-mono text-[10px] font-bold">
              {pendingFactsCount}
            </span>
          )}
        </button>

        {/* Export Pre-Flight & XLSX */}
        <button
          onClick={onOpenPreFlight}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
          <span>Export .xlsx</span>
        </button>

        {/* Theme 3-Way Mode Toggle */}
        <button
          onClick={onCycleThemeMode}
          title={getThemeTitle()}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all ml-0.5 sm:ml-1"
        >
          {getThemeIcon()}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Open Settings & Preferences"
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all"
        >
          <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400 hover:rotate-45 transition-transform" />
        </button>
      </div>
    </header>
  );
};
