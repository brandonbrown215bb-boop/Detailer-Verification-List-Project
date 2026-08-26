import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  NormalizedXmlGraph,
  Fact,
  SpecialQuote,
  ChecklistInstance,
  CheckStatus,
  DvlProjectFile,
  ThemeMode
} from './types';
import { parseAhuXml } from './services/xmlParser';
import { extractFactsFromGraph, overrideFact, revertFact } from './services/factRegistry';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from './services/rulesCatalog';
import { generateChecklists } from './services/ruleEvaluator';
import { createDvlProject, inspectDvlIntegrity, saveDvlToFile, autosaveToLocal, loadAutosave } from './services/projectStorage';
import { createManualUnit, ManualUnitConfig } from './services/manualUnitFactory';
import { desktopBridge } from './services/desktopBridge';
import { SAMPLE_CONFIG_XML } from './fixtures/sampleConfigXml';

import { HomePage } from './components/HomePage';
import { ManualUnitModal } from './components/ManualUnitModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GeneralUnitTab } from './components/GeneralUnitTab';
import { SkidViewTab } from './components/SkidViewTab';
import { ResolutionCenterModal } from './components/ResolutionCenterModal';
import { PreFlightModal } from './components/PreFlightModal';
import { OmniSearchModal } from './components/OmniSearchModal';
import { SettingsModal } from './components/SettingsModal';
import { AlertCircle, RefreshCw, CheckCircle2, FileSpreadsheet, Folder } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in AHU Verification UI:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-red-500/30 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-lg font-bold">Application Error</h2>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  // Navigation & Project Active State (Defaults to false = Landing Home Page)
  const [isProjectLoaded, setIsProjectLoaded] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [autosavedProject, setAutosavedProject] = useState<DvlProjectFile | null>(() => loadAutosave());

  // Project Workspace State
  const [rawXml, setRawXml] = useState<string>('');
  const [graph, setGraph] = useState<NormalizedXmlGraph | null>(null);
  const [facts, setFacts] = useState<Record<string, Fact>>({});
  const [sqItems, setSqItems] = useState<SpecialQuote[]>([]);
  const [checklists, setChecklists] = useState<ChecklistInstance[]>([]);
  const [generalComments, setGeneralComments] = useState<string>(
    'Verification performed in accordance with standard factory detailing guidelines and BOM requirements.'
  );
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [projectIntegrityWarning, setProjectIntegrityWarning] = useState<string | null>(null);

  // Active view: 'general' or skid ID ('skid-1', 'skid-2', etc.)
  const [activeTab, setActiveTab] = useState<string>('general');

  // Modals & Navigation state
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sidebar Collapse state (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dvl_sidebar_collapsed') === 'true';
  });

  // 3-Way Theme Mode state ('dark' | 'light' | 'system')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('dvl_theme_mode') as ThemeMode;
    return saved || 'dark';
  });

  // Live Autosave status tracking
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Export success toast state
  const [exportNotice, setExportNotice] = useState<{ fileName: string; filePath?: string } | null>(null);

  // Apply Theme Mode class to document element
  useEffect(() => {
    const applyTheme = (mode: ThemeMode) => {
      let isDark = true;
      if (mode === 'light') isDark = false;
      else if (mode === 'dark') isDark = true;
      else if (mode === 'system') isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(themeMode);
    localStorage.setItem('dvl_theme_mode', themeMode);

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      };
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('dvl_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Autosave when active data changes
  useEffect(() => {
    if (isProjectLoaded && graph && facts && sqItems && checklists) {
      let cancelled = false;
      void createDvlProject(graph, facts, sqItems, checklists, rawXml, generalComments)
        .then(proj => {
          if (cancelled) return;
          autosaveToLocal(proj);
          setAutosavedProject(proj);
          setLastSavedAt(new Date().toISOString());
        })
        .catch(error => console.warn('Autosave project creation failed:', error));
      return () => {
        cancelled = true;
      };
    }
  }, [isProjectLoaded, graph, facts, sqItems, checklists, rawXml, generalComments]);

  // Handler for loading new XML
  const loadXmlData = useCallback((xmlString: string) => {
    try {
      const newGraph = parseAhuXml(xmlString);
      const newFacts = extractFactsFromGraph(newGraph);
      const newChecklists = generateChecklists(RULES_CATALOG, newGraph, newFacts);

      setRawXml(xmlString);
      setGraph(newGraph);
      setFacts(newFacts);
      setChecklists(newChecklists);
      setSqItems([]);
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setActiveTab('general');
      setIsProjectLoaded(true);
    } catch (err: any) {
      alert(`Error parsing AHU XML: ${err.message}`);
    }
  }, []);

  // Handler for loading saved .dvl project
  const handleOpenDvl = useCallback(async (project: DvlProjectFile, _rawJson?: string, filePath?: string) => {
    try {
      const integrity = await inspectDvlIntegrity(project);
      setGraph(project.normalizedGraph);
      setFacts(project.factRegistry);
      setSqItems(project.sqItems || []);
      setChecklists(project.checklistInstances || []);
      setRawXml(project.sourceXml?.rawXml || '');
      setGeneralComments(project.generalComments || '');
      setCurrentProjectPath(filePath || null);
      setProjectIntegrityWarning(integrity.status === 'unverified' ? integrity.message || 'This project could not be verified.' : null);
      setActiveTab('general');
      setIsProjectLoaded(true);
    } catch (err: any) {
      alert(`Error loading .dvl project: ${err.message}`);
    }
  }, []);

  // Handler for creating manual unit
  const handleManualCreate = useCallback((config: ManualUnitConfig) => {
    try {
      const manual = createManualUnit(config);
      setGraph(manual.graph);
      setFacts(manual.facts);
      setChecklists(manual.checklists);
      setSqItems(manual.sqItems);
      setRawXml(manual.rawXml);
      setGeneralComments(manual.generalComments);
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setActiveTab('general');
      setIsProjectLoaded(true);
    } catch (err: any) {
      alert(`Error creating manual unit: ${err.message}`);
    }
  }, []);

  // Handler for resuming autosave
  const handleResumeAutosave = useCallback(() => {
    if (autosavedProject) {
      handleOpenDvl(autosavedProject);
    }
  }, [autosavedProject, handleOpenDvl]);

  // Handler for clearing autosave
  const handleClearAutosave = useCallback(() => {
    try {
      localStorage.removeItem('ahu_dvl_autosave');
      setAutosavedProject(null);
      setLastSavedAt(null);
    } catch (e) {
      console.warn('Failed to clear autosave:', e);
    }
  }, []);

  // Handler for loading demo sample
  const handleLoadSample = useCallback(() => {
    try {
      const newGraph = parseAhuXml(SAMPLE_CONFIG_XML);
      const newFacts = extractFactsFromGraph(newGraph);
      const newChecklists = generateChecklists(RULES_CATALOG, newGraph, newFacts);

      setRawXml(SAMPLE_CONFIG_XML);
      setGraph(newGraph);
      setFacts(newFacts);
      setChecklists(newChecklists);
      setSqItems([
        {
          slot: 1,
          id: 'sq-1',
          text: 'Custom drain pan depth 3.5 in. with copper downspout connection',
          linkedSkidId: 'skid-3',
          initials: 'TD',
          isCompleted: true
        },
        {
          slot: 2,
          id: 'sq-2',
          text: 'Dual 630 EBM Fan Wall array with individual disconnects',
          linkedSkidId: 'skid-4',
          initials: 'TD',
          isCompleted: false
        }
      ]);
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setActiveTab('general');
      setIsProjectLoaded(true);
    } catch (err: any) {
      alert(`Error loading sample: ${err.message}`);
    }
  }, []);

  // Handler for opening files (.xml or .dvl) from Header
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (file.name.endsWith('.dvl')) {
        try {
          const project = JSON.parse(text);
          handleOpenDvl(project);
        } catch (err: any) {
          alert(`Error reading .dvl project file: ${err.message}`);
        }
      } else {
        loadXmlData(text);
      }
    };
    reader.readAsText(file);
  };

  // Fact Update & Revert Handlers
  const handleUpdateFact = useCallback((key: string, value: any, author: string = 'Detailer', note?: string) => {
    if (!graph) return;
    setFacts(prev => {
      const updated = overrideFact(prev, key, value, author, note);
      const newChecklists = generateChecklists(RULES_CATALOG, graph, updated, checklists);
      setChecklists(newChecklists);
      return updated;
    });
  }, [graph, checklists]);

  const handleRevertFact = useCallback((key: string) => {
    if (!graph) return;
    setFacts(prev => {
      const reverted = revertFact(prev, key);
      const newChecklists = generateChecklists(RULES_CATALOG, graph, reverted, checklists);
      setChecklists(newChecklists);
      return reverted;
    });
  }, [graph, checklists]);

  const handleBatchResolveDefaults = useCallback(() => {
    if (!graph) return;
    setFacts(prev => {
      let updated = { ...prev };

      // Set standard default specs
      if (updated['unit.noa'] && updated['unit.noa'].confidence === 'RequiresConfirmation') {
        updated = overrideFact(updated, 'unit.noa', 'N/A (Standard Unit)', 'Detailer', 'Standard Non-NOA unit');
      }
      if (updated['unit.isSeismic'] && updated['unit.isSeismic'].confidence === 'RequiresConfirmation') {
        updated = overrideFact(updated, 'unit.isSeismic', 'No (Standard Non-Seismic)', 'Detailer', 'Standard Non-Seismic');
      }

      // Confirm all skid weights to calculated weights
      graph.skids.forEach(s => {
        const key = `skid.${s.id}.weight`;
        if (updated[key] && updated[key].confidence === 'RequiresConfirmation') {
          updated = overrideFact(updated, key, s.calculatedWeight, 'Detailer', 'Confirmed from segment mass properties');
        }
      });

      const newChecklists = generateChecklists(RULES_CATALOG, graph, updated, checklists);
      setChecklists(newChecklists);
      return updated;
    });
    setIsResolutionOpen(false);
  }, [graph, checklists]);

  // Checklist Update Handlers
  const handleUpdateChecklistStatus = useCallback((instanceKey: string, status: CheckStatus) => {
    setChecklists(prev => prev.map(item => {
      if (item.instanceKey === instanceKey) {
        return { ...item, status, updatedAt: new Date().toISOString() };
      }
      return item;
    }));
  }, []);

  const handleUpdateChecklistComment = useCallback((instanceKey: string, detailerComment: string) => {
    setChecklists(prev => prev.map(item => {
      if (item.instanceKey === instanceKey) {
        return { ...item, detailerComment, updatedAt: new Date().toISOString() };
      }
      return item;
    }));
  }, []);

  // Save .dvl Project
  const handleSaveDvl = async (forceSaveAs: boolean = false) => {
    if (!graph) return;
    try {
      const project = await createDvlProject(graph, facts, sqItems, checklists, rawXml, generalComments);
      const jobName = facts['unit.jobName']?.value || 'AHU_Project';
      const comNumber = facts['unit.comNumber']?.value || 'COM-000000';
      const defaultName = `${jobName}_${comNumber}.dvl`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      if (desktopBridge.isRunningInDesktop()) {
        let targetPath = forceSaveAs ? null : currentProjectPath;
        if (!targetPath) {
          targetPath = await desktopBridge.saveFileDialog(defaultName);
        }
        if (!targetPath) return;

        const res = await desktopBridge.saveDvl(targetPath, project);
        if (res.saved) {
          setCurrentProjectPath(res.path);
          setProjectIntegrityWarning(null);
          setExportNotice({ fileName: res.path.split(/[\\/]/).pop() || defaultName, filePath: res.path });
        }
      } else {
        saveDvlToFile(project);
      }
    } catch (error: any) {
      alert(`Error saving .dvl project: ${error.message}`);
    }
  };

  // Export Excel Deliverable
  const handleExportExcel = async (isDraft: boolean = false) => {
    if (!graph) return;
    const jobName = facts['unit.jobName']?.value || 'AHU_Project';
    const comNumber = facts['unit.comNumber']?.value || 'COM-000000';
    const defaultName = `${jobName}_${comNumber}_Detailing_Verification_List${isDraft ? '_DRAFT' : ''}.xlsx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    const result = await desktopBridge.exportExcelDeliverable(
      facts,
      sqItems,
      checklists,
      RULES_CATALOG,
      graph,
      generalComments,
      defaultName,
      isDraft
    );

    if (result.exported && !result.cancelled) {
      setExportNotice({ fileName: result.fileName || defaultName, filePath: result.filePath });
    }
  };

  // Keyboard Shortcuts (Ctrl+K, Ctrl+S, Ctrl+E, Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (isProjectLoaded) {
          e.preventDefault();
          void handleSaveDvl(e.shiftKey);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        if (isProjectLoaded) {
          e.preventDefault();
          setIsPreFlightOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectLoaded, graph, facts, sqItems, checklists, rawXml, generalComments, currentProjectPath]);

  // Cycle Theme Mode handler
  const handleCycleThemeMode = useCallback(() => {
    setThemeMode(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'system';
      return 'dark';
    });
  }, []);

  // --- RENDER: HOME / LANDING PAGE ---
  if (!isProjectLoaded || !graph) {
    return (
      <div className="min-h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <HomePage
          autosavedProject={autosavedProject}
          onResumeAutosave={handleResumeAutosave}
          onClearAutosave={handleClearAutosave}
          onImportXml={loadXmlData}
          onOpenDvl={handleOpenDvl}
          onOpenManualModal={() => setIsManualModalOpen(true)}
          onLoadSample={handleLoadSample}
        />

        <ManualUnitModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onCreateUnit={handleManualCreate}
        />
      </div>
    );
  }

  // --- RENDER: ACTIVE WORKSPACE ---
  const selectedSkid = graph.skids.find(s => s.id === activeTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Left Navigation Rail */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        graph={graph}
        checklists={checklists}
        sqItems={sqItems}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Top Header */}
        <Header
          jobName={String(facts['unit.jobName']?.value || '')}
          comNumber={String(facts['unit.comNumber']?.value || '')}
          facts={facts}
          onGoHome={() => setIsProjectLoaded(false)}
          onOpenResolutionCenter={() => setIsResolutionOpen(true)}
          onOpenPreFlight={() => setIsPreFlightOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLoadSample={handleLoadSample}
          onFileUpload={handleFileUpload}
          onSaveDvl={handleSaveDvl}
          onSaveDvlAs={() => handleSaveDvl(true)}
          rulePackVersion={RULE_PACK_IDENTITY.version}
          themeMode={themeMode}
          onCycleThemeMode={handleCycleThemeMode}
          lastSavedAt={lastSavedAt || undefined}
        />

        {projectIntegrityWarning && (
          <div className="bg-amber-100 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-700/60 px-6 py-2 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{projectIntegrityWarning}</span>
          </div>
        )}

        {/* Export Notification Toast */}
        {exportNotice && (
          <div className="bg-emerald-100 dark:bg-emerald-950/90 border-b border-emerald-300 dark:border-emerald-700/60 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                Successfully generated deliverable: <strong className="font-mono">{exportNotice.fileName}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {exportNotice.filePath && (
                <>
                  <button
                    onClick={() => desktopBridge.openFile(exportNotice.filePath!)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{exportNotice.fileName.endsWith('.dvl') ? 'Open File' : 'Open in Excel'}</span>
                  </button>
                  <button
                    onClick={() => desktopBridge.showInExplorer(exportNotice.filePath!)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Show in Folder</span>
                  </button>
                </>
              )}
              <button
                onClick={() => setExportNotice(null)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content View */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' ? (
            <GeneralUnitTab
              facts={facts}
              sqItems={sqItems}
              graph={graph}
              generalComments={generalComments}
              onUpdateFact={handleUpdateFact}
              onRevertFact={handleRevertFact}
              onUpdateSqItems={setSqItems}
              onUpdateComments={setGeneralComments}
              onOpenResolutionCenter={() => setIsResolutionOpen(true)}
            />
          ) : selectedSkid ? (
            <SkidViewTab
              skid={selectedSkid}
              segments={graph.segments}
              bases={graph.bases}
              checklists={checklists}
              rules={RULES_CATALOG}
              sqItems={sqItems}
              facts={facts}
              onUpdateChecklistStatus={handleUpdateChecklistStatus}
              onUpdateChecklistComment={handleUpdateChecklistComment}
              onUpdateFact={handleUpdateFact}
              onOpenResolutionCenter={() => setIsResolutionOpen(true)}
            />
          ) : null}
        </main>
      </div>

      {/* Modals */}
      <ResolutionCenterModal
        isOpen={isResolutionOpen}
        onClose={() => setIsResolutionOpen(false)}
        facts={facts}
        onUpdateFact={handleUpdateFact}
        onBatchResolveDefaults={handleBatchResolveDefaults}
      />

      <PreFlightModal
        isOpen={isPreFlightOpen}
        onClose={() => setIsPreFlightOpen(false)}
        checklists={checklists}
        rules={RULES_CATALOG}
        facts={facts}
        sqItems={sqItems}
        onExportExcel={handleExportExcel}
        onExportDvl={handleSaveDvl}
        onNavigateToRule={(scopeTargetId) => {
          setActiveTab(scopeTargetId === 'unit' ? 'general' : scopeTargetId);
        }}
        onOpenResolutionCenter={() => setIsResolutionOpen(true)}
      />

      <OmniSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        rules={RULES_CATALOG}
        facts={facts}
        sqItems={sqItems}
        graph={graph}
        onNavigate={(tabId) => setActiveTab(tabId)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onSetThemeMode={setThemeMode}
        detailerName={String(facts['unit.detailer']?.value || 'Detailer')}
        onUpdateDetailerName={(name) => handleUpdateFact('unit.detailer', name)}
        rulePackVersion={RULE_PACK_IDENTITY.version}
        ruleCount={RULES_CATALOG.length}
        lastAutosavedAt={lastSavedAt || undefined}
        onClearAutosave={handleClearAutosave}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};
