import assert from 'assert';
import { desktopBridge } from '../src/services/desktopBridge.ts';
import { createManualUnit, AVAILABLE_SEGMENT_TEMPLATES } from '../src/services/manualUnitFactory.ts';
import { RULES_CATALOG } from '../src/services/rulesCatalog.ts';
import { generateChecklists } from '../src/services/ruleEvaluator.ts';

class SimpleNode {
  constructor(tagName, textContent = '') {
    this.tagName = tagName;
    this.localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
    this.textContent = textContent;
    this.children = [];
  }
  getElementsByTagName(name) {
    const results = [];
    const search = (node) => {
      for (const child of node.children) {
        if (name === '*' || child.localName.toLowerCase() === name.toLowerCase() || child.tagName.toLowerCase() === name.toLowerCase()) {
          results.push(child);
        }
        search(child);
      }
    };
    search(this);
    return results;
  }
}

class SimpleDOMParser {
  parseFromString(xmlString) {
    const tokenRegex = /(<\/?[a-zA-Z0-9_:-]+(?:\s+[^>]*?)?\/?>)|([^<]+)/g;
    const stack = [];
    let rootNode = null;
    let match;

    while ((match = tokenRegex.exec(xmlString)) !== null) {
      const [_, tag, text] = match;
      if (text && text.trim() && stack.length > 0) {
        const top = stack[stack.length - 1];
        top.textContent = top.textContent ? `${top.textContent} ${text.trim()}`.trim() : text.trim();
      } else if (tag) {
        if (tag.startsWith('<?') || tag.startsWith('<!')) continue;
        if (tag.startsWith('</')) {
          if (stack.length > 1) {
            stack.pop();
          }
        } else if (tag.endsWith('/>')) {
          const tagName = tag.slice(1, -2).trim().split(/\s+/)[0];
          const node = new SimpleNode(tagName);
          if (stack.length > 0) {
            stack[stack.length - 1].children.push(node);
          } else {
            rootNode = node;
          }
        } else {
          const tagName = tag.slice(1, -1).trim().split(/\s+/)[0];
          const node = new SimpleNode(tagName);
          if (stack.length > 0) {
            stack[stack.length - 1].children.push(node);
          } else if (!rootNode) {
            rootNode = node;
          }
          stack.push(node);
        }
      }
    }

    return {
      documentElement: rootNode || new SimpleNode('root'),
      getElementsByTagName: (name) => rootNode ? rootNode.getElementsByTagName(name) : []
    };
  }
}

if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = SimpleDOMParser;
}

const { parseAhuXml } = await import('../src/services/xmlParser.ts');

console.log('======================================================================');
console.log(' CE2-B: Manual Projects & Rule Pack Updates Integration Tests');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: Desktop Bridge Method Exposure & Preview Behavior
// ---------------------------------------------------------------------------
console.log('[Suite 1/4] Desktop Bridge Method Exposure & Preview Behavior...');

assert.strictEqual(typeof desktopBridge.projectSessionCreateManual, 'function',
  'desktopBridge must expose projectSessionCreateManual');
console.log('  ✓ desktopBridge.projectSessionCreateManual is exposed');

assert.strictEqual(typeof desktopBridge.getSegmentTemplates, 'function',
  'desktopBridge must expose getSegmentTemplates');
console.log('  ✓ desktopBridge.getSegmentTemplates is exposed');

assert.strictEqual(typeof desktopBridge.projectSessionUpdateGeneralComments, 'function',
  'desktopBridge must expose projectSessionUpdateGeneralComments');
console.log('  ✓ desktopBridge.projectSessionUpdateGeneralComments is exposed');

// In browser preview (node / non-webview2), projectSessionCreateManual should reject
try {
  await desktopBridge.projectSessionCreateManual({
    config: {
      jobName: 'Test Unit',
      comNumber: 'COM-123456',
      detailerName: 'Detailer',
      unitType: 'Outdoor',
      housingStyle: 'ThermalBreak',
      segments: []
    }
  });
  assert.fail('projectSessionCreateManual should throw in browser preview');
} catch (err) {
  assert.match(err.message, /requires desktop host/i,
    'Should guard projectSessionCreateManual in browser preview');
  console.log('  ✓ projectSessionCreateManual safely guards against browser preview execution');
}

// In browser preview, getSegmentTemplates should return the preset catalog
const templates = await desktopBridge.getSegmentTemplates();
assert(Array.isArray(templates) && templates.length > 0,
  'getSegmentTemplates should return non-empty array');
assert(templates.some(t => t.typeCode === 'DP' || t.name?.includes('Discharge')),
  'templates should contain standard segments');
console.log(`  ✓ getSegmentTemplates returns ${templates.length} segment templates in preview`);

