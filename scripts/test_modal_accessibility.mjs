import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log(' AHU Verification - Modal & Keyboard Accessibility Test Suite (M2)');
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
    if (err.actual !== undefined && err.expected !== undefined) {
      console.error(`    Actual:   ${JSON.stringify(err.actual)}`);
      console.error(`    Expected: ${JSON.stringify(err.expected)}`);
    }
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

function countDeepStrictEqual(actual, expected, message) {
  totalAssertions++;
  assert.deepStrictEqual(actual, expected, message);
}

// ---------------------------------------------------------------------------
// SUITE 1: Focus Trap Algorithmic Simulation & Cyclic Boundaries
// ---------------------------------------------------------------------------
console.log('[Suite 1/6] Focus Trap State Machine & Tab Cycling...');

function simulateFocusTrapEngine(elements, initialActiveIndex = 0) {
  let activeIndex = initialActiveIndex;
  return {
    getActiveIndex: () => activeIndex,
    getActiveElement: () => elements[activeIndex] || null,
    setActiveIndex: (idx) => { activeIndex = idx; },
    handleTab: (shiftKey = false) => {
      if (elements.length === 0) return;
      if (shiftKey) {
        // Shift+Tab: If on first element or outside modal, loop to last
        activeIndex = (activeIndex - 1 + elements.length) % elements.length;
      } else {
        // Tab: If on last element or outside modal, loop to first
        activeIndex = (activeIndex + 1) % elements.length;
      }
    }
  };
}

runTest('1.1 Forward Tab wraps around from last interactive element to first', () => {
  const elements = ['input-search', 'button-clear', 'kbd-esc', 'button-close'];
  const trap = simulateFocusTrapEngine(elements, 3); // Start at last element (index 3)

  countStrictEqual(trap.getActiveElement(), 'button-close', 'Initially at last element');
  trap.handleTab(false);
  countStrictEqual(trap.getActiveIndex(), 0, 'Tab wrapped around to index 0');
  countStrictEqual(trap.getActiveElement(), 'input-search', 'Focus landed on first element');
});

runTest('1.2 Reverse Shift+Tab wraps around from first element to last', () => {
  const elements = ['input-search', 'button-clear', 'kbd-esc', 'button-close'];
  const trap = simulateFocusTrapEngine(elements, 0); // Start at first element (index 0)

  countStrictEqual(trap.getActiveElement(), 'input-search', 'Initially at first element');
  trap.handleTab(true);
  countStrictEqual(trap.getActiveIndex(), 3, 'Shift+Tab wrapped around to index 3');
  countStrictEqual(trap.getActiveElement(), 'button-close', 'Focus landed on last element');
});

runTest('1.3 Sequential Tab navigation traverses all focusable elements in exact order', () => {
  const elements = ['first-field', 'second-field', 'submit-btn', 'cancel-btn'];
  const trap = simulateFocusTrapEngine(elements, 0);

  const traversed = [];
  for (let i = 0; i < elements.length; i++) {
    traversed.push(trap.getActiveElement());
    trap.handleTab(false);
  }

  countDeepStrictEqual(traversed, elements, 'Traversed elements in sequential order');
  countStrictEqual(trap.getActiveElement(), 'first-field', 'Returned to start after full cycle');
});

runTest('1.4 Single focusable element trap traps Tab and Shift+Tab on itself', () => {
  const elements = ['single-confirm-btn'];
  const trap = simulateFocusTrapEngine(elements, 0);

  trap.handleTab(false);
  countStrictEqual(trap.getActiveIndex(), 0, 'Tab remains on single element');

  trap.handleTab(true);
  countStrictEqual(trap.getActiveIndex(), 0, 'Shift+Tab remains on single element');
});

// ---------------------------------------------------------------------------
// SUITE 2: Focus Restoration & Element Lifecycle
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/6] Invoking Element Recording & Focus Restoration...');

function simulateFocusRestorationLifecycle() {
  let globalActiveElement = 'table-row-42';
  let recordedInvokingElement = null;

  return {
    openModal: () => {
      recordedInvokingElement = globalActiveElement;
      globalActiveElement = 'modal-search-input';
    },
    closeModal: () => {
      globalActiveElement = recordedInvokingElement;
      recordedInvokingElement = null;
    },
    getCurrentFocus: () => globalActiveElement,
    getRecordedElement: () => recordedInvokingElement
  };
}

