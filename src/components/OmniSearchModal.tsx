import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RuleDefinition, Fact, SpecialQuote, NormalizedXmlGraph } from '../types';
import { Search, X, Layers, Box, FileText, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RuleDefinition[];
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  graph: NormalizedXmlGraph | null;
  onNavigate: (tabId: string, ruleId?: string) => void;
}

interface FlattenedSearchItem {
  id: string;
  type: 'rule' | 'fact' | 'skid' | 'sq';
  onSelect: () => void;
}

export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  isOpen,
  onClose,
  rules,
  facts,
  sqItems,
  graph,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    initialFocusRef: inputRef,
    selectOnFocus: true,
    onEscape: onClose
  });

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const q = query.toLowerCase().trim();

  // Search Results Categorization
  const matchingRules = useMemo(() => {
    if (!q) return [];
    return rules
      .filter(
        r =>
          r.id.toLowerCase().includes(q) ||
          r.text.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.reference && r.reference.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [q, rules]);

  const matchingFacts = useMemo(() => {
    if (!q) return [];
    return Object.values(facts)
      .filter(
        f =>
          f.label.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q) ||
          (f.value !== null && String(f.value).toLowerCase().includes(q))
      )
      .slice(0, 4);
  }, [q, facts]);

  const matchingSkids = useMemo(() => {
    if (!q || !graph) return [];
    return graph.skids.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.segmentIds.some(sid => {
          const seg = graph.segments.find(sg => sg.id === sid);
          return seg && (seg.name.toLowerCase().includes(q) || seg.typeCode.toLowerCase().includes(q));
        })
    );
  }, [q, graph]);

  const matchingSqs = useMemo(() => {
    if (!q) return [];
    return sqItems
      .filter(s => s.text.toLowerCase().includes(q) || `slot ${s.slot}`.includes(q))
      .slice(0, 3);
  }, [q, sqItems]);

  // Flattened array for unified keyboard index tracking
  const flattenedResults: FlattenedSearchItem[] = useMemo(() => {
    const items: FlattenedSearchItem[] = [];

    matchingRules.forEach(rule => {
      items.push({
        id: `rule-${rule.id}`,
        type: 'rule',
        onSelect: () => {
          onClose();
          onNavigate(rule.scope === 'Unit' ? 'general' : 'skid-1', rule.id);
        }
      });
    });

    matchingFacts.forEach(fact => {
      items.push({
        id: `fact-${fact.key}`,
        type: 'fact',
        onSelect: () => {
          onClose();
          onNavigate('general');
        }
      });
    });

    matchingSkids.forEach(skid => {
      items.push({
        id: `skid-${skid.id}`,
        type: 'skid',
        onSelect: () => {
          onClose();
          onNavigate(skid.id);
        }
      });
    });

    matchingSqs.forEach(sq => {
      items.push({
        id: `sq-${sq.id}`,
        type: 'sq',
        onSelect: () => {
          onClose();
          onNavigate('general');
        }
      });
    });

    return items;
  }, [matchingRules, matchingFacts, matchingSkids, matchingSqs, onClose, onNavigate]);

  const totalResults = flattenedResults.length;

  // Reset selected index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);

  // Scroll active option into view
  useEffect(() => {
    if (totalResults > 0 && selectedIndex >= 0 && selectedIndex < totalResults) {
      const activeEl = document.getElementById(`omni-option-${selectedIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, totalResults]);

  if (!isOpen) return null;

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalResults > 0) {
        setSelectedIndex(prev => (prev + 1) % totalResults);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalResults > 0) {
        setSelectedIndex(prev => (prev - 1 + totalResults) % totalResults);
      }
    } else if (e.key === 'Enter') {
      if (totalResults > 0 && selectedIndex >= 0 && selectedIndex < totalResults) {
        e.preventDefault();
        flattenedResults[selectedIndex].onSelect();
      }
    }
  };

  let globalResultCounter = 0;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      tabIndex={-1}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 outline-none"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-850">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            id="omni-search-input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={totalResults > 0}
            aria-controls="omni-search-listbox"
            aria-activedescendant={totalResults > 0 ? `omni-option-${selectedIndex}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search rules, specifications, skids, special quotes..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title="Clear search query"
              aria-label="Clear search query"
              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <kbd
            onClick={onClose}
            title="Press ESC or click to exit search"
            className="cursor-pointer px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-400 transition-colors select-none"
          >
            ESC
          </kbd>

          <button
            type="button"
            onClick={onClose}
            title="Close Search (Esc)"
            aria-label="Close search modal"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {!q ? (
            <div role="status" className="py-8 text-center text-xs text-slate-600 dark:text-slate-400 font-mono">
              Type keywords like &quot;lifting&quot;, &quot;drain&quot;, &quot;seismic&quot;, &quot;fan&quot;, &quot;gauge&quot;, or &quot;skid 1&quot;
            </div>
          ) : totalResults === 0 ? (
            <div role="status" className="py-8 text-center text-xs text-slate-600 dark:text-slate-400 font-mono">
              No matching rules, specifications, or skids found.
            </div>
          ) : (
            <div
              id="omni-search-listbox"
              role="listbox"
              aria-label="Search results"
              className="space-y-4"
            >
            <>
              {/* Matching Rules */}
              {matchingRules.length > 0 && (
                <div className="space-y-1.5" role="group" aria-label="Verification Rules">
                  <div className="text-[11px] font-bold font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider px-2">
                    Verification Rules ({matchingRules.length})
                  </div>
                  {matchingRules.map(rule => {
                    const currentIndex = globalResultCounter++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={rule.id}
                        id={`omni-option-${currentIndex}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onClose();
                          onNavigate(rule.scope === 'Unit' ? 'general' : 'skid-1', rule.id);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 shadow-sm ring-1 ring-blue-400'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{rule.id}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {rule.category}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-1">{rule.text}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="flex items-center text-[10px] font-mono text-blue-600 dark:text-blue-400 mr-1">
                              <CornerDownLeft className="w-3 h-3 mr-0.5" />
                              Enter
                            </span>
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                            isSelected
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matching Specs / Facts */}
              {matchingFacts.length > 0 && (
                <div className="space-y-1.5" role="group" aria-label="Specifications and Facts">
                  <div className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-2">
                    Specifications & Facts ({matchingFacts.length})
                  </div>
                  {matchingFacts.map(fact => {
                    const currentIndex = globalResultCounter++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={fact.key}
                        id={`omni-option-${currentIndex}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onClose();
                          onNavigate('general');
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600 shadow-sm ring-1 ring-emerald-400'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{fact.label}</div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{fact.key}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                            {String(fact.value ?? 'Not Set')}
                          </span>
                          {isSelected && (
                            <CornerDownLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matching Skids */}
              {matchingSkids.length > 0 && (
                <div className="space-y-1.5" role="group" aria-label="Shipping Skids">
                  <div className="text-[11px] font-bold font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider px-2">
                    Shipping Skids ({matchingSkids.length})
                  </div>
                  {matchingSkids.map(skid => {
                    const currentIndex = globalResultCounter++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={skid.id}
                        id={`omni-option-${currentIndex}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onClose();
                          onNavigate(skid.id);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 dark:border-indigo-600 shadow-sm ring-1 ring-indigo-400'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{skid.name}</div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {skid.segmentIds.length} Segments • {skid.calculatedWeight.toLocaleString()} lbs
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <CornerDownLeft className="w-3 h-3 text-indigo-600 dark:text-indigo-400 mr-1" />
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                            isSelected
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matching SQs */}
              {matchingSqs.length > 0 && (
                <div className="space-y-1.5" role="group" aria-label="Special Quotes">
                  <div className="text-[11px] font-bold font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider px-2">
                    Special Quotes ({matchingSqs.length})
                  </div>
                  {matchingSqs.map(sq => {
                    const currentIndex = globalResultCounter++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={sq.id}
                        id={`omni-option-${currentIndex}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onClose();
                          onNavigate('general');
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 shadow-sm ring-1 ring-amber-400'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <div>
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 mr-2">Slot {sq.slot}:</span>
                            <span className="text-slate-800 dark:text-slate-200">{sq.text}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <CornerDownLeft className="w-3 h-3 text-amber-600 dark:text-amber-400 mr-1" />
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                            isSelected
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
            </div>
          )}
        </div>

        {/* Keyboard Navigation Footer Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px]">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px]">↵</kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px]">esc</kbd>
              <span>close</span>
            </span>
          </div>
          {totalResults > 0 && (
            <span>{selectedIndex + 1} of {totalResults} results</span>
          )}
        </div>
      </div>
    </div>
  );
};