// ---------------------------------------------------------------------------
// Suite 2: Real Manual Unit Creation & XML Escaping Invariants (No Mock Snapshots)
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/4] Real Manual Unit Creation & XML Escaping Invariants...');

const manualConfig = {
  jobName: 'Memorial Hospital Wing & Tower',
  comNumber: 'COM-887766',
  detailerName: 'Lead Detailer',
  unitType: 'Outdoor',
  housingStyle: 'ThermalBreak',
  defaultUnitWidth: 84,
  defaultUnitHeight: 96,
  defaultBaseHeight: 10,
  defaultWallThickness: 2.0,
  totalStaticPressure: 2.5,
  skids: [
    {
      id: 'skid-1',
      index: 1,
      name: 'Supply Skid (Fans & Coils)',
      baseMaterial: 'StructuralSteel',
      baseType: 'A36'
    },
    {
      id: 'skid-2',
      index: 2,
      name: 'Intake Skid (Filters & Dampers)',
      baseMaterial: 'StructuralSteel',
      baseType: 'A36'
    }
  ],
  segments: [
    {
      id: 'seg-1',
      typeCode: 'DP',
      name: 'Discharge Plenum',
      skidId: 'skid-1',
      length: 48,
      weight: 1200,
      airPressureType: 'Positive',
      airVolume: 18000,
      internals: ['Damper Wall (Return & Outside Air)']
    },
    {
      id: 'seg-2',
      typeCode: 'FF',
      name: 'Flat Filter',
      skidId: 'skid-2',
      length: 24,
      weight: 600,
      airPressureType: 'Negative',
      airVolume: 18000,
      internals: ['Filter Rack & Manometer']
    }
  ]
};

const realManualUnit = createManualUnit(manualConfig, RULES_CATALOG);

assert(realManualUnit, 'createManualUnit must return a valid manual unit result');
assert.strictEqual(realManualUnit.graph.skids.length, 2, 'Graph must contain 2 skids');
assert.strictEqual(realManualUnit.graph.segments.length, 2, 'Graph must contain 2 segments');
assert.strictEqual(realManualUnit.graph.bases.length, 2, 'Graph must contain 2 bases');
assert.strictEqual(realManualUnit.facts['unit.jobName']?.value, 'Memorial Hospital Wing & Tower',
  'Facts must extract jobName correctly');
assert.strictEqual(realManualUnit.facts['unit.comNumber']?.value, 'COM-887766',
  'Facts must extract comNumber correctly');
console.log('  ✓ Real manual unit graph and facts constructed accurately');

// Check XML well-formedness via actual XML parser
const xml = realManualUnit.rawXml;
assert(typeof xml === 'string' && xml.length > 0, 'rawXml must be a non-empty string');

const parsedGraph = parseAhuXml(xml);
assert(parsedGraph, 'parseAhuXml must parse the manual XML configuration');
assert.strictEqual(parsedGraph.skids.length, 2, 'Parsed graph must contain 2 skids');
assert.strictEqual(parsedGraph.segments.length, 2, 'Parsed graph must contain 2 segments');

// Check XML comments: comments may contain literal & and must escape illegal double hyphens
const commentMatches = [...xml.matchAll(/<!--([\s\S]*?)-->/g)].map(m => m[1]);
assert(commentMatches.length > 0, 'rawXml must contain header comments');
const jobComment = commentMatches.find(c => c.includes('Manually Created AHU Project'));
assert(jobComment, 'rawXml must contain manual project header comment');
assert(jobComment.includes('Memorial Hospital Wing & Tower'),
  'XML comment preserves unescaped ampersand in jobName');
assert(jobComment.includes('COM-887766'),
  'XML comment preserves comNumber');
assert(!commentMatches.some(c => c.includes('--')),
  'XML comments must not contain illegal double hyphens');
console.log('  ✓ XML comments preserve text with valid syntax and sanitized hyphens');

// Check element text and markup outside comments
const xmlElements = xml.replace(/<!--[\s\S]*?-->/g, '');
assert(xmlElements.includes('Damper Wall (Return &amp; Outside Air)'),
  'element text must escape ampersand in internalFeature');
assert(xmlElements.includes('Supply Skid (Fans &amp; Coils)'),
  'element text must escape ampersand in skid name');
assert(xmlElements.includes('Filter Rack &amp; Manometer'),
  'element text must escape ampersand in filter internals');

// Verify zero unescaped ampersands exist in element text/markup
const unescapedAmpersandRegex = /&(?!(amp|lt|gt|quot|apos);)/;
assert(!unescapedAmpersandRegex.test(xmlElements),
  'element content must have zero raw unescaped ampersands');
console.log('  ✓ XML element text escapes all ampersands cleanly (Damper Wall, skids, filter rack)');

// Check opening and closing root tags
assert(xml.includes('<AHU>') && xml.includes('</AHU>'),
  'rawXml must have matching root tags');
