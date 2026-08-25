export type FactStatus = 'Known' | 'Derived' | 'Unknown' | 'ManuallyOverridden';
export type FactConfidence = 'Authoritative' | 'RequiresConfirmation';
export type RuleApplicability = 'Applicable' | 'NotApplicable' | 'NeedsInput';
export type CheckStatus = 'Incomplete' | 'Passed' | 'NA' | 'Flagged';
export type RuleScope = 'Unit' | 'Skid' | 'Segment' | 'Component';
export type ThemeMode = 'dark' | 'light' | 'system';
export type SkidViewMode = 'cards' | 'grid';

export interface Fact<T = any> {
  key: string;
  label: string;
  category: string;
  value: T | null;
  status: FactStatus;
  sourcePointer?: string;        // e.g. /AHU/unitOptions/housingStyle
  sourceRawValue?: any;
  derivationName?: string;
  confidence: FactConfidence;
  promptNote?: string;          // Guidance when unconfirmed or unknown
  overrideHistory?: Array<{
    previousValue: T | null;
    overriddenBy: string;
    timestamp: string;
    note?: string;
  }>;
}

export interface UnitBase {
  id: string;
  materialType: string;
  baseType: string;
  paintType: string;
  height: number;
  lipHeight: number;
  insulationType: string;
  housingStyle: string;
  hasSubFloor: boolean;
  subFloorMaterial: string;
  dimensions: { x: number; y: number; z: number; xLength: number; yLength: number; zLength: number };
}

export interface Segment {
  id: string;
  tag: string;                  // e.g. segment_IP, segment_HW, segment_CC
  typeCode: string;             // IP, FF, XA, HW, FE, PC, RF, HC, CC, FR, FS, DP, AT, MB
  name: string;                 // Human friendly: "Inlet Plenum", "Cooling Coil", etc.
  weight: number;
  airPressureType: string;      // Positive / Negative
  airVolume: number;
  handOrientation: string;
  dimensions: { x: number; y: number; z: number; xLength: number; yLength: number; zLength: number };
  casing: {
    exteriorMaterial: string;
    exteriorGauge: number;
    interiorMaterial: string;
    interiorGauge: number;
    housingThickness: number;
    housingStyle: string;
    insulationType: string;
  };
  internals: string[];          // Extracted internal features
  hasFrontChannel: boolean;
  hasRearChannel: boolean;
  hasMotorRemovalRail: boolean;
}

export interface ShippingSkid {
  id: string;
  index: number;
  name: string;
  segmentIds: string[];
  baseIds: string[];
  calculatedWeight: number;     // Sum of segments on this skid
  authoritativeWeight?: number; // Authoritative skid weight if provided
  isWeightConfirmed: boolean;
  dimensions: { length: number; width: number; height: number };
}

export interface MotorControl {
  name: string;
  unitSide: string;
  motorControlType: string;
  fla: number;
  voltage: number;
  hp: number;
  disconnectSize: number;
  weight: number;
  serviceSegmentId?: string;
}

export interface NormalizedXmlGraph {
  unitMOMID: string;
  documentVersion: string;
  generatingSoftware: string;
  unitWeight: number;
  totalStaticPressure: number;
  dimensions: { length: number; width: number; height: number };
  unitOptions: {
    unitType: string;
    brandOption: string;
    unitConstructionType: string;
    washdown: boolean;
    knockdown: boolean;
    hasUTL: boolean;
    isSeismic: boolean | null;
    noaRating: string | null;
    primaryAccessSide: string;
    defaultUnitBaseHeight: number;
    materials: {
      exteriorMaterialType: string;
      exteriorMaterialGauge: number;
      interiorMaterialType: string;
      interiorMaterialGauge: number;
      floorMaterialType: string;
      floorMaterialGauge: number;
      housingStyle: string;
      insulationType: string;
    };
  };
  roofOptions: {
    hasSlopedRoof: boolean;
    roofSlope: number;
    roofSlopeHighSide: string;
    roofPeakZDim: number;
  };
  curbOptions: {
    hasCurbRest: boolean;
    hasCurb: boolean;
    curbHeight: number;
  };
  skids: ShippingSkid[];
  bases: UnitBase[];
  segments: Segment[];
  motorControls: MotorControl[];
}

export interface SpecialQuote {
  slot: number;                 // 1..22
  id: string;
  text: string;
  linkedSkidId?: string;        // e.g. "skid-1"
  linkedRuleId?: string;        // e.g. "BASE-01"
  initials?: string;
  isCompleted?: boolean;
}

export interface ASTPredicate {
  [operator: string]: any;
}

export interface RuleDefinition {
  id: string;
  semanticKey: string;
  scope: RuleScope;
  category: string;             // Base, Housing, Drain Pan, Fans, Filters, Internals, Reconnects, UTL, Knockdown, MOM, ISG
  subgroup?: string;
  order: number;
  text: string;
  reference?: string;
  excelRow?: number;
  requiredFacts: string[];
  predicate?: ASTPredicate;     // AST logic rule
  allowNA: boolean;
  verificationMode: 'ManualCheckbox' | 'AutoEvaluated' | 'MeasurementVerify';
}

export interface ChecklistInstance {
  ruleId: string;
  semanticKey: string;
  instanceKey: string;          // e.g. "skid-1:BASE_LIFTING_LUG_SUPPORT" or "unit:SHELL_THERMAL_BREAK"
  scopeTargetId: string;        // "unit" or skid ID "skid-1" or segment ID
  applicability: RuleApplicability;
  applicabilityReason: string;
  status: CheckStatus;
  detailerComment: string;
  checkerComment?: string;
  updatedAt: string;
  factTraces: Array<{ key: string; label: string; value: any; status: FactStatus }>;
}

export interface CellCoordinate {
  sheet: string;
  cell: string;
}

export interface RuleCellMapping {
  ruleId: string;
  row: number;
  naCell: string;
  detailerCell: string;
  checkerCell: string;
  commentsCell: string;
  initialsCell: string;
}

export interface SqRangeMapping {
  sheet: string;
  startRow: number;
  endRow: number;
  slotCol: string;
  textCol: string;
}

export interface TemplateMap {
  templateVersion: string;
  generalFields: Record<string, CellCoordinate>;
  sqRange: SqRangeMapping;
  ruleCellMappings: Record<string, RuleCellMapping>;
}

export interface DvlProjectFile {
  formatVersion: string;
  appVersion: string;
  createdAt: string;
  lastSavedAt: string;
  author: string;
  checkerName?: string;
  jobName: string;
  comNumber: string;
  rulePack: {
    version: string;
    sha256: string;
  };
  sourceXml: {
    fileName: string;
    fileSha256: string;
    schemaVersion: string;
    rawXml: string;
  };
  normalizedGraph: NormalizedXmlGraph;
  factRegistry: Record<string, Fact>;
  sqItems: SpecialQuote[];
  checklistInstances: ChecklistInstance[];
  generalComments: string;
}
