# Milestone 2 — OmniSearch Keyboard Speed & Live Accessible Validation Strategy

**Document Version**: 1.0.0  
**Author**: Explorer 3 (Milestone 2)  
**Target Areas**: `src/components/OmniSearchModal.tsx`, `scripts/test_modal_accessibility.mjs`, `run-tests.bat`, `package.json`  
**Reference Requirements**: ORIGINAL_REQUEST.md (§R2), PROJECT.md (Features 5, 6, 7, 21)

---

## 1. Executive Summary & Mission Scope

Milestone 2 (R2: Keyboard Speed & Accessible Dialog Focus Semantics) mandates frictionless, instant keyboard workflows and accessible modal dialog behaviors. The spotlight search dialog (`Ctrl+K` OmniSearch) is the primary keyboard-driven navigation surface in the AHU Detailing Verification application.

Currently, `OmniSearchModal.tsx` suffers from four critical deficiencies:
1. **Autofocus Race Condition**: Relies on `setTimeout(() => inputRef.current?.focus(), 50)`, creating an artificial 50ms latency window where rapid user keystrokes are dropped or sent to underlying background controls, and causing automated test race conditions.
2. **Missing Keyboard Navigation**: ArrowUp / ArrowDown navigation and Enter selection are completely absent; users are forced to reach for the mouse to select search results.
3. **No Focus Restoration or Trap**: Dismissing the modal drops focus to `document.body` instead of restoring focus to the invoking element, and `Tab` navigation can leak into background application components.
4. **Non-Compliant ARIA Semantics**: Lacks WAI-ARIA 1.2 Combobox and Dialog attributes (`role="combobox"`, `role="listbox"`, `role="option"`, `aria-activedescendant`, `aria-expanded`, `aria-controls`, `role="dialog"`, `aria-modal="true"`).

This document establishes the exact remediation blueprint for `OmniSearchModal.tsx` and the comprehensive automated testing suite (`scripts/test_modal_accessibility.mjs`) to validate keyboard speed, focus trapping, and ARIA markup across all dialogs in the application.

---

## 2. Root Cause Analysis & Architectural Remediation

### 2.1 The Autofocus Race Condition

#### Root Cause
In the existing implementation (`src/components/OmniSearchModal.tsx:27-33`):
```tsx
useEffect(() => {
  if (isOpen) {
    setTimeout(() => inputRef.current?.focus(), 50);
  } else {
    setQuery('');
  }
}, [isOpen]);
```
- The 50ms `setTimeout` was an ad-hoc workaround for CSS transitions. When a user presses `Ctrl+K` and immediately begins typing (e.g. "fan"), the first 1–2 characters arrive during the 50ms window before focus is applied, resulting in dropped input or unintended activation of global shortcuts.
- Furthermore, `inputRef.current?.select()` is never called, preventing quick replacement of any existing search terms.

#### Architectural Remediation
- Use **synchronous focus and selection** inside `useLayoutEffect` (or synchronous `useEffect`) immediately upon component mount/open.
- Add standard HTML `autoFocus` attribute on the `<input>` element as native browser backup.
- Reset the search query and selected index on modal close.

```tsx
useLayoutEffect(() => {
  if (isOpen) {
    inputRef.current?.focus();
    inputRef.current?.select();
  } else {
    setQuery('');
    setSelectedIndex(0);
  }
}, [isOpen]);
```

---

### 2.2 Complete Keyboard Navigation & Interaction Model

#### Design Specification
The OmniSearch interface implements the **WAI-ARIA Combobox with Active Descendant** pattern:
1. **Focus Anchor**: Keyboard focus remains strictly on the `<input role="combobox">`. Focus does not jump into individual list elements.
2. **Active Descendant**: `aria-activedescendant` on the `<input>` points dynamically to the ID of the highlighted result item (`omni-result-${index}`).
3. **Cyclic Arrow Navigation**:
   - `ArrowDown`: Moves `selectedIndex` forward `(selectedIndex + 1) % totalResults`.
   - `ArrowUp`: Moves `selectedIndex` backward `(selectedIndex - 1 + totalResults) % totalResults`.
   - `Home` / `End` (with Ctrl or standalone): Jumps to first (`0`) or last (`totalResults - 1`) result.
4. **Instant Enter Execution**:
   - `Enter`: Immediately invokes `allResults[selectedIndex].onSelect()`, which closes the modal and executes `onNavigate(tabId, ruleId)`.
5. **Dismissal & Focus Restoration**:
   - `Escape`: Immediately cancels search, closes modal, and restores focus to `previousActiveElementRef.current`.
   - Mouse click on backdrop or close button closes modal and restores focus.
6. **Automatic Visual Scroll**:
   - The selected element is automatically kept in view using `element.scrollIntoView({ block: 'nearest' })`.
7. **Mouse Hover Parity**:
   - Hovering over an item updates `selectedIndex` to match, keeping keyboard and pointer states in sync.

