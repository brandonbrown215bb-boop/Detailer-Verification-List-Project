/**
 * Formatting and copy sanitization utilities for AHU Detailing Verification.
 * Eliminates raw PascalCase enums, LaTeX artifacts ($N \ge 1$), and leaked internal jargon.
 */

// Well-known domain acronyms that should remain capitalized
const ACRONYMS = new Set(['AHU', 'BOM', 'ECM', 'VFD', 'DX', 'CW', 'OA', 'RA', 'EA', 'SA', 'COM', 'CAD', 'ISG', 'NOA', 'IBC', 'OSHPD', 'UTL', 'DVL', 'XML', 'JCI']);

// Common enum token mappings to user-friendly titles
const ENUM_MAP: Record<string, string> = {
  // Casing / Base Materials
  StructuralSteel: 'Structural Steel',
  FormedChannel: 'Formed Channel',
  ThermalBreak: 'Thermal Break',
  SingleWall: 'Single Wall',
  DoubleWall: 'Double Wall',
  GalvanizedSteel: 'Galvanized Steel',
  StainlessSteel: 'Stainless Steel',
  MarineAluminum: 'Marine Aluminum',
  Aluminum: 'Aluminum',
  Perforated: 'Perforated',
  Solid: 'Solid',

  // Fan & Drive Types
  DirectDrive: 'Direct Drive',
  BeltDrive: 'Belt Drive',
  StandardDirectDrive: 'Standard Direct Drive',
  PlenumFan: 'Plenum Fan',
  HousedFan: 'Housed Fan',
  FanArray: 'Fan Array',

  // Coil & Filter Options
  ChilledWater: 'Chilled Water',
  HotWater: 'Hot Water',
  Steam: 'Steam',
  DirectExpansion: 'Direct Expansion (DX)',
  Cartridge: 'Cartridge',
  Bag: 'Bag',
  Panel: 'Panel',
  HEPA: 'HEPA',

  // Fact & Checklist Statuses
  RequiresConfirmation: 'Requires Confirmation',
  NeedsInput: 'Needs Input',
  ManuallyOverridden: 'Manually Overridden',
  Derived: 'Derived',
  Authoritative: 'Authoritative',
  NotApplicable: 'Not Applicable',
  FlaggedForReview: 'Flagged for Review',
  AwaitingExtraction: 'Awaiting Extraction',
  Unknown: 'Unknown',
  Passed: 'Passed',
  Failed: 'Failed',
  Flagged: 'Flagged',
  Blocked: 'Blocked',
  Draft: 'Draft',
  Final: 'Final'
};

/**
 * Formats a raw PascalCase or technical enum token into a human-readable title.
 * E.g. "StructuralSteel" -> "Structural Steel", "RequiresConfirmation" -> "Requires Confirmation"
 */
export function formatEnumLabel(enumValue: string | null | undefined): string {
  if (!enumValue || typeof enumValue !== 'string') return '';
  const trimmed = enumValue.trim();
  if (!trimmed) return '';

  // Direct lookup
  if (ENUM_MAP[trimmed]) {
    return ENUM_MAP[trimmed];
  }

  // Handle camelCase / PascalCase splitting
  const words = trimmed
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/);

  return words
    .map(word => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Sanitizes domain copy by removing LaTeX math symbols ($N \ge 1$), browser download terms,
 * and internal implementation jargon.
 */
export function sanitizeDomainText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Replace LaTeX inequality patterns ($N \ge 1$, $N \geq 1$, N \ge 1, etc.)
    .replace(/\$?N\s*\\ge(q)?\s*1\$?/gi, 'one or more')
    .replace(/\$?N\s*\\ge(q)?\s*2\$?/gi, 'two or more')
    .replace(/\$?N\s*>=\s*1\$?/gi, 'one or more')
    .replace(/\$?N\s*>=\s*2\$?/gi, 'two or more')
    .replace(/\\ge(q)?/gi, '≥')
    // Replace leaked internal jargon
    .replace(/normalized\s+XML/gi, 'AHU configuration')
    .replace(/domain\s+facts/gi, 'project facts')
    .replace(/AST\s+verification\s+rules/gi, 'verification rules')
    .replace(/AST\s+Rule\s+Logic\s+Trace/gi, 'Rule Verification Logic')
    .replace(/Expand\s+AST\s+logic\s+trace/gi, 'Expand rule logic trace')
    .replace(/OpenXML\s+deliverables/gi, 'Excel deliverables')
    .replace(/OpenXML\s+3\.1\.1\s+Deliverable\s+Engine\s*•?\s*Zero\s+Schema\s+Corruption/gi, 'Official Verification Deliverables • Johnson Controls York')
    .replace(/Download\s+\.dvl/gi, 'Save Project (.dvl)')
    .replace(/Download\s+Excel/gi, 'Export Excel (.xlsx)')
    .replace(/Download\s+Verification\s+List/gi, 'Export Verification List (.xlsx)');
}
