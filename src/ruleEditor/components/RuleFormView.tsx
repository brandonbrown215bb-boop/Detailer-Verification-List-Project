import React from 'react';
import { RuleDefinition, RuleScope } from '../../types';
import { VisualConditionBuilder } from './VisualConditionBuilder';
import { RuleTestSandbox } from './RuleTestSandbox';
import { Archive, Copy, Sparkles, BookOpen, CheckSquare, Trash2, AlertTriangle } from 'lucide-react';

export interface FormValidationError {
  ruleId?: string;
  field?: string;
  message: string;
}

interface RuleFormViewProps {
  rule: RuleDefinition;
  isNew?: boolean;
  onUpdate: (updated: RuleDefinition, originalId?: string) => void;
  onClone: (rule: RuleDefinition) => void;
  onToggleArchive: (ruleId: string) => void;
  onDeleteRule?: (ruleId: string) => void;
  validationErrors?: FormValidationError[];
}

export const RuleFormView: React.FC<RuleFormViewProps> = ({
  rule,
  isNew = false,
  onUpdate,
  onClone,
  onToggleArchive,
  onDeleteRule,
  validationErrors
}) => {
  const categories = [
    'Base',
    'Housing',
    'Internals',
    'Knockdown',
    'UTL',
    'Paperwork',
    'MOM'
  ];

  const internalSubgroups = [
    'Fan Segments',
    'Coil Segments',
    'Filter Segments',
    'Access Segments',
    'Damper Segments',
    'Reconnects'
  ];

  // Helper to auto-generate a clean semanticKey from Category and Title
  const handleAutoGenerateKey = () => {
    const cleanCategory = rule.category.toUpperCase().replace(/\s+/g, '_');
    const words = rule.text
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .toUpperCase()
      .split(/\s+/)
      .slice(0, 4)
      .join('_');
    const autoKey = `${cleanCategory}_${words || 'CHECK'}`;
    onUpdate({ ...rule, semanticKey: autoKey }, rule.id);
  };

  const isInternalCategory = rule.category === 'Internal' || rule.category === 'Internals';

  const getFieldError = (fieldName: string): string | null => {
    if (!validationErrors || validationErrors.length === 0) return null;
    const match = validationErrors.find(
      e => (!e.ruleId || e.ruleId === rule.id) && e.field === fieldName
    );
    return match ? match.message : null;
  };

  const idError = getFieldError('id');
  const semanticKeyError = getFieldError('semanticKey');
  const excelRowError = getFieldError('excelRow');
  const categoryError = getFieldError('category');
  const scopeError = getFieldError('scope');
  const verificationModeError = getFieldError('verificationMode');
  const textError = getFieldError('text');
  const predicateError = getFieldError('predicate') || getFieldError('requiredFacts');

  const generalRuleErrors = validationErrors?.filter(
    e => (!e.ruleId || e.ruleId === rule.id) && (!e.field || !['id', 'semanticKey', 'excelRow', 'category', 'scope', 'verificationMode', 'text', 'predicate', 'requiredFacts'].includes(e.field))
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      {/* Main Form (Left 2 cols) */}
      <div className="xl:col-span-2 space-y-6 overflow-y-auto pr-2">
        {/* General Rule Errors Banner */}
        {generalRuleErrors && generalRuleErrors.length > 0 && (
          <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl space-y-1">
            {generalRuleErrors.map((err, i) => (
              <p key={i} className="text-xs text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{err.message}</span>
              </p>
            ))}
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-950/80 border border-blue-800 rounded-lg text-blue-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rule.id}
                  onChange={e => onUpdate({ ...rule, id: e.target.value.toUpperCase() }, rule.id)}
                  className={`text-base font-bold text-slate-100 bg-slate-950 border rounded px-2.5 py-0.5 font-mono focus:outline-none focus:ring-1 w-36 ${
                    idError ? 'border-red-500 focus:ring-red-500 bg-red-950/30 ring-1 ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                  }`}
                  placeholder="RULE-ID"
                />
                {rule.isArchived && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800 rounded">
                    Archived
                  </span>
                )}
              </div>
              {idError && (
                <p className="text-[11px] text-red-400 font-normal mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {idError}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                Category: <strong className="text-slate-200">{rule.category}</strong>
                {rule.subgroup && (
                  <>
                    {' '}• Subgroup: <strong className="text-slate-200">{rule.subgroup}</strong>
                  </>
                )}
                {' '}• Scope: <strong className="text-slate-200">{rule.scope}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onClone(rule)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Clone Rule
            </button>
            <button
              type="button"
              onClick={() => onToggleArchive(rule.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                rule.isArchived
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800 hover:bg-emerald-900'
                  : 'text-amber-300 bg-amber-950/80 border-amber-800 hover:bg-amber-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              {rule.isArchived ? 'Restore Rule' : 'Archive Rule'}
            </button>
            {onDeleteRule && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to permanently delete rule "${rule.id}"? This will also remove its dynamic Excel cell mappings.`)) {
                    onDeleteRule(rule.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded-lg transition-colors"
                title="Permanently delete rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Rule
              </button>
            )}
          </div>
        </div>

        {/* Core Metadata Grid */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Rule Metadata & Classification
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Category
              </label>
              <select
                aria-label="Category"
                value={rule.category}
                onChange={e => onUpdate({ ...rule, category: e.target.value }, rule.id)}
                className={`w-full text-xs bg-slate-950 border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 ${
                  categoryError ? 'border-red-500 focus:ring-red-500 bg-red-950/30' : 'border-slate-700 focus:ring-blue-500'
                }`}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {categoryError && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {categoryError}
                </p>
              )}
            </div>

            {/* Subgroup (for Internals) */}
            {isInternalCategory && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Internal Subgroup
                </label>
                <select
                  aria-label="Internal Subgroup"
                  value={rule.subgroup || ''}
                  onChange={e => onUpdate({ ...rule, subgroup: e.target.value || undefined }, rule.id)}
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">(None / Global Internals)</option>
                  {internalSubgroups.map(sub => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scope */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Scope
              </label>
              <select
                aria-label="Scope"
                value={rule.scope}
                onChange={e => onUpdate({ ...rule, scope: e.target.value as RuleScope }, rule.id)}
                className={`w-full text-xs bg-slate-950 border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 ${
                  scopeError ? 'border-red-500 focus:ring-red-500 bg-red-950/30' : 'border-slate-700 focus:ring-blue-500'
                }`}
              >
                <option value="Unit">Unit (Global)</option>
                <option value="Skid">Skid (Per Shipping Section)</option>
              </select>
              {scopeError && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {scopeError}
                </p>
              )}
            </div>

            {/* Verification Mode */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Verification Mode
              </label>
              <select
                aria-label="Verification Mode"
                value={rule.verificationMode}
                onChange={e => onUpdate({ ...rule, verificationMode: e.target.value as any }, rule.id)}
                className={`w-full text-xs bg-slate-950 border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 ${
                  verificationModeError ? 'border-red-500 focus:ring-red-500 bg-red-950/30' : 'border-slate-700 focus:ring-blue-500'
                }`}
              >
                <option value="ManualCheckbox">Manual Checkbox</option>
              </select>
              {verificationModeError && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {verificationModeError}
                </p>
              )}
            </div>

            {/* Allow NA */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Allow N/A Toggle
              </label>
              <select
                aria-label="Allow N/A Toggle"
                value={rule.allowNA ? 'true' : 'false'}
                onChange={e => onUpdate({ ...rule, allowNA: e.target.value === 'true' }, rule.id)}
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="true">Allowed (Detailer can mark NA)</option>
                <option value="false">Required (Must be checked Pass/Fail)</option>
              </select>
            </div>

            {/* Excel Row */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Excel Row <span className="text-[10px] text-slate-400">(Dynamic Mapping)</span>
              </label>
              <input
                aria-label="Excel Row"
                type="number"
                min={1}
                value={rule.excelRow ?? ''}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  onUpdate({ ...rule, excelRow: isNaN(val) ? undefined : val }, rule.id);
                }}
                className={`w-full text-xs bg-slate-950 border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 ${
                  excelRowError ? 'border-red-500 focus:ring-red-500 bg-red-950/30 ring-1 ring-red-500' : 'border-slate-700 focus:ring-blue-500'
                }`}
                placeholder="e.g. 29"
              />
              {excelRowError && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {excelRowError}
                </p>
              )}
            </div>
          </div>

          {/* Semantic Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-400">
                Semantic Key <span className="text-[10px] text-slate-400">(Decoupled identifier for Excel map)</span>
              </label>
              <button
                type="button"
                onClick={handleAutoGenerateKey}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3 h-3" /> Auto-Generate Key
              </button>
            </div>
            <input
              aria-label="Semantic Key"
              type="text"
              value={rule.semanticKey}
              onChange={e => onUpdate({ ...rule, semanticKey: e.target.value.toUpperCase().replace(/\s+/g, '_') }, rule.id)}
              className={`w-full text-xs font-mono bg-slate-950 border rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 ${
                semanticKeyError ? 'border-red-500 focus:ring-red-500 bg-red-950/30 ring-1 ring-red-500' : 'border-slate-700 focus:ring-blue-500'
              }`}
              placeholder="CATEGORY_FEATURE_NAME"
            />
            {semanticKeyError && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {semanticKeyError}
              </p>
            )}
          </div>

          {/* Rule Text */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Checklist Instruction Text
            </label>
            <textarea
              aria-label="Checklist Instruction Text"
              rows={3}
              value={rule.text}
              onChange={e => onUpdate({ ...rule, text: e.target.value }, rule.id)}
              className={`w-full text-xs bg-slate-950 border rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-1 leading-relaxed ${
                textError ? 'border-red-500 focus:ring-red-500 bg-red-950/30 ring-1 ring-red-500' : 'border-slate-700 focus:ring-blue-500'
              }`}
              placeholder="Enter clear, actionable verification instructions for the detailer..."
            />
            {textError && (
              <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {textError}
              </p>
            )}
          </div>

          {/* Reference Spec Document */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              Standard Reference / Specification Document
            </label>
            <input
              aria-label="Standard Reference / Specification Document"
              type="text"
              value={rule.reference || ''}
              onChange={e => onUpdate({ ...rule, reference: e.target.value }, rule.id)}
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. ASSY Manual p.391-40206-003, Standard Assembly Spec Sec 4.2"
            />
          </div>
        </div>

        {/* Visual Condition Builder (AST) */}
        <div className={`p-4 bg-slate-900 border rounded-xl ${predicateError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'}`}>
          {predicateError && (
            <div className="mb-3 p-2.5 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{predicateError}</span>
            </div>
          )}
          <VisualConditionBuilder
            predicate={rule.predicate}
            scope={rule.scope}
            onChange={(predicate, requiredFacts) => {
              onUpdate({
                ...rule,
                predicate,
                requiredFacts
              }, rule.id);
            }}
          />
        </div>
      </div>

      {/* Right Column: Live Simulation Sandbox */}
      <div className="xl:col-span-1 h-full">
        <RuleTestSandbox rule={rule} />
      </div>
    </div>
  );
};
