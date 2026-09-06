import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  ChecklistInstance,
  CheckStatus,
  DvlProjectFile,
  Fact,
  NormalizedXmlGraph,
  RuleDefinition,
  RulePackIdentity,
  SpecialQuote,
  UpzBundle
} from '../types';
import type {
  BatchFactOverrideItem,
  ProjectSessionSnapshot,
  SessionCommandResult,
  SpecialQuoteSlotAssignment
} from '../types/session';
import {
  extractBrowserPreviewFacts,
  parseBrowserPreviewAhuXml,
  parseBrowserPreviewOrderRevXml
} from '../services/browserPreviewIngestion';
import { normalizePersistedFactRegistry, overrideFact, revertFact } from '../services/factRegistry';
import { generateChecklists } from '../services/ruleEvaluator';
import { createDvlProject, inspectDvlIntegrity, saveDvlToFile, autosaveToLocal, loadAutosave } from '../services/projectStorage';
import { createManualUnit, type ManualUnitConfig } from '../services/manualUnitFactory';
import { desktopBridge } from '../services/desktopBridge';
import { parseFactInput } from '../services/factContract';
import { SAMPLE_CONFIG_XML } from '../fixtures/sampleConfigXml';
import {
  manualOverridesFromFacts,
  sourceMetadataFromBundle,
  type ActiveRulePackArtifacts,
  type SourceMetadata
} from '../orchestration/projectSession';
import { computeUnitReadiness, projectSessionReadiness, type UnitReadiness } from '../utils/readiness';

export interface ExportNotice {
  fileName: string;
  filePath?: string;
}

export interface UseProjectSessionOptions {
  activeRules: RuleDefinition[];
  rulePackIdentity: RulePackIdentity;
  activeRulePackArtifacts: ActiveRulePackArtifacts;
  onRequestComNumber?: () => void;
  onSessionLoaded?: () => void;
}

export interface UseProjectSessionResult {
  isProjectLoaded: boolean;
  graph: NormalizedXmlGraph | null;
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  checklists: ChecklistInstance[];
  generalComments: string;
  autosavedProject: DvlProjectFile | null;
  projectIntegrityWarning: string | null;
  sourceIsTrusted: boolean;
  pendingVerifications: number;
  lastSavedAt: string | null;
  exportNotice: ExportNotice | null;
  exportError: string | null;
  sessionSnapshot: ProjectSessionSnapshot | null;
  readiness: UnitReadiness;
  setSqItems: Dispatch<SetStateAction<SpecialQuote[]>>;
  setGeneralComments: Dispatch<SetStateAction<string>>;
  leaveProject: () => void;
  loadXmlData: (xmlString: string, bundle?: UpzBundle, sourceFileName?: string) => Promise<void>;
  handleOpenDvl: (project: DvlProjectFile, rawJson?: string, filePath?: string) => Promise<void>;
  handleManualCreate: (config: ManualUnitConfig) => void;
  handleResumeAutosave: () => void;
  handleClearAutosave: () => void;
  handleLoadSample: () => void;
  handleResetAllChanges: () => Promise<void>;
  handleFileUpload: (file: File) => void;
  handleUpdateFact: (key: string, value: any, author?: string, note?: string) => void;
  handleRevertFact: (key: string) => void;
  handleBatchResolveDefaults: () => void;
  handleUpdateChecklistStatus: (instanceKey: string, status: CheckStatus) => void;
  handleUpdateChecklistComment: (instanceKey: string, detailerComment: string) => void;
  handleUpdateSpecialQuote?: (item: SpecialQuote) => void;
  handleDeleteSpecialQuote?: (slotOrId: number | string) => void;
  handleReorderSpecialQuotes?: (assignments: SpecialQuoteSlotAssignment[]) => void;
  handleUpdateGeneralComments?: (comments: string) => void;
  handleSaveDvl: (forceSaveAs?: boolean) => Promise<void>;
  handleExportExcel: (isDraft?: boolean) => Promise<void>;
  dismissExportNotice: () => void;
  dismissExportError: () => void;
}

