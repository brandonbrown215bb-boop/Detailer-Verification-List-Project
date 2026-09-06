// Invoked by CanonicalParityAcceptanceTests: execute production TypeScript,
// never a second implementation of the canonicalization/evaluator algorithm.
import fs from 'node:fs';
import { canonicalDvlPayload, createDvlProject } from '../src/services/projectStorage.ts';
import { semanticFingerprint, evaluateAstPredicate } from '../src/services/ruleEvaluator.ts';
import { createManualUnit } from '../src/services/manualUnitFactory.ts';
import { RULES_CATALOG } from '../src/services/rulesCatalog.ts';

const request = JSON.parse(fs.readFileSync(0, 'utf8'));
let result;
switch (request.operation) {
  case 'canonical': result = canonicalDvlPayload(JSON.parse(request.json)); break;
  case 'fingerprint': result = semanticFingerprint(request.rule); break;
  case 'predicate': result = evaluateAstPredicate(request.predicate, request.context, request.requiredFacts, request.facts); break;
  case 'project': {
    const manual = createManualUnit({ jobName: 'Parity fixture', comNumber: 'TEST-ONLY', detailerName: 'Test', unitType: 'Indoor', housingStyle: 'Standard', skidCount: 1 }, RULES_CATALOG);
    result = await createDvlProject(manual.graph, manual.facts, manual.sqItems, manual.checklists, '', 'Round-trip café 😀', { fileName: 'Manual Unit', isUpzBundle: false }, { activeRules: RULES_CATALOG });
    break;
  }
  case 'extract': {
    const { build } = await import('esbuild');
    const { chromium } = await import('@playwright/test');
    const bundle = await build({
      stdin: {
        contents: "import {parseAhuXml} from './src/services/xmlParser.ts'; import {extractFactsFromGraph} from './src/services/factRegistry.ts'; window.extractParity = xml => { const graph = parseAhuXml(xml); return {graph, facts:extractFactsFromGraph(graph)}; };",
        resolveDir: process.cwd(), loader: 'ts'
      },
      bundle: true, write: false, platform: 'browser', format: 'iife', logLevel: 'silent'
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.route('http://parity.local/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
      await page.goto('http://parity.local/');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      result = await page.evaluate(xml => window.extractParity(xml), request.xml);
    } finally { await browser.close(); }
    break;
  }
  default: throw new Error(`Unknown parity operation: ${request.operation}`);
}
process.stdout.write(JSON.stringify(result));
