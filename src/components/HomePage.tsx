import React, { useState, useRef } from 'react';
import {
  FileCode,
  FolderOpen,
  PlusCircle,
  Shield,
  UploadCloud,
  Clock,
  Trash2,
  Snowflake,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  RefreshCw
} from 'lucide-react';
import { DvlProjectFile, UpzBundle } from '../types';
import { desktopBridge } from '../services/desktopBridge';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from '../services/rulesCatalog';

export interface ImportErrorState {
  fileName?: string;
  title: string;
  message: string;
  recoverySteps?: string[];
}

interface HomePageProps {
  autosavedProject: DvlProjectFile | null;
  onResumeAutosave: () => void;
  onClearAutosave: () => void;
  onImportXml: (xmlContent: string, bundle?: UpzBundle, sourceFileName?: string) => void | Promise<void>;
  onOpenDvl: (project: DvlProjectFile, rawJson?: string, filePath?: string) => void | Promise<void>;
  onOpenManualModal: () => void;
  onLoadSample: () => void;
  rulePackVersion?: string;
  ruleCount?: number;
}

export const HomePage: React.FC<HomePageProps> = ({
  autosavedProject,
  onResumeAutosave,
  onClearAutosave,
  onImportXml,
  onOpenDvl,
  onOpenManualModal,
  onLoadSample,
  rulePackVersion = RULE_PACK_IDENTITY.version,
  ruleCount = RULES_CATALOG.filter(rule => !rule.isArchived).length
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [importError, setImportError] = useState<ImportErrorState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setImportError(null);
    setIsProcessing(true);

    if (file.name.toLowerCase().endsWith('.upz')) {
      setProcessingMessage(`Unpacking UPZ bundle: ${file.name}...`);
      const filePath = (file as any).path;
      if (desktopBridge.isRunningInDesktop() && filePath) {
        try {
          const res = await desktopBridge.extractUpz(filePath);
          setProcessingMessage(`Ingesting extracted configuration: ${res.fileName}...`);
          await onImportXml(res.content, res.bundle, res.fileName);
          setIsProcessing(false);
          return;
        } catch (err: any) {
          setIsProcessing(false);
          setImportError({
            fileName: file.name,
            title: 'Failed to Extract UPZ Package',
            message: err?.message || 'An unexpected error occurred while extracting the UPZ bundle.',
            recoverySteps: [
              'Ensure the .upz file is not locked by another application or corrupted.',
              'Confirm the package contains a valid Johnson Controls AHU Config.xml and manifest.',
              'Alternatively, extract Config.xml manually or configure the unit using Manual Unit Setup.'
            ]
          });
          return;
        }
      } else {
        setIsProcessing(false);
        setImportError({
          fileName: file.name,
          title: 'Desktop App Required for UPZ Bundles',
          message: 'Direct .upz bundle extraction requires the desktop application runtime.',
          recoverySteps: [
            'In browser preview mode, import standalone Config.xml or .dvl project files.',
            'Launch the application via the desktop executable (AHUVerification.App.exe) for automated native UPZ extraction.'
          ]
        });
        return;
      }
    }

    setProcessingMessage(`Reading file: ${file.name}...`);
    const reader = new FileReader();
    reader.onerror = () => {
      setIsProcessing(false);
      setImportError({
        fileName: file.name,
        title: 'File Read Failure',
        message: 'Failed to read the selected file from disk.',
        recoverySteps: ['Check file permissions and try selecting the file again.']
      });
    };
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (file.name.toLowerCase().endsWith('.dvl')) {
        try {
          setProcessingMessage(`Validating project file: ${file.name}...`);
          const project = JSON.parse(text);
          await onOpenDvl(project, text);
          setIsProcessing(false);
        } catch (err: any) {
          setIsProcessing(false);
          setImportError({
            fileName: file.name,
            title: 'Invalid .dvl Project File',
            message: err?.message || 'Failed to parse project JSON data.',
            recoverySteps: [
              'Verify that the .dvl file is not corrupted or truncated.',
              'Ensure the file is a valid Detailing Verification List project export.'
            ]
          });
        }
      } else {
        try {
          setProcessingMessage(`Parsing AHU configuration: ${file.name}...`);
          await onImportXml(text, undefined, file.name);
          setIsProcessing(false);
        } catch (err: any) {
          setIsProcessing(false);
          setImportError({
            fileName: file.name,
            title: 'Failed to Ingest AHU Configuration',
            message: err?.message || 'The XML configuration does not match expected AHU schema specifications.',
            recoverySteps: [
              'Verify that this is an exported Johnson Controls MOM Config.xml file.',
              'Ensure the XML file contains <unitOptions>, <skidList>, or <segmentList> definitions.',
              'If you do not have a MOM export, configure the unit from scratch using Manual Unit Setup.'
            ]
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const handleNativeOpen = async () => {
    setImportError(null);
    if (desktopBridge.isRunningInDesktop()) {
      try {
        setIsProcessing(true);
        setProcessingMessage('Opening file dialog...');
        const result = await desktopBridge.openFileDialog();
        if (result) {
          setProcessingMessage(`Ingesting ${result.fileName}...`);
          if (result.isDvl) {
            try {
              const project = JSON.parse(result.content);
              await onOpenDvl(project, result.content, result.filePath);
              setIsProcessing(false);
            } catch (err: any) {
              setIsProcessing(false);
              setImportError({
                fileName: result.fileName,
                title: 'Invalid .dvl Project File',
                message: err?.message || 'Failed to parse project JSON structure.',
                recoverySteps: [
                  'Ensure the .dvl file is valid and complete.',
                  'Try opening another saved project or importing Config.xml.'
                ]
              });
            }
          } else if (result.isUpz && result.bundle) {
            await onImportXml(result.content, result.bundle, result.fileName);
            setIsProcessing(false);
          } else {
            await onImportXml(result.content, undefined, result.fileName);
            setIsProcessing(false);
          }
        } else {
          setIsProcessing(false);
        }
      } catch (err: any) {
        setIsProcessing(false);
        setImportError({
          title: 'File Ingestion Error',
          message: err?.message || 'An error occurred while opening the file.',
          recoverySteps: ['Try selecting the file again or use drag-and-drop.']
        });
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const isProd = import.meta.env.PROD;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-screen w-screen overflow-y-auto bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-between p-6 sm:p-10 transition-colors ${
        isDragging ? 'bg-blue-50 dark:bg-blue-950/20' : ''
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".xml,.dvl,.upz"
        className="hidden"
      />

      {/* Header Banner with York Snowflake Logo */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-900 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
            <Snowflake className="w-5 h-5 text-cyan-100" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              York AHU Detailing Verification System
            </h1>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
              Engineering Configuration Ingestion & Verification Deliverables
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>Rule Pack v{rulePackVersion} ({ruleCount} Rules)</span>
        </div>
      </div>

      {/* Main Hero & Launch Grid */}
      <div className="w-full max-w-5xl my-auto py-8 space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Select an AHU Project to Begin Verification
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Ingest MOM Config.xml engineering configuration, load an existing .dvl project, or configure a custom unit.
          </p>
        </div>

        {/* Durable Error Banner */}
        {importError && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-5 rounded-2xl bg-red-50/95 dark:bg-red-950/50 border-2 border-red-300 dark:border-red-800/80 shadow-lg animate-in fade-in slide-in-from-top-2 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                      {importError.title}
                    </h3>
                    {importError.fileName && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-red-200/60 dark:bg-red-900/60 text-red-800 dark:text-red-300 font-semibold">
                        {importError.fileName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed font-mono">
                    {importError.message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setImportError(null)}
                title="Dismiss error banner"
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importError.recoverySteps && importError.recoverySteps.length > 0 && (
              <div className="pt-2 border-t border-red-200 dark:border-red-900/50 pl-12 space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-400">
                  Suggested Recovery Steps:
                </span>
                <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300/90 space-y-1">
                  {importError.recoverySteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 border-t border-red-200 dark:border-red-900/50 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setImportError(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-850 hover:bg-red-100/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleNativeOpen}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Another File</span>
              </button>
              <button
                type="button"
                onClick={onOpenManualModal}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Manually</span>
              </button>
            </div>
          </div>
        )}

        {/* Ingestion Loading Indicator */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/40 shadow-sm flex items-center gap-3.5 animate-in fade-in">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">Processing AHU Ingestion</h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 font-mono">{processingMessage || 'Extracting configuration data...'}</p>
            </div>
          </div>
        )}

        {/* Autosave Resume Banner (if present) */}
        {autosavedProject && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 dark:from-blue-950/70 dark:via-indigo-950/60 dark:to-slate-900 border border-blue-200 dark:border-blue-500/40 shadow-sm dark:shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{autosavedProject.jobName}</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold">
                    {autosavedProject.comNumber || 'COM Pending'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unsaved session from {new Date(autosavedProject.lastSavedAt).toLocaleString()} ({autosavedProject.author || 'Detailer'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={onClearAutosave}
                title="Discard autosaved session"
                className="p-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onResumeAutosave}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <span>Resume Previous Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Launch Action Cards */}
        <div className={`grid grid-cols-1 ${isProd ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'} gap-4`}>
          {/* 1. Import Config.xml / .upz Bundle */}
          <div
            onClick={handleNativeOpen}
            className="group relative p-6 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all shadow-sm hover:shadow-blue-500/10 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Import Config.xml / .upz
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Ingest MOM Config.xml or JCI .upz bundle to automatically extract unit geometry, casing materials, segments, and shipping splits.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-blue-700 dark:text-blue-400 font-semibold">
              <span>Select File</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Open .dvl Project */}
          <div
            onClick={handleNativeOpen}
            className="group relative p-6 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all shadow-sm hover:shadow-emerald-500/10 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FolderOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Open .dvl Project
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Resume an existing Detailing Verification List project with complete fact provenance, checklists, and manual overrides intact.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              <span>Browse Projects</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. Manual Unit Setup */}
          <div
            onClick={onOpenManualModal}
            className="group relative p-6 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all shadow-sm hover:shadow-indigo-500/10 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Manual Unit Setup
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Configure a custom unit from scratch without an XML file. Specify Job Name, COM#, Casing specs, and split skids.
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400 font-semibold">
              <span>Configure Unit</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 4. Load Demo Sample (Dev/Demo Only) */}
          {!isProd && (
            <div
              onClick={onLoadSample}
              className="group relative p-6 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 cursor-pointer transition-all shadow-sm hover:shadow-amber-500/10 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileCode className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Load Demo Dataset
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Explore features and Excel export with reference 4-skid AHU demo dataset (Medical Center Phase 3).
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-400 font-semibold">
                <span>Launch Demo</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Notes */}
      <div className="w-full max-w-5xl text-center border-t border-slate-200 dark:border-slate-900 pt-4 text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center justify-between">
        <span>Johnson Controls York Custom Air Handling Units</span>
        <span>OpenXML 3.1.1 Deliverable Engine &bull; Zero Schema Corruption</span>
      </div>
    </div>
  );
};