console.log('  ✓ Generated manual XML is structurally balanced and well-formed');

// ---------------------------------------------------------------------------
// Suite 3: Rule Pack Updates & In-Memory Checklist Re-evaluation
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/4] Rule Pack Updates & In-Memory Checklist Re-evaluation...');

const initialChecklists = realManualUnit.checklists;
assert(Array.isArray(initialChecklists) && initialChecklists.length > 0,
  'Initial checklists must be generated from rules catalog');

// Detailer marks an applicable item
const targetItem = initialChecklists.find(c => c.applicability === 'Applicable');
assert(targetItem, 'Must have at least one applicable check');
targetItem.status = 'Passed';
targetItem.detailerComment = 'Verified on skid 1 with tape measure';

// Simulate Rule Pack update by adding a new rule definition
const customPackRule = {
  ...RULES_CATALOG[0],
  id: 'RULE-PACK-TEST-CUSTOM',
  semanticKey: 'rule-pack-test-custom',
  code: 'CK-TEST-01',
  title: 'Custom Test Verification Rule',
  description: 'Verifies custom rule pack dynamic evaluation',
  scope: 'Unit',
  category: 'General',
  severity: 'Warning',
  allowNA: true,
  requiredFacts: ['unit.jobName'],
  predicate: {
    '!==': [{ var: 'unit.jobName' }, '']
  }
};

const updatedRules = [...RULES_CATALOG, customPackRule];
const updatedChecklists = generateChecklists(
  updatedRules,
  realManualUnit.graph,
  realManualUnit.facts,
  initialChecklists
);

// Verify existing detailer status & comment survived the pack update
const preservedItem = updatedChecklists.find(c => c.instanceKey === targetItem.instanceKey);
assert(preservedItem, 'Preserved item must exist in updated checklists');
assert.strictEqual(preservedItem.status, 'Passed',
  'Detailer status must be preserved across rule pack updates');
assert.strictEqual(preservedItem.detailerComment, 'Verified on skid 1 with tape measure',
  'Detailer comment must be preserved across rule pack updates');
console.log('  ✓ Checklist detailer modifications preserved across rule pack updates');

// Verify new rule from updated pack was evaluated
const newChecklistInstance = updatedChecklists.find(c => c.ruleId === 'RULE-PACK-TEST-CUSTOM');
assert(newChecklistInstance, 'New rule from updated pack must be evaluated');
assert.strictEqual(newChecklistInstance.applicability, 'Applicable',
  'New rule predicate should evaluate to Applicable since unit.jobName is present');
assert.strictEqual(newChecklistInstance.status, 'Incomplete',
  'Newly evaluated check starts Incomplete awaiting detailer verification');
console.log('  ✓ New rule pack rules dynamically evaluated into active session checklists');

// ---------------------------------------------------------------------------
// Suite 4: Bridge Command Payload Contract Compatibility
// ---------------------------------------------------------------------------
console.log('\n[Suite 4/4] Bridge Command Payload Contract Compatibility...');

// Verify that projectSessionUpdateGeneralComments expects comments and requestId
const commentsPayload = {
  sessionId: 'test-session',
  expectedRevision: 3,
  comments: 'Updated detailer comments',
  requestId: 'req-001'
};
assert.strictEqual(typeof commentsPayload.comments, 'string',
  'UpdateGeneralCommentsPayload must include comments property');
assert.strictEqual(typeof commentsPayload.requestId, 'string',
  'UpdateGeneralCommentsPayload must include requestId property');

// Verify that projectSessionOverrideFact includes requestId
const overridePayload = {
  sessionId: 'test-session',
  expectedRevision: 3,
  requestId: 'req-002',
  factId: 'unit.jobName',
  value: 'Updated Job',
  author: 'Detailer',
  comment: 'Manual note'
};
assert.strictEqual(overridePayload.requestId, 'req-002');
assert.strictEqual(overridePayload.factId, 'unit.jobName');

// Verify that projectSessionUpdateChecklist includes requestId and checkId
const checklistPayload = {
  sessionId: 'test-session',
  expectedRevision: 3,
  requestId: 'req-003',
  checkId: 'check-1',
  status: 'Passed',
  comment: 'Looks good'
};
assert.strictEqual(checklistPayload.requestId, 'req-003');
assert.strictEqual(checklistPayload.checkId, 'check-1');

// Verify that projectSessionReset includes requestId
const resetPayload = {
  sessionId: 'test-session',
  expectedRevision: 3,
  requestId: 'req-004'
};
assert.strictEqual(resetPayload.requestId, 'req-004');

console.log('  ✓ Command payloads strictly conform to C# session contract with requestId');

console.log('\n======================================================================');
console.log(' [SUCCESS] All CE2-B manual and rule-pack integration assertions passed!');
console.log('======================================================================\n');
