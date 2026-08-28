import React, { useState, useEffect, useRef } from 'react';
import { RuleDefinition, Fact, SpecialQuote, NormalizedXmlGraph } from '../types';
import { Search, X, Layers, Box, CheckSquare, FileText, ArrowRight } from 'lucide-react';

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RuleDefinition[];
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  graph: NormalizedXmlGraph | null;
  onNavigate: (tabId: string, ruleId?: string) => void;
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Search Results
  const matchingRules = q
    ? rules.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.text.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.reference && r.reference.toLowerCase().includes(q))
      ).slice(0, 5)
    : [];

  const matchingFacts = q
    ? Object.values(facts).filter(f =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.value !== null && String(f.value).toLowerCase().includes(q))
      ).slice(0, 4)
    : [];

  const matchingSqs = q
    ? sqItems.filter(s => s.text.toLowerCase().includes(q) || `slot ${s.slot}`.includes(q)).slice(0, 3)
    : [];

  const matchingSkids = q && graph
    ? graph.skids.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.segmentIds.some(sid => {
          const seg = graph.segments.find(sg => sg.id === sid);
          return seg && (seg.name.toLowerCase().includes(q) || seg.typeCode.toLowerCase().includes(q));
        })
      )
    : [];

  const totalResults = matchingRules.length + matchingFacts.length + matchingSqs.length + matchingSkids.length;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-850">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search rules, specifications, skids, special quotes..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              title="Clear search query"
              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <kbd
            onClick={onClose}
            title="Press ESC or click to exit search"
            className="cursor-pointer px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-400 transition-colors"
          >
            ESC
          </kbd>

          <button
            onClick={onClose}
            title="Close Search (Esc)"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {!q ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 font-mono">
              Type keywords like "lifting", "drain", "seismic", "fan", "gauge", or "skid 1"
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
              No matching rules, specifications, or skids found.
            </div>
          ) : (
            <>
              {/* Matching Rules */}
              {matchingRules.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider px-2">
                    Verification Rules ({matchingRules.length})
                  </div>
                  {matchingRules.map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => {
                        onClose();
                        onNavigate(rule.scope === 'Unit' ? 'general' : 'skid-1', rule.id);
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs transition-colors group"
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
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {/* Matching Specs / Facts */}
              {matchingFacts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-2">
                    Specifications & Facts ({matchingFacts.length})
                  </div>
                  {matchingFacts.map(fact => (
                    <button
                      key={fact.key}
                      onClick={() => {
                        onClose();
                        onNavigate('general');
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{fact.label}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{fact.key}</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                        {String(fact.value ?? 'Not Set')}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Matching Skids */}
              {matchingSkids.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider px-2">
                    Shipping Skids ({matchingSkids.length})
                  </div>
                  {matchingSkids.map(skid => (
                    <button
                      key={skid.id}
                      onClick={() => {
                        onClose();
                        onNavigate(skid.id);
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs transition-colors group"
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
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {/* Matching SQs */}
              {matchingSqs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider px-2">
                    Special Quotes ({matchingSqs.length})
                  </div>
                  {matchingSqs.map(sq => (
                    <button
                      key={sq.id}
                      onClick={() => {
                        onClose();
                        onNavigate('general');
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-300 mr-2">Slot {sq.slot}:</span>
                          <span className="text-slate-800 dark:text-slate-200">{sq.text}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