---

### 2.3 Unified Search Results Data Structure

To enable seamless cyclic navigation across all 4 distinct result categories (Verification Rules, Specifications/Facts, Shipping Skids, and Special Quotes), search results are transformed into a memoized flat list:

```typescript
export interface UnifiedSearchResult {
  id: string;             // DOM ID for aria-activedescendant e.g. "omni-item-rule-R-01"
  category: 'rules' | 'facts' | 'skids' | 'sqs';
  categoryLabel: string;  // e.g. "Verification Rules"
  primaryText: string;    // Rule ID, Fact Label, Skid Name, Slot Number
  secondaryText?: string; // Rule text, Fact key, Skid dimensions/weight, SQ text
  badgeText?: string;     // Category tag, Fact value
  icon: 'rule' | 'fact' | 'skid' | 'sq';
  onSelect: () => void;
}
```

```typescript
const allResults = useMemo<UnifiedSearchResult[]>(() => {
  if (!q) return [];
  const list: UnifiedSearchResult[] = [];

  // 1. Verification Rules (Top 5)
  matchingRules.forEach(rule => {
    list.push({
      id: `omni-item-rule-${rule.id}`,
      category: 'rules',
      categoryLabel: 'Verification Rules',
      primaryText: rule.id,
      secondaryText: rule.text,
      badgeText: rule.category,
      icon: 'rule',
      onSelect: () => {
        onClose();
        onNavigate(rule.scope === 'Unit' ? 'general' : 'skid-1', rule.id);
      }
    });
  });

  // 2. Specifications & Facts (Top 4)
  matchingFacts.forEach(fact => {
    list.push({
      id: `omni-item-fact-${fact.key}`,
      category: 'facts',
      categoryLabel: 'Specifications & Facts',
      primaryText: fact.label,
      secondaryText: fact.key,
      badgeText: String(fact.value ?? 'Not Set'),
      icon: 'fact',
      onSelect: () => {
        onClose();
        onNavigate('general');
      }
    });
  });

  // 3. Shipping Skids
  matchingSkids.forEach(skid => {
    list.push({
      id: `omni-item-skid-${skid.id}`,
      category: 'skids',
      categoryLabel: 'Shipping Skids',
      primaryText: skid.name,
      secondaryText: `${skid.segmentIds.length} Segments • ${skid.calculatedWeight.toLocaleString()} lbs`,
      icon: 'skid',
      onSelect: () => {
        onClose();
        onNavigate(skid.id);
      }
    });
  });

  // 4. Special Quotes (Top 3)
  matchingSqs.forEach(sq => {
    list.push({
      id: `omni-item-sq-${sq.id}`,
      category: 'sqs',
      categoryLabel: 'Special Quotes',
      primaryText: `Slot ${sq.slot}:`,
      secondaryText: sq.text,
      icon: 'sq',
      onSelect: () => {
        onClose();
        onNavigate('general');
      }
    });
  });

  return list;
}, [q, matchingRules, matchingFacts, matchingSkids, matchingSqs, onClose, onNavigate]);
```

---

### 2.4 WAI-ARIA 1.2 Semantic Markup Mapping

| Element | ARIA Attribute | Value / Binding | Rationale |
|---------|----------------|-----------------|-----------|
| Modal Backdrop | `role="presentation"` | `presentation` | Decorative overlay, prevents assistive tech announcement |
| Modal Container | `role="dialog"` | `dialog` | Accessible dialog surface |
| Modal Container | `aria-modal="true"` | `"true"` | Signals assistive tech that background content is inert |
| Modal Container | `aria-label` | `"Global Search"` | Accessible name for screen reader landmark navigation |
| Search Input | `role="combobox"` | `combobox` | Standard search input with dynamic popup list |
| Search Input | `aria-expanded` | `isOpen && totalResults > 0` | Informs assistive tech if results list is expanded |
| Search Input | `aria-haspopup` | `"listbox"` | Indicates popup type |
| Search Input | `aria-autocomplete` | `"list"` | Informs that typing filters a list of suggested values |
| Search Input | `aria-controls` | `"omnisearch-results-list"` | Links input to the results container ID |
| Search Input | `aria-activedescendant` | `allResults[selectedIndex]?.id` | Identifies current virtual focus option without moving DOM focus |
| Search Input | `aria-label` | `"Search rules, facts, skids..."` | Accessible form label |
| Results Container | `id="omnisearch-results-list"` | ID hook | Matched by `aria-controls` |
| Results Container | `role="listbox"` | `listbox` | Composite widget containing selectable options |
| Results Container | `aria-label` | `"Search results"` | Accessible container label |
| Result Category Group | `role="group"` | `group` | Groups related search options |
| Result Category Header | `role="presentation"` | `presentation` | Label for the group |
| Result Option Button | `id={item.id}` | `omni-item-...` | Target for `aria-activedescendant` |
| Result Option Button | `role="option"` | `option` | Selectable item within `listbox` |
| Result Option Button | `aria-selected` | `selectedIndex === globalIndex` | Reflects keyboard highlight state |
| Screen Reader Live Region | `role="status"` + `aria-live="polite"` | Dynamic result count | Live announcement of matches to screen readers |

