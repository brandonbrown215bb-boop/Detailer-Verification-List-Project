import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { RuleDefinition, TemplateMap, RulePackManifest } from '../types';
import { RuleDiffItem } from './types';
import { Header } from './components/Header';
import { RuleListView } from './components/RuleListView';
import { RuleFormView, FormValidationError } from './components/RuleFormView';
import { PublishModal } from './components/PublishModal';
import { DesktopHostRequiredScreen } from '../components/DesktopHostRequiredScreen';
import { desktopBridge } from '../services/desktopBridge';

const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const defaultTemplateMap: TemplateMap = {
  templateVersion: '14.0.0',
  generalFields: {
    'unit.detailer': { sheet: 'Verification List', cell: 'D3' },
    'unit.date': { sheet: 'Verification List', cell: 'D4' },
    'unit.jobName': { sheet: 'Verification List', cell: 'D5' },
    'unit.comNumber': { sheet: 'Verification List', cell: 'D6' },
    'unit.shellType': { sheet: 'Verification List', cell: 'D7' },
    'unit.tags': { sheet: 'Verification List', cell: 'D8' },
    'unit.baseHeight': { sheet: 'Verification List', cell: 'D9' },
    'casing.thicknessFront': { sheet: 'Verification List', cell: 'D10' },
    'unit.thermalBreak': { sheet: 'Verification List', cell: 'D11' },
    'roof.roofPeak': { sheet: 'Verification List', cell: 'D12' },
    'unit.curbrest': { sheet: 'Verification List', cell: 'D13' },
    'unit.noa': { sheet: 'Verification List', cell: 'D14' },
    'unit.isSeismic': { sheet: 'Verification List', cell: 'D15' },
    'unit.unitType': { sheet: 'Verification List', cell: 'D16' },
    'unit.knockdown': { sheet: 'Verification List', cell: 'D17' },
    'unit.hasUTL': { sheet: 'Verification List', cell: 'D18' },
    'casing.interiorMaterial': { sheet: 'Verification List', cell: 'D19' },
    'casing.interiorGauge': { sheet: 'Verification List', cell: 'F19' },
    'casing.exteriorMaterial': { sheet: 'Verification List', cell: 'D20' },
    'casing.exteriorGauge': { sheet: 'Verification List', cell: 'F20' },
    'casing.floorMaterial': { sheet: 'Verification List', cell: 'D21' },
    'casing.floorGauge': { sheet: 'Verification List', cell: 'F21' },
    'generalComments': { sheet: 'Verification List', cell: 'D22' }
  },
  sqRange: { sheet: 'Verification List', startRow: 4, endRow: 25, slotCol: 'G', textCol: 'H' },
  ruleCellMappings: {}
};

const defaultManifest: RulePackManifest = {
  name: 'AHU Detailing Verification Rules',
  version: '1.0.0',
  generatedAt: '',
  bundleSha256: '',
  files: {}
};

