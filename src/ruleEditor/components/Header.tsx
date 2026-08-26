import React from 'react';
import { Sliders, ShieldCheck, Download, UploadCloud, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';

interface HeaderProps {
  version: string;
  dirtyCount: number;
  onOpenPublish: () => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  version,
  dirtyCount,
  onOpenPublish,
  onExportJson,
  onImportJson
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 px-4 flex items-center justify-between gap-4 select-none">
      {/* Title & Badge */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-white shadow-md shadow-blue-950">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">
              AHU Verification • Rule & Logic Editor
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800 rounded-md">
              v{version}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Engineering Verification Checklist & AST Predicate Authoring Studio
          </p>
        </div>
      </div>

      {/* Center status badge */}
      <div className="hidden md:flex items-center gap-2">
        {dirtyCount > 0 ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/50 border border-amber-800 text-amber-300 text-xs font-semibold rounded-full animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Draft Mode: {dirtyCount} rule{dirtyCount > 1 ? 's' : ''} modified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Rule Pack Synced & Verified</span>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg cursor-pointer transition-colors">
          <FileJson className="w-3.5 h-3.5 text-slate-400" />
          Import
          <input
            type="file"
            accept=".json"
            onChange={onImportJson}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={onExportJson}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          Export JSON
        </button>

        <button
          type="button"
          onClick={onOpenPublish}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md shadow-emerald-950 transition-colors ml-1"
        >
          <UploadCloud className="w-4 h-4" />
          Publish Release
        </button>
      </div>
    </header>
  );
};
