import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import type { ThemeMode } from './types';
import { desktopBridge } from './services/desktopBridge';
import { useProjectSession } from './hooks/useProjectSession';
import { useRulePackSession } from './hooks/useRulePackSession';
import { STORAGE_KEYS } from './utils/constants';

import { HomePage } from './components/HomePage';
import { ManualUnitModal } from './components/ManualUnitModal';
import { DetailerNameModal } from './components/DetailerNameModal';
import { ComNumberModal } from './components/ComNumberModal';
import { ProjectIdentityModal } from './components/ProjectIdentityModal';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GeneralUnitTab } from './components/GeneralUnitTab';
import { SkidViewTab } from './components/SkidViewTab';
import { ResolutionCenterModal } from './components/ResolutionCenterModal';
import { PreFlightModal } from './components/PreFlightModal';
import { OmniSearchModal } from './components/OmniSearchModal';
import { SettingsModal } from './components/SettingsModal';
import { DesktopHostRequiredScreen } from './components/DesktopHostRequiredScreen';
import { AlertCircle, RefreshCw, CheckCircle2, FileSpreadsheet, Folder, DownloadCloud } from 'lucide-react';

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
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 bg-status-danger/10 border border-status-danger rounded-lg max-w-lg mb-4 text-status-danger">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <h2 className="text-lg font-bold">Something went wrong</h2>
            <p className="text-xs text-text-muted mt-2 font-mono break-all">{this.state.error?.message}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-fg rounded hover:bg-primary/90 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectIdentityModalOpen, setIsProjectIdentityModalOpen] = useState(false);
  const [isDetailerModalOpen, setIsDetailerModalOpen] = useState(false);
  const [isComModalOpen, setIsComModalOpen] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('dvl_sidebar_collapsed') === 'true';
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('dvl_theme_mode') as ThemeMode;
    return saved || 'dark';
  });

  const {
    activeRules,
    rulePackIdentity,
    activeRulePackArtifacts,
    centralRulePackPath,
    setCentralRulePackPath,
    rulePackNotice,
    rulePackNeedsReverify,
    dismissRulePackNotice,
    appUpdateNotice,
    dismissAppUpdateNotice,
    applyAppUpdate,
    handleRulePackUpdated,
    markRulePackReverified,
    rulePackError
  } = useRulePackSession();

  const requestComNumber = useCallback(() => setIsComModalOpen(true), []);
  const resetActiveTab = useCallback(() => setActiveTab('general'), []);
  const {
    isProjectLoaded,
    graph,
    facts,
    sqItems,
    checklists,
    generalComments,
    autosavedProject,
    projectIntegrityWarning,
    sourceIsTrusted,
    pendingVerifications,
    lastSavedAt,
    exportNotice,
    exportError,
    readiness,
    setSqItems,
    setGeneralComments,
    leaveProject,
    loadXmlData,
    handleOpenDvl,
    handleManualCreate,
    handleResumeAutosave,
    handleClearAutosave,
    handleLoadSample,
    handleResetAllChanges,
    handleFileUpload,
    handleUpdateFact,
    handleRevertFact,
    handleBatchResolveDefaults,
    handleUpdateChecklistStatus,
    handleUpdateChecklistComment,
    handleUpdateSpecialQuote,
    handleDeleteSpecialQuote,
    handleReorderSpecialQuotes,
    handleUpdateGeneralComments,
    handleSaveDvl,
    handleExportExcel,
    applySessionSnapshot,
    sessionSnapshot,
    dismissExportNotice,
    dismissExportError
  } = useProjectSession({
    activeRules,
    rulePackIdentity,
    activeRulePackArtifacts,
    onRequestComNumber: requestComNumber,
    onSessionLoaded: resetActiveTab
  });

  const handleReloadAndReverify = useCallback(async () => {
    try {
      const res = await desktopBridge.reloadActiveRulePack();
      if (res && res.success) {
        const bundle = res.rulePack || res;
        if (bundle.rules) {
          markRulePackReverified(bundle);
        }
        const snapshot = res.sessionSnapshot || res.snapshot;
        if (snapshot) {
          applySessionSnapshot(snapshot);
        }
      }
    } catch (err: any) {
      console.error('Failed to reload active rule pack:', err);
    }
  }, [markRulePackReverified, applySessionSnapshot]);

  const renderRulePackNotice = () => {
    if (!rulePackNotice) return null;
    return (
      <div className="bg-indigo-100 dark:bg-indigo-950/90 border-b border-indigo-300 dark:border-indigo-700/60 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{rulePackNotice}</span>
        </div>
        <div className="flex items-center gap-2">
          {rulePackNeedsReverify && isProjectLoaded && desktopBridge.isRunningInDesktop() && (
            <button
              type="button"
              onClick={handleReloadAndReverify}
              className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow transition-colors"
            >
              Reload & Re-verify Project
            </button>
          )}
          <button
            type="button"
            onClick={dismissRulePackNotice}
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const renderAppUpdateNotice = () => {
    if (!appUpdateNotice) return null;
    return (
      <div className="bg-sky-100 dark:bg-sky-950/90 border-b border-sky-300 dark:border-sky-700/60 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
        <div className="flex items-center gap-2.5 text-xs text-sky-900 dark:text-sky-200 font-medium">
          <DownloadCloud className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{appUpdateNotice.message}</span>
        </div>
        <div className="flex items-center gap-2">
          {appUpdateNotice.canRestart && (
            <button
              type="button"
              onClick={applyAppUpdate}
              className="px-2.5 py-1 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded shadow transition-colors"
            >
              Restart App
            </button>
          )}
          <button
            type="button"
            onClick={dismissAppUpdateNotice}
            className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  };

  const handleBatchResolveDefaultsAndClose = useCallback(() => {
    handleBatchResolveDefaults();
    setIsResolutionOpen(false);
  }, [handleBatchResolveDefaults]);

  // Prompt for Detailer Name on first launch if blank.
  useEffect(() => {
    const savedDetailer = localStorage.getItem('dvl_detailer_name');
    if (!savedDetailer) {
      setIsDetailerModalOpen(true);
    }
  }, []);

  // Apply Theme Mode class to document element.
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

  // Persist sidebar collapsed state.
  useEffect(() => {
    localStorage.setItem('dvl_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Responsive Auto-Collapse Sidebar < 1200px.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsSidebarCollapsed(true);
      }
    };

    if (typeof window !== 'undefined' && window.innerWidth < 1200) {
      setIsSidebarCollapsed(true);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard Shortcuts (Ctrl+K, Ctrl+S, Ctrl+E, Ctrl+B).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (isProjectLoaded) {
          e.preventDefault();
          void handleSaveDvl(e.shiftKey);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        if (isProjectLoaded) {
          e.preventDefault();
          setIsPreFlightOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProjectLoaded, handleSaveDvl]);

  const handleCycleThemeMode = useCallback(() => {
    setThemeMode(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'system';
      return 'dark';
    });
  }, []);

  // --- RENDER: HARD-BLOCKING RULE PACK ERROR ---
  if (rulePackError) {
    return (
      <div className="min-h-screen w-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-6 bg-red-950/60 border border-red-500 rounded-xl max-w-lg mb-6 shadow-2xl">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold text-red-200">Rule Pack Error</h2>
          <p className="text-sm text-slate-300 mt-3 font-mono break-all leading-relaxed">
            {rulePackError}
          </p>
          <p className="text-xs text-slate-400 mt-4">
            The verification engine requires a valid authoritative rule pack bundle to operate safely.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg flex items-center gap-2 shadow-lg transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // --- RENDER: HOME / LANDING PAGE ---
  if (!isProjectLoaded || !graph) {
    return (
      <div className="min-h-screen w-screen overflow-x-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        {renderRulePackNotice()}
        {renderAppUpdateNotice()}
        <div className="flex-1 min-h-0">
          <HomePage
            autosavedProject={autosavedProject}
            onResumeAutosave={handleResumeAutosave}
            onClearAutosave={handleClearAutosave}
            onImportXml={loadXmlData}
            onOpenDvl={handleOpenDvl}
            onOpenManualModal={() => setIsManualModalOpen(true)}
            onLoadSample={handleLoadSample}
            rulePackVersion={rulePackIdentity.version}
            ruleCount={activeRules.filter(r => !r.isArchived).length}
          />
        </div>

        <ManualUnitModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onCreateUnit={handleManualCreate}
        />

        <DetailerNameModal
          isOpen={isDetailerModalOpen}
          onClose={() => setIsDetailerModalOpen(false)}
          currentName={localStorage.getItem(STORAGE_KEYS.DETAILER_NAME) || ''}
          currentInitials={localStorage.getItem(STORAGE_KEYS.DETAILER_INITIALS) || ''}
          onSaveName={(name, initials) => {
            localStorage.setItem(STORAGE_KEYS.DETAILER_NAME, name);
            if (initials) localStorage.setItem(STORAGE_KEYS.DETAILER_INITIALS, initials);
          }}
          isFirstLaunch={!localStorage.getItem(STORAGE_KEYS.DETAILER_NAME)}
        />
      </div>
    );
  }

  // --- RENDER: ACTIVE WORKSPACE ---
  const selectedSkid = graph.skids.find(s => s.id === activeTab);

  // Unit-Level Verifications virtual skid
  const unitVerificationVirtualSkid = {
    id: 'unit',
    index: 0,
    name: 'Unit-Level Verifications',
    segmentIds: graph.segments.map(s => s.id),
    baseIds: graph.bases.map(b => b.id),
    calculatedWeight: graph.unitWeight,
    isWeightConfirmed: true,
    dimensions: graph.dimensions
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Left Navigation Rail */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        graph={graph}
        facts={facts}
        checklists={checklists}
        sqItems={sqItems}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        readiness={readiness}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Top Header */}
        <Header
          jobName={String(facts['unit.jobName']?.value || '')}
          comNumber={String(facts['unit.comNumber']?.value || '')}
          orderNumber={String(facts['unit.orderNumber']?.value || '')}
          unitTag={String(facts['unit.tag']?.value || '')}
          dimensions={graph.dimensions}
          facts={facts}
          checklists={checklists}
          readiness={readiness}
          onGoHome={leaveProject}
          onOpenResolutionCenter={() => setIsResolutionOpen(true)}
          onOpenPreFlight={() => setIsPreFlightOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLoadSample={handleLoadSample}
          onFileUpload={handleFileUpload}
          onSaveDvl={handleSaveDvl}
          onSaveDvlAs={() => handleSaveDvl(true)}
          rulePackVersion={rulePackIdentity.version}
          themeMode={themeMode}
          onCycleThemeMode={handleCycleThemeMode}
          lastSavedAt={lastSavedAt || undefined}
          onOpenProjectIdentityModal={() => setIsProjectIdentityModalOpen(true)}
          onOpenDetailerModal={() => setIsDetailerModalOpen(true)}
          onOpenComModal={() => setIsComModalOpen(true)}
          onOpenDvl={handleOpenDvl}
          onImportXml={loadXmlData}
        />

        {projectIntegrityWarning && (
          <div className="bg-amber-100 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-700/60 px-6 py-2 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{projectIntegrityWarning}</span>
          </div>
        )}

        {pendingVerifications > 0 && (
          <div role="status" className="px-6 py-2 text-xs bg-slate-100 dark:bg-slate-900">
            Recomputing verification with the active Rule Pack…
          </div>
        )}
        {desktopBridge.isRunningInDesktop() && !sourceIsTrusted && !projectIntegrityWarning && (
          <div role="status" className="px-6 py-2 text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {sessionSnapshot?.source?.fileName === 'Manual Unit Configuration.xml' ? (
              <span>
                <strong>Manual Unit (Draft Only):</strong> This manually synthesized unit is uncertified. Official final certification requires an authentic .upz or Config.xml package.
              </span>
            ) : (
              <span>
                <strong>Draft Mode:</strong> This session produces draft deliverables. Official final certification requires a verified source (.upz or Config.xml) opened through the desktop file picker.
              </span>
            )}
          </div>
        )}

        {/* Rule Pack Update Notice Toast */}
        {renderRulePackNotice()}

        {/* Desktop App Update Notice Toast */}
        {renderAppUpdateNotice()}

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
                onClick={dismissExportNotice}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Export Error Notification Banner */}
        {exportError && (
          <div className="bg-rose-100 dark:bg-rose-950/90 border-b border-rose-300 dark:border-rose-700/60 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 text-xs text-rose-900 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                <strong>Excel Export Failed:</strong> {exportError}
              </span>
            </div>
            <button
              onClick={dismissExportError}
              className="text-xs text-rose-700 hover:text-rose-950 dark:text-rose-400 dark:hover:text-white px-2 py-0.5 rounded hover:bg-rose-200/50 dark:hover:bg-rose-900/50 font-medium"
            >
              Dismiss
            </button>
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
              onUpdateComments={handleUpdateGeneralComments || setGeneralComments}
              onOpenResolutionCenter={() => setIsResolutionOpen(true)}
              onOpenDetailerModal={() => setIsDetailerModalOpen(true)}
              onUpdateSpecialQuote={handleUpdateSpecialQuote}
              onDeleteSpecialQuote={handleDeleteSpecialQuote}
              onReorderSpecialQuotes={handleReorderSpecialQuotes}
            />
          ) : activeTab === 'unit-checks' ? (
            <SkidViewTab
              skid={unitVerificationVirtualSkid}
              segments={graph.segments}
              bases={graph.bases}
              checklists={checklists}
              rules={activeRules}
              sqItems={sqItems}
              facts={facts}
              onUpdateChecklistStatus={handleUpdateChecklistStatus}
              onUpdateChecklistComment={handleUpdateChecklistComment}
              onUpdateFact={handleUpdateFact}
              onOpenResolutionCenter={() => setIsResolutionOpen(true)}
            />
          ) : selectedSkid ? (
            <SkidViewTab
              skid={selectedSkid}
              segments={graph.segments}
              bases={graph.bases}
              checklists={checklists}
              rules={activeRules}
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
      <ProjectIdentityModal
        isOpen={isProjectIdentityModalOpen}
        onClose={() => setIsProjectIdentityModalOpen(false)}
        facts={facts}
        onUpdateFact={handleUpdateFact}
      />

      <ResolutionCenterModal
        isOpen={isResolutionOpen}
        onClose={() => setIsResolutionOpen(false)}
        facts={facts}
        checklists={checklists}
        rules={activeRules}
        readiness={readiness}
        onUpdateFact={handleUpdateFact}
        onBatchResolveDefaults={handleBatchResolveDefaultsAndClose}
        onNavigateToRule={(scopeTargetId) => {
          setActiveTab(scopeTargetId === 'unit' ? 'unit-checks' : scopeTargetId);
          setIsResolutionOpen(false);
        }}
      />

      <PreFlightModal
        isOpen={isPreFlightOpen}
        onClose={() => setIsPreFlightOpen(false)}
        checklists={checklists}
        rules={activeRules}
        facts={facts}
        sqItems={sqItems}
        readiness={readiness}
        canExportFinal={desktopBridge.isRunningInDesktop() && sourceIsTrusted && pendingVerifications === 0 && !projectIntegrityWarning}
        onExportExcel={handleExportExcel}
        onExportDvl={handleSaveDvl}
        onNavigateToRule={(scopeTargetId) => {
          setActiveTab(scopeTargetId === 'unit' ? 'unit-checks' : scopeTargetId);
        }}
        onOpenResolutionCenter={() => setIsResolutionOpen(true)}
      />

      <OmniSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        rules={activeRules}
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
        detailerName={String(facts['unit.detailer']?.value || localStorage.getItem(STORAGE_KEYS.DETAILER_NAME) || 'Detailer')}
        onUpdateDetailerName={(name) => {
          localStorage.setItem(STORAGE_KEYS.DETAILER_NAME, name);
          handleUpdateFact('unit.detailer', name);
        }}
        detailerInitials={String(facts['unit.detailerInitials']?.value || localStorage.getItem(STORAGE_KEYS.DETAILER_INITIALS) || '')}
        onUpdateDetailerInitials={(initials) => {
          localStorage.setItem(STORAGE_KEYS.DETAILER_INITIALS, initials);
          handleUpdateFact('unit.detailerInitials', initials);
        }}
        rulePackVersion={rulePackIdentity.version}
        ruleCount={activeRules.filter(r => !r.isArchived).length}
        lastAutosavedAt={lastSavedAt || undefined}
        onClearAutosave={handleClearAutosave}
        centralRulePackPath={centralRulePackPath}
        onUpdateCentralRulePackPath={setCentralRulePackPath}
        onRulePackUpdated={handleRulePackUpdated}
        onResetAllChanges={handleResetAllChanges}
      />

      <DetailerNameModal
        isOpen={isDetailerModalOpen}
        onClose={() => setIsDetailerModalOpen(false)}
        currentName={String(facts['unit.detailer']?.value || localStorage.getItem(STORAGE_KEYS.DETAILER_NAME) || '')}
        currentInitials={String(facts['unit.detailerInitials']?.value || localStorage.getItem(STORAGE_KEYS.DETAILER_INITIALS) || '')}
        onSaveName={(name, initials) => {
          localStorage.setItem(STORAGE_KEYS.DETAILER_NAME, name);
          handleUpdateFact('unit.detailer', name);
          if (initials) {
            localStorage.setItem(STORAGE_KEYS.DETAILER_INITIALS, initials);
            handleUpdateFact('unit.detailerInitials', initials);
          }
        }}
      />

      <ComNumberModal
        isOpen={isComModalOpen}
        onClose={() => setIsComModalOpen(false)}
        currentComNumber={String(facts['unit.comNumber']?.value || '')}
        jobName={String(facts['unit.jobName']?.value || '')}
        onSaveComNumber={(com) => {
          handleUpdateFact('unit.comNumber', com);
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  if (!desktopBridge.isDesktopHost()) {
    return <DesktopHostRequiredScreen />;
  }

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};
