import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  NormalizedXmlGraph,
  Fact,
  SpecialQuote,
  ChecklistInstance,
  CheckStatus,
  DvlProjectFile,
  ThemeMode,
  UpzBundle,
  RuleDefinition
} from './types';
import { parseAhuXml, parseOrderRevXml } from './services/xmlParser';
import { extractFactsFromGraph, overrideFact, revertFact } from './services/factRegistry';
import { RULES_CATALOG, RULE_PACK_IDENTITY } from './services/rulesCatalog';
import { generateChecklists } from './services/ruleEvaluator';
import { createDvlProject, inspectDvlIntegrity, saveDvlToFile, autosaveToLocal, loadAutosave } from './services/projectStorage';
import { createManualUnit, ManualUnitConfig } from './services/manualUnitFactory';
import { desktopBridge } from './services/desktopBridge';
import { computeUnitReadiness } from './utils/readiness';
import { SAMPLE_CONFIG_XML } from './fixtures/sampleConfigXml';

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
  // Application Data States
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [graph, setGraph] = useState<NormalizedXmlGraph | null>(null);
  const [facts, setFacts] = useState<Record<string, Fact>>({});
  const [sqItems, setSqItems] = useState<SpecialQuote[]>([]);
  const [checklists, setChecklists] = useState<ChecklistInstance[]>([]);
  const [rawXml, setRawXml] = useState<string>('');
  const [autosavedProject, setAutosavedProject] = useState<DvlProjectFile | null>(() => loadAutosave());
  const [generalComments, setGeneralComments] = useState<string>(
    'Verification performed in accordance with standard factory detailing guidelines and BOM requirements.'
  );
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [projectIntegrityWarning, setProjectIntegrityWarning] = useState<string | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<{
    fileName?: string;
    isUpzBundle?: boolean;
    orderRevision?: any;
  }>({});

  // Active view: 'general' | 'unit-checks' | skid ID ('skid-1', 'skid-2', etc.)
  const [activeTab, setActiveTab] = useState<string>('general');

  // Modals & Navigation state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectIdentityModalOpen, setIsProjectIdentityModalOpen] = useState(false);
  const [isDetailerModalOpen, setIsDetailerModalOpen] = useState(false);
  const [isComModalOpen, setIsComModalOpen] = useState(false);

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

  // Export success and error toast states
  const [exportNotice, setExportNotice] = useState<{ fileName: string; filePath?: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Dynamic Rule Pack State
  const [activeRules, setActiveRules] = useState<RuleDefinition[]>(RULES_CATALOG);
  const [rulePackIdentity, setRulePackIdentity] = useState(RULE_PACK_IDENTITY);
  const [centralRulePackPath, setCentralRulePackPath] = useState<string>(() => {
    return localStorage.getItem('dvl_central_rulepack_path') || '';
  });
  const [rulePackNotice, setRulePackNotice] = useState<string | null>(null);
  const [appUpdateNotice, setAppUpdateNotice] = useState<{ message: string; canRestart?: boolean } | null>(null);

  // Initial rule pack fetch from desktop host, autonomous SharePoint sync, and background app update check
  useEffect(() => {
    if (desktopBridge.isRunningInDesktop()) {
      desktopBridge.getRulePack().then(pack => {
        if (pack && pack.rules && pack.rules.length > 0) {
          setActiveRules(pack.rules);
          if (pack.manifest) {
            setRulePackIdentity({
              version: pack.manifest.version,
              sha256: pack.manifest.bundleSha256
            });
          }
        }
      }).catch(err => console.warn('Failed to load initial rule pack from bridge:', err));

      const configuredPath = localStorage.getItem('dvl_central_rulepack_path');
      const autoSync = localStorage.getItem('dvl_auto_sync_rulepack') !== 'false';

      // Auto-discover location (e.g. synced SharePoint/OneDrive) if not configured
      desktopBridge.resolveRulePackLocation(configuredPath || undefined).then(async resolved => {
        const effectivePath = configuredPath || resolved.path;
        if (effectivePath && autoSync) {
          try {
            const updateInfo = await desktopBridge.checkRulePackUpdate(effectivePath);
            if (updateInfo.hasUpdate && !updateInfo.error) {
              const syncResult = await desktopBridge.syncRulePack(effectivePath);
              if (syncResult.success && syncResult.rules) {
                setActiveRules(syncResult.rules);
                setRulePackIdentity({
                  version: syncResult.version,
                  sha256: syncResult.bundleSha256 || ''
                });
                const origin = resolved.isAutoDetected ? 'SharePoint sync' : 'central path';
                setRulePackNotice(`Rule Pack auto-updated to v${syncResult.version} (${syncResult.ruleCount} active rules) from ${origin}`);
              }
            }
          } catch (err) {
            console.warn('Rule pack auto-sync check failed:', err);
          }
        }
      }).catch(err => console.warn('Rule pack location discovery failed:', err));

      // Check for Velopack desktop app updates in background
      desktopBridge.checkAppUpdate().then(async appUpdate => {
        if (appUpdate.hasUpdate && appUpdate.remoteVersion) {
          setAppUpdateNotice({
            message: `New desktop app v${appUpdate.remoteVersion} detected. Downloading in background...`,
            canRestart: false
          });
          const downloaded = await desktopBridge.downloadAppUpdate();
          if (downloaded.success) {
            setAppUpdateNotice({
              message: `App update v${appUpdate.remoteVersion} is ready to apply.`,
              canRestart: true
            });
          }
        }
      }).catch(err => console.warn('Desktop app update check failed:', err));
    }
  }, []);

  const handleRulePackUpdated = useCallback((updatedBundle: any) => {
    if (updatedBundle && updatedBundle.rules) {
      setActiveRules(updatedBundle.rules);
      setRulePackIdentity({
        version: updatedBundle.version,
        sha256: updatedBundle.bundleSha256 || ''
      });
      setRulePackNotice(`Rule Pack updated to v${updatedBundle.version} (${updatedBundle.ruleCount} active rules)`);
      if (graph && facts) {
        setChecklists(prev => generateChecklists(updatedBundle.rules, graph, facts, prev));
      }
    }
  }, [graph, facts]);

  // Prompt for Detailer Name on first launch if blank
  useEffect(() => {
    const savedDetailer = localStorage.getItem('dvl_detailer_name');
    if (!savedDetailer) {
      setIsDetailerModalOpen(true);
    }
  }, []);

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

  // Responsive Auto-Collapse Sidebar < 1200px
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


  // Autosave when active data changes
  useEffect(() => {
    if (isProjectLoaded && graph && facts && sqItems && checklists) {
      let cancelled = false;
      void createDvlProject(graph, facts, sqItems, checklists, rawXml, generalComments, sourceMetadata)
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
  }, [isProjectLoaded, graph, facts, sqItems, checklists, rawXml, generalComments, sourceMetadata]);

  // Fact Update & Revert Handlers
  const handleUpdateFact = useCallback((key: string, value: any, author: string = 'Detailer', note?: string) => {
    if (!graph) return;
    setFacts(prev => {
      const updated = overrideFact(prev, key, value, author, note);
      const newChecklists = generateChecklists(activeRules, graph, updated, checklists);
      setChecklists(newChecklists);
      return updated;
    });
  }, [graph, checklists, activeRules]);

  const handleRevertFact = useCallback((key: string) => {
    if (!graph) return;
    setFacts(prev => {
      const reverted = revertFact(prev, key);
      const newChecklists = generateChecklists(activeRules, graph, reverted, checklists);
      setChecklists(newChecklists);
      return reverted;
    });
  }, [graph, checklists, activeRules]);

  // Handler for loading new XML or UPZ bundle
  const loadXmlData = useCallback((xmlString: string, bundle?: UpzBundle, sourceFileName?: string) => {
    const newGraph = parseAhuXml(xmlString);

    let orderRev = bundle?.orderRevision;
    if (!orderRev && bundle?.rawOrderRevXml) {
      orderRev = parseOrderRevXml(bundle.rawOrderRevXml);
    }

    const newFacts = extractFactsFromGraph(newGraph, orderRev);
    const newChecklists = generateChecklists(activeRules, newGraph, newFacts);

    const meta = {
      fileName: sourceFileName || (bundle ? 'bundle.upz' : 'Config.xml'),
      isUpzBundle: !!bundle,
      orderRevision: orderRev
    };

    setSourceMetadata(meta);
    setRawXml(xmlString);
    setGraph(newGraph);
    setFacts(newFacts);
    setChecklists(newChecklists);
    setSqItems([]);
    setCurrentProjectPath(null);
    setProjectIntegrityWarning(null);
    setActiveTab('general');
    setIsProjectLoaded(true);

    // Prompt for COM# if not populated
    if (!newFacts['unit.comNumber']?.value) {
      setIsComModalOpen(true);
    }
  }, [activeRules]);

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
      setSourceMetadata({
        fileName: project.sourceXml?.fileName,
        isUpzBundle: project.sourceXml?.isUpzBundle,
        orderRevision: project.sourceXml?.orderRevision
      });
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
      const newChecklists = generateChecklists(activeRules, newGraph, newFacts);

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
  }, [activeRules]);

  // Reset all manual changes handler
  const handleResetAllChanges = useCallback(() => {
    if (!graph) return;
    try {
      const freshFacts = extractFactsFromGraph(graph, sourceMetadata.orderRevision);
      const freshChecklists = generateChecklists(activeRules, graph, freshFacts);
      setFacts(freshFacts);
      setChecklists(freshChecklists);
    } catch (err: any) {
      alert(`Error resetting changes: ${err.message}`);
    }
  }, [graph, sourceMetadata, activeRules]);

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

  const handleBatchResolveDefaults = useCallback(() => {
    if (!graph) return;
    setFacts(prev => {
      let updated = { ...prev };

      // Set standard default specs
      if (updated['unit.noa'] && updated['unit.noa'].confidence === 'RequiresConfirmation') {
        updated = overrideFact(updated, 'unit.noa', false, 'Detailer', 'Standard Non-NOA unit');
      }
      if (updated['unit.isSeismic'] && updated['unit.isSeismic'].confidence === 'RequiresConfirmation') {
        updated = overrideFact(updated, 'unit.isSeismic', false, 'Detailer', 'Standard Non-Seismic');
      }
      if (updated['unit.knockdown'] && updated['unit.knockdown'].confidence === 'RequiresConfirmation') {
        updated = overrideFact(updated, 'unit.knockdown', false, 'Detailer', 'Factory Assembled');
      }

      const newChecklists = generateChecklists(activeRules, graph, updated, checklists);
      setChecklists(newChecklists);
      return updated;
    });
    setIsResolutionOpen(false);
  }, [graph, checklists, activeRules]);

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
    if (!graph) {
      setExportError('Cannot export Excel deliverable: No project geometry or graph is loaded.');
      return;
    }
    const jobName = String(facts['unit.jobName']?.value || 'AHU_Project');
    const comNumber = String(facts['unit.comNumber']?.value || 'COM-000000');
    const defaultName = `${jobName}_${comNumber}_Detailing_Verification_List${isDraft ? '_DRAFT' : ''}.xlsx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    // Dynamic verification date population on export
    const exportFacts = {
      ...facts,
      'unit.date': {
        ...facts['unit.date'],
        key: 'unit.date',
        label: 'Verification Date',
        category: 'Order & Identity',
        value: new Date().toISOString().split('T')[0],
        status: 'Known' as const,
        confidence: 'Authoritative' as const
      }
    };

    try {
      setExportError(null);
      const result = await desktopBridge.exportExcelDeliverable(
        exportFacts,
        sqItems,
        checklists,
        activeRules,
        graph,
        generalComments,
        defaultName,
        isDraft
      );

      if (result.exported && !result.cancelled) {
        setExportNotice({ fileName: result.fileName || defaultName, filePath: result.filePath });
      }
    } catch (error: any) {
      console.error('Export Excel failed:', error);
      const errorMsg = error?.message || 'An unknown error occurred while exporting the Excel deliverable.';
      setExportError(errorMsg);
    }
  };

  // Keyboard Shortcuts (Ctrl+K, Ctrl+S, Ctrl+E, Ctrl+B)
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
          rulePackVersion={rulePackIdentity.version}
          ruleCount={activeRules.filter(r => !r.isArchived).length}
        />

        <ManualUnitModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onCreateUnit={handleManualCreate}
        />

        <DetailerNameModal
          isOpen={isDetailerModalOpen}
          onClose={() => setIsDetailerModalOpen(false)}
          currentName={localStorage.getItem('dvl_detailer_name') || ''}
          onSaveName={(name) => {
            localStorage.setItem('dvl_detailer_name', name);
          }}
          isFirstLaunch={!localStorage.getItem('dvl_detailer_name')}
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

  const readiness = computeUnitReadiness(facts, checklists);

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
          onGoHome={() => setIsProjectLoaded(false)}
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
        />

        {projectIntegrityWarning && (
          <div className="bg-amber-100 dark:bg-amber-950/90 border-b border-amber-300 dark:border-amber-700/60 px-6 py-2 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{projectIntegrityWarning}</span>
          </div>
        )}

        {/* Rule Pack Update Notice Toast */}
        {rulePackNotice && (
          <div className="bg-indigo-100 dark:bg-indigo-950/90 border-b border-indigo-300 dark:border-indigo-700/60 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-medium">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{rulePackNotice}</span>
            </div>
            <button
              onClick={() => setRulePackNotice(null)}
              className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Desktop App Update Notice Toast */}
        {appUpdateNotice && (
          <div className="bg-sky-100 dark:bg-sky-950/90 border-b border-sky-300 dark:border-sky-700/60 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 text-xs text-sky-900 dark:text-sky-200 font-medium">
              <DownloadCloud className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{appUpdateNotice.message}</span>
            </div>
            <div className="flex items-center gap-2">
              {appUpdateNotice.canRestart && (
                <button
                  type="button"
                  onClick={() => desktopBridge.applyAppUpdate()}
                  className="px-2.5 py-1 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded shadow transition-colors"
                >
                  Restart App
                </button>
              )}
              <button
                type="button"
                onClick={() => setAppUpdateNotice(null)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-1.5 py-0.5"
              >
                Dismiss
              </button>
            </div>
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
              onClick={() => setExportError(null)}
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
              onUpdateComments={setGeneralComments}
              onOpenResolutionCenter={() => setIsResolutionOpen(true)}
              onOpenDetailerModal={() => setIsDetailerModalOpen(true)}
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
        onBatchResolveDefaults={handleBatchResolveDefaults}
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
        detailerName={String(facts['unit.detailer']?.value || localStorage.getItem('dvl_detailer_name') || 'Detailer')}
        onUpdateDetailerName={(name) => {
          localStorage.setItem('dvl_detailer_name', name);
          handleUpdateFact('unit.detailer', name);
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
        currentName={String(facts['unit.detailer']?.value || localStorage.getItem('dvl_detailer_name') || '')}
        onSaveName={(name) => {
          localStorage.setItem('dvl_detailer_name', name);
          handleUpdateFact('unit.detailer', name);
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
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};