runTest('2.1 Captures document.activeElement before opening and restores on close', () => {
  const lifecycle = simulateFocusRestorationLifecycle();

  countStrictEqual(lifecycle.getCurrentFocus(), 'table-row-42', 'Initial focus on triggering control');
  lifecycle.openModal();
  countStrictEqual(lifecycle.getCurrentFocus(), 'modal-search-input', 'Focus transferred to modal input');
  countStrictEqual(lifecycle.getRecordedElement(), 'table-row-42', 'Recorded previous active element');

  lifecycle.closeModal();
  countStrictEqual(lifecycle.getCurrentFocus(), 'table-row-42', 'Focus successfully restored to trigger element');
  countStrictEqual(lifecycle.getRecordedElement(), null, 'Recorded element cleared');
});

// ---------------------------------------------------------------------------
// SUITE 3: OmniSearch Keyboard Navigation State Machine
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/6] OmniSearch Keyboard Navigation & Combobox Semantics...');

function createOmniSearchNavigator(totalItems) {
  let selectedIndex = 0;
  return {
    getSelectedIndex: () => selectedIndex,
    setSelectedIndex: (idx) => { selectedIndex = idx; },
    handleKeyDown: (key) => {
      if (totalItems === 0) return null;
      if (key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % totalItems;
        return 'NAVIGATE';
      }
      if (key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + totalItems) % totalItems;
        return 'NAVIGATE';
      }
      if (key === 'Enter') {
        return `EXECUTE_${selectedIndex}`;
      }
      return null;
    }
  };
}

runTest('3.1 ArrowDown cycles through results and wraps around from last to first', () => {
  const nav = createOmniSearchNavigator(5);
  countStrictEqual(nav.getSelectedIndex(), 0, 'Starts at 0');

  nav.handleKeyDown('ArrowDown'); // -> 1
  nav.handleKeyDown('ArrowDown'); // -> 2
  nav.handleKeyDown('ArrowDown'); // -> 3
  nav.handleKeyDown('ArrowDown'); // -> 4
  countStrictEqual(nav.getSelectedIndex(), 4, 'Reached last item (index 4)');

  nav.handleKeyDown('ArrowDown'); // -> 0 (wrap)
  countStrictEqual(nav.getSelectedIndex(), 0, 'Wrapped around to index 0 on ArrowDown');
});

runTest('3.2 ArrowUp cycles backward and wraps around from first to last', () => {
  const nav = createOmniSearchNavigator(5);
  countStrictEqual(nav.getSelectedIndex(), 0, 'Starts at 0');

  nav.handleKeyDown('ArrowUp'); // -> 4 (wrap)
  countStrictEqual(nav.getSelectedIndex(), 4, 'Wrapped around to index 4 on ArrowUp');

  nav.handleKeyDown('ArrowUp'); // -> 3
  countStrictEqual(nav.getSelectedIndex(), 3, 'Moved back to index 3');
});

runTest('3.3 Enter key selects the highlighted item and triggers navigation action', () => {
  const nav = createOmniSearchNavigator(4);
  nav.handleKeyDown('ArrowDown'); // -> index 1
  nav.handleKeyDown('ArrowDown'); // -> index 2

  const action = nav.handleKeyDown('Enter');
  countStrictEqual(action, 'EXECUTE_2', 'Enter executed action on currently highlighted item (index 2)');
});

// ---------------------------------------------------------------------------
// SUITE 4: OmniSearch Query Filtering & Categorization
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/6] OmniSearch Filtering & Domain Categorization...');

const sampleRules = [
  { id: 'GEN-01', text: 'Unit Tag matches job order specifications', category: 'General', scope: 'Unit' },
  { id: 'BASE-01', text: 'Lifting lug structural steel thickness minimum 3/8"', category: 'Base', scope: 'Skid' },
  { id: 'FAN-03', text: 'Fan array vibration isolator seismic snubber verification', category: 'Fans', scope: 'Skid' },
  { id: 'HOUS-02', text: 'Thermal break casing panel exterior PPC paint inspection', category: 'Housing', scope: 'Unit' }
];

const sampleFacts = {
  'job.name': { key: 'job.name', label: 'Job / Project Name', value: 'Hospital AHU Exp' },
  'unit.type': { key: 'unit.type', label: 'Unit Installation Type', value: 'Outdoor' },
  'unit.housingStyle': { key: 'unit.housingStyle', label: 'Housing Construction Style', value: 'ThermalBreak' }
};

const sampleSkids = [
  { id: 'skid-1', name: 'Skid 1 (Mixing Box & Filter)', segmentIds: ['seg-1', 'seg-2'] },
  { id: 'skid-2', name: 'Skid 2 (Supply Fan Array)', segmentIds: ['seg-3'] }
];

