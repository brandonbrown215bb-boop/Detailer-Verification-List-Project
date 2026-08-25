import React, { useRef } from 'react';
import {
  FileCode,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Search,
  Moon,
  Sun,
  Shield,
  Save
} from 'lucide-react';
import { Fact } from '../types';

interface HeaderProps {
  jobName: string;
  comNumber: string;
  facts: Record<string, Fact>;
  onOpenResolutionCenter: () => void;
  onOpenPreFlight: () => void;
  onOpenSearch: () => void;
  onLoadSample: () => void;
  onFileUpload: (file: File) => void;
  onSaveDvl: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  jobName,
  comNumber,
  facts,
  onOpenResolutionCenter,
  onOpenPreFlight,
  onOpenSearch,
  onLoadSample,
  onFileUpload,
  onSaveDvl,
  isDarkMode,
  onToggleDarkMode
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

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-10 shrink-0">
      {/* Left: Job Identity & Pinned Rule Pack */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              {jobName || 'AHU Detailing Project'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-blue-400 font-semibold">
              {comNumber || 'COM-PENDING'}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Detailer Verification Workspace
          </p>
        </div>

        {/* Rule Pack Tag */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>Rule Pack v13.1.0</span>
        </div>
      </div>

      {/* Center: Omni-Search Trigger */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-400 hover:text-slate-200 transition-all w-64 justify-between group"
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
          <span>Search rules, specs, SQs...</span>
        </span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-slate-400">
          Ctrl+K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
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
          title="Reload the authoritative demo Config.xml"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-all"
        >
          <FileCode className="w-3.5 h-3.5 text-amber-400" />
          <span>Sample XML</span>
        </button>

        {/* Upload XML */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload custom Config.xml or .dvl project"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-all"
        >
          <Upload className="w-3.5 h-3.5 text-blue-400" />
          <span>Upload</span>
        </button>

        {/* Save .dvl Project */}
        <button
          onClick={onSaveDvl}
          title="Save self-contained .dvl project file (Ctrl+S)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-all"
        >
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span>Save .dvl</span>
        </button>

        {/* Resolution Center */}
        <button
          onClick={onOpenResolutionCenter}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            pendingFactsCount > 0
              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>Facts</span>
          {pendingFactsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-200 font-mono text-[10px] font-bold">
              {pendingFactsCount}
            </span>
          )}
        </button>

        {/* Export Pre-Flight & XLSX */}
        <button
          onClick={onOpenPreFlight}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
          <span>Export .xlsx</span>
        </button>

        {/* Dark/Light Toggle */}
        <button
          onClick={onToggleDarkMode}
          title="Toggle Theme"
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all ml-1"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
        </button>
      </div>
    </header>
  );
};
