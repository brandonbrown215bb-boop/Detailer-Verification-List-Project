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
  SpecialQuoteSlotAssignment,
  RecoveryInfo
} from '../types/session';
import { desktopBridge } from '../services/desktopBridge';
import { parseFactInput } from '../services/factContract';
import { SAMPLE_CONFIG_XML } from '../fixtures/sampleConfigXml';
import {
  sourceMetadataFromBundle,
  type ActiveRulePackArtifacts,
  type SourceMetadata
} from '../orchestration/projectSession';
import { projectSessionReadiness, type UnitReadiness } from '../utils/readiness';
import type { ManualUnitConfig } from '../types/manual';
import { STORAGE_KEYS } from '../utils/constants';

const EMPTY_READINESS: UnitReadiness = {
  unconfirmedFactsCount: 0,
  blockedChecksCount: 0,
  incompleteChecksCount: 0,
  completedChecksCount: 0,
  naChecksCount: 0,
  totalApplicableChecksCount: 0,
  totalChecksCount: 0,
  percentComplete: 0,
  isReadyForFinal: false,
  blockedRules: [],
  unconfirmedFacts: [],
  incompleteRules: [],
  passedRules: [],
  scopeReadinessMap: {}
};

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
  recoveryInfo: RecoveryInfo | null;
  projectIntegrityWarning: string | null;
  sourceIsTrusted: boolean;
  pendingVerifications: number;
  lastSavedAt: string | null;
  exportNotice: ExportNotice | null;
  exportError: string | null;
  sessionSnapshot: ProjectSessionSnapshot | null;
  applySessionSnapshot: (snapshot: ProjectSessionSnapshot) => void;
  readiness: UnitReadiness;
  setSqItems: Dispatch<SetStateAction<SpecialQuote[]>>;
  setGeneralComments: Dispatch<SetStateAction<string>>;
  leaveProject: () => void;
  loadXmlData: (xmlString: string, bundle?: UpzBundle, sourceFileName?: string, sourceFilePath?: string, sourceHandle?: string) => Promise<void>;
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
  const [autosavedProject, setAutosavedProject] = useState<DvlProjectFile | null>(null);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);
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
  const sessionLifecycleGeneration = useRef(0);
  const previousPackHash = useRef(rulePackIdentity.sha256);

  const latestGraph = useRef(graph);
  latestGraph.current = graph;
  const latestFacts = useRef(facts);
  latestFacts.current = facts;
  const latestChecklists = useRef(checklists);
  latestChecklists.current = checklists;
  const latestSqItems = useRef(sqItems);
  latestSqItems.current = sqItems;
  const latestGeneralComments = useRef(generalComments);
  latestGeneralComments.current = generalComments;
  const latestRawXml = useRef(rawXml);
  latestRawXml.current = rawXml;
  const latestSourceMetadata = useRef(sourceMetadata);
  latestSourceMetadata.current = sourceMetadata;

  const syncFromSnapshot = useCallback((snapshot: ProjectSessionSnapshot) => {
    const prevSnapshot = sessionSnapshotRef.current;
    const isSameSession = Boolean(prevSnapshot?.sessionId && prevSnapshot.sessionId === snapshot.sessionId);

    setSessionSnapshot(snapshot);
    sessionSnapshotRef.current = snapshot;
    setGraph(snapshot.graph);
    latestGraph.current = snapshot.graph;
    setFacts(snapshot.facts);
    latestFacts.current = snapshot.facts;
    const nextSq = snapshot.specialQuotes || [];
    setSqItems(nextSq);
    latestSqItems.current = nextSq;
    const nextChecklists = snapshot.checklists || [];
    setChecklists(nextChecklists);
    latestChecklists.current = nextChecklists;
    const nextComments = snapshot.generalComments || '';
    setGeneralComments(nextComments);
    latestGeneralComments.current = nextComments;
    setSourceIsTrusted(snapshot.source?.isTrusted === true);
    if (snapshot.rawConfigXml !== undefined) {
      setRawXml(snapshot.rawConfigXml);
      latestRawXml.current = snapshot.rawConfigXml;
    }
    if (snapshot.currentProjectPath !== undefined) {
      setCurrentProjectPath(snapshot.currentProjectPath || null);
    }
    if (snapshot.lastSavedAt !== undefined) {
      setLastSavedAt(snapshot.lastSavedAt || null);
    }
    if (snapshot.integrityWarning !== undefined) {
      setProjectIntegrityWarning(snapshot.integrityWarning || null);
    }
    if (snapshot.integrityState !== undefined) {
      setProjectIntegrityClassification(snapshot.integrityState || null);
    }
    const currentPrevMetadata = latestSourceMetadata.current;
    const nextMetadata: SourceMetadata = snapshot.source ? {
      fileName: snapshot.source.fileName,
      filePath: snapshot.source.filePath,
      fileSha256: snapshot.source.fileSha256,
      isUpzBundle: snapshot.source.isUpz,
      orderRevision: snapshot.source.orderRevision,
      rawOrderRevisionXml: snapshot.source.rawOrderRevisionXml ?? (isSameSession ? currentPrevMetadata?.rawOrderRevisionXml : undefined),
      rawManifestXml: snapshot.source.rawManifestXml ?? (isSameSession ? currentPrevMetadata?.rawManifestXml : undefined)
    } : (isSameSession ? currentPrevMetadata : { fileName: 'Manual Unit Configuration.xml', isUpzBundle: false });
    if (snapshot.source || !isSameSession) {
      setSourceMetadata(nextMetadata);
      latestSourceMetadata.current = nextMetadata;
    }
  }, []);

  const dispatchSessionCommand = useCallback(async (
    runCommand: (sessionId: string, expectedRevision: number, requestId: string) => Promise<SessionCommandResult>
  ): Promise<ProjectSessionSnapshot | null> => {
    const boundSessionId = sessionSnapshotRef.current?.sessionId;
    const boundGeneration = sessionLifecycleGeneration.current;
    if (!boundSessionId) {
      throw new Error('No active project session.');
    }
    const requestId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const run = async () => {
      if (sessionLifecycleGeneration.current !== boundGeneration || sessionSnapshotRef.current?.sessionId !== boundSessionId) {
        console.warn('Session command discarded: session was superseded or closed before execution.');
        return null;
      }
      const current = sessionSnapshotRef.current;
      if (!current) return null;

      try {
        const result = await runCommand(boundSessionId, current.revision, requestId);
        if (sessionLifecycleGeneration.current !== boundGeneration || sessionSnapshotRef.current?.sessionId !== boundSessionId) {
          console.warn('Session command response discarded: session was superseded or closed.');
          return null;
        }

        if (!result.success) {
          console.error('Session command rejected:', result.errorMessage);
          if (result.snapshot) {
            syncFromSnapshot(result.snapshot);
          }
          const errMsg = result.errorMessage || 'Session mutation was rejected.';
          setExportError(`Edit rejected: ${errMsg}`);
          throw new Error(errMsg);
        }

        if (result.snapshot) {
          syncFromSnapshot(result.snapshot);
          return result.snapshot;
        }
        const latest = await desktopBridge.projectSessionGetSnapshot();
        if (sessionLifecycleGeneration.current !== boundGeneration || sessionSnapshotRef.current?.sessionId !== boundSessionId) {
          return null;
        }
        syncFromSnapshot(latest);
        return latest;
      } catch (err: any) {
        if (sessionLifecycleGeneration.current === boundGeneration && sessionSnapshotRef.current?.sessionId === boundSessionId) {
          console.error('Session command execution error, recovering latest snapshot:', err);
          try {
            const latest = await desktopBridge.projectSessionGetSnapshot();
            if (sessionLifecycleGeneration.current === boundGeneration && sessionSnapshotRef.current?.sessionId === boundSessionId) {
              syncFromSnapshot(latest);
            }
          } catch (recoverErr) {
            console.warn('Failed to recover snapshot after session command failure:', recoverErr);
          }
        }
        throw err;
      }
    };

    const chained = pendingCommandChain.current
      .catch(() => {})
      .then(run);
    chained.catch(() => {});
    pendingCommandChain.current = chained;
    return chained;
  }, [syncFromSnapshot]);

  // Derived readiness: Authoritative projection from C# ProjectSession
  const readiness = useMemo<UnitReadiness>(() => {
    if (sessionSnapshot) {
      return projectSessionReadiness(sessionSnapshot);
    }
    return EMPTY_READINESS;
  }, [sessionSnapshot]);

  // Startup and Settings pack changes share this migration boundary. Every
  // applied pack change invalidates old asynchronous verification work.
  useEffect(() => {
    if (previousPackHash.current === rulePackIdentity.sha256) return;
    previousPackHash.current = rulePackIdentity.sha256;
    const revision = ++sessionRevision.current;
    if (!graph || !isProjectLoaded) return;
    if (sessionSnapshotRef.current) {
      setPendingVerifications(count => count + 1);
      void desktopBridge.projectSessionGetSnapshot().then(snapshot => {
        if (revision !== sessionRevision.current) return;
        syncFromSnapshot(snapshot);
      }).catch(err => {
        console.warn('Failed to retrieve updated session snapshot after rule pack change:', err);
      }).finally(() => setPendingVerifications(count => count - 1));
    }
  }, [rulePackIdentity.sha256, graph, isProjectLoaded, syncFromSnapshot]);

  // Check for native recovery session on desktop host startup
  useEffect(() => {
    if (desktopBridge.isRunningInDesktop()) {
      desktopBridge.getRecoveryInfo().then(info => {
        if (info && info.hasRecovery) {
          setRecoveryInfo(info);
          setAutosavedProject({
            jobName: info.jobName || 'Recovered Session',
            comNumber: info.comNumber || 'COM Pending',
            author: info.author || 'Detailer',
            lastSavedAt: info.lastSavedAt || new Date().toISOString()
          } as any);
        }
      }).catch(err => {
        console.warn('Failed to check native recovery info:', err);
      });
    }
  }, []);

  const handleUpdateFact = useCallback((key: string, value: any, author: string = 'Detailer', note?: string) => {
    try {
      const typedValue = typeof value === 'string' ? parseFactInput(key, value) : value;
      if (sessionSnapshotRef.current) {
        void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
          desktopBridge.projectSessionOverrideFact({
            sessionId,
            expectedRevision,
            requestId,
            factId: key,
            value: typedValue,
            author,
            comment: note
          })
        );
      }
    } catch (error: any) {
      alert(error.message);
    }
  }, [dispatchSessionCommand]);

  const handleRevertFact = useCallback((key: string) => {
    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionRevertFact({
          sessionId,
          expectedRevision,
          requestId,
          factId: key
        })
      );
    }
  }, [dispatchSessionCommand]);

  const loadXmlData = useCallback(async (xmlString: string, bundle?: UpzBundle, sourceFileName?: string, sourceFilePath?: string, sourceHandle?: string) => {
    const generation = ++sessionLifecycleGeneration.current;
    const revision = ++sessionRevision.current;
    pendingCommandChain.current = Promise.resolve();
    const meta = sourceMetadataFromBundle(bundle, sourceFileName, bundle?.orderRevision);
    if (sourceFilePath) {
      meta.filePath = sourceFilePath;
    }

    try {
      const snapshot = await desktopBridge.projectSessionOpen({
        configXml: xmlString,
        orderRevXml: bundle?.rawOrderRevXml,
        manifestXml: bundle?.rawManifestXml,
        filePath: sourceFilePath || sourceFileName || meta.fileName || 'Config.xml',
        isUpz: !!bundle,
        isTrusted: false,
        sourceHandle
      });
      if (revision !== sessionRevision.current || generation !== sessionLifecycleGeneration.current) return;
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
      const savedDetailer = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DETAILER_NAME) : null;
      if (savedDetailer && (!snapshot.facts['unit.detailer']?.value || snapshot.facts['unit.detailer']?.status === 'Unknown')) {
        handleUpdateFact('unit.detailer', savedDetailer, 'Detailer', 'Auto-applied from detailer profile');
      }
      const savedInitials = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DETAILER_INITIALS) : null;
      if (savedInitials && (!snapshot.facts['unit.detailerInitials']?.value || snapshot.facts['unit.detailerInitials']?.status === 'Unknown')) {
        handleUpdateFact('unit.detailerInitials', savedInitials, 'Detailer', 'Auto-applied from detailer profile');
      }
    } catch (err: any) {
      alert(`Host verification failed: ${err.message}`);
    }
  }, [handleUpdateFact, onRequestComNumber, onSessionLoaded, syncFromSnapshot]);

  const handleOpenDvl = useCallback(async (project: DvlProjectFile, rawJson?: string, filePath?: string) => {
    const generation = ++sessionLifecycleGeneration.current;
    const revision = ++sessionRevision.current;
    pendingCommandChain.current = Promise.resolve();

    try {
      const dvlJson = rawJson || JSON.stringify(project);
      const snapshot = await desktopBridge.projectSessionOpenDvl({
        filePath: filePath || undefined,
        dvlJson
      });
      if (revision !== sessionRevision.current || generation !== sessionLifecycleGeneration.current) return;
      syncFromSnapshot(snapshot);
      setRawXml(snapshot.rawConfigXml || '');
      setGeneralComments(snapshot.generalComments || '');
      setSourceMetadata({
        fileName: project.sourceXml?.fileName,
        filePath: filePath,
        isUpzBundle: project.sourceXml?.isUpzBundle,
        orderRevision: project.sourceXml?.orderRevision,
        rawOrderRevisionXml: project.sourceXml?.rawOrderRevisionXml,
        rawManifestXml: project.sourceXml?.rawManifestXml
      });
      setCurrentProjectPath(snapshot.currentProjectPath || filePath || null);
      setLastSavedAt(snapshot.lastSavedAt || null);
      setProjectIntegrityWarning(snapshot.integrityWarning || null);
      setProjectIntegrityClassification(snapshot.integrityState || null);
      setSourceIsTrusted(snapshot.source?.isTrusted === true);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
    } catch (err: any) {
      alert(`Error loading DVL project: ${err.message}`);
    }
  }, [onSessionLoaded, syncFromSnapshot]);

  const handleManualCreate = useCallback(async (config: ManualUnitConfig) => {
    const generation = ++sessionLifecycleGeneration.current;
    const revision = ++sessionRevision.current;
    pendingCommandChain.current = Promise.resolve();
    try {
      const snapshot = await desktopBridge.projectSessionCreateManual({ config });
      if (revision !== sessionRevision.current || generation !== sessionLifecycleGeneration.current) return;
      syncFromSnapshot(snapshot);
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setProjectIntegrityClassification(null);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
    } catch (err: any) {
      alert(`Error creating manual unit: ${err.message}`);
    }
  }, [onSessionLoaded, syncFromSnapshot]);

  const handleResumeAutosave = useCallback(async () => {
    try {
      const snapshot = await desktopBridge.restoreRecovery();
      syncFromSnapshot(snapshot);
      setRawXml(snapshot.rawConfigXml || '');
      setGeneralComments(snapshot.generalComments || '');
      setCurrentProjectPath(snapshot.currentProjectPath || null);
      setLastSavedAt(snapshot.lastSavedAt || null);
      setProjectIntegrityWarning(snapshot.integrityWarning || null);
      setProjectIntegrityClassification(snapshot.integrityState || null);
      setSourceIsTrusted(snapshot.source?.isTrusted === true);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
      setRecoveryInfo(null);
      setAutosavedProject(null);
    } catch (err: any) {
      alert(`Failed to restore recovery session: ${err?.message || err}`);
    }
  }, [onSessionLoaded, syncFromSnapshot]);

  const handleClearAutosave = useCallback(async () => {
    try {
      await desktopBridge.discardRecovery();
    } catch (err: any) {
      console.warn('Failed to discard recovery session:', err);
    }
    setRecoveryInfo(null);
    setAutosavedProject(null);
    setLastSavedAt(null);
  }, []);

  const handleLoadSample = useCallback(async () => {
    const generation = ++sessionLifecycleGeneration.current;
    const revision = ++sessionRevision.current;
    pendingCommandChain.current = Promise.resolve();
    try {
      const snapshot = await desktopBridge.projectSessionOpen({
        configXml: SAMPLE_CONFIG_XML,
        filePath: 'Sample Config.xml',
        isUpz: false,
        isTrusted: false
      });
      if (revision !== sessionRevision.current || generation !== sessionLifecycleGeneration.current) return;
      syncFromSnapshot(snapshot);
      setRawXml(SAMPLE_CONFIG_XML);
      setSourceMetadata({ fileName: 'Sample Config.xml', isUpzBundle: false });
      setCurrentProjectPath(null);
      setProjectIntegrityWarning(null);
      setProjectIntegrityClassification(null);
      setIsProjectLoaded(true);
      onSessionLoaded?.();
    } catch (err: any) {
      alert(`Error loading sample: ${err.message}`);
    }
  }, [onSessionLoaded, syncFromSnapshot]);

  const handleResetAllChanges = useCallback(async () => {
    const currentGraph = latestGraph.current || graph;
    if (!currentGraph) return;
    try {
      if (sessionSnapshotRef.current) {
        await dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
          desktopBridge.projectSessionReset({
            sessionId,
            expectedRevision,
            requestId
          })
        );
      }
    } catch (err: any) {
      alert(`Error resetting changes: ${err.message}`);
    }
  }, [graph, dispatchSessionCommand]);

  const handleFileUpload = useCallback((file: File) => {
    const filePath = (file as any).path || (file as any).webkitRelativePath || undefined;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (file.name.endsWith('.dvl')) {
        try {
          const project = JSON.parse(text);
          void handleOpenDvl(project, text, filePath);
        } catch (err: any) {
          alert(`Error reading .dvl project file: ${err.message}`);
        }
      } else {
        void loadXmlData(text, undefined, file.name, filePath);
      }
    };
    reader.readAsText(file);
  }, [handleOpenDvl, loadXmlData]);

  const handleBatchResolveDefaults = useCallback(() => {
    const currentGraph = latestGraph.current || graph;
    if (!currentGraph) return;
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

    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionBatchOverrideFacts({
          sessionId,
          expectedRevision,
          overrides: items,
          requestId
        })
      );
    }
  }, [graph, dispatchSessionCommand]);

  const handleUpdateChecklistStatus = useCallback((instanceKey: string, status: CheckStatus) => {
    if (sessionSnapshotRef.current) {
      const savedInitials = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DETAILER_INITIALS) : null;
      const currentInitialsFact = sessionSnapshotRef.current.facts['unit.detailerInitials']?.value?.toString();
      const currentDetailerFact = sessionSnapshotRef.current.facts['unit.detailer']?.value?.toString();
      const effectiveInitials = currentInitialsFact || savedInitials || (currentDetailerFact ? currentDetailerFact.split(/\s+/).map((p: string) => p[0]).join('').slice(0, 4).toUpperCase() : undefined);

      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionUpdateChecklist({
          sessionId,
          expectedRevision,
          checkId: instanceKey,
          status,
          detailerInitials: (status === 'Passed' || status === 'Flagged') ? effectiveInitials : undefined,
          requestId
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleUpdateChecklistComment = useCallback((instanceKey: string, detailerComment: string) => {
    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionUpdateChecklist({
          sessionId,
          expectedRevision,
          checkId: instanceKey,
          comment: detailerComment,
          requestId
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleUpdateSpecialQuote = useCallback((item: SpecialQuote) => {
    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionUpdateSpecialQuote({
          sessionId,
          expectedRevision,
          specialQuote: item,
          requestId
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleDeleteSpecialQuote = useCallback((slotOrId: number | string) => {
    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionDeleteSpecialQuote({
          sessionId,
          expectedRevision,
          quoteId: String(slotOrId),
          requestId
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleReorderSpecialQuotes = useCallback((assignments: SpecialQuoteSlotAssignment[]) => {
    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionReorderSpecialQuotes({
          sessionId,
          expectedRevision,
          assignments,
          requestId
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleUpdateGeneralComments = useCallback((comments: string) => {
    latestGeneralComments.current = comments;
    setGeneralComments(comments);
    if (sessionSnapshotRef.current) {
      void dispatchSessionCommand((sessionId, expectedRevision, requestId) =>
        desktopBridge.projectSessionUpdateGeneralComments({
          sessionId,
          expectedRevision,
          comments,
          requestId
        })
      );
    }
  }, [dispatchSessionCommand]);

  const handleSaveDvl = useCallback(async (forceSaveAs: boolean = false) => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    try {
      await pendingCommandChain.current;
    } catch (err: any) {
      alert(`Cannot save project: A pending edit was rejected or failed (${err?.message || err}).`);
      return;
    }

    if (sessionSnapshotRef.current) {
      try {
        const currentSessionId = sessionSnapshotRef.current.sessionId;
        const defaultDirectory = typeof localStorage !== 'undefined'
          ? localStorage.getItem('dvl_shared_export_path') || undefined
          : undefined;
        const res = await desktopBridge.projectSessionSave({
          sessionId: currentSessionId,
          expectedRevision: sessionSnapshotRef.current.revision,
          forceSaveAs,
          defaultDirectory
        });
        if (res.saved) {
          setCurrentProjectPath(res.path || null);
          setLastSavedAt(res.lastSavedAt || new Date().toISOString());
          setExportNotice({ fileName: res.fileName || 'Project.dvl', filePath: res.path });
          setRecoveryInfo(null);
          setAutosavedProject(null);
          if (res.snapshot) {
            syncFromSnapshot(res.snapshot);
          }
        }
      } catch (error: any) {
        alert(`Error saving .dvl project: ${error.message}`);
      }
    }
  }, [syncFromSnapshot]);

  const handleExportExcel = useCallback(async (isDraft: boolean = false) => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setExportError(null);
    try {
      await pendingCommandChain.current;
    } catch (err: any) {
      setExportError(`Cannot export deliverable: A pending edit was rejected or failed (${err?.message || err}).`);
      return;
    }

    if (sessionSnapshotRef.current) {
      try {
        const currentSessionId = sessionSnapshotRef.current.sessionId;
        const defaultDirectory = typeof localStorage !== 'undefined'
          ? localStorage.getItem('dvl_shared_export_path') || undefined
          : undefined;
        const result = await desktopBridge.projectSessionExportExcel({
          sessionId: currentSessionId,
          isDraft,
          expectedRevision: sessionSnapshotRef.current.revision,
          defaultDirectory
        });
        if (result.exported && !result.cancelled) {
          setExportNotice({ fileName: result.fileName || 'Deliverable.xlsx', filePath: result.filePath });
        }
      } catch (error: any) {
        console.error('Export Excel failed:', error);
        setExportError(error?.message || 'An unknown error occurred while exporting the Excel deliverable.');
      }
    }
  }, []);

  return {
    isProjectLoaded,
    graph,
    facts,
    sqItems,
    checklists,
    generalComments,
    autosavedProject,
    recoveryInfo,
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
      sessionLifecycleGeneration.current++;
      sessionRevision.current++;
      pendingCommandChain.current = Promise.resolve();
      setSessionSnapshot(null);
      sessionSnapshotRef.current = null;
      setIsProjectLoaded(false);
      setGraph(null);
      latestGraph.current = null;
      setFacts({});
      latestFacts.current = {};
      setSqItems([]);
      latestSqItems.current = [];
      setChecklists([]);
      latestChecklists.current = [];
      setRawXml('');
      latestRawXml.current = '';
      setGeneralComments('');
      latestGeneralComments.current = '';
      setSourceMetadata({});
      latestSourceMetadata.current = {};
      setCurrentProjectPath(null);
      setLastSavedAt(null);
      setProjectIntegrityWarning(null);
      setProjectIntegrityClassification(null);
      setSourceIsTrusted(false);
      setExportError(null);
      setExportNotice(null);
      setRecoveryInfo(null);
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
    applySessionSnapshot: syncFromSnapshot,
    dismissExportNotice: () => setExportNotice(null),
    dismissExportError: () => setExportError(null)
  };
}