export function useProjectSession({
  activeRules,
  rulePackIdentity,
  activeRulePackArtifacts,
  onRequestComNumber,
  onSessionLoaded
}: UseProjectSessionOptions): UseProjectSessionResult {
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
  const [sourceMetadata, setSourceMetadata] = useState<SourceMetadata>({});
  const [sourceIsTrusted, setSourceIsTrusted] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [projectIntegrityClassification, setProjectIntegrityClassification] = useState<string | null>(null);

  // Authoritative C# ProjectSession state & command synchronization queue
  const [sessionSnapshot, setSessionSnapshot] = useState<ProjectSessionSnapshot | null>(null);
  const sessionSnapshotRef = useRef<ProjectSessionSnapshot | null>(null);
  sessionSnapshotRef.current = sessionSnapshot;
  const pendingCommandChain = useRef<Promise<any>>(Promise.resolve());

  const sessionRevision = useRef(0);
  const previousPackHash = useRef(rulePackIdentity.sha256);
  const latestFacts = useRef(facts);
  latestFacts.current = facts;
  const latestChecklists = useRef(checklists);
  latestChecklists.current = checklists;

  const syncFromSnapshot = useCallback((snapshot: ProjectSessionSnapshot) => {
    setSessionSnapshot(snapshot);
    sessionSnapshotRef.current = snapshot;
    setGraph(snapshot.graph);
    setFacts(snapshot.facts);
    setSqItems(snapshot.specialQuotes || []);
    setChecklists(snapshot.checklists || []);
    setGeneralComments(snapshot.generalComments || '');
    setSourceIsTrusted(snapshot.source?.isTrusted === true);
    latestFacts.current = snapshot.facts;
    latestChecklists.current = snapshot.checklists || [];
  }, []);

  const dispatchSessionCommand = useCallback(async (
    runCommand: (sessionId: string, expectedRevision: number) => Promise<SessionCommandResult>
  ): Promise<ProjectSessionSnapshot | null> => {
    const run = async () => {
      const current = sessionSnapshotRef.current;
      if (!current) throw new Error('No active project session.');
      try {
        const result = await runCommand(current.sessionId, current.revision);
        if (result.snapshot) {
          syncFromSnapshot(result.snapshot);
          return result.snapshot;
        }
        const latest = await desktopBridge.projectSessionGetSnapshot();
        syncFromSnapshot(latest);
        return latest;
      } catch (err: any) {
        console.error('Session command execution error, recovering latest snapshot:', err);
        try {
          const latest = await desktopBridge.projectSessionGetSnapshot();
          syncFromSnapshot(latest);
        } catch (recoverErr) {
          console.warn('Failed to recover snapshot after session command failure:', recoverErr);
        }
        throw err;
      }
    };

    const chained = pendingCommandChain.current.then(run, run);
    pendingCommandChain.current = chained.catch(err => {
      console.error('Session command failed in sequential queue:', err);
    });
    return chained;
  }, [syncFromSnapshot]);

  // Derived readiness: Authoritative projection from C# ProjectSession when active,
  // falling back to computeUnitReadiness in standalone web preview / test environments.
  const readiness = useMemo<UnitReadiness>(() => {
    if (sessionSnapshot) {
      return projectSessionReadiness(sessionSnapshot);
    }
    return computeUnitReadiness(facts, checklists, activeRules);
  }, [sessionSnapshot, facts, checklists, activeRules]);

  // Startup and Settings pack changes share this migration boundary. Every
  // applied pack change invalidates old asynchronous verification work.
  useEffect(() => {
    if (previousPackHash.current === rulePackIdentity.sha256) return;
    previousPackHash.current = rulePackIdentity.sha256;
    const revision = ++sessionRevision.current;
    if (!graph || !isProjectLoaded) return;
    const wasTrusted = sourceIsTrusted;
    setSourceIsTrusted(false);
    setProjectIntegrityClassification('pack-mismatch');
    setProjectIntegrityWarning('This project was evaluated with a previous Rule Pack. It must be explicitly recomputed and reviewed before final export.');
    const overrides = manualOverridesFromFacts(latestFacts.current);
    if (desktopBridge.isRunningInDesktop() && wasTrusted && rawXml) {
      setPendingVerifications(count => count + 1);
      void desktopBridge.projectSessionOpen({
        configXml: rawXml,
        orderRevXml: sourceMetadata.rawOrderRevisionXml,
        manifestXml: sourceMetadata.rawManifestXml,
        filePath: sourceMetadata.fileName || 'Config.xml',
        isUpz: !!sourceMetadata.isUpzBundle,
        isTrusted: true,
        initialOverrides: overrides,
        initialChecklists: latestChecklists.current,
        initialSpecialQuotes: sqItems,
        initialGeneralComments: generalComments
      }).then(snapshot => {
        if (revision !== sessionRevision.current) return;
        syncFromSnapshot(snapshot);
      }).catch(err => {
        console.warn('Failed to recompute project after Rule Pack update via session open, trying fallback verify:', err);
        return desktopBridge.verifySource(
          rawXml,
          sourceMetadata.rawOrderRevisionXml,
          sourceMetadata.rawManifestXml,
          overrides,
          sqItems,
          checklists
        ).then(verified => {
          if (revision !== sessionRevision.current) return;
          setGraph(verified.graph);
          setFacts(verified.facts);
          setChecklists(verified.checklists);
          setSourceIsTrusted(verified.sourceIsTrusted === true);
        });
      }).finally(() => setPendingVerifications(count => count - 1));
    } else {
      setChecklists(generateChecklists(activeRules, graph, latestFacts.current, latestChecklists.current));
    }
  }, [rulePackIdentity.sha256, activeRules, graph, isProjectLoaded, rawXml, sourceMetadata, sqItems, checklists, sourceIsTrusted, generalComments, syncFromSnapshot]);

  // Autosave when active data changes. Project creation is cancellable so a
  // slower integrity hash cannot publish an older session snapshot.
  useEffect(() => {
    if (isProjectLoaded && graph && facts && sqItems && checklists) {
      let cancelled = false;
      void createDvlProject(graph, facts, sqItems, checklists, rawXml, generalComments, sourceMetadata, {
        rulePackIdentity,
        activeRules,
        rulePackSnapshot: {
          templateMap: activeRulePackArtifacts.templateMap as any,
          approvedMappings: activeRulePackArtifacts.approvedMappings,
          rules: activeRules
        },
        integrityState: projectIntegrityClassification || undefined
      })
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
  }, [isProjectLoaded, graph, facts, sqItems, checklists, rawXml, generalComments, sourceMetadata, activeRules, rulePackIdentity, activeRulePackArtifacts, projectIntegrityClassification]);

  // Browser Preview fallback for fact editing
  const applyFactEdit = useCallback((updated: Record<string, Fact>) => {
    if (!graph) return;
    latestFacts.current = updated;
    setFacts(updated);
    setChecklists(generateChecklists(activeRules, graph, updated, latestChecklists.current));
  }, [graph, activeRules]);

  const handleUpdateFact = useCallback((key: string, value: any, author: string = 'Detailer', note?: string) => {
    try {
      const typedValue = typeof value === 'string' ? parseFactInput(key, value) : value;
      if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
        void dispatchSessionCommand((sessionId, expectedRevision) =>
          desktopBridge.projectSessionOverrideFact({
            sessionId,
            expectedRevision,
            factId: key,
            value: typedValue,
            author,
            comment: note
          })
        );
        return;
      }
      applyFactEdit(overrideFact(latestFacts.current, key, typedValue, author, note));
    } catch (error: any) {
      alert(error.message);
    }
  }, [applyFactEdit, dispatchSessionCommand]);

  const handleRevertFact = useCallback((key: string) => {
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionRevertFact({
          sessionId,
          expectedRevision,
          factId: key
        })
      );
      return;
    }
    applyFactEdit(revertFact(latestFacts.current, key));
  }, [applyFactEdit, dispatchSessionCommand]);

  const loadXmlData = useCallback(async (xmlString: string, bundle?: UpzBundle, sourceFileName?: string) => {
    const revision = ++sessionRevision.current;
    let orderRev = bundle?.orderRevision;
    if (!orderRev && bundle?.rawOrderRevXml) {
      orderRev = parseBrowserPreviewOrderRevXml(bundle.rawOrderRevXml);
    }
    const meta = sourceMetadataFromBundle(bundle, sourceFileName, orderRev);

    if (desktopBridge.isRunningInDesktop()) {
      try {
        const snapshot = await desktopBridge.projectSessionOpen({
          configXml: xmlString,
          orderRevXml: bundle?.rawOrderRevXml,
          manifestXml: bundle?.rawManifestXml,
          filePath: sourceFileName || meta.fileName || 'Config.xml',
          isUpz: !!bundle,
          isTrusted: true
        });
        if (revision !== sessionRevision.current) return;
        syncFromSnapshot(snapshot);
        setRawXml(xmlString);
        setSourceMetadata(meta);
        setCurrentProjectPath(null);
        setProjectIntegrityWarning(null);
        setProjectIntegrityClassification(null);
        setIsProjectLoaded(true);
        onSessionLoaded?.();

        if (!snapshot.facts['unit.comNumber']?.value) {
          onRequestComNumber?.();
        }
        return;
      } catch (err: any) {
        alert(`Host verification failed: ${err.message}`);
        return;
      }
    }

    const newGraph = parseBrowserPreviewAhuXml(xmlString);
    const newFacts = extractBrowserPreviewFacts(newGraph, orderRev);
    const newChecklists = generateChecklists(activeRules, newGraph, newFacts);

    setSourceMetadata(meta);
    setSourceIsTrusted(false);
    setRawXml(xmlString);
    setGraph(newGraph);
    setFacts(newFacts);
    setChecklists(newChecklists);
    setSqItems([]);
    setCurrentProjectPath(null);
    setProjectIntegrityWarning(null);
    setProjectIntegrityClassification(null);
    setIsProjectLoaded(true);
    onSessionLoaded?.();

    if (!newFacts['unit.comNumber']?.value) {
      onRequestComNumber?.();
    }
  }, [activeRules, onRequestComNumber, onSessionLoaded, syncFromSnapshot]);

  const handleOpenDvl = useCallback(async (project: DvlProjectFile, _rawJson?: string, filePath?: string) => {
    const revision = ++sessionRevision.current;
    let trusted = false;
    try {
      const integrity = await inspectDvlIntegrity(project, rulePackIdentity);
      const persistedFacts = normalizePersistedFactRegistry(project.factRegistry || {});
      const persistedSqItems = project.sqItems || [];
      const persistedChecklists = project.checklistInstances || [];
      const persistedSource = project.sourceXml || ({} as DvlProjectFile['sourceXml']);
      const persistedMetadata: SourceMetadata = {
        fileName: persistedSource.fileName,
        isUpzBundle: persistedSource.isUpzBundle,
        orderRevision: persistedSource.orderRevision,
        rawOrderRevisionXml: persistedSource.rawOrderRevisionXml,
        rawManifestXml: persistedSource.rawManifestXml
      };

      if (persistedSource.rawXml && desktopBridge.isRunningInDesktop()) {
        const snapshot = await desktopBridge.projectSessionOpen({
          configXml: persistedSource.rawXml,
          orderRevXml: persistedSource.rawOrderRevisionXml,
          manifestXml: persistedSource.rawManifestXml,
          filePath: filePath || persistedMetadata.fileName || 'Project.dvl',
          isUpz: !!persistedMetadata.isUpzBundle,
          isTrusted: true,
          initialOverrides: manualOverridesFromFacts(persistedFacts),
          initialChecklists: persistedChecklists,
          initialSpecialQuotes: persistedSqItems,
          initialGeneralComments: project.generalComments || ''
        });
        if (revision !== sessionRevision.current) return;
        syncFromSnapshot(snapshot);
        setRawXml(persistedSource.rawXml || '');
        setGeneralComments(snapshot.generalComments || project.generalComments || '');
        setSourceMetadata(persistedMetadata);
        setCurrentProjectPath(filePath || null);
        setProjectIntegrityWarning(integrity.status === 'unverified' ? integrity.message || 'This project could not be verified.' : null);
        setProjectIntegrityClassification(integrity.status === 'unverified' ? integrity.classification : null);
        setIsProjectLoaded(true);
        onSessionLoaded?.();
        return;
      }

      let loadedGraph = project.normalizedGraph;
      let loadedFacts = persistedFacts;
      let loadedChecklists = persistedChecklists;
      if (persistedSource.rawXml) {
        loadedGraph = parseBrowserPreviewAhuXml(persistedSource.rawXml);
        const extractedFacts = extractBrowserPreviewFacts(loadedGraph, persistedSource.orderRevision);
        loadedFacts = Object.entries(manualOverridesFromFacts(persistedFacts)).reduce(
          (registry, [key, fact]) => registry[key] ? overrideFact(registry, key, fact.value, 'Detailer', 'Restored persisted override') : registry,
          extractedFacts
        );
        loadedChecklists = generateChecklists(activeRules, loadedGraph, loadedFacts, persistedChecklists);
      }

      if (revision !== sessionRevision.current) return;
      setSessionSnapshot(null);
      sessionSnapshotRef.current = null;
      setSourceIsTrusted(trusted);
      setGraph(loadedGraph);
      setFacts(loadedFacts);
      setSqItems(persistedSqItems);
      setChecklists(loadedChecklists);
      setRawXml(persistedSource.rawXml || '');
      setGeneralComments(project.generalComments || '');
      setSourceMetadata(persistedMetadata);
      setCurrentProjectPath(filePath || null);
      setProjectIntegrityWarning(integrity.status === 'unverified' ? integrity.message || 'This project could not be verified.' : null);
      setProjectIntegrityClassification(integrity.status === 'unverified' ? integrity.classification : null);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
    } catch (err: any) {
      alert(`Error loading .dvl project: ${err.message}`);
    }
  }, [activeRules, onSessionLoaded, rulePackIdentity, syncFromSnapshot]);

  const handleManualCreate = useCallback((config: ManualUnitConfig) => {
    ++sessionRevision.current;
    setSessionSnapshot(null);
    sessionSnapshotRef.current = null;
    setSourceIsTrusted(false);
    try {
      const manual = createManualUnit(config, activeRules);
      setGraph(manual.graph);
      setFacts(manual.facts);
      setChecklists(manual.checklists);
      setSqItems(manual.sqItems);
      setRawXml(manual.rawXml);
      setGeneralComments(manual.generalComments);
      setSourceMetadata({ fileName: 'Manual Unit Configuration.xml', isUpzBundle: false });
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setProjectIntegrityClassification(null);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
    } catch (err: any) {
      alert(`Error creating manual unit: ${err.message}`);
    }
  }, [activeRules, onSessionLoaded]);

  const handleResumeAutosave = useCallback(() => {
    if (autosavedProject) void handleOpenDvl(autosavedProject);
  }, [autosavedProject, handleOpenDvl]);

  const handleClearAutosave = useCallback(() => {
    try {
      localStorage.removeItem('ahu_dvl_autosave');
      setAutosavedProject(null);
      setLastSavedAt(null);
    } catch (e) {
      console.warn('Failed to clear autosave:', e);
    }
  }, []);

  const handleLoadSample = useCallback(async () => {
    const revision = ++sessionRevision.current;
    if (desktopBridge.isRunningInDesktop()) {
      try {
        const snapshot = await desktopBridge.projectSessionOpen({
          configXml: SAMPLE_CONFIG_XML,
          filePath: 'Sample Config.xml',
          isUpz: false,
          isTrusted: false
        });
        if (revision !== sessionRevision.current) return;
        syncFromSnapshot(snapshot);
        setRawXml(SAMPLE_CONFIG_XML);
        setSourceMetadata({ fileName: 'Sample Config.xml', isUpzBundle: false });
        setCurrentProjectPath(null);
        setProjectIntegrityWarning(null);
        setProjectIntegrityClassification(null);
        setIsProjectLoaded(true);
        onSessionLoaded?.();
        return;
      } catch (err) {
        console.warn('Desktop session open failed for sample, falling back to browser preview:', err);
      }
    }

    setSessionSnapshot(null);
    sessionSnapshotRef.current = null;
    setSourceIsTrusted(false);
    try {
      const newGraph = parseBrowserPreviewAhuXml(SAMPLE_CONFIG_XML);
      const newFacts = extractBrowserPreviewFacts(newGraph);
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
      setSourceMetadata({ fileName: 'Sample Config.xml', isUpzBundle: false });
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setProjectIntegrityClassification(null);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
    } catch (err: any) {
      alert(`Error loading sample: ${err.message}`);
    }
  }, [activeRules, onSessionLoaded, syncFromSnapshot]);

  const handleResetAllChanges = useCallback(async () => {
    if (!graph) return;
    try {
      if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
        await dispatchSessionCommand((sessionId, expectedRevision) =>
          desktopBridge.projectSessionReset({
            sessionId,
            expectedRevision
          })
        );
        return;
      }
      const freshFacts = extractBrowserPreviewFacts(graph, sourceMetadata.orderRevision);
      const freshChecklists = generateChecklists(activeRules, graph, freshFacts);
      setFacts(freshFacts);
      setChecklists(freshChecklists);
    } catch (err: any) {
      alert(`Error resetting changes: ${err.message}`);
    }
  }, [graph, sourceMetadata, activeRules, dispatchSessionCommand]);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (file.name.endsWith('.dvl')) {
        try {
          const project = JSON.parse(text);
          void handleOpenDvl(project);
        } catch (err: any) {
          alert(`Error reading .dvl project file: ${err.message}`);
        }
      } else {
        void loadXmlData(text, undefined, file.name);
      }
    };
    reader.readAsText(file);
  }, [handleOpenDvl, loadXmlData]);

  const handleBatchResolveDefaults = useCallback(() => {
    if (!graph) return;
    const currentFacts = latestFacts.current;
    const items: BatchFactOverrideItem[] = [];
    if (currentFacts['unit.noa'] && currentFacts['unit.noa'].confidence === 'RequiresConfirmation') {
      items.push({ factId: 'unit.noa', value: false, author: 'Detailer', comment: 'Standard Non-NOA unit' });
    }
    if (currentFacts['unit.isSeismic'] && currentFacts['unit.isSeismic'].confidence === 'RequiresConfirmation') {
      items.push({ factId: 'unit.isSeismic', value: false, author: 'Detailer', comment: 'Standard Non-Seismic' });
    }
    if (currentFacts['unit.knockdown'] && currentFacts['unit.knockdown'].confidence === 'RequiresConfirmation') {
      items.push({ factId: 'unit.knockdown', value: false, author: 'Detailer', comment: 'Factory Assembled' });
    }

    if (items.length === 0) return;

    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionBatchOverrideFacts({
          sessionId,
          expectedRevision,
          overrides: items
        })
      );
      return;
    }

    let updated = { ...currentFacts };
    items.forEach(item => {
      updated = overrideFact(updated, item.factId, item.value, item.author, item.comment);
    });
    applyFactEdit(updated);
  }, [graph, applyFactEdit, dispatchSessionCommand]);

  const handleUpdateChecklistStatus = useCallback((instanceKey: string, status: CheckStatus) => {
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      const item = latestChecklists.current.find(c => c.instanceKey === instanceKey);
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionUpdateChecklist({
          sessionId,
          expectedRevision,
          checkId: instanceKey,
          status,
          comment: item?.detailerComment
        })
      );
      return;
    }
    ++sessionRevision.current;
    setChecklists(prev => prev.map(item => {
      if (item.instanceKey === instanceKey) {
        const rule = activeRules.find(candidate => candidate.id === item.ruleId);
        if (item.applicability !== 'Applicable' || !rule || (status === 'NA' && !rule.allowNA)) return item;
        return { ...item, status, updatedAt: new Date().toISOString() };
      }
      return item;
    }));
  }, [activeRules, dispatchSessionCommand]);

  const handleUpdateChecklistComment = useCallback((instanceKey: string, detailerComment: string) => {
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      const item = latestChecklists.current.find(c => c.instanceKey === instanceKey);
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionUpdateChecklist({
          sessionId,
          expectedRevision,
          checkId: instanceKey,
          status: item?.status || 'Incomplete',
          comment: detailerComment
        })
      );
      return;
    }
    ++sessionRevision.current;
    setChecklists(prev => prev.map(item => {
      if (item.instanceKey === instanceKey) {
        return { ...item, detailerComment, updatedAt: new Date().toISOString() };
      }
      return item;
    }));
  }, [dispatchSessionCommand]);

  const handleUpdateSpecialQuote = useCallback((item: SpecialQuote) => {
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionUpdateSpecialQuote({
          sessionId,
          expectedRevision,
          specialQuote: item
        })
      );
      return;
    }
    setSqItems(prev => {
      const existingIndex = prev.findIndex(s => (s.id && item.id && s.id === item.id) || s.slot === item.slot);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = item;
        return next.sort((a, b) => a.slot - b.slot);
      }
      return [...prev, item].sort((a, b) => a.slot - b.slot);
    });
  }, [dispatchSessionCommand]);

  const handleDeleteSpecialQuote = useCallback((slotOrId: number | string) => {
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionDeleteSpecialQuote({
          sessionId,
          expectedRevision,
          quoteId: String(slotOrId)
        })
      );
      return;
    }
    setSqItems(prev => prev.filter(s => s.slot !== slotOrId && s.id !== slotOrId));
  }, [dispatchSessionCommand]);

  const handleReorderSpecialQuotes = useCallback((assignments: SpecialQuoteSlotAssignment[]) => {
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionReorderSpecialQuotes({
          sessionId,
          expectedRevision,
          assignments
        })
      );
      return;
    }
    setSqItems(prev => {
      const map = new Map(assignments.map(a => [a.quoteId, a.slot]));
      return prev.map(s => {
        const newSlot = map.get(s.id);
        return newSlot !== undefined ? { ...s, slot: newSlot } : s;
      }).sort((a, b) => a.slot - b.slot);
    });
  }, [dispatchSessionCommand]);

  const handleUpdateGeneralComments = useCallback((comments: string) => {
    setGeneralComments(comments);
    if (desktopBridge.isRunningInDesktop() && sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision) =>
        desktopBridge.projectSessionUpdateGeneralComments({
          sessionId,
          expectedRevision,
          generalComments: comments
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleSaveDvl = useCallback(async (forceSaveAs: boolean = false) => {
    if (!graph) return;
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await pendingCommandChain.current;
    try {
      const project = await createDvlProject(graph, facts, sqItems, checklists, rawXml, generalComments, sourceMetadata, {
        rulePackIdentity,
        activeRules,
        rulePackSnapshot: {
          templateMap: activeRulePackArtifacts.templateMap as any,
          approvedMappings: activeRulePackArtifacts.approvedMappings,
          rules: activeRules
        },
        integrityState: projectIntegrityClassification || undefined
      });
      const jobName = facts['unit.jobName']?.value || 'AHU_Project';
      const comNumber = facts['unit.comNumber']?.value || 'COM-000000';
      const defaultName = `${jobName}_${comNumber}.dvl`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

      if (desktopBridge.isRunningInDesktop()) {
        let targetPath = forceSaveAs ? null : currentProjectPath;
        if (!targetPath) targetPath = await desktopBridge.saveFileDialog(defaultName);
        if (!targetPath) return;

        const res = await desktopBridge.saveDvl(targetPath, project);
        if (res.saved) {
          setCurrentProjectPath(res.path);
          setExportNotice({ fileName: res.path.split(/[\\/]/).pop() || defaultName, filePath: res.path });
        }
      } else {
        saveDvlToFile(project);
      }
    } catch (error: any) {
      alert(`Error saving .dvl project: ${error.message}`);
    }
  }, [graph, facts, sqItems, checklists, rawXml, generalComments, sourceMetadata, rulePackIdentity, activeRules, activeRulePackArtifacts, projectIntegrityClassification, currentProjectPath]);

  const handleExportExcel = useCallback(async (isDraft: boolean = false) => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await pendingCommandChain.current;
    if (!graph) {
      setExportError('Cannot export Excel deliverable: No project geometry or graph is loaded.');
      return;
    }
    if (pendingVerifications > 0) {
      setExportError('Wait for host verification to finish before exporting.');
      return;
    }
    if (!isDraft && (!desktopBridge.isRunningInDesktop() || projectIntegrityWarning || !sourceIsTrusted)) {
      setExportError(!desktopBridge.isRunningInDesktop()
        ? 'Final Excel export requires the certified Windows desktop host. Browser preview can export drafts only.'
        : 'Final Excel export requires a verified native source and resolved project integrity. Reopen the source through the desktop file picker.');
      return;
    }
    const jobName = String(facts['unit.jobName']?.value || 'AHU_Project');
    const comNumber = String(facts['unit.comNumber']?.value || 'COM-000000');
    const defaultName = `${jobName}_${comNumber}_Detailing_Verification_List${isDraft ? '_DRAFT' : ''}.xlsx`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
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
        isDraft,
        rawXml,
        sourceMetadata.rawOrderRevisionXml,
        sourceMetadata.rawManifestXml
      );
      if (result.exported && !result.cancelled) {
        setExportNotice({ fileName: result.fileName || defaultName, filePath: result.filePath });
      }
    } catch (error: any) {
      console.error('Export Excel failed:', error);
      setExportError(error?.message || 'An unknown error occurred while exporting the Excel deliverable.');
    }
  }, [graph, pendingVerifications, projectIntegrityWarning, sourceIsTrusted, facts, sqItems, checklists, activeRules, generalComments, rawXml, sourceMetadata]);

  return {
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
    sessionSnapshot,
    readiness,
    setSqItems,
    setGeneralComments,
    leaveProject: () => {
      setSessionSnapshot(null);
      sessionSnapshotRef.current = null;
      setIsProjectLoaded(false);
    },
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
    dismissExportNotice: () => setExportNotice(null),
    dismissExportError: () => setExportError(null)
  };
}
