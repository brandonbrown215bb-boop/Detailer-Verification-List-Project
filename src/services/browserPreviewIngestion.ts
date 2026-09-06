import type { NormalizedXmlGraph, OrderRevisionData, Fact } from '../types/index.ts';
import { parseAhuXml, parseOrderRevXml } from './xmlParser.ts';
import { extractFactsFromGraph } from './factRegistry.ts';

/**
 * Non-certifying browser-preview ingestion boundary.
 *
 * The Windows desktop host remains the authority for certified verification.
 * These adapters exist only for the browser preview, local development, and
 * parity/test paths that intentionally do not have the native host available.
 */
export function parseBrowserPreviewAhuXml(xmlContent: string): NormalizedXmlGraph {
  return parseAhuXml(xmlContent);
}

export function parseBrowserPreviewOrderRevXml(xmlContent: string): OrderRevisionData {
  return parseOrderRevXml(xmlContent);
}

export function extractBrowserPreviewFacts(
  graph: NormalizedXmlGraph,
  orderRevision?: OrderRevisionData
): Record<string, Fact> {
  return extractFactsFromGraph(graph, orderRevision);
}
