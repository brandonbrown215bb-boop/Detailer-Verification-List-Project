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
  SaveAll,
  Home,
  Settings,
  CheckCircle2,
  User
} from 'lucide-react';
import { Fact, ThemeMode } from '../types';

interface HeaderProps {
  jobName: string;
  comNumber: string;
  orderNumber?: string;
  unitTag?: string;
  dimensions?: { length: number; width: number; height: number };
  facts: Record<string, Fact>;
  onGoHome: () => void;
  onOpenResolutionCenter: () => void;
  onOpenPreFlight: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onLoadSample: () => void;
  onFileUpload: (file: File) => void;
  onSaveDvl: () => void;
  onSaveDvlAs: () => void;
  rulePackVersion: string;
  themeMode: ThemeMode;
  onCycleThemeMode: () => void;
  lastSavedAt?: string;
  hasUnsavedChanges?: boolean;
  onOpenProjectIdentityModal?: () => void;
  onOpenDetailerModal?: () => void;
  onOpenComModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  jobName,
  comNumber,
  orderNumber,
  unitTag,
  dimensions,
  facts,
  onGoHome,
  onOpenResolutionCenter,
  onOpenPreFlight,
  onOpenSearch,
  onOpenSettings,
  onLoadSample,
  onFileUpload,
  onSaveDvl,
  onSaveDvlAs,
  rulePackVersion,
  themeMode,
  onCycleThemeMode,
  lastSavedAt,
  hasUnsavedChanges,
  onOpenProjectIdentityModal,
  onOpenDetailerModal,
  onOpenComModal
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Count pending unconfirmed facts (exclude weight)
  const pendingFactsCount = Object.values(facts).filter(
    f => (f.status === 'Unknown' || f.confidence === 'RequiresConfirmation') && !f.key.includes('weight')
  ).length;

  const detailerName = facts['unit.detailer']?.value ? String(facts['unit.detailer'].value) : '';

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
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 flex items-center justify-between z-10 shrink-0 transition-colors gap-2 sm:gap-4 overflow-hidden">
      {/* Left: Home Trigger + Job Identity & Casing Dimensions */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onGoHome}
          title="Return to Home Landing Page"
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm flex items-center gap-1.5 text-xs font-semibold shrink-0"
        >
          <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Home</span>
        </button>

        {/* Unified Project Identity & Casing Dimensions Button */}
        <button
          onClick={onOpenProjectIdentityModal || onOpenComModal}
          title="Click to view and edit Project & Order Identity"
          className="text-left group/id flex flex-col justify-center min-w-0 max-w-full px-2.5 py-1.5 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
        >
          {/* Top Line: Job Name + Casing Dimensions */}
          <div className="flex items-center gap-2 flex-nowrap min-w-0 overflow-hidden">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate min-w-[70px] max-w-[160px] sm:max-w-[220px] md:max-w-[280px] lg:max-w-[380px] group-hover/id:text-blue-600 dark:group-hover/id:text-blue-400 transition-colors">
              {jobName || 'AHU Detailing Project'}
            </h2>
            {dimensions && (
              <span className="text-[10px] sm:text-[11px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm shrink-0 whitespace-nowrap">
                {dimensions.length}"L × {dimensions.width}"W × {dimensions.height}"H
              </span>
            )}
          </div>

          {/* Sub Line: COM #, Order #, Unit Tag, Detailer, Autosave */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex-nowrap overflow-hidden">
            <span className={`px-1.5 py-0.2 rounded border font-semibold whitespace-nowrap ${
              comNumber
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
            }`}>
              {comNumber ? `COM: ${comNumber}` : 'No COM#'}
            </span>

            {orderNumber && (
              <span className="hidden md:inline px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                Ord: {orderNumber}
              </span>
            )}

            {unitTag && (
              <span className="hidden lg:inline px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                Tag: {unitTag}
              </span>
            )}

            <span className="hidden sm:flex items-center gap-1 text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <User className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[90px]">{detailerName || 'Detailer'}</span>
            </span>

            {lastSavedAt && (
              <span className="hidden 2xl:inline text-[10px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap flex items-center gap-0.5">
                • <CheckCircle2 className="w-3 h-3" /> {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </button>

        {/* Rule Pack Tag */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-medium shrink-0">
          <Shield className="w-3.5 h-3.5" />
          <span>Rule Pack v{rulePackVersion}</span>
        </div>
      </div>

      {/* Center: Omni-Search Trigger (Compact on medium screens, expanded on large) */}
      <button
        onClick={onOpenSearch}
        title="Search rules, specifications, skids, special quotes (Ctrl+K)"
        className="hidden md:flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all w-36 lg:w-48 xl:w-56 justify-between group shrink-0"
      >
        <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
          <span className="truncate text-[11px]">Search...</span>
        </span>
        <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
          Ctrl+K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xml,.dvl"
          className="hidden"
        />

        {/* Load Sample Config.xml (Hidden in production) */}
        {!import.meta.env.PROD && (
          <button
            onClick={onLoadSample}
            title="Reload demo Config.xml"
            className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-500" />
            <span>Sample XML</span>
          </button>
        )}

        {/* Upload XML */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload custom Config.xml or .dvl project"
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden xl:inline">Upload</span>
        </button>

        {/* Save .dvl Project */}
        <button
          onClick={() => onSaveDvl()}
          title="Save self-contained .dvl project file (Ctrl+S)"
          className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
        >
          <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden xl:inline">Save .dvl</span>
          <span className="hidden md:inline xl:hidden">Save</span>
        </button>

        <button
          onClick={() => onSaveDvlAs()}
          title="Save a copy to a new .dvl path (Ctrl+Shift+S)"
          className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 font-medium transition-all"
        >
          <SaveAll className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Save As</span>
        </button>

        {/* Resolution Center */}
        <button
          onClick={onOpenResolutionCenter}
          title="Facts & Provenance Resolution Center"
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            pendingFactsCount > 0
              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-800 dark:text-amber-300'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">Facts</span>
          {pendingFactsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-900 dark:text-amber-200 font-mono text-[10px] font-bold">
              {pendingFactsCount}
            </span>
          )}
        </button>

        {/* Export Pre-Flight & XLSX */}
        <button
          onClick={onOpenPreFlight}
          title="Generate Excel Verification List (.xlsx)"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
          <span className="hidden sm:inline">Export</span>
          <span className="hidden lg:inline"> .xlsx</span>
        </button>

        {/* Theme 3-Way Mode Toggle */}
        <button
          onClick={onCycleThemeMode}
          title={getThemeTitle()}
          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all"
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