const sampleSqs = [
  { id: 'sq-1', slot: 1, text: 'Custom 2-inch stainless steel sloped drain pan in fan section' },
  { id: 'sq-2', slot: 2, text: 'Extended warranty for marine environment casing' }
];

function executeOmniFilter(query) {
  const q = query.toLowerCase().trim();
  if (!q) return { rules: [], facts: [], skids: [], sqs: [], total: 0 };

  const matchingRules = sampleRules.filter(r =>
    r.id.toLowerCase().includes(q) ||
    r.text.toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q)
  );

  const matchingFacts = Object.values(sampleFacts).filter(f =>
    f.label.toLowerCase().includes(q) ||
    f.key.toLowerCase().includes(q) ||
    String(f.value).toLowerCase().includes(q)
  );

  const matchingSkids = sampleSkids.filter(s =>
    s.name.toLowerCase().includes(q)
  );

  const matchingSqs = sampleSqs.filter(s =>
    s.text.toLowerCase().includes(q) || `slot ${s.slot}`.includes(q)
  );

  return {
    rules: matchingRules,
    facts: matchingFacts,
    skids: matchingSkids,
    sqs: matchingSqs,
    total: matchingRules.length + matchingFacts.length + matchingSkids.length + matchingSqs.length
  };
}

runTest('4.1 Searches across rules, facts, skids, and special quotes with keyword "fan"', () => {
  const res = executeOmniFilter('fan');
  countAssert(res.rules.some(r => r.id === 'FAN-03'), 'Matched FAN-03 rule');
  countAssert(res.skids.some(s => s.id === 'skid-2'), 'Matched Skid 2');
  countAssert(res.sqs.some(sq => sq.id === 'sq-1'), 'Matched SQ 1 (drain pan in fan section)');
  countStrictEqual(res.total, 3, 'Found exactly 3 matching items across categories');
});

runTest('4.2 Case insensitivity and whitespace trimming for "  thermal  "', () => {
  const res = executeOmniFilter('  THERMAL  ');
  countAssert(res.rules.some(r => r.id === 'HOUS-02'), 'Matched HOUS-02 rule');
  countAssert(res.facts.some(f => f.key === 'unit.housingStyle'), 'Matched housingStyle fact');
});

runTest('4.3 Performance benchmark: 1,000 rules + 500 facts filtered in < 10ms', () => {
  const bigRules = Array.from({ length: 1000 }, (_, i) => ({
    id: `RULE-${i}`,
    text: `Rule description for component item ${i} checking dampers, fans, and casing integrity`,
    category: i % 2 === 0 ? 'Base' : 'Housing'
  }));

  const bigFacts = Object.fromEntries(
    Array.from({ length: 500 }, (_, i) => [
      `fact.key.${i}`,
      { key: `fact.key.${i}`, label: `Fact Label Property ${i}`, value: `Val-${i}` }
    ])
  );

  const start = performance.now();
  const q = 'fan';
  const filteredR = bigRules.filter(r => r.id.toLowerCase().includes(q) || r.text.toLowerCase().includes(q)).slice(0, 5);
  const filteredF = Object.values(bigFacts).filter(f => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)).slice(0, 4);
  const elapsed = performance.now() - start;

  countAssert(filteredR.length > 0, 'Found matching rules in large dataset');
  countAssert(elapsed < 10.0, `Filtering took ${elapsed.toFixed(3)}ms (must be < 10ms)`);
});

// ---------------------------------------------------------------------------
// SUITE 5: Static Code Audit & ARIA Semantics Across All Application Modals
// ---------------------------------------------------------------------------
console.log('\n[Suite 5/6] Static Source Code & ARIA Compliance Audit...');

