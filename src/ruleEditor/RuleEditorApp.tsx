import React, { useState, useEffect, useMemo } from 'react';
import { RuleDefinition, TemplateMap, RulePackManifest } from '../types';
import { RuleDiffItem, RuleChangeType } from './types';
import { Header } from './components/Header';
import { RuleListView } from './components/RuleListView';
import { RuleFormView } from './components/RuleFormView';
import { PublishModal } from './components/PublishModal';
import { desktopBridge } from '../services/desktopBridge';
import { normalizeRuleDefinition, validateRulePackData } from '../services/factContract';

// Baseline fallback rule pack imports for web / development
import initialRules from '../../resources/rulepack/rules.json';
import initialTemplateMap from '../../resources/rulepack/template_map.json';
import initialApprovedMappings from '../../resources/rulepack/approved_mappings.json';
import initialManifest from '../../resources/rulepack/manifest.json';

const EDITOR_SCOPES = new Set(['Unit', 'Skid']);
const EDITOR_MODES = new Set(['ManualCheckbox']);
const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function validateEditorRuleSupport(ruleSet: RuleDefinition[]): void {
  const unsupported = ruleSet.filter(rule => !EDITOR_SCOPES.has(rule.scope) || !EDITOR_MODES.has(rule.verificationMode));
  if (unsupported.length > 0) {
    const details = unsupported.map(rule => `${rule.id} (${rule.scope}/${rule.verificationMode})`).join(', ');
    throw new Error(`Rule Editor cannot publish unsupported scope or verification mode: ${details}.`);
  }
}

