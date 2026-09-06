/** Approved, tokenized material classification shared by XML parsing and fact extraction. */
export type ApprovedMaterialKind = 'aluminum' | 'stainless' | 'galvanized' | 'unknown';

export function normalizeMaterialTokens(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase().replace(/[\\/_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function classifyApprovedMaterial(value: string | null | undefined): ApprovedMaterialKind {
  const normalized = normalizeMaterialTokens(value);
  if (!normalized) return 'unknown';
  const tokens = new Set(normalized.split(' '));
  const isGauge = (token: string) => /^\d+(\.\d+)?(GA)?$/i.test(token);
  const isAllowed = (allowed: Set<string>) => [...tokens].every(token => allowed.has(token) || isGauge(token));
  const aluminum = new Set(['AL', 'ALUM', 'ALUMINUM', 'ALM', 'TREAD', 'DIAMOND', 'DIA', 'PLATE', 'PPC', 'EMB', 'SHT']);
  const stainless = new Set(['SS', 'SS304', 'SST', 'SST304', 'STAINLESS', 'STEEL', '304', '316']);
  const galvanized = new Set(['STL', 'GALV', 'GALVANIZED', 'STEEL', 'PPC']);
  if ([...tokens].some(token => ['AL', 'ALUM', 'ALUMINUM', 'ALM'].includes(token)) && isAllowed(aluminum)) return 'aluminum';
  if ([...tokens].some(token => ['SS', 'SS304', 'SST', 'SST304', 'STAINLESS'].includes(token)) && isAllowed(stainless)) return 'stainless';
  if (((tokens.has('STL') && (tokens.has('GALV') || tokens.has('GALVANIZED'))) || tokens.has('GALVANIZED')) && isAllowed(galvanized)) return 'galvanized';
  return 'unknown';
}

export function approvedFloorDrainHoleDiameter(value: string | null | undefined): number | undefined {
  const kind = classifyApprovedMaterial(value);
  if (kind === 'aluminum') return 3.125;
  if (kind === 'stainless' || kind === 'galvanized') return 1.5;
  return undefined;
}