export const RuleEditorAppContent: React.FC = () => {
  const [baselineRules, setBaselineRules] = useState<RuleDefinition[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [templateMap, setTemplateMap] = useState<TemplateMap>(defaultTemplateMap);
  const [approvedMappings, setApprovedMappings] = useState<any>({});
  const [manifest, setManifest] = useState<RulePackManifest>(defaultManifest);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'modified'>('all');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [validationErrors, setValidationErrors] = useState<FormValidationError[]>([]);
  const [activeDraftName, setActiveDraftName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [defaultPublishPath, setDefaultPublishPath] = useState<string | undefined>(undefined);

  // Load from Desktop IPC bridge
  useEffect(() => {
    async function loadFromHost() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const [pack, appInfo] = await Promise.all([
          desktopBridge.getRulePack(),
          desktopBridge.getAppInfo().catch(() => null)
        ]);
        if ((appInfo as any)?.defaultPublishPath) {
          setDefaultPublishPath((appInfo as any).defaultPublishPath);
        }
        if (pack && pack.rules && pack.rules.length > 0) {
          setBaselineRules(JSON.parse(JSON.stringify(pack.rules)));
          setRules(JSON.parse(JSON.stringify(pack.rules)));
          if (pack.templateMap) setTemplateMap(pack.templateMap);
          if (pack.approvedMappings) setApprovedMappings(JSON.parse(JSON.stringify(pack.approvedMappings)));
          if (pack.manifest) setManifest(pack.manifest);
          if (pack.rules[0]?.id) setSelectedRuleId(pack.rules[0].id);
        } else {
          setLoadError('Failed to load active Rule Pack: Rule Pack contains no rules or is empty.');
        }
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load active Rule Pack from desktop host.');
      } finally {
        setIsLoading(false);
      }
    }
    loadFromHost();
  }, []);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Map of baseline rules by ID for quick diffing
  const baselineMap = useMemo(() => {
    const map = new Map<string, RuleDefinition>();
    baselineRules.forEach(r => map.set(r.id, r));
    return map;
  }, [baselineRules]);

  // Compute dirty rules and field diffs
  const { dirtyRuleIds, diffs } = useMemo(() => {
    const dirtyIds = new Set<string>();
    const diffList: RuleDiffItem[] = [];

    // Check added or modified rules
    rules.forEach(r => {
      const base = baselineMap.get(r.id);
      if (!base) {
        // New rule added
        dirtyIds.add(r.id);
        diffList.push({
          ruleId: r.id,
          semanticKey: r.semanticKey,
          category: r.category,
          changeType: 'added',
          after: r
        });
      } else {
        // Check field-level differences
        const fieldChanges: Array<{ field: keyof RuleDefinition; label: string; beforeVal: any; afterVal: any }> = [];

        if (r.text !== base.text) fieldChanges.push({ field: 'text', label: 'Instruction Text', beforeVal: base.text, afterVal: r.text });
        if (r.semanticKey !== base.semanticKey) fieldChanges.push({ field: 'semanticKey', label: 'Semantic Key', beforeVal: base.semanticKey, afterVal: r.semanticKey });
        if (r.category !== base.category) fieldChanges.push({ field: 'category', label: 'Category', beforeVal: base.category, afterVal: r.category });
        if (r.scope !== base.scope) fieldChanges.push({ field: 'scope', label: 'Scope', beforeVal: base.scope, afterVal: r.scope });
        if (r.allowNA !== base.allowNA) fieldChanges.push({ field: 'allowNA', label: 'Allow N/A', beforeVal: base.allowNA, afterVal: r.allowNA });
        if (r.verificationMode !== base.verificationMode) fieldChanges.push({ field: 'verificationMode', label: 'Verification Mode', beforeVal: base.verificationMode, afterVal: r.verificationMode });
        if (r.reference !== base.reference) fieldChanges.push({ field: 'reference', label: 'Reference Spec', beforeVal: base.reference, afterVal: r.reference });
        if (r.excelRow !== base.excelRow) fieldChanges.push({ field: 'excelRow', label: 'Excel Row', beforeVal: base.excelRow, afterVal: r.excelRow });

        // AST Predicate diff
        const p1 = JSON.stringify(r.predicate || {});
        const p2 = JSON.stringify(base.predicate || {});
        if (p1 !== p2) {
          fieldChanges.push({ field: 'predicate', label: 'Applicability Logic (AST)', beforeVal: base.predicate || 'Always Applicable', afterVal: r.predicate || 'Always Applicable' });
        }

        // Archive state
        if (!!r.isArchived !== !!base.isArchived) {
          dirtyIds.add(r.id);
          diffList.push({
            ruleId: r.id,
            semanticKey: r.semanticKey,
            category: r.category,
            changeType: r.isArchived ? 'archived' : 'unarchived',
            before: base,
            after: r
          });
        } else if (fieldChanges.length > 0) {
          dirtyIds.add(r.id);
          diffList.push({
            ruleId: r.id,
            semanticKey: r.semanticKey,
            category: r.category,
            changeType: 'modified',
            before: base,
            after: r,
            fieldChanges
          });
        }
      }
    });

    // A removed rule is a material change and must remain visible in the release diff.
    baselineRules.forEach(base => {
      if (!rules.some(rule => rule.id === base.id)) {
        dirtyIds.add(base.id);
        diffList.push({
          ruleId: base.id,
          semanticKey: base.semanticKey,
          category: base.category,
          changeType: 'deleted',
          before: base
        });
      }
    });

    return { dirtyRuleIds: dirtyIds, diffs: diffList };
  }, [rules, baselineMap]);

  // Warn on tab/window close if there are unsaved draft changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRuleIds.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyRuleIds.size]);

  const selectedRule = useMemo(() => {
    return rules.find(r => r.id === selectedRuleId) || rules[0] || null;
  }, [rules, selectedRuleId]);

  // Handler: Update current rule
  const handleUpdateRule = (updated: RuleDefinition, originalId?: string) => {
    if (originalId && updated.id !== originalId && rules.some(r => r.id === updated.id)) {
      showNotification(`Rule ID ${updated.id} is already in use.`, 'error');
      return;
    }
    if (rules.some(r => r.semanticKey === updated.semanticKey && r.id !== (originalId || updated.id))) {
      showNotification(`Semantic Key ${updated.semanticKey} is already in use.`, 'error');
      return;
    }
    setRules(prev => prev.map(r => (r.id === (originalId || updated.id) ? updated : r)));
    if (originalId && updated.id !== originalId) {
      setSelectedRuleId(updated.id);
    }
    if (validationErrors.length > 0) {
      setValidationErrors(prev => prev.filter(e => e.ruleId !== (originalId || updated.id)));
    }
  };

  // Handler: Add new rule
  const handleNewRule = () => {
    const cat = selectedCategory !== 'All' ? selectedCategory : 'Base';
    const prefix = cat.slice(0, 4).toUpperCase();

    // Find next available rule number in this category
    const catRules = rules.filter(r => r.category === cat);
    let nextNum = catRules.length + 1;
    let nextId = `${prefix}-${String(nextNum).padStart(2, '0')}`;
    while (rules.some(r => r.id === nextId)) {
      nextNum++;
      nextId = `${prefix}-${String(nextNum).padStart(2, '0')}`;
    }

    // Next excel row
    const maxRow = Math.max(...rules.map(r => r.excelRow || 0), 28);

    const newRule: RuleDefinition = {
      id: nextId,
      semanticKey: `${prefix}_NEW_VERIFICATION_CHECK`,
      scope: 'Skid',
      category: cat,
      order: catRules.length + 1,
      text: 'New verification check instruction...',
      reference: 'Standard Specification',
      excelRow: maxRow + 1,
      requiredFacts: [],
      allowNA: true,
      verificationMode: 'ManualCheckbox'
    };

    setRules(prev => [newRule, ...prev]);
    setSelectedRuleId(newRule.id);
    showNotification(`Created new rule ${newRule.id}`, 'info');
  };

  // Handler: Clone rule
  const handleCloneRule = (source: RuleDefinition) => {
    let cloneId = `${source.id}-COPY`;
    let count = 1;
    while (rules.some(r => r.id === cloneId)) {
      cloneId = `${source.id}-COPY${count++}`;
    }

    const cloned: RuleDefinition = {
      ...JSON.parse(JSON.stringify(source)),
      id: cloneId,
      semanticKey: `${source.semanticKey}_COPY`,
      text: `${source.text} (Copy)`
    };

    setRules(prev => [cloned, ...prev]);
    setSelectedRuleId(cloned.id);
    showNotification(`Cloned rule as ${cloned.id}`, 'info');
  };

  // Handler: Archive/Restore rule
  const handleToggleArchive = (ruleId: string) => {
    setRules(prev =>
      prev.map(r => (r.id === ruleId ? { ...r, isArchived: !r.isArchived } : r))
    );
    const target = rules.find(r => r.id === ruleId);
    showNotification(
      `${target?.isArchived ? 'Restored' : 'Archived'} rule ${ruleId}`,
      'info'
    );
  };

  // Handler: Reorder rules
  const handleReorder = (ruleId: string, direction: 'up' | 'down') => {
    const targetIndex = rules.findIndex(r => r.id === ruleId);
    if (targetIndex < 0) return;

    const targetCategory = rules[targetIndex].category;
    // Find all indices belonging to the same category
    const catIndices = rules
      .map((r, i) => (r.category === targetCategory ? i : -1))
      .filter(i => i >= 0);

    const posInCat = catIndices.indexOf(targetIndex);
    if (posInCat < 0) return;

    if (direction === 'up' && posInCat > 0) {
      const swapIndex = catIndices[posInCat - 1];
      const newRules = [...rules];
      const temp = newRules[targetIndex];
      newRules[targetIndex] = newRules[swapIndex];
      newRules[swapIndex] = temp;
      setRules(newRules);
    } else if (direction === 'down' && posInCat < catIndices.length - 1) {
      const swapIndex = catIndices[posInCat + 1];
      const newRules = [...rules];
      const temp = newRules[targetIndex];
      newRules[targetIndex] = newRules[swapIndex];
      newRules[swapIndex] = temp;
      setRules(newRules);
    }
  };

  // Handler: Delete rule permanently
  const handleDeleteRule = (ruleId: string) => {
    const target = rules.find(r => r.id === ruleId);
    if (!target) return;

    setRules(prev => prev.filter(r => r.id !== ruleId));
    if (target.semanticKey && templateMap?.ruleCellMappings?.[target.semanticKey]) {
      setTemplateMap(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (copy.ruleCellMappings) {
          delete copy.ruleCellMappings[target.semanticKey];
        }
        return copy;
      });
    }
    setValidationErrors(prev => prev.filter(e => e.ruleId !== ruleId));
    if (selectedRuleId === ruleId) {
      const remaining = rules.filter(r => r.id !== ruleId);
      setSelectedRuleId(remaining[0]?.id || null);
    }
    showNotification(`Permanently deleted rule ${ruleId}`, 'info');
  };

  // Handler: Save Draft JSON via native SaveFileDialog
  const handleSaveDraft = async () => {
    try {
      const payload = {
        rules,
        templateMap,
        approvedMappings,
        manifest
      };
      const res = await desktopBridge.saveDraft(payload);
      if (res && res.success) {
        setValidationErrors([]);
        if (res.rules) {
          setRules(JSON.parse(JSON.stringify(res.rules)));
          setBaselineRules(JSON.parse(JSON.stringify(res.rules)));
        } else {
          setBaselineRules(JSON.parse(JSON.stringify(rules)));
        }
        if (res.templateMap) setTemplateMap(JSON.parse(JSON.stringify(res.templateMap)));
        const name = res.fileName || (res.filePath ? res.filePath.split(/[\\/]/).pop() : 'Draft.json');
        setActiveDraftName(name || 'Draft.json');
        showNotification(`Draft saved successfully to ${res.filePath || res.fileName || 'file'}!`, 'success');
      } else if (res && res.cancelled) {
        // User cancelled Save dialog
      } else {
        const errorList: FormValidationError[] = Array.isArray(res?.errors)
          ? res.errors.map((e: any) => typeof e === 'string' ? { message: e } : e)
          : [{ message: res?.error || 'Validation failed when saving draft.' }];
        setValidationErrors(errorList);
        const offending = errorList.find(e => e.ruleId);
        if (offending?.ruleId && rules.some(r => r.id === offending.ruleId)) {
          setSelectedRuleId(offending.ruleId);
        }
        showNotification(res?.error || 'Draft rejected due to validation errors. Please review highlighted fields.', 'error');
      }
    } catch (err: any) {
      showNotification(`Failed to save draft: ${err.message}`, 'error');
    }
  };

  // Handler: Open Draft JSON via native OpenFileDialog with unsaved changes guard
  const handleOpenDraft = async () => {
    if (dirtyRuleIds.size > 0) {
      const confirmed = window.confirm(
        `You have ${dirtyRuleIds.size} unsaved change${dirtyRuleIds.size > 1 ? 's' : ''} in your current draft. Discard these changes and open another draft?`
      );
      if (!confirmed) return;
    }

    try {
      const res = await desktopBridge.openDraft();
      if (res && res.cancelled) return;
      if (res && res.success && res.rules) {
        setRules(JSON.parse(JSON.stringify(res.rules)));
        setBaselineRules(JSON.parse(JSON.stringify(res.rules)));
        if (res.templateMap) setTemplateMap(JSON.parse(JSON.stringify(res.templateMap)));
        if (res.approvedMappings) setApprovedMappings(JSON.parse(JSON.stringify(res.approvedMappings)));
        if (res.manifest) setManifest(res.manifest);
        setValidationErrors([]);
        if (res.rules[0]?.id) setSelectedRuleId(res.rules[0].id);
        const name = res.fileName || (res.filePath ? res.filePath.split(/[\\/]/).pop() : 'Draft.json');
        setActiveDraftName(name || 'Draft.json');
        showNotification(`Draft opened successfully from ${res.filePath || res.fileName || 'file'}!`, 'success');
      } else {
        const errorList: FormValidationError[] = Array.isArray(res?.errors)
          ? res.errors.map((e: any) => typeof e === 'string' ? { message: e } : e)
          : [{ message: res?.error || 'Failed to open draft.' }];
        setValidationErrors(errorList);
        showNotification(res?.error || 'Failed to open draft.', 'error');
      }
    } catch (err: any) {
      showNotification(`Error opening draft: ${err.message}`, 'error');
    }
  };

  // Handler: Publish release
  const handlePublish = async (newVersion: string, releaseNotes: string, targetPath?: string) => {
    const normalizedVersion = newVersion.trim().replace(/^v/i, '');
    if (!RELEASE_VERSION_PATTERN.test(normalizedVersion)) {
      throw new Error(`Invalid release version '${newVersion}'. Use SemVer such as 1.2.3 or 1.2.3-rc1.`);
    }

    const payload = {
      version: normalizedVersion,
      rules,
      templateMap,
      approvedMappings,
      releaseNotes,
      targetPath
    };

    const res = await desktopBridge.publishRulePack(payload);
    if (res && res.success === false) {
      if (Array.isArray(res.errors)) {
        const errorList: FormValidationError[] = res.errors.map((e: any) =>
          typeof e === 'string' ? { message: e } : e
        );
        setValidationErrors(errorList);
        const offending = errorList.find(e => e.ruleId);
        if (offending?.ruleId && rules.some(r => r.id === offending.ruleId)) {
          setSelectedRuleId(offending.ruleId);
        }
      }
      throw new Error(res.error || 'Desktop publish failed');
    }

    // Read the pack back through the native bridge. This verifies the editor
    // is showing the bundle that was actually promoted to the active path.
    const reloaded = await desktopBridge.getRulePack();
    if (!reloaded?.rules || !reloaded.templateMap || !reloaded.manifest) {
      throw new Error('Native publish completed without a readable published Rule Pack.');
    }

    setRules(JSON.parse(JSON.stringify(reloaded.rules)));
    setBaselineRules(JSON.parse(JSON.stringify(reloaded.rules)));
    setTemplateMap(JSON.parse(JSON.stringify(reloaded.templateMap)));
    if (reloaded.approvedMappings) setApprovedMappings(JSON.parse(JSON.stringify(reloaded.approvedMappings)));
    setManifest(reloaded.manifest);
    setValidationErrors([]);
    if (reloaded.rules[0]?.id) setSelectedRuleId(reloaded.rules[0].id);
    setActiveDraftName(null);

    showNotification(`Successfully published and reloaded Rule Pack v${normalizedVersion}!`, 'success');
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="p-6 bg-red-950/60 border border-red-800 rounded-2xl max-w-lg mb-4 text-red-200 shadow-2xl space-y-2">
          <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
          <h2 className="text-lg font-bold text-white">Rule Pack Unavailable</h2>
          <p className="text-xs text-red-300 font-mono break-all leading-relaxed">{loadError}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center gap-2 text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry Connection
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 select-none">
        <RefreshCw className="w-6 h-6 animate-spin mb-3 text-amber-400" />
        <p className="text-xs font-medium">Loading active Rule Pack from desktop host...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        version={manifest.version}
        dirtyCount={dirtyRuleIds.size}
        draftName={activeDraftName}
        onOpenPublish={() => setIsPublishModalOpen(true)}
        onSaveDraft={handleSaveDraft}
        onOpenDraft={handleOpenDraft}
      />

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 border transition-all ${
            notification.type === 'error'
              ? 'bg-red-950 border-red-800 text-red-200'
              : notification.type === 'info'
              ? 'bg-blue-950 border-blue-800 text-blue-200'
              : 'bg-emerald-950 border-emerald-800 text-emerald-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rules Explorer (360px) */}
        <div className="w-[360px] flex-shrink-0 h-full">
          <RuleListView
            rules={rules}
            selectedRuleId={selectedRuleId}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            selectedScope={selectedScope}
            statusFilter={statusFilter}
            dirtyRuleIds={dirtyRuleIds}
            onSelectRule={setSelectedRuleId}
            onNewRule={handleNewRule}
            onSearchChange={setSearchQuery}
            onCategoryChange={setSelectedCategory}
            onScopeChange={setSelectedScope}
            onStatusFilterChange={setStatusFilter}
            onReorder={handleReorder}
            onClone={handleCloneRule}
            onToggleArchive={handleToggleArchive}
            onDeleteRule={handleDeleteRule}
          />
        </div>

        {/* Right Editor & Sandbox Panel */}
        <div className="flex-1 h-full p-4 overflow-hidden bg-slate-950">
          {selectedRule ? (
            <RuleFormView
              key={selectedRule.id}
              rule={selectedRule}
              onUpdate={handleUpdateRule}
              onClone={handleCloneRule}
              onToggleArchive={handleToggleArchive}
              onDeleteRule={handleDeleteRule}
              validationErrors={validationErrors}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              Select a rule from the left panel or click "New" to create one.
            </div>
          )}
        </div>
      </div>

      {/* Publish Release Modal */}
      <PublishModal
        isOpen={isPublishModalOpen}
        currentVersion={manifest.version}
        diffs={diffs}
        defaultPublishPath={defaultPublishPath}
        onClose={() => setIsPublishModalOpen(false)}
        onPublish={handlePublish}
      />
    </div>
  );
};

export const RuleEditorApp: React.FC = () => {
  if (!desktopBridge.isDesktopHost()) {
    return <DesktopHostRequiredScreen />;
  }

  return <RuleEditorAppContent />;
};
