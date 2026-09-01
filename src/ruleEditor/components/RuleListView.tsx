import React from 'react';
import { RuleDefinition } from '../../types';
import { Search, Plus, ArrowUp, ArrowDown, Copy, Archive, CheckCircle2, SlidersHorizontal, Tag, Filter } from 'lucide-react';

interface RuleListViewProps {
  rules: RuleDefinition[];
  selectedRuleId: string | null;
  searchQuery: string;
  selectedCategory: string;
  selectedScope: string;
  statusFilter: 'all' | 'active' | 'archived' | 'modified';
  dirtyRuleIds: Set<string>;
  onSelectRule: (ruleId: string) => void;
  onNewRule: () => void;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onScopeChange: (scope: string) => void;
  onStatusFilterChange: (status: 'all' | 'active' | 'archived' | 'modified') => void;
  onReorder: (ruleId: string, direction: 'up' | 'down') => void;
  onClone: (rule: RuleDefinition) => void;
  onToggleArchive: (ruleId: string) => void;
}

export const RuleListView: React.FC<RuleListViewProps> = ({
  rules,
  selectedRuleId,
  searchQuery,
  selectedCategory,
  selectedScope,
  statusFilter,
  dirtyRuleIds,
  onSelectRule,
  onNewRule,
  onSearchChange,
  onCategoryChange,
  onScopeChange,
  onStatusFilterChange,
  onReorder,
  onClone,
  onToggleArchive
}) => {
  const categories = [
    'All',
    'Base',
    'Housing',
    'Internals',
    'Knockdown',
    'UTL',
    'Paperwork',
    'MOM',
    'Drain Pan',
    'Coil Panels',
    'Reconnects'
  ];

  const isCatMatch = (ruleCat: string, targetCat: string) => {
    if (targetCat === 'All') return true;
    if (targetCat === ruleCat) return true;
    if ((targetCat === 'Internals' || targetCat === 'Internal') && (ruleCat === 'Internals' || ruleCat === 'Internal')) return true;
    return false;
  };

  // Filter rules based on search, category, scope, and status
  const filteredRules = rules.filter(r => {
    if (selectedCategory !== 'All' && !isCatMatch(r.category, selectedCategory)) return false;
    if (selectedScope !== 'All' && r.scope !== selectedScope) return false;

    if (statusFilter === 'active' && r.isArchived) return false;
    if (statusFilter === 'archived' && !r.isArchived) return false;
    if (statusFilter === 'modified' && !dirtyRuleIds.has(r.id)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchText = r.text.toLowerCase().includes(q);
      const matchKey = r.semanticKey.toLowerCase().includes(q);
      const matchSub = (r.subgroup || '').toLowerCase().includes(q);
      const matchFacts = r.requiredFacts.some(f => f.toLowerCase().includes(q));
      if (!matchId && !matchText && !matchKey && !matchSub && !matchFacts) return false;
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Category Tabs */}
      <div className="p-3 border-b border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {categories.map(cat => {
            const count =
              cat === 'All'
                ? rules.filter(r => !r.isArchived).length
                : rules.filter(r => isCatMatch(r.category, cat) && !r.isArchived).length;
            const isSelected = selectedCategory === cat || (cat === 'Internals' && selectedCategory === 'Internal');

            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search by ID, text, key, or fact..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Scope Dropdown */}
          <select
            value={selectedScope}
            onChange={e => onScopeChange(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none"
          >
            <option value="All">All Scopes</option>
            <option value="Unit">Unit Scope</option>
            <option value="Skid">Skid Scope</option>
            <option value="Segment">Segment Scope</option>
            <option value="Component">Component Scope</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Rules</option>
            <option value="active">Active Only</option>
            <option value="archived">Archived Only</option>
            <option value="modified">Modified ({dirtyRuleIds.size})</option>
          </select>

          {/* New Rule Button */}
          <button
            type="button"
            onClick={onNewRule}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      {/* Rule Count Summary */}
      <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Showing {filteredRules.length} of {rules.length} rules</span>
        {dirtyRuleIds.size > 0 && (
          <span className="text-amber-400 font-medium">
            {dirtyRuleIds.size} uncommitted change{dirtyRuleIds.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Rules Scrollable List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredRules.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No rules match the current filters.
          </div>
        ) : (
          filteredRules.map((rule, idx) => {
            const isSelected = selectedRuleId === rule.id;
            const isDirty = dirtyRuleIds.has(rule.id);
            const hasPredicate = !!rule.predicate && Object.keys(rule.predicate).length > 0;

            return (
              <div
                key={rule.id}
                onClick={() => onSelectRule(rule.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-950/40 border-blue-600 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                } ${rule.isArchived ? 'opacity-60 bg-slate-950/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {rule.id}
                    </span>
                    {isDirty && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Modified in draft" />
                    )}
                    {rule.isArchived && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-amber-950 text-amber-400 border border-amber-800 rounded">
                        Archived
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {rule.subgroup && (
                      <span className="text-[10px] font-medium px-1.5 py-0.2 bg-blue-950/80 text-blue-300 border border-blue-800/60 rounded truncate max-w-[110px]">
                        {rule.subgroup}
                      </span>
                    )}
                    <span className="text-[10px] font-medium px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">
                      {rule.scope}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-2">
                  {rule.text}
                </p>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400">
                  <span className="font-mono truncate max-w-[180px]">
                    {rule.semanticKey}
                  </span>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onReorder(rule.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30"
                      title="Move rule up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorder(rule.id, 'down')}
                      disabled={idx === filteredRules.length - 1}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30"
                      title="Move rule down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onClone(rule)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                      title="Clone rule"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleArchive(rule.id)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400"
                      title={rule.isArchived ? 'Restore rule' : 'Archive rule'}
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
