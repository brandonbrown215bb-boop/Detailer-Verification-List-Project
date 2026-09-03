import assert from 'assert';

// ---------------------------------------------------------------------------
// Node.js DOMParser Polyfill for Testing
// ---------------------------------------------------------------------------
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
const { isDesktopHost, desktopBridge, BrowserPreviewBridge } = await import('../src/services/desktopBridge.ts');

console.log('======================================================================');
console.log(' Milestone 2 - Dual-Engine XML Parser Parity & Bridge Test Suite');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// Suite 1: XML Parser Defaults & Thermal Break Semantics
// ---------------------------------------------------------------------------
console.log('[Suite 1/3] XML Parser Defaults & Semantic Parity...');

// 1.1 Minimal XML with missing dimensions & weights defaults strictly to 0
const minimalXml = `<?xml version="1.0" encoding="utf-8"?>
<unitRevision xmlns="http://tempuri.org/XMLSchema.xsd">
  <unit_MOMID>{11111111-2222-3333-4444-555555555555}</unit_MOMID>
</unitRevision>`;

const graphMin = parseAhuXml(minimalXml);
assert.strictEqual(graphMin.unitWeight, 0, 'Missing unitWeight must default strictly to 0 (no 31376 sample fallback)');
assert.strictEqual(graphMin.totalStaticPressure, 0, 'Missing totalStaticPressure must default strictly to 0 (no 6.26 sample fallback)');
assert.strictEqual(graphMin.dimensions.length, 0, 'Missing cabLength must default strictly to 0 (no 411 sample fallback)');
assert.strictEqual(graphMin.dimensions.height, 0, 'Missing cabHeight must default strictly to 0 (no 110 sample fallback)');
assert.strictEqual(graphMin.dimensions.width, 0, 'Missing cabWidth must default strictly to 0 (no 194 sample fallback)');
console.log('  ✓ 1.1 Missing numerical fields default strictly to 0 (zero sample constants)');

// 1.2 Thermal Break semantics: Standard vs ThermalBreak vs Custom
const standardXml = `<?xml version="1.0" encoding="utf-8"?>
<unitRevision xmlns="http://tempuri.org/XMLSchema.xsd">
  <unitOptions>
    <defaultConstructionOptions>
      <housingStyle>Standard</housingStyle>
    </defaultConstructionOptions>
  </unitOptions>
</unitRevision>`;

const graphStandard = parseAhuXml(standardXml);
assert.strictEqual(graphStandard.unitOptions.materials.housingStyle, 'Standard');
assert.strictEqual(graphStandard.unitOptions.thermalBreak, false, 'Housing style "Standard" must yield thermalBreak === false');
console.log('  ✓ 1.2 Housing style "Standard" produces thermalBreak: false');

const tbXml = `<?xml version="1.0" encoding="utf-8"?>
<unitRevision xmlns="http://tempuri.org/XMLSchema.xsd">
  <unitOptions>
    <defaultConstructionOptions>
      <housingStyle>ThermalBreak</housingStyle>
    </defaultConstructionOptions>
  </unitOptions>
</unitRevision>`;

const graphTb = parseAhuXml(tbXml);
assert.strictEqual(graphTb.unitOptions.materials.housingStyle, 'ThermalBreak');
assert.strictEqual(graphTb.unitOptions.thermalBreak, true, 'Housing style "ThermalBreak" must yield thermalBreak === true');
console.log('  ✓ 1.3 Housing style "ThermalBreak" produces thermalBreak: true');

const customXml = `<?xml version="1.0" encoding="utf-8"?>
<unitRevision xmlns="http://tempuri.org/XMLSchema.xsd">
  <unitOptions>
    <defaultConstructionOptions>
      <housingStyle>CustomISG</housingStyle>
    </defaultConstructionOptions>
  </unitOptions>
</unitRevision>`;

const graphCustom = parseAhuXml(customXml);
assert.strictEqual(graphCustom.unitOptions.materials.housingStyle, 'CustomISG');
assert.strictEqual(graphCustom.unitOptions.thermalBreak, true, 'Custom housing style (!== Standard) must yield thermalBreak === true matching C# NormalizedXmlParser.cs');
console.log('  ✓ 1.4 Custom housing style (!= Standard) produces thermalBreak: true (C# alignment)');

// ---------------------------------------------------------------------------
// Suite 2: Desktop Bridge Environment Detection & Decoupling
// ---------------------------------------------------------------------------
console.log('\n[Suite 2/3] Desktop Bridge Decoupling & Host Detection...');

assert.strictEqual(isDesktopHost(), false, 'isDesktopHost() returns false outside WebView2');
assert.strictEqual(desktopBridge.isDesktopHost(), false, 'desktopBridge.isDesktopHost() returns false outside WebView2');
assert.strictEqual(desktopBridge.isRunningInDesktop(), false, 'desktopBridge.isRunningInDesktop() returns false in browser preview mode');
console.log('  ✓ 2.1 isDesktopHost accurately identifies non-WebView2 environment');

const previewBridge = new BrowserPreviewBridge();
assert.strictEqual(previewBridge.isDesktopHost(), false, 'BrowserPreviewBridge reports isDesktopHost === false');
assert.strictEqual(previewBridge.isRunningInDesktop(), false, 'BrowserPreviewBridge reports isRunningInDesktop === false');

let upzErrorCaught = false;
try {
  await previewBridge.extractUpz('test.upz');
} catch (err) {
  upzErrorCaught = true;
  assert(err.message.includes('UPZ decompression requires Microsoft Windows desktop host'), 'extractUpz throws informative desktop requirement message');
}
assert.strictEqual(upzErrorCaught, true, 'BrowserPreviewBridge rejects UPZ extraction gracefully');
console.log('  ✓ 2.2 BrowserPreviewBridge safely guards native desktop-only actions');

const appInfo = await desktopBridge.getAppInfo();
assert.strictEqual(appInfo.isDesktopHost, false, 'getAppInfo() in preview returns isDesktopHost: false');
assert(appInfo.appVersion.includes('Browser Preview'), 'appVersion clearly notes Browser Preview');
console.log('  ✓ 2.3 getAppInfo delivers browser preview metadata');

// ---------------------------------------------------------------------------
// Suite 3: Static Watermarking Verification
// ---------------------------------------------------------------------------
console.log('\n[Suite 3/3] Excel Export Watermark Verification...');

import fs from 'fs';
import path from 'path';

const excelExporterPath = path.resolve('src/services/excelExporter.ts');
const excelExporterSource = fs.readFileSync(excelExporterPath, 'utf8');

assert(excelExporterSource.includes('[BROWSER PREVIEW DRAFT - NOT FOR PRODUCTION CHECKING]'), 'excelExporter.ts includes required watermark string');
assert(excelExporterSource.includes('wb.Props'), 'excelExporter.ts sets workbook metadata properties');
assert(excelExporterSource.includes('OFFICIAL DELIVERABLE SYNTHESIS REQUIRES C# DESKTOP HOST'), 'excelExporter.ts specifies official C# desktop host requirement');
console.log('  ✓ 3.1 excelExporter.ts embeds prominent preview watermarks and metadata');

console.log('\n======================================================================');
console.log(' [SUCCESS] All Milestone 2 dual-engine alignment tests passed cleanly!');
console.log('======================================================================\n');
