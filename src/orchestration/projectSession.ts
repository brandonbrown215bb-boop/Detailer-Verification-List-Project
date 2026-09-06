import type { Fact, RulePackIdentity, UpzBundle } from '../types';

export interface SourceMetadata {
  fileName?: string;
  isUpzBundle?: boolean;
  orderRevision?: UpzBundle['orderRevision'];
  rawOrderRevisionXml?: string;
  rawManifestXml?: string;
}

export interface ActiveRulePackArtifacts {
  templateMap?: unknown;
  approvedMappings?: unknown;
  manifest?: any;
}

export interface RulePackPayload {
  rules?: unknown[];
  manifest?: any;
  version?: string;
  bundleSha256?: string;
  generation?: number;
  ruleCount?: number;
  templateMap?: unknown;
  approvedMappings?: unknown;
}

export function identityFromRulePack(
  pack: RulePackPayload | undefined,
  fallback: RulePackIdentity
): RulePackIdentity {
  const manifest = pack?.manifest;
  const files = manifest?.files || {};
  return {
    ...fallback,
    ...(manifest?.version || pack?.version ? { version: manifest?.version || pack?.version } : {}),
    ...(manifest?.bundleSha256 || pack?.bundleSha256 ? { sha256: manifest?.bundleSha256 || pack?.bundleSha256 } : {}),
    ...(files['template.xlsx']?.sha256 ? { templateSha256: files['template.xlsx'].sha256 } : {}),
    ...(files['template_map.json']?.sha256 ? { templateMapSha256: files['template_map.json'].sha256 } : {}),
    ...(files['approved_mappings.json']?.sha256 ? { approvedMappingsSha256: files['approved_mappings.json'].sha256 } : {}),
    ...(files['template.xlsx']?.sha256 ? { templateRetrievable: true } : {})
  };
}

export function activeRulePackArtifactsFrom(pack: RulePackPayload | undefined): ActiveRulePackArtifacts {
  return {
    templateMap: pack?.templateMap,
    approvedMappings: pack?.approvedMappings,
    manifest: pack?.manifest
  };
}

export function manualOverridesFromFacts(registry: Record<string, Fact>): Record<string, Fact> {
  return Object.fromEntries(
    Object.entries(registry || {}).filter(([, fact]) => fact.status === 'ManuallyOverridden')
  );
}

export function sourceMetadataFromBundle(
  bundle: UpzBundle | undefined,
  sourceFileName: string | undefined,
  orderRevision: UpzBundle['orderRevision']
): SourceMetadata {
  return {
    fileName: sourceFileName || (bundle ? 'bundle.upz' : 'Config.xml'),
    isUpzBundle: !!bundle,
    orderRevision,
    rawOrderRevisionXml: bundle?.rawOrderRevXml,
    rawManifestXml: bundle?.rawManifestXml
  };
}
