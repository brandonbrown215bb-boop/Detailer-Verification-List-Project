import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Code2, Layers, AlertCircle, HelpCircle } from 'lucide-react';
import { VisualConditionGroup, VisualConditionLeaf, VisualConditionNode, ComparisonOperator } from '../types';
import { FACT_DICTIONARY, getFactDefinition, getFactsByScope } from './FactDictionaryCatalog';
import { generateNodeId, visualTreeToAst, astToVisualTree } from '../services/astConverter';
import { ASTPredicate, RuleScope } from '../../types';

interface VisualConditionBuilderProps {
  predicate: ASTPredicate | undefined;
  scope: RuleScope;
  onChange: (predicate: ASTPredicate | undefined, requiredFacts: string[]) => void;
}

export const VisualConditionBuilder: React.FC<VisualConditionBuilderProps> = ({
  predicate,
  scope,
  onChange
}) => {
  const [tree, setTree] = useState<VisualConditionGroup>(() => astToVisualTree(predicate));
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [jsonString, setJsonString] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const lastEmittedAstJsonRef = React.useRef<string>(predicate ? JSON.stringify(predicate) : '');

  // Sync internal tree when incoming predicate changes from external source (like selecting a different rule)
  useEffect(() => {
    const incomingJson = predicate ? JSON.stringify(predicate) : '';
    if (incomingJson !== lastEmittedAstJsonRef.current) {
      lastEmittedAstJsonRef.current = incomingJson;
      const newTree = astToVisualTree(predicate);
      setTree(newTree);
      setJsonString(predicate ? JSON.stringify(predicate, null, 2) : '{\n  // Standard check (Always applicable)\n}');
    }
  }, [predicate]);

  const availableFacts = getFactsByScope(scope);

  const notifyChange = (updatedTree: VisualConditionGroup) => {
    setTree(updatedTree);
    const ast = visualTreeToAst(updatedTree);
    const astJson = ast ? JSON.stringify(ast) : '';
    lastEmittedAstJsonRef.current = astJson;
    setJsonString(ast ? JSON.stringify(ast, null, 2) : '{\n  // Standard check (Always applicable)\n}');
    setJsonError(null);

    // Collect required facts
    const facts = new Set<string>();
    function collect(node: VisualConditionNode) {
      if (node.type === 'condition' && node.factKey?.trim()) {
        facts.add(node.factKey.trim());
      } else if (node.type === 'group') {
        node.children.forEach(collect);
      }
    }
    collect(updatedTree);

    onChange(ast, Array.from(facts));
  };

  const handleAddCondition = (groupId: string) => {
    const defaultFact = availableFacts[0]?.key || 'unit.shellType';
    const factDef = getFactDefinition(defaultFact);
    const defaultVal = factDef?.sampleValue ?? 'ThermalBreak';

    const newLeaf: VisualConditionLeaf = {
      type: 'condition',
      id: generateNodeId(),
      factKey: defaultFact,
      operator: '===',
      value: defaultVal
    };

    const updateGroup = (group: VisualConditionGroup): VisualConditionGroup => {
      if (group.id === groupId) {
        return { ...group, children: [...group.children, newLeaf] };
      }
      return {
        ...group,
        children: group.children.map(child =>
          child.type === 'group' ? updateGroup(child) : child
        )
      };
    };

    notifyChange(updateGroup(tree));
  };

  const handleAddSubGroup = (groupId: string) => {
    const defaultFact = availableFacts[0]?.key || 'unit.shellType';
    const factDef = getFactDefinition(defaultFact);
    const defaultVal = factDef?.sampleValue ?? 'ThermalBreak';

    const newGroup: VisualConditionGroup = {
      type: 'group',
      id: generateNodeId(),
      logicalOperator: 'and',
      children: [
        {
          type: 'condition',
          id: generateNodeId(),
          factKey: defaultFact,
          operator: '===',
          value: defaultVal
        }
      ]
    };

    const updateGroup = (group: VisualConditionGroup): VisualConditionGroup => {
      if (group.id === groupId) {
        return { ...group, children: [...group.children, newGroup] };
      }
      return {
        ...group,
        children: group.children.map(child =>
          child.type === 'group' ? updateGroup(child) : child
        )
      };
    };

    notifyChange(updateGroup(tree));
  };

  const handleRemoveNode = (nodeId: string) => {
    const remove = (group: VisualConditionGroup): VisualConditionGroup => {
      return {
        ...group,
        children: group.children
          .filter(c => c.id !== nodeId)
          .map(child => (child.type === 'group' ? remove(child) : child))
      };
    };

    notifyChange(remove(tree));
  };

  const handleUpdateCondition = (leafId: string, updates: Partial<VisualConditionLeaf>) => {
    const updateLeaf = (group: VisualConditionGroup): VisualConditionGroup => {
      return {
        ...group,
        children: group.children.map(child => {
          if (child.type === 'condition' && child.id === leafId) {
            const updated = { ...child, ...updates };
            // If factKey changed, adjust default operator and value to fit fact type
            if (updates.factKey && updates.factKey !== child.factKey) {
              const def = getFactDefinition(updates.factKey);
              if (def?.dataType === 'boolean') {
                updated.operator = 'is_true';
                updated.value = true;
              } else if (def?.dataType === 'number') {
                updated.operator = '>';
                updated.value = def.sampleValue ?? 0;
              } else if (def?.dataType === 'enum') {
                updated.operator = '===';
                updated.value = def.enumOptions?.[0]?.value ?? '';
              } else {
                updated.operator = 'includes';
                updated.value = '';
              }
            }
            return updated;
          }
          if (child.type === 'group') {
            return updateLeaf(child);
          }
          return child;
        })
      };
    };

    notifyChange(updateLeaf(tree));
  };

  const handleUpdateGroupOperator = (groupId: string, op: 'and' | 'or') => {
    const update = (group: VisualConditionGroup): VisualConditionGroup => {
      if (group.id === groupId) {
        return { ...group, logicalOperator: op };
      }
      return {
        ...group,
        children: group.children.map(child =>
          child.type === 'group' ? update(child) : child
        )
      };
    };

    notifyChange(update(tree));
  };

  const handleJsonApply = (text: string) => {
    setJsonString(text);
    if (!text.trim() || text.includes('Standard check')) {
      setJsonError(null);
      const emptyTree: VisualConditionGroup = { type: 'group', id: generateNodeId(), logicalOperator: 'and', children: [] };
      setTree(emptyTree);
      lastEmittedAstJsonRef.current = '';
      onChange(undefined, []);
      return;
    }

    try {
      const parsed = JSON.parse(text);
      const newTree = astToVisualTree(parsed);
      setTree(newTree);
      setJsonError(null);
      lastEmittedAstJsonRef.current = JSON.stringify(parsed);

      const facts = new Set<string>();
      function collect(node: VisualConditionNode) {
        if (node.type === 'condition' && node.factKey?.trim()) {
          facts.add(node.factKey.trim());
        } else if (node.type === 'group') {
          node.children.forEach(collect);
        }
      }
      collect(newTree);

      onChange(parsed, Array.from(facts));
    } catch (e: any) {
      setJsonError(`JSON Syntax Error: ${e.message}`);
    }
  };

  // Render recursive condition group
  const renderGroup = (group: VisualConditionGroup, isRoot = false) => {
    return (
      <div
        key={group.id}
        className={`p-3 rounded-lg border ${
          isRoot
            ? 'bg-slate-900/60 border-slate-700/70 shadow-sm'
            : 'bg-slate-800/80 border-slate-700 ml-4 my-2'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Match
            </span>
            <div className="inline-flex rounded-md bg-slate-950 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => handleUpdateGroupOperator(group.id, 'and')}
                className={`px-2.5 py-1 text-xs font-semibold rounded ${
                  group.logicalOperator === 'and'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ALL (AND)
              </button>
              <button
                type="button"
                onClick={() => handleUpdateGroupOperator(group.id, 'or')}
                className={`px-2.5 py-1 text-xs font-semibold rounded ${
                  group.logicalOperator === 'or'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ANY (OR)
              </button>
            </div>
            <span className="text-xs text-slate-400">of the following conditions:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAddCondition(group.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-300 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Condition
            </button>
            <button
              type="button"
              onClick={() => handleAddSubGroup(group.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              Add Nested Group
            </button>
            {!isRoot && (
              <button
                type="button"
                onClick={() => handleRemoveNode(group.id)}
                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
                title="Remove group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {group.children.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded border border-dashed border-slate-800">
            {isRoot ? (
              <>
                No conditions in this group. Rule is <strong className="text-emerald-400">Always Applicable (Standard Check)</strong>.
              </>
            ) : (
              <>
                No conditions in this nested group. Click <strong className="text-blue-400">+ Add Condition</strong> above or remove this group.
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {group.children.map(child => {
              if (child.type === 'condition') {
                return renderLeaf(child);
              } else {
                return renderGroup(child, false);
              }
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLeaf = (leaf: VisualConditionLeaf) => {
    const factDef = getFactDefinition(leaf.factKey);
    const dataType = factDef?.dataType || 'string';

    return (
      <div
        key={leaf.id}
        className="flex flex-wrap items-center gap-2 p-2 rounded bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
      >
        {/* Fact Selector */}
        <div className="flex-1 min-w-[200px]">
          <select
            value={leaf.factKey}
            onChange={e => handleUpdateCondition(leaf.id, { factKey: e.target.value })}
            className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            {availableFacts.map(fact => (
              <option key={fact.key} value={fact.key}>
                {fact.label} ({fact.key})
              </option>
            ))}
            {/* If the rule had a custom key not in dictionary, show it */}
            {!availableFacts.some(f => f.key === leaf.factKey) && (
              <option value={leaf.factKey}>Custom: {leaf.factKey}</option>
            )}
          </select>
        </div>

        {/* Operator Selector */}
        <div className="w-[140px]">
          <select
            value={leaf.operator}
            onChange={e => handleUpdateCondition(leaf.id, { operator: e.target.value as ComparisonOperator })}
            className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            {dataType === 'boolean' ? (
              <>
                <option value="is_true">is True</option>
                <option value="is_false">is False</option>
                <option value="is_defined">is Defined</option>
              </>
            ) : dataType === 'number' ? (
              <>
                <option value=">">greater than (&gt;)</option>
                <option value=">=">greater or equal (&gt;=)</option>
                <option value="<">less than (&lt;)</option>
                <option value="<=">less or equal (&lt;=)</option>
                <option value="===">equals (===)</option>
                <option value="!==">not equal (!==)</option>
              </>
            ) : (
              <>
                <option value="===">equals (===)</option>
                <option value="!==">not equal (!==)</option>
                <option value="includes">contains text</option>
                <option value="in">is one of (list)</option>
              </>
            )}
          </select>
        </div>

        {/* Value Input */}
        <div className="flex-1 min-w-[150px]">
          {leaf.operator === 'is_true' || leaf.operator === 'is_false' || leaf.operator === 'is_defined' ? (
            <div className="text-xs text-slate-400 italic px-2 py-1 bg-slate-900/50 rounded border border-slate-800">
              No comparison value needed
            </div>
          ) : factDef?.dataType === 'enum' && leaf.operator === '===' ? (
            <select
              value={leaf.value}
              onChange={e => handleUpdateCondition(leaf.id, { value: e.target.value })}
              className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {factDef.enumOptions?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : dataType === 'number' ? (
            <div className="relative">
              <input
                type="number"
                step="any"
                value={leaf.value ?? ''}
                onChange={e => handleUpdateCondition(leaf.id, { value: parseFloat(e.target.value) || 0 })}
                placeholder="Value..."
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              {factDef?.unit && (
                <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-medium pointer-events-none">
                  {factDef.unit}
                </span>
              )}
            </div>
          ) : leaf.operator === 'in' ? (
            <input
              type="text"
              value={Array.isArray(leaf.value) ? leaf.value.join(', ') : leaf.value ?? ''}
              onChange={e => handleUpdateCondition(leaf.id, { value: e.target.value })}
              placeholder="Comma separated values (e.g. FS, FR, FE)..."
              className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          ) : (
            <input
              type="text"
              value={leaf.value ?? ''}
              onChange={e => handleUpdateCondition(leaf.id, { value: e.target.value })}
              placeholder="Target value..."
              className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          )}
        </div>

        {/* Delete Button */}
        <button
          type="button"
          onClick={() => handleRemoveNode(leaf.id)}
          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors"
          title="Delete condition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header controls: Visual vs JSON */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-300">
            Applicability Predicate Logic
          </label>
          <span className="text-[11px] text-slate-500">
            (Determines when this rule is Applicable vs Not Applicable)
          </span>
        </div>

        <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'visual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            Visual Builder
          </button>
          <button
            type="button"
            onClick={() => {
              const ast = visualTreeToAst(tree);
              setJsonString(ast ? JSON.stringify(ast, null, 2) : '{\n  // Standard check (Always applicable)\n}');
              setViewMode('json');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'json'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            JSON AST
          </button>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div>{renderGroup(tree, true)}</div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <textarea
              rows={8}
              value={jsonString}
              onChange={e => handleJsonApply(e.target.value)}
              className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              placeholder="Paste AST JSON predicate here..."
            />
          </div>
          {jsonError && (
            <div className="flex items-center gap-2 p-2 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{jsonError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
