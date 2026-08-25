import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import {
  NormalizedXmlGraph,
  Fact,
  SpecialQuote,
  ChecklistInstance,
  CheckStatus
} from './types';
import { parseAhuXml } from './services/xmlParser';
import { extractFactsFromGraph, overrideFact, revertFact } from './services/factRegistry';
import { RULES_CATALOG } from './services/rulesCatalog';
import { generateChecklists } from './services/ruleEvaluator';
import { exportToExcel } from './services/excelExporter';
import { createDvlProject, saveDvlToFile, autosaveToLocal, loadAutosave } from './services/projectStorage';
import { SAMPLE_CONFIG_XML } from './fixtures/sampleConfigXml';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GeneralUnitTab } from './components/GeneralUnitTab';
import { SkidViewTab } from './components/SkidViewTab';
import { ResolutionCenterModal } from './components/ResolutionCenterModal';
import { PreFlightModal } from './components/PreFlightModal';
import { OmniSearchModal } from './components/OmniSearchModal';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
        <div className="h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full p-6 rounded-2xl bg-slate-900 border border-red-500/30 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-lg font-bold">Application Error</h2>
            </div>
            <p className="text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto">
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
  // Synchronous initial parse
  const [rawXml, setRawXml] = useState<string>(SAMPLE_CONFIG_XML);
  const [graph, setGraph] = useState<NormalizedXmlGraph>(() => {
    try {
      return parseAhuXml(SAMPLE_CONFIG_XML);
    } catch (e) {
      console.error('Initial XML parse error:', e);
      throw e;
    }
  });

  const [facts, setFacts] = useState<Record<string, Fact>>(() => {
    try {
      const g = parseAhuXml(SAMPLE_CONFIG_XML);
      return extractFactsFromGraph(g);
    } catch (e) {
      return {};
    }
  });

  const [sqItems, setSqItems] = useState<SpecialQuote[]>([
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

  const [checklists, setChecklists] = useState<ChecklistInstance[]>(() => {
    try {
      const g = parseAhuXml(SAMPLE_CONFIG_XML);
      const f = extractFactsFromGraph(g);
      return generateChecklists(RULES_CATALOG, g, f);
    } catch (e) {
      return [];
    }
  });

  const [generalComments, setGeneralComments] = useState<string>('Automated verification session against Config.xml.');

  // UI State
  const [activeTab, setActiveTab] = useState<string>('general');
  const [isResolutionOpen, setIsResolutionOpen] = useState<boolean>(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Initialize from XML
  const loadXmlData = useCallback((xmlString: string) => {
    try {
      const parsedGraph = parseAhuXml(xmlString);
      const extractedFacts = extractFactsFromGraph(parsedGraph);
      const initialChecks = generateChecklists(RULES_CATALOG, parsedGraph, extractedFacts);

      setRawXml(xmlString);
      setGraph(parsedGraph);
      setFacts(extractedFacts);
      setChecklists(initialChecks);
    } catch (err) {
      console.error('Error parsing XML:', err);
      alert('Error parsing XML file: ' + (err as Error).message);
    }
  }, []);

  // Re-evaluate checklists whenever facts change
  const handleUpdateFact = (key: string, value: any, note?: string) => {
    const updatedFacts = overrideFact(facts, key, value, 'Detailer', note);
    setFacts(updatedFacts);

    if (graph) {
      const updatedChecks = generateChecklists(RULES_CATALOG, graph, updatedFacts, checklists);
      setChecklists(updatedChecks);
    }
  };

  const handleRevertFact = (key: string) => {
    const updatedFacts = revertFact(facts, key);
    setFacts(updatedFacts);

    if (graph) {
      const updatedChecks = generateChecklists(RULES_CATALOG, graph, updatedFacts, checklists);
      setChecklists(updatedChecks);
    }
  };

  const handleBatchResolveDefaults = () => {
    let currentFacts = { ...facts };

    // Set standard defaults for known required unconfirmed facts
    if (currentFacts['unit.isSeismic']) {
      currentFacts = overrideFact(currentFacts, 'unit.isSeismic', false, 'Detailer', 'Standard Non-Seismic Default');
    }
    if (currentFacts['unit.noa']) {
      currentFacts = overrideFact(currentFacts, 'unit.noa', 'N/A', 'Detailer', 'Standard Wind Load Default');
    }

    // Approve derived weights for all skids
    if (graph) {
      graph.skids.forEach((s) => {
        const wKey = `skid.${s.id}.weight`;
        if (currentFacts[wKey]) {
          currentFacts = overrideFact(currentFacts, wKey, s.calculatedWeight, 'Detailer', 'Approved Calculated Weight');
        }
      });
    }

    setFacts(currentFacts);
    if (graph) {
      const updatedChecks = generateChecklists(RULES_CATALOG, graph, currentFacts, checklists);
      setChecklists(updatedChecks);
    }
    setIsResolutionOpen(false);
  };

  // Checklist updates
  const handleUpdateChecklistStatus = (instanceKey: string, status: CheckStatus) => {
    setChecklists(prev =>
      prev.map(c => (c.instanceKey === instanceKey ? { ...c, status, updatedAt: new Date().toISOString() } : c))
    );
  };

  const handleUpdateChecklistComment = (instanceKey: string, comment: string) => {
    setChecklists(prev =>
      prev.map(c => (c.instanceKey === instanceKey ? { ...c, detailerComment: comment, updatedAt: new Date().toISOString() } : c))
    );
  };

  // File upload handler (XML or .dvl)
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (file.name.endsWith('.dvl') || file.name.endsWith('.json')) {
        try {
          const dvl = JSON.parse(content);
          if (dvl.normalizedGraph && dvl.factRegistry) {
            setGraph(dvl.normalizedGraph);
            setFacts(dvl.factRegistry);
            setSqItems(dvl.sqItems || []);
            setChecklists(dvl.checklistInstances || []);
            setGeneralComments(dvl.generalComments || '');
            if (dvl.sourceXml?.rawXml) setRawXml(dvl.sourceXml.rawXml);
          }
        } catch (err) {
          alert('Error loading .dvl file: ' + (err as Error).message);
        }
      } else {
        loadXmlData(content);
      }
    };
    reader.readAsText(file);
  };

  // Save .dvl Project
  const handleSaveDvl = () => {
    if (!graph) return;
    const project = createDvlProject(graph, facts, sqItems, checklists, rawXml, generalComments);
    saveDvlToFile(project);
    autosaveToLocal(project);
  };

  // Export Excel deliverable
  const handleExportExcel = () => {
    exportToExcel(facts, sqItems, checklists, RULES_CATALOG);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveDvl();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setIsPreFlightOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [graph, facts, sqItems, checklists, rawXml, generalComments]);

  // Dark mode toggle
  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const selectedSkid = graph?.skids.find(s => s.id === activeTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Left Navigation Rail */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        graph={graph}
        checklists={checklists}
        sqItems={sqItems}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950/60 dark:bg-slate-950">
        {/* Top Header */}
        <Header
          jobName={String(facts['unit.jobName']?.value || '')}
          comNumber={String(facts['unit.comNumber']?.value || '')}
          facts={facts}
          onOpenResolutionCenter={() => setIsResolutionOpen(true)}
          onOpenPreFlight={() => setIsPreFlightOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onLoadSample={() => loadXmlData(SAMPLE_CONFIG_XML)}
          onFileUpload={handleFileUpload}
          onSaveDvl={handleSaveDvl}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />

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