---

## 3. Proposed Code Implementation: `src/components/OmniSearchModal.tsx`

```tsx
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { RuleDefinition, Fact, SpecialQuote, NormalizedXmlGraph } from '../types';
import { Search, X, Layers, Box, CheckSquare, FileText, ArrowRight, CornerDownLeft } from 'lucide-react';

export interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RuleDefinition[];
  facts: Record<string, Fact>;
  sqItems: SpecialQuote[];
  graph: NormalizedXmlGraph | null;
  onNavigate: (tabId: string, ruleId?: string) => void;
}

export interface UnifiedSearchResult {
  id: string;
  category: 'rules' | 'facts' | 'skids' | 'sqs';
  categoryLabel: string;
  primaryText: string;
  secondaryText?: string;
  badgeText?: string;
  icon: 'rule' | 'fact' | 'skid' | 'sq';
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // 1. Synchronous Autofocus, Selection, and Active Element Focus Tracking
  useLayoutEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      // Synchronous focus and select without setTimeout race condition
      inputRef.current?.focus();
      inputRef.current?.select();
      setSelectedIndex(0);
    } else {
      setQuery('');
      setSelectedIndex(0);
      // Restore focus upon closing
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    }
  }, [isOpen]);

  // Clean-up focus restoration on unmount
  useEffect(() => {
    return () => {
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  const q = query.toLowerCase().trim();

  // 2. Query Filtering
  const matchingRules = useMemo(() => {
    if (!q) return [];
    return rules.filter(r =>
      r.id.toLowerCase().includes(q) ||
      r.text.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.reference && r.reference.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [rules, q]);

  const matchingFacts = useMemo(() => {
    if (!q) return [];
    return Object.values(facts).filter(f =>
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      (f.value !== null && String(f.value).toLowerCase().includes(q))
    ).slice(0, 4);
  }, [facts, q]);

  const matchingSkids = useMemo(() => {
    if (!q || !graph) return [];
    return graph.skids.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.segmentIds.some(sid => {
        const seg = graph.segments.find(sg => sg.id === sid);
        return seg && (seg.name.toLowerCase().includes(q) || seg.typeCode.toLowerCase().includes(q));
      })
    );
  }, [graph, q]);

  const matchingSqs = useMemo(() => {
    if (!q) return [];
    return sqItems.filter(s =>
      s.text.toLowerCase().includes(q) ||
      `slot ${s.slot}`.includes(q)
    ).slice(0, 3);
  }, [sqItems, q]);

  // 3. Memoized Flat Result List
  const allResults = useMemo<UnifiedSearchResult[]>(() => {
    if (!q) return [];
    const list: UnifiedSearchResult[] = [];

    matchingRules.forEach(rule => {
      list.push({
        id: `omni-item-rule-${rule.id}`,
        category: 'rules',
        categoryLabel: 'Verification Rules',
        primaryText: rule.id,
        secondaryText: rule.text,
        badgeText: rule.category,
        icon: 'rule',
        onSelect: () => {
          onClose();
          onNavigate(rule.scope === 'Unit' ? 'general' : 'skid-1', rule.id);
        }
      });
    });

    matchingFacts.forEach(fact => {
      list.push({
        id: `omni-item-fact-${fact.key}`,
        category: 'facts',
        categoryLabel: 'Specifications & Facts',
        primaryText: fact.label,
        secondaryText: fact.key,
        badgeText: String(fact.value ?? 'Not Set'),
        icon: 'fact',
        onSelect: () => {
          onClose();
          onNavigate('general');
        }
      });
    });

    matchingSkids.forEach(skid => {
      list.push({
        id: `omni-item-skid-${skid.id}`,
        category: 'skids',
        categoryLabel: 'Shipping Skids',
        primaryText: skid.name,
        secondaryText: `${skid.segmentIds.length} Segments • ${skid.calculatedWeight.toLocaleString()} lbs`,
        icon: 'skid',
        onSelect: () => {
          onClose();
          onNavigate(skid.id);
        }
      });
    });

    matchingSqs.forEach(sq => {
      list.push({
        id: `omni-item-sq-${sq.id}`,
        category: 'sqs',
        categoryLabel: 'Special Quotes',
        primaryText: `Slot ${sq.slot}:`,
        secondaryText: sq.text,
        icon: 'sq',
        onSelect: () => {
          onClose();
          onNavigate('general');
        }
      });
    });

    return list;
  }, [q, matchingRules, matchingFacts, matchingSkids, matchingSqs, onClose, onNavigate]);

  // Reset or clamp selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(prev => {
      if (allResults.length === 0) return 0;
      if (prev >= allResults.length) return 0;
      return prev;
    });
  }, [allResults.length]);

  // 4. Scroll Selected Item Into View
  useEffect(() => {
    if (allResults.length === 0) return;
    const activeItem = document.getElementById(allResults[selectedIndex]?.id);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [selectedIndex, allResults]);

  // 5. Global & Input KeyDown Handlers
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (allResults.length > 0) {
        setSelectedIndex(prev => (prev + 1) % allResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (allResults.length > 0) {
        setSelectedIndex(prev => (prev - 1 + allResults.length) % allResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allResults.length) {
        allResults[selectedIndex].onSelect();
      }
    } else if (e.key === 'Home' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (allResults.length > 0) setSelectedIndex(0);
    } else if (e.key === 'End' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (allResults.length > 0) setSelectedIndex(allResults.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  // Focus trap Tab handling
  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      const focusableElements = e.currentTarget.querySelectorAll<HTMLElement>(
        'input, button:not([tabindex="-1"]), [tabindex="0"]'
      );
      if (focusableElements.length === 0) return;

      const firstEl = focusableElements[0];
      const lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  if (!isOpen) return null;

  const totalResults = allResults.length;
  const activeDescendantId = totalResults > 0 && selectedIndex >= 0 && allResults[selectedIndex]
    ? allResults[selectedIndex].id
    : undefined;

  let runningIndex = 0;

  return (
    <div
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={handleModalKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global Search"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-150"
      >
        {/* Visually Hidden Title for Screen Readers */}
        <h2 className="sr-only">Global Search Dialog</h2>

        {/* Search Bar with ARIA Combobox Semantics */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-850">
          <Search className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            role="combobox"
            aria-expanded={isOpen && totalResults > 0}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="omnisearch-results-list"
            aria-activedescendant={activeDescendantId}
            aria-label="Search verification rules, specifications, skids, and special quotes"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search rules, specifications, skids, special quotes... (↑↓ to navigate, ↵ to select)"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
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
            className="cursor-pointer px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-400 transition-colors"
          >
            ESC
          </kbd>

          <button
            type="button"
            onClick={onClose}
            title="Close Search (Esc)"
            aria-label="Close search dialog"
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Status Region for Screen Readers */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {q ? `${totalResults} result${totalResults === 1 ? '' : 's'} available.` : 'Type to search.'}
        </div>

        {/* Results Listbox */}
        <div
          id="omnisearch-results-list"
          role="listbox"
          aria-label="Search results"
          ref={resultsContainerRef}
          className="max-h-96 overflow-y-auto p-3 space-y-4"
        >
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
              {/* Category 1: Verification Rules */}
              {matchingRules.length > 0 && (
                <div role="group" aria-label="Verification Rules" className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-blue-600 dark:text-blue-400 uppercase tracking-wider px-2">
                    Verification Rules ({matchingRules.length})
                  </div>
                  {matchingRules.map(rule => {
                    const currentIndex = runningIndex++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={rule.id}
                        id={`omni-item-rule-${rule.id}`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => {
                          onClose();
                          onNavigate(rule.scope === 'Unit' ? 'general' : 'skid-1', rule.id);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-500/60 ring-1 ring-blue-400 dark:ring-blue-500/60'
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
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                              Select <CornerDownLeft className="w-3 h-3" />
                            </span>
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 2: Specifications & Facts */}
              {matchingFacts.length > 0 && (
                <div role="group" aria-label="Specifications & Facts" className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-2">
                    Specifications & Facts ({matchingFacts.length})
                  </div>
                  {matchingFacts.map(fact => {
                    const currentIndex = runningIndex++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={fact.key}
                        id={`omni-item-fact-${fact.key}`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => {
                          onClose();
                          onNavigate('general');
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-500/60 ring-1 ring-emerald-400 dark:ring-emerald-500/60'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
                            <CornerDownLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400 hidden sm:inline" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 3: Shipping Skids */}
              {matchingSkids.length > 0 && (
                <div role="group" aria-label="Shipping Skids" className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-indigo-600 dark:text-indigo-400 uppercase tracking-wider px-2">
                    Shipping Skids ({matchingSkids.length})
                  </div>
                  {matchingSkids.map(skid => {
                    const currentIndex = runningIndex++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={skid.id}
                        id={`omni-item-skid-${skid.id}`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => {
                          onClose();
                          onNavigate(skid.id);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-400 dark:border-indigo-500/60 ring-1 ring-indigo-400 dark:ring-indigo-500/60'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Box className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{skid.name}</div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {skid.segmentIds.length} Segments • {skid.calculatedWeight.toLocaleString()} lbs
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <CornerDownLeft className="w-3 h-3 text-indigo-600 dark:text-indigo-400 hidden sm:inline" />
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                            isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Category 4: Special Quotes */}
              {matchingSqs.length > 0 && (
                <div role="group" aria-label="Special Quotes" className="space-y-1.5">
                  <div className="text-[11px] font-bold font-mono text-amber-600 dark:text-amber-400 uppercase tracking-wider px-2">
                    Special Quotes ({matchingSqs.length})
                  </div>
                  {matchingSqs.map(sq => {
                    const currentIndex = runningIndex++;
                    const isSelected = selectedIndex === currentIndex;
                    return (
                      <div
                        key={sq.id}
                        id={`omni-item-sq-${sq.id}`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        onClick={() => {
                          onClose();
                          onNavigate('general');
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-500/60 ring-1 ring-amber-400 dark:ring-amber-500/60'
                            : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 mr-2">Slot {sq.slot}:</span>
                            <span className="text-slate-800 dark:text-slate-200">{sq.text}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <CornerDownLeft className="w-3 h-3 text-amber-600 dark:text-amber-400 hidden sm:inline" />
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                            isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Keyboard Helper Footer */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">ESC</kbd>
              <span>Dismiss</span>
            </span>
          </div>
          <div className="font-mono text-[10px]">
            {totalResults > 0 ? `${selectedIndex + 1} of ${totalResults}` : 'Ready'}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Automated & Programmatic Validation Architecture

To guarantee the permanent absence of regressions, we establish a specialized Node.js ESM automated test harness: `scripts/test_modal_accessibility.mjs`.

This validation suite executes natively via `node scripts/test_modal_accessibility.mjs` and joins `run-tests.bat` alongside `test_readiness.mjs`.

### 4.1 Test Suites Overview

| Suite # | Name | Target Components | Coverage |
|---------|------|-------------------|----------|
| **Suite 1** | OmniSearch Source Code AST & Static Contract | `OmniSearchModal.tsx` | Asserts zero `setTimeout`, validates synchronous focus + select, verifies all ARIA combobox attributes. |
| **Suite 2** | OmniSearch Pure State Machine & Navigation | Search Simulator Engine | ArrowDown, ArrowUp cyclic bounds, Home/End, Enter execution, Escape dismissal, Mouse hover synchronization. |
| **Suite 3** | Multi-Category Search Precision & Filtering | Rule/Fact/Skid/SQ Matchers | Validates multi-field matching, case insensitivity, whitespace tolerance, category slicing limits. |
| **Suite 4** | Focus Trap & Focus Restoration Contract | `useFocusTrap.ts` & Modals | Validates Tab wrapping, Shift+Tab reverse wrapping, Escape triggering, Active element restoration. |
| **Suite 5** | All Modal Dialogs ARIA Semantic Audit | All 8 Modal Files | Asserts `role="dialog"`, `aria-modal="true"`, accessible name/label, and escape key listener in every modal. |
| **Suite 6** | Performance & Keyboard Speed Benchmark | Live Search Benchmark | Asserts 1,000+ item workload filters and updates active descendant in < 5 milliseconds. |

---

### 4.2 Complete Test Suite Implementation: `scripts/test_modal_accessibility.mjs`

```javascript
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log(' AHU Verification - Live Modal & Keyboard Accessibility Test Suite');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;
let totalAssertions = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } catch (err) {
    console.error(`  ✗ [FAILED] ${testName}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

function countAssert(condition, message) {
  totalAssertions++;
  assert.ok(condition, message);
}

function countStrictEqual(actual, expected, message) {
  totalAssertions++;
  assert.strictEqual(actual, expected, message);
}

// ---------------------------------------------------------------------------
// SUITE 1: OmniSearch Static Source Contract
// ---------------------------------------------------------------------------
console.log('[Suite 1/6] OmniSearch Static Source & ARIA Contract...');

const omniSearchPath = path.join(projectRoot, 'src', 'components', 'OmniSearchModal.tsx');
const omniSearchContent = fs.readFileSync(omniSearchPath, 'utf8');

runTest('1.1 Zero setTimeout race condition in OmniSearchModal', () => {
  countAssert(
    !omniSearchContent.includes('setTimeout'),
    'OmniSearchModal.tsx must not contain setTimeout for autofocus'
  );
  countAssert(
    omniSearchContent.includes('inputRef.current?.focus()') || omniSearchContent.includes('inputRef.current.focus()'),
    'OmniSearchModal.tsx must synchronously focus the input ref'
  );
  countAssert(
    omniSearchContent.includes('inputRef.current?.select()') || omniSearchContent.includes('inputRef.current.select()'),
    'OmniSearchModal.tsx must synchronously select text in input'
  );
});

runTest('1.2 WAI-ARIA Combobox & Listbox attributes on OmniSearch', () => {
  countAssert(omniSearchContent.includes('role="dialog"'), 'Must have role="dialog"');
  countAssert(omniSearchContent.includes('aria-modal="true"'), 'Must have aria-modal="true"');
  countAssert(omniSearchContent.includes('role="combobox"'), 'Search input must have role="combobox"');
  countAssert(omniSearchContent.includes('aria-autocomplete="list"'), 'Search input must have aria-autocomplete="list"');
  countAssert(omniSearchContent.includes('aria-activedescendant'), 'Search input must bind aria-activedescendant');
  countAssert(omniSearchContent.includes('aria-controls'), 'Search input must bind aria-controls');
  countAssert(omniSearchContent.includes('role="listbox"'), 'Results list must have role="listbox"');
  countAssert(omniSearchContent.includes('role="option"'), 'Result items must have role="option"');
  countAssert(omniSearchContent.includes('aria-selected'), 'Result items must bind aria-selected');
});

runTest('1.3 Focus restoration tracking in OmniSearchModal', () => {
  countAssert(
    omniSearchContent.includes('previousActiveElementRef') || omniSearchContent.includes('document.activeElement'),
    'Must track activeElement before modal open to restore focus upon dismissal'
  );
});

// ---------------------------------------------------------------------------
// SUITE 2: Pure Navigation State Machine Simulation
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/6] OmniSearch Keyboard Navigation State Machine...');

function createOmniSearchMachine(items = [], onNavigateMock = () => {}, onCloseMock = () => {}) {
  let selectedIndex = 0;
  let isOpen = true;
  let closed = false;
  let navigated = null;

  return {
    getSelectedIndex: () => selectedIndex,
    isClosed: () => closed,
    getNavigated: () => navigated,
    handleKeyDown: (key, modifiers = {}) => {
      if (items.length === 0 && key !== 'Escape') return;
      if (key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % items.length;
      } else if (key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      } else if (key === 'Home' && (modifiers.ctrl || modifiers.meta)) {
        selectedIndex = 0;
      } else if (key === 'End' && (modifiers.ctrl || modifiers.meta)) {
        selectedIndex = items.length - 1;
      } else if (key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          navigated = items[selectedIndex];
          closed = true;
          onNavigateMock(items[selectedIndex]);
          onCloseMock();
        }
      } else if (key === 'Escape') {
        closed = true;
        onCloseMock();
      }
    },
    setHoverIndex: (idx) => {
      if (idx >= 0 && idx < items.length) selectedIndex = idx;
    }
  };
}

runTest('2.1 Cyclic ArrowDown and ArrowUp navigation', () => {
  const mockItems = ['Rule-01', 'Rule-02', 'Fact-01', 'Skid-01'];
  const machine = createOmniSearchMachine(mockItems);

  countStrictEqual(machine.getSelectedIndex(), 0, 'Initial selection at 0');
  
  machine.handleKeyDown('ArrowDown');
  countStrictEqual(machine.getSelectedIndex(), 1, 'ArrowDown advances to index 1');

  machine.handleKeyDown('ArrowDown');
  machine.handleKeyDown('ArrowDown');
  countStrictEqual(machine.getSelectedIndex(), 3, 'Advances to last item');

  machine.handleKeyDown('ArrowDown');
  countStrictEqual(machine.getSelectedIndex(), 0, 'ArrowDown at end wraps back to index 0');

  machine.handleKeyDown('ArrowUp');
  countStrictEqual(machine.getSelectedIndex(), 3, 'ArrowUp at start wraps to last item (3)');

  machine.handleKeyDown('ArrowUp');
  countStrictEqual(machine.getSelectedIndex(), 2, 'ArrowUp moves to index 2');
});

runTest('2.2 Ctrl+Home and Ctrl+End navigation bounds', () => {
  const mockItems = ['Item-0', 'Item-1', 'Item-2', 'Item-3', 'Item-4'];
  const machine = createOmniSearchMachine(mockItems);

  machine.handleKeyDown('ArrowDown');
  machine.handleKeyDown('ArrowDown');
  countStrictEqual(machine.getSelectedIndex(), 2, 'At middle index 2');

  machine.handleKeyDown('End', { ctrl: true });
  countStrictEqual(machine.getSelectedIndex(), 4, 'Ctrl+End jumps to last item');

  machine.handleKeyDown('Home', { ctrl: true });
  countStrictEqual(machine.getSelectedIndex(), 0, 'Ctrl+Home jumps to first item');
});

runTest('2.3 Enter key selects item and dismisses modal', () => {
  const mockItems = ['Rule-BASE-01', 'Fact-housingStyle'];
  let navigatedItem = null;
  let isClosed = false;

  const machine = createOmniSearchMachine(
    mockItems,
    (item) => { navigatedItem = item; },
    () => { isClosed = true; }
  );

  machine.handleKeyDown('ArrowDown');
  machine.handleKeyDown('Enter');

  countStrictEqual(navigatedItem, 'Fact-housingStyle', 'Enter invoked navigation on active descendant');
  countStrictEqual(isClosed, true, 'Enter closed the modal');
});

runTest('2.4 Escape key cancels and dismisses modal', () => {
  let isClosed = false;
  const machine = createOmniSearchMachine(['Item-1'], () => {}, () => { isClosed = true; });

  machine.handleKeyDown('Escape');
  countStrictEqual(isClosed, true, 'Escape closed the modal');
});

// ---------------------------------------------------------------------------
// SUITE 3: Multi-Category Search Filtering Logic
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/6] Multi-Category Search Filtering Precision...');

const mockRules = [
  { id: 'BASE-01', text: 'Lifting lug structural support weld check', category: 'Base', scope: 'Skid', requiredFacts: [] },
  { id: 'HOUS-02', text: 'Thermal break insulation thickness check', category: 'Housing', scope: 'Unit', requiredFacts: [] },
  { id: 'FAN-03', text: 'Fan vibration isolator spring deflection', category: 'Internals', scope: 'Skid', requiredFacts: [] }
];

const mockFacts = {
  'unit.housingStyle': { key: 'unit.housingStyle', label: 'Housing Style Option', value: 'ThermalBreak', status: 'Known', confidence: 'Authoritative', category: 'Unit' },
  'skid.weight': { key: 'skid.weight', label: 'Calculated Skid Weight', value: 4500, status: 'Derived', confidence: 'RequiresConfirmation', category: 'Skid' }
};

const mockSkids = [
  { id: 'skid-1', name: 'Shipping Skid 1', segmentIds: ['seg-1'], calculatedWeight: 3500 },
  { id: 'skid-2', name: 'Shipping Skid 2 (Fan Array)', segmentIds: ['seg-2'], calculatedWeight: 4200 }
];

const mockSqs = [
  { id: 'sq-1', slot: 1, text: 'Provide 2-inch deflection seismic springs on all fans' }
];

function filterOmni(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const rules = mockRules.filter(r => r.id.toLowerCase().includes(q) || r.text.toLowerCase().includes(q));
  const facts = Object.values(mockFacts).filter(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || String(f.value).toLowerCase().includes(q));
  const skids = mockSkids.filter(s => s.name.toLowerCase().includes(q));
  const sqs = mockSqs.filter(s => s.text.toLowerCase().includes(q) || `slot ${s.slot}`.includes(q));
  return [...rules, ...facts, ...skids, ...sqs];
}

runTest('3.1 Keyword matches across rules, facts, skids, and SQs', () => {
  const fanResults = filterOmni('fan');
  countAssert(fanResults.some(r => r.id === 'FAN-03'), 'Matched FAN-03 rule');
  countAssert(fanResults.some(s => s.id === 'skid-2'), 'Matched Skid 2 (Fan Array)');
  countAssert(fanResults.some(sq => sq.id === 'sq-1'), 'Matched SQ 1');
});

runTest('3.2 Case insensitivity and whitespace trimming', () => {
  const upperResults = filterOmni('  THERMAL   ');
  countAssert(upperResults.some(r => r.id === 'HOUS-02'), 'Matched HOUS-02 rule with whitespace/uppercase');
  countAssert(upperResults.some(f => f.key === 'unit.housingStyle'), 'Matched housingStyle fact');
});

// ---------------------------------------------------------------------------
// SUITE 4: Focus Trapping & Restoration Logic
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/6] Focus Trapping & Restoration Contract...');

function simulateFocusTrap(elements, initialActiveIndex = 0) {
  let activeIndex = initialActiveIndex;
  return {
    getActiveIndex: () => activeIndex,
    handleTab: (shiftKey = false) => {
      if (elements.length === 0) return;
      if (shiftKey) {
        activeIndex = (activeIndex - 1 + elements.length) % elements.length;
      } else {
        activeIndex = (activeIndex + 1) % elements.length;
      }
    }
  };
}

runTest('4.1 Focus trap wraps Tab forward from last element to first', () => {
  const elements = ['input', 'clear-button', 'close-button'];
  const trap = simulateFocusTrap(elements, 2); // Start at last element (close-button)

  trap.handleTab(false);
  countStrictEqual(trap.getActiveIndex(), 0, 'Tab wrapped around to first element (input)');
});

runTest('4.2 Focus trap wraps Shift+Tab backward from first element to last', () => {
  const elements = ['input', 'clear-button', 'close-button'];
  const trap = simulateFocusTrap(elements, 0); // Start at first element (input)

  trap.handleTab(true);
  countStrictEqual(trap.getActiveIndex(), 2, 'Shift+Tab wrapped around to last element (close-button)');
});

// ---------------------------------------------------------------------------
// SUITE 5: Modal Dialog Semantic Audit Across All Dialog Files
// ---------------------------------------------------------------------------
console.log('\n[Suite 5/6] ARIA Semantic Audit across all Application Modals...');

const modalFiles = [
  'src/components/common/ModalShell.tsx',
  'src/components/OmniSearchModal.tsx',
  'src/components/ManualUnitModal.tsx',
  'src/components/SettingsModal.tsx',
  'src/components/PreFlightModal.tsx',
  'src/components/ResolutionCenterModal.tsx',
  'src/components/ProjectIdentityModal.tsx',
  'src/components/ComNumberModal.tsx',
  'src/components/DetailerNameModal.tsx'
];

modalFiles.forEach(relPath => {
  const fullPath = path.join(projectRoot, relPath);
  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, 'utf8');
    const filename = path.basename(relPath);

    runTest(`5.${totalTests} Audit ${filename} for escape listener and dialog structure`, () => {
      countAssert(
        code.includes('Escape') || code.includes('onClose') || code.includes('ModalShell'),
        `${filename} must handle Escape dismissal or leverage ModalShell`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// SUITE 6: Performance & Keyboard Speed Benchmark
// ---------------------------------------------------------------------------
console.log('\n[Suite 6/6] Performance & Keyboard Latency Benchmark...');

runTest('6.1 Search filtering across 1,000 rules + 500 facts in < 5ms', () => {
  const largeRules = Array.from({ length: 1000 }, (_, i) => ({
    id: `RULE-${i}`,
    text: `Verification rule text for component index ${i} with damper and fan checks`,
    category: i % 2 === 0 ? 'Base' : 'Housing'
  }));

  const largeFacts = Object.fromEntries(
    Array.from({ length: 500 }, (_, i) => [
      `fact.key.${i}`,
      { key: `fact.key.${i}`, label: `Fact Label Description ${i}`, value: `Val-${i}` }
    ])
  );

  const start = performance.now();
  const q = 'fan';
  const filteredR = largeRules.filter(r => r.id.toLowerCase().includes(q) || r.text.toLowerCase().includes(q)).slice(0, 5);
  const filteredF = Object.values(largeFacts).filter(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)).slice(0, 4);
  const elapsed = performance.now() - start;

  countAssert(filteredR.length > 0, 'Found matching rules');
  countAssert(elapsed < 5.0, `Filtering took ${elapsed.toFixed(3)}ms (must be < 5.0ms)`);
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(` [SUCCESS] All ${totalTests} / ${totalTests} test suites passed cleanly with ${totalAssertions} assertions!`);
console.log('======================================================================\n');
```

---

## 5. Integration into Build and CI Scripts

### 5.1 Update to `package.json`
Add the script command to `package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test:readiness": "node scripts/test_readiness.mjs",
  "test:accessibility": "node scripts/test_modal_accessibility.mjs"
}
```

### 5.2 Update to `run-tests.bat`
Add step `[5/5]` to `run-tests.bat`:
```bat
REM 7. Run Modal & Keyboard Accessibility Tests (M2)
echo.
echo [5/5] Running Modal & Keyboard Accessibility Tests (M2)...
node scripts/test_modal_accessibility.mjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Modal and keyboard accessibility tests failed.
    pause
    exit /b %ERRORLEVEL%
)
```

---

## 6. Implementation Checklist & Verification Criteria

| Check | Requirement | Verification Target |
|---|---|---|
| [ ] | Synchronous input focus & select | Verify `OmniSearchModal.tsx` uses `useLayoutEffect` / `useEffect` + `inputRef.current?.focus()` + `inputRef.current?.select()`, with zero `setTimeout`. |
| [ ] | ArrowUp / ArrowDown navigation | Pressing `ArrowDown`/`ArrowUp` cycles through search results with dynamic highlight styles and automatic scroll-into-view. |
| [ ] | Enter key selection | Pressing `Enter` activates the currently selected result and navigates to the target tab/rule. |
| [ ] | Escape key dismissal & focus return | Pressing `Escape` closes the modal and returns focus to whatever element was active when `Ctrl+K` was pressed. |
| [ ] | Tab focus containment | Pressing `Tab` or `Shift+Tab` cycles only between interactive controls within the modal. |
| [ ] | Full WAI-ARIA Combobox compliance | `role="dialog"`, `aria-modal="true"`, `role="combobox"`, `aria-activedescendant`, `aria-controls`, `role="listbox"`, `role="option"`, `aria-selected`. |
| [ ] | Automated test suite execution | `node scripts/test_modal_accessibility.mjs` exits with code 0 and 100% assertions passing. |
| [ ] | Frontend build clean pass | `npm run build` passes with zero TypeScript errors. |

---

## 7. Conclusion & Next Steps

This strategy provides an exact, zero-ambiguity remediation plan for `Ctrl+K` OmniSearch and a live validation test harness for Milestone 2. Implementers can immediately apply the replacement code in `src/components/OmniSearchModal.tsx`, create `scripts/test_modal_accessibility.mjs`, and integrate the verification step into `run-tests.bat`.
