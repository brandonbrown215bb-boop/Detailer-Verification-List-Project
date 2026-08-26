import React from 'react';
import { RuleDefinition, RuleScope } from '../../types';
import { VisualConditionBuilder } from './VisualConditionBuilder';
import { RuleTestSandbox } from './RuleTestSandbox';
import { Archive, Copy, Sparkles, BookOpen, FileSpreadsheet, ShieldAlert, CheckSquare } from 'lucide-react';

interface RuleFormViewProps {
  rule: RuleDefinition;
  isNew?: boolean;
  onUpdate: (updated: RuleDefinition) => void;
  onClone: (rule: RuleDefinition) => void;
  onToggleArchive: (ruleId: string) => void;
}

export const RuleFormView: React.FC<RuleFormViewProps> = ({
  rule,
  isNew = false,
  onUpdate,
  onClone,
  onToggleArchive
}) => {
  const categories = [
    'Base',
    'Housing',
    'Drain Pan',
    'Coil Panels',
    'Internal',
    'Reconnects',
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
    onUpdate({ ...rule, semanticKey: autoKey });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
      {/* Main Form (Left 2 cols) */}
      <div className="xl:col-span-2 space-y-6 overflow-y-auto pr-2">
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
                  onChange={e => onUpdate({ ...rule, id: e.target.value.toUpperCase() })}
                  className="text-base font-bold text-slate-100 bg-slate-950 border border-slate-700 rounded px-2.5 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                  placeholder="RULE-ID"
                />
                {rule.isArchived && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800 rounded">
                    Archived
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Category: <strong className="text-slate-200">{rule.category}</strong> • Scope:{' '}
                <strong className="text-slate-200">{rule.scope}</strong>
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
          </div>
        </div>

        {/* Core Metadata Grid */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Rule Metadata & Classification
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Category
              </label>
              <select
                value={rule.category}
                onChange={e => onUpdate({ ...rule, category: e.target.value })}
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subgroup (for Internals) */}
            {rule.category === 'Internal' ? (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Internal Subgroup
                </label>
                <select
                  value={rule.subgroup || 'Access Segments'}
                  onChange={e => onUpdate({ ...rule, subgroup: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {internalSubgroups.map(sub => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Scope
                </label>
                <select
                  value={rule.scope}
                  onChange={e => onUpdate({ ...rule, scope: e.target.value as RuleScope })}
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Unit">Unit (Global)</option>
                  <option value="Skid">Skid (Per Shipping Section)</option>
                  <option value="Segment">Segment (Per AHU Segment)</option>
                  <option value="Component">Component (Per Fan/Coil/VFD)</option>
                </select>
              </div>
            )}

            {/* Verification Mode */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Verification Mode
              </label>
              <select
                value={rule.verificationMode}
                onChange={e => onUpdate({ ...rule, verificationMode: e.target.value as any })}
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ManualCheckbox">Manual Checkbox</option>
                <option value="MeasurementVerify">Measurement Verify</option>
                <option value="AutoEvaluated">Auto Evaluated</option>
              </select>
            </div>

            {/* Allow NA */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Allow N/A Toggle
              </label>
              <select
                value={rule.allowNA ? 'true' : 'false'}
                onChange={e => onUpdate({ ...rule, allowNA: e.target.value === 'true' })}
                className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="true">Allowed (Detailer can mark NA)</option>
                <option value="false">Required (Must be checked Pass/Fail)</option>
              </select>
            </div>
          </div>

          {/* Semantic Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-400">
                Semantic Key <span className="text-[10px] text-slate-500">(Decoupled identifier for Excel map)</span>
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
              type="text"
              value={rule.semanticKey}
              onChange={e => onUpdate({ ...rule, semanticKey: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="CATEGORY_FEATURE_NAME"
            />
          </div>

          {/* Rule Text */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Checklist Instruction Text
            </label>
            <textarea
              rows={3}
              value={rule.text}
              onChange={e => onUpdate({ ...rule, text: e.target.value })}
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
              placeholder="Enter clear, actionable verification instructions for the detailer..."
            />
          </div>

          {/* Reference Spec Document */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              Standard Reference / Specification Document
            </label>
            <input
              type="text"
              value={rule.reference || ''}
              onChange={e => onUpdate({ ...rule, reference: e.target.value })}
              className="w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. ASSY Manual p.391-40206-003, Standard Assembly Spec Sec 4.2"
            />
          </div>
        </div>

        {/* Visual Condition Builder (AST) */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <VisualConditionBuilder
            predicate={rule.predicate}
            scope={rule.scope}
            onChange={(predicate, requiredFacts) => {
              onUpdate({
                ...rule,
                predicate,
                requiredFacts
              });
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