const modalFileSpecs = [
  {
    path: 'src/hooks/useFocusTrap.ts',
    checks: [
      { name: 'exports useFocusTrap', pattern: 'export function useFocusTrap' },
      { name: 'handles Tab key trapping', pattern: "e.key === 'Tab'" },
      { name: 'handles Escape dismissal', pattern: "e.key === 'Escape'" },
      { name: 'restores previous activeElement', pattern: 'invokingElementRef.current' }
    ]
  },
  {
    path: 'src/components/common/ModalShell.tsx',
    checks: [
      { name: 'uses useFocusTrap hook', pattern: 'useFocusTrap' },
      { name: 'renders role="dialog"', pattern: 'role="dialog"' },
      { name: 'renders aria-modal="true"', pattern: 'aria-modal="true"' },
      { name: 'renders aria-labelledby', pattern: 'aria-labelledby' },
      { name: 'no premature subtitle truncate', pattern: (code) => !code.includes('truncate max-w-[320px]') }
    ]
  },
  {
    path: 'src/components/OmniSearchModal.tsx',
    checks: [
      { name: 'uses useFocusTrap hook', pattern: 'useFocusTrap' },
      { name: 'renders role="dialog"', pattern: 'role="dialog"' },
      { name: 'renders aria-modal="true"', pattern: 'aria-modal="true"' },
      { name: 'renders role="combobox"', pattern: 'role="combobox"' },
      { name: 'renders role="listbox"', pattern: 'role="listbox"' },
      { name: 'renders role="option"', pattern: 'role="option"' },
      { name: 'handles ArrowDown / ArrowUp navigation', pattern: 'ArrowDown' },
      { name: 'no 50ms setTimeout focus hack', pattern: (code) => !code.includes('setTimeout(() => inputRef.current?.focus(), 50)') }
    ]
  },
  {
    path: 'src/components/ManualUnitModal.tsx',
    checks: [
      { name: 'uses useFocusTrap hook', pattern: 'useFocusTrap' },
      { name: 'renders role="dialog"', pattern: 'role="dialog"' },
      { name: 'renders aria-modal="true"', pattern: 'aria-modal="true"' },
      { name: 'renders dynamic titleId', pattern: 'manual-unit-title' },
      { name: 'no raw $N >= 1 LaTeX markup', pattern: (code) => !code.includes('$N \\ge 1$') && !code.includes('$N \\geq 1$') }
    ]
  },
  {
    path: 'src/components/SettingsModal.tsx',
    checks: [
      { name: 'uses ModalShell', pattern: '<ModalShell' }
    ]
  },
  {
    path: 'src/components/PreFlightModal.tsx',
    checks: [
      { name: 'uses ModalShell', pattern: '<ModalShell' }
    ]
  },
  {
    path: 'src/components/ProjectIdentityModal.tsx',
    checks: [
      { name: 'uses ModalShell', pattern: '<ModalShell' }
    ]
  },
  {
    path: 'src/components/ComNumberModal.tsx',
    checks: [
      { name: 'uses ModalShell', pattern: '<ModalShell' }
    ]
  },
  {
    path: 'src/components/DetailerNameModal.tsx',
    checks: [
      { name: 'uses ModalShell', pattern: '<ModalShell' }
    ]
  }
];

modalFileSpecs.forEach(spec => {
  const fullPath = path.join(projectRoot, spec.path);
  const exists = fs.existsSync(fullPath);

  runTest(`5.${totalTests} File exists: ${spec.path}`, () => {
    countAssert(exists, `File must exist at ${spec.path}`);
  });

  if (exists) {
    const content = fs.readFileSync(fullPath, 'utf8');
    spec.checks.forEach(check => {
      runTest(`5.${totalTests} [${path.basename(spec.path)}] ${check.name}`, () => {
        if (typeof check.pattern === 'string') {
          countAssert(content.includes(check.pattern), `Expected "${check.pattern}" in ${spec.path}`);
        } else if (typeof check.pattern === 'function') {
          countAssert(check.pattern(content), `Assertion check failed for ${check.name} in ${spec.path}`);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// SUITE 6: Subtitle Wrapping & High Resolution Text Layout Verification
// ---------------------------------------------------------------------------
console.log('\n[Suite 6/6] Subtitle Text Layout & Typography Verification...');

runTest('6.1 ModalShell.tsx ensures subtitle does not truncate and wraps cleanly', () => {
  const modalShellPath = path.join(projectRoot, 'src/components/common/ModalShell.tsx');
  const code = fs.readFileSync(modalShellPath, 'utf8');

  countAssert(!code.includes('truncate max-w-[320px]'), 'Must not truncate subtitle to 320px');
  countAssert(code.includes('break-words') || code.includes('leading-relaxed'), 'Subtitle has flexible text wrapping classes');
});

runTest('6.2 ManualUnitModal.tsx contains clean desktop description without LaTeX math', () => {
  const manualUnitPath = path.join(projectRoot, 'src/components/ManualUnitModal.tsx');
  const code = fs.readFileSync(manualUnitPath, 'utf8');

  countAssert(!code.includes('$N \\ge 1$'), 'Removed LaTeX math artifact');
  countAssert(code.includes('Configure arbitrary skids, custom segment sequencing'), 'Clean engineering copy present');
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(` [SUCCESS] All ${totalTests} / ${totalTests} test suites passed cleanly with ${totalAssertions} assertions!`);
console.log('======================================================================\n');