export const RuleEditorApp: React.FC = () => {
  const [baselineRules, setBaselineRules] = useState<RuleDefinition[]>(() => initialRules as RuleDefinition[]);
  const [rules, setRules] = useState<RuleDefinition[]>(() => initialRules as RuleDefinition[]);
  const [templateMap, setTemplateMap] = useState<TemplateMap>(() => initialTemplateMap as any);
  const [approvedMappings, setApprovedMappings] = useState<any>(() => initialApprovedMappings as any);
  const [manifest, setManifest] = useState<RulePackManifest>(() => initialManifest as RulePackManifest);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(() => rules[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedScope, setSelectedScope] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived' | 'modified'>('all');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Load from Desktop IPC bridge if available
  useEffect(() => {
    async function loadFromHost() {
      try {
        const pack = await desktopBridge.getRulePack();
        if (pack && pack.rules && pack.rules.length > 0) {
          setBaselineRules(JSON.parse(JSON.stringify(pack.rules)));
          setRules(JSON.parse(JSON.stringify(pack.rules)));
          if (pack.templateMap) setTemplateMap(pack.templateMap);
          if (pack.approvedMappings) setApprovedMappings(JSON.parse(JSON.stringify(pack.approvedMappings)));
          if (pack.manifest) setManifest(pack.manifest);
          if (pack.rules[0]?.id) setSelectedRuleId(pack.rules[0].id);
        }
      } catch (e) {
        console.warn('Native desktop bridge unavailable, using local rule pack assets.', e);
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

  // Handler: Export Draft JSON
  const handleExportJson = () => {
    const dataStr = JSON.stringify({
      rules,
      templateMap,
      approvedMappings,
      manifest
    }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rules_draft_v${manifest.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported rules draft as JSON', 'success');
  };

  // Handler: Import Draft JSON
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        const importedRules = Array.isArray(imported) ? imported : imported?.rules;
        if (!Array.isArray(importedRules)) throw new Error('expected an array of rule definitions or a rule-pack draft object');
        const normalizedRules = importedRules.map((rule: RuleDefinition) => normalizeRuleDefinition(rule));
        const importedMap = Array.isArray(imported) ? templateMap : imported.templateMap;
        if (!importedMap || typeof importedMap !== 'object') throw new Error('templateMap is required for a canonical rule-pack draft');
        validateRulePackData(normalizedRules, importedMap);
        validateEditorRuleSupport(normalizedRules);
        setRules(JSON.parse(JSON.stringify(normalizedRules)));
        if (!Array.isArray(imported) && imported.approvedMappings) {
          setApprovedMappings(JSON.parse(JSON.stringify(imported.approvedMappings)));
        }
        if (!Array.isArray(imported) && imported.manifest) setManifest(imported.manifest);
        if (!Array.isArray(imported)) setTemplateMap(JSON.parse(JSON.stringify(importedMap)));
        if (normalizedRules[0]?.id) setSelectedRuleId(normalizedRules[0].id);
        showNotification(`Successfully imported and validated ${normalizedRules.length} rules!`, 'success');
      } catch (err: any) {
        showNotification(`Failed to parse JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Handler: Publish release
  const handlePublish = async (newVersion: string, releaseNotes: string, targetPath?: string) => {
    const normalizedVersion = newVersion.trim().replace(/^v/i, '');
    if (!RELEASE_VERSION_PATTERN.test(normalizedVersion)) {
      throw new Error(`Invalid release version '${newVersion}'. Use SemVer such as 1.2.3 or 1.2.3-rc1.`);
    }
    validateEditorRuleSupport(rules);

    // 1. Synchronize templateMap with rule cell mappings
    const updatedTemplateMap: TemplateMap = JSON.parse(JSON.stringify(templateMap));
    const liveRuleKeys = new Set(rules.map(rule => rule.semanticKey));
    for (const key of Object.keys(updatedTemplateMap.ruleCellMappings || {})) {
      if (!liveRuleKeys.has(key)) delete updatedTemplateMap.ruleCellMappings[key];
    }
    rules.forEach(r => {
      if (r.excelRow) {
        const existing = updatedTemplateMap.ruleCellMappings[r.semanticKey];
        if (existing) {
          // Semantic keys are the stable Excel identity. An ID rename updates
          // the identity carried by the mapping without moving its cells.
          existing.ruleId = r.id;
        } else {
          updatedTemplateMap.ruleCellMappings[r.semanticKey] = {
            ruleId: r.id,
            row: r.excelRow,
            naCell: `S${r.excelRow}`,
            detailerCell: `T${r.excelRow}`,
            checkerCell: `V${r.excelRow}`,
            commentsCell: `Y${r.excelRow}`,
            initialsCell: `Z${r.excelRow}`
          };
        }
      }
    });
    validateRulePackData(rules, updatedTemplateMap);

    const payload = {
      version: normalizedVersion,
      rules,
      templateMap: updatedTemplateMap,
      approvedMappings,
      releaseNotes,
      targetPath
    };

    // If running in desktop host WebView2, use native bridge IPC
    if (desktopBridge.isRunningInDesktop()) {
      const res = await desktopBridge.publishRulePack(payload);
      if (res && (res as any).success === false) {
        throw new Error((res as any).error || 'Desktop publish failed');
      }
      // Read the pack back through the native bridge. This verifies the editor
      // is showing the bundle that was actually promoted to the active path.
      const reloaded = await desktopBridge.getRulePack();
      if (!reloaded?.rules || !reloaded.templateMap || !reloaded.manifest) {
        throw new Error('Native publish completed without a readable published Rule Pack.');
      }
      const reloadedRules = reloaded.rules.map((rule: RuleDefinition) => normalizeRuleDefinition(rule));
      validateRulePackData(reloadedRules, reloaded.templateMap);
      validateEditorRuleSupport(reloadedRules);
      setRules(JSON.parse(JSON.stringify(reloadedRules)));
      setBaselineRules(JSON.parse(JSON.stringify(reloadedRules)));
      setTemplateMap(JSON.parse(JSON.stringify(reloaded.templateMap)));
      if (reloaded.approvedMappings) setApprovedMappings(JSON.parse(JSON.stringify(reloaded.approvedMappings)));
      setManifest(reloaded.manifest);
      if (reloadedRules[0]?.id) setSelectedRuleId(reloadedRules[0].id);
    } else {
      showNotification('Native Rule Pack publishing is unavailable in browser preview. Downloading a validated draft JSON instead.', 'info');
      handleExportJson();
      setIsPublishModalOpen(false);
      return;
    }

    showNotification(`Successfully published and reloaded Rule Pack v${normalizedVersion}!`, 'success');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        version={manifest.version}
        dirtyCount={dirtyRuleIds.size}
        onOpenPublish={() => setIsPublishModalOpen(true)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
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
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
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
        onClose={() => setIsPublishModalOpen(false)}
        onPublish={handlePublish}
      />
    </div>
  );
};
