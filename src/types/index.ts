export type FactStatus = 'Known' | 'Derived' | 'Unknown' | 'ManuallyOverridden';
export type FactConfidence = 'Authoritative' | 'RequiresConfirmation';
/** How a persisted fact got its value. This is separate from status/confidence. */
export type FactSourceState = 'present' | 'absent' | 'malformed' | 'defaulted' | 'derived' | 'manual';

export interface FactSnapshot {
  value: unknown;
  status: FactStatus;
  confidence: FactConfidence;
  sourceRawValue?: unknown;
  sourcePointer?: string;
  derivationName?: string;
  promptNote?: string;
  sourceState?: FactSourceState;
}

export interface FactAuditEntry {
  action: string;
  timestamp: string;
  by: string;
  note?: string;
  snapshot: FactSnapshot;
}
export type RuleApplicability = 'Applicable' | 'NotApplicable' | 'NeedsInput';
export type CheckStatus = 'Incomplete' | 'Passed' | 'NA' | 'Flagged' | 'NeedsInput' | 'NotApplicable';
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
  /** Source presence/provenance is explicit so defaults cannot look authored. */
  sourceState?: FactSourceState;
  derivationName?: string;
  confidence: FactConfidence;
  promptNote?: string;          // Guidance when unconfirmed or unknown
  overrideHistory?: Array<{
    previousValue: T | null;
    overriddenBy: string;
    timestamp: string;
    note?: string;
  }>;
  /** Immutable baseline captured before the first manual override. */
  originalSnapshot?: FactSnapshot;
  /** Append-only audit records for overrides and reverts. */
  auditHistory?: FactAuditEntry[];
  /** Diagnostic calculation retained separately from authoritative value. */
  calculatedValue?: unknown;
}

export interface UnitDoor {
  id: string;
  segmentId: string;
  unitSide: string;
  width: number;
  height: number;
  swing: string;
  hingeSide: string;
  hasWindow: boolean;
  hasViewPort: boolean;
  latchType: string;
  doorType: string;
}

export interface UnitDamper {
  id: string;
  segmentId: string;
  unitSide: string;
  width: number;
  height: number;
  depth: number;
  damperType: string;
  actuatorType: string;
  bladeType: string;
  hasAttachedLouver: boolean;
}

export interface UnitFloorDrain {
  id: string;
  segmentId: string;
  unitSide: string;
  type: string;
  pipingMaterial: string;
  connectionDiameter: number;
  holeDiameter: number;
  connectionSide: string;
  geometry: { x: number; y: number; z: number; xLength: number; yLength: number; zLength: number };
}

export interface UnitDuctOpening {
  id: string;
  segmentId: string;
  unitSide: string;
  width: number;
  height: number;
  shape: string;
  airType: string;
  ductType: string;
}

export interface UnitDrainPanOpening {
  id: string;
  segmentId: string;
  width: number;
  length: number;
  depth: number;
}

export interface FanConfig {
  isFanArray: boolean;
  arrayQtyHeight: number;
  arrayQtyWidth: number;
  arrayGrid: string;
  hasRedundancy: boolean;
  hasStand: boolean;
  hasDualFanSeparationWall: boolean;
  hasMotorRemovalRail: boolean;
  isolationType: string;
  fanCount: number;
  motorHp: number;
  voltage: number;
}

export interface CoilConfig {
  bulkheadMaterial: string;
  hasStackingRack: boolean;
  stackingRackMaterial: string;
  dripPanMaterial: string;
  staggeredOverlap: number;
  connectionHand: string;
  coilCount: number;
}

export interface FilterConfig {
  filterType: string;
  loadMethod: string;
  bulkheadMaterial: string;
  gaugeType: string;
  gaugeDoorId: string;
  gaugeMountingType: string;
}

export interface HeatWheelConfig {
  vendor: string;
  model: string;
  wheelType: string;
  mediaType: string;
  hasPurge: boolean;
  allowVariableSpeed: boolean;
  wheelDiameter: number;
  recoveryPercentCFM: number;
}

export interface TestingOptions {
  deflectionTest: string;
  leakageTest: string;
  fanVibrationTest: string;
  requireCustomerWitness: boolean;
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
  subFloorMaterialType?: string;
  subFloorMaterialGauge?: number;
  subFloorPaintType?: string;
  floorAttachmentType?: string;
  isUpperBase?: boolean;
  dimensions: { x: number; y: number; z: number; xLength: number; yLength: number; zLength: number };
}

export interface SurfaceDetail {
  exteriorMaterial: string;
  exteriorGauge: number;
  exteriorPaint?: string;
  interiorMaterial: string;
  interiorGauge: number;
  interiorPaint?: string;
  housingThickness: number;
}

export interface SegmentSurfaces {
  left?: SurfaceDetail;
  front?: SurfaceDetail;
  right?: SurfaceDetail;
  rear?: SurfaceDetail;
  top?: SurfaceDetail;
  bottom?: SurfaceDetail;
}

export interface Segment {
  id: string;
  tag: string;
  typeCode: string;
  name: string;
  weight: number;
  airPressureType: string;
  airVolume: number;
  handOrientation: string;
  dimensions: { x: number; y: number; z: number; xLength: number; yLength: number; zLength: number };
  casing: {
    exteriorMaterial: string;
    exteriorGauge: number;
    interiorMaterial: string;
    interiorGauge: number;
    floorMaterial?: string;
    floorGauge?: number;
    floorGaugeString?: string;
    housingThickness: number;
    housingThicknessFront?: number;
    housingThicknessTop?: number;
    housingStyle: string;
    insulationType: string;
    exteriorPaintType?: string;
    interiorPaintType?: string;
    floorPaintType?: string;
  };
  surfaces?: SegmentSurfaces;
  internals: string[];
  hasFrontChannel: boolean;
  hasRearChannel: boolean;
  hasMotorRemovalRail: boolean;
  isTiered?: boolean;
  tierLevel?: number;
  elevationY?: number;
  doors?: UnitDoor[];
  dampers?: UnitDamper[];
  floorDrains?: UnitFloorDrain[];
  ductOpenings?: UnitDuctOpening[];
  drainPanOpenings?: UnitDrainPanOpening[];
  fanConfig?: FanConfig;
  coilConfig?: CoilConfig;
  filterConfig?: FilterConfig;
  heatWheelConfig?: HeatWheelConfig;
}

export interface ShippingSkid {
  id: string;
  index: number;
  name: string;
  segmentIds: string[];
  baseIds: string[];
  calculatedWeight: number;
  authoritativeWeight?: number;
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
  isTiered?: boolean;
  isStacked?: boolean;
  isStackedTopUnit?: boolean;
  hasFloorDrains?: boolean;
  dimensions: { length: number; width: number; height: number };
  unitOptions: {
    unitType: string;
    brandOption: string;
    unitConstructionType: string;
    shippingProtection?: string;
    washdown: boolean;
    knockdown: boolean;
    hasUTL: boolean;
    lipHeight?: number;
    isSeismic: boolean;
    noa: boolean;
    noaRating?: string | null;
    thermalBreak?: boolean;
    primaryAccessSide: string;
    defaultUnitBaseHeight: number;
    materials: {
      exteriorMaterialType: string;
      exteriorMaterialGauge: number;
      interiorMaterialType: string;
      interiorMaterialGauge: number;
      floorMaterialType: string;
      floorMaterialGauge: number;
      floorMaterialGaugeString?: string;
      housingStyle: string;
      insulationType: string;
      exteriorPaintType?: string;
      interiorPaintType?: string;
      floorPaintType?: string;
      housingThicknessFront?: number;
      housingThicknessTop?: number;
    };
  };
  roofOptions: {
    hasSlopedRoof: boolean;
    roofSlope: number;
    roofSlopeHighSide: string;
    roofPeak?: string;
    roofPeakZDim: number;
  };
  curbOptions: {
    hasCurbRest: boolean;
  };
  testingOptions?: TestingOptions;
  skids: ShippingSkid[];
  bases: UnitBase[];
  segments: Segment[];
  motorControls: MotorControl[];
  doors?: UnitDoor[];
  dampers?: UnitDamper[];
  floorDrains?: UnitFloorDrain[];
  /** Field-level ingestion outcomes used to distinguish absent/malformed/defaulted values. */
  sourceFieldStates?: Record<string, FactSourceState>;
  /** Legacy compact form retained for compatibility with earlier .dvl files. */
  missingFacts?: string[];
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
  category: string;             // Base, Housing, Knockdown, UTL, Paperwork, MOM, Internals
  subgroup?: string;            // Used for Internals: Fan Segments, Coil Segments, Access Segments, Filter Segments, Reconnects
  order: number;
  text: string;
  reference?: string;
  excelRow?: number;
  requiredFacts: string[];
  predicate?: ASTPredicate;     // AST logic rule
  allowNA: boolean;
  verificationMode: 'ManualCheckbox' | 'AutoEvaluated' | 'MeasurementVerify';
  isArchived?: boolean;
}

export interface ChecklistInstance {
  ruleId: string;
  semanticKey: string;
  instanceKey: string;          // e.g. "skid-1:BASE_LIFTING_LUG_SUPPORT" or "unit:SHELL_THERMAL_BREAK"
  scopeTargetId: string;        // "unit" or skid ID "skid-1" or segment ID
  applicability: RuleApplicability;
  applicabilityReason: string;
  status: CheckStatus;
  /** Rule policy copied into instances for readiness checks after persistence. */
  allowNA?: boolean;
  detailerComment: string;
  /** Optional per-instance initials retained for the official workbook export. */
  detailerInitials?: string;
  checkerComment?: string;
  /** Optional checker initials retained for the official workbook export. */
  checkerInitials?: string;
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

export interface TemplateCategoryConfig {
  key: string;
  hasSubgroups: boolean;
  subgroups?: string[];
}

export interface TemplateMap {
  templateVersion: string;
  sheetNames?: Record<string, string>;
  categories?: TemplateCategoryConfig[];
  generalFields: Record<string, CellCoordinate>;
  sqRange: SqRangeMapping;
  ruleCellMappings: Record<string, RuleCellMapping>;
}

export interface OrderRevisionData {
  productType: string;
  jobName: string;
  orderNumber: string;
  lineNumber: number;
  projectName: string;
  projectId: string;
  baseSQOrderNumber: string;
  tagList: string[];
  primaryTag?: string;
}

export interface UpzBundle {
  rawConfigXml: string;
  rawOrderRevXml?: string;
  rawManifestXml?: string;
  orderRevision?: OrderRevisionData;
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
    /** Hash of semantic rule content used during evaluation. */
    ruleSemanticFingerprint?: string;
    /** Hashes/identities of the physical export artifacts used with this pack. */
    templateSha256?: string;
    templateMapSha256?: string;
    approvedMappingsSha256?: string;
    /** True only when the active host can retrieve the exact template by pack hash. */
    templateRetrievable?: boolean;
  };
  /**
   * Immutable evaluator snapshot. The binary template remains external and is
   * matched by templateSha256; a project without this snapshot cannot claim
   * historical reproducibility from hashes alone.
   */
  rulePackSnapshot?: DvlRulePackSnapshot;
  sourceXml: {
    fileName: string;
    fileSha256: string;
    schemaVersion: string;
    rawXml: string;
    isUpzBundle?: boolean;
    orderRevision?: OrderRevisionData;
    rawOrderRevisionXml?: string;
    rawManifestXml?: string;
  };
  normalizedGraph: NormalizedXmlGraph;
  factRegistry: Record<string, Fact>;
  sqItems: SpecialQuote[];
  checklistInstances: ChecklistInstance[];
  generalComments: string;
  /**
   * Integrity metadata for the complete persisted state. Legacy projects may
   * contain only sourceXml.fileSha256 and therefore remain unverified.
   */
  integrity?: {
    algorithm: 'dvl-canonical-json-v1' | string;
    sourceXmlSha256?: string;
    completeStateSha256?: string;
    state: 'complete' | 'source-only' | 'legacy' | 'tampered' | string;
  };
}

export interface DvlRulePackSnapshot {
  version: string;
  bundleSha256: string;
  rules: RuleDefinition[];
  templateMap: TemplateMap;
  approvedMappings: unknown;
  templateSha256?: string;
  templateRetrievable?: boolean;
  templateEmbedded: boolean;
  reproducibility: 'snapshot-without-template' | 'complete' | 'unavailable' | string;
}

export interface RulePackIdentity {
  version: string;
  sha256: string;
  ruleSemanticFingerprint?: string;
  templateSha256?: string;
  templateMapSha256?: string;
  approvedMappingsSha256?: string;
  templateRetrievable?: boolean;
}

export interface RulePackManifestFileEntry {
  sha256: string;
  totalRules?: number;
  activeRules?: number;
  archivedRules?: number;
}

export interface RulePackManifest {
  name: string;
  version: string;
  generatedAt: string;
  bundleSha256: string;
  files: Record<string, RulePackManifestFileEntry>;
}

/** Type aliases for domain clarity and backwards compatibility */
export type DomainFact = Fact;
export type ChecklistItem = ChecklistInstance;

export interface ScopeReadiness {
  scopeTargetId: string;
  totalChecks: number;
  totalChecksCount: number;
  applicableChecks: number;
  totalApplicableChecksCount: number;
  passedChecks: number;
  completedChecksCount: number;
  incompleteChecks: number;
  incompleteChecksCount: number;
  blockedChecks: number;
  blockedChecksCount: number;
  naChecksCount: number;
  percentComplete: number;
  isComplete: boolean;
  isFullyVerified: boolean;
  blockedRules: ChecklistInstance[];
  incompleteRules: ChecklistInstance[];
  passedRules: ChecklistInstance[];
}

export interface UnitReadiness {
  unconfirmedFactsCount: number;
  blockedChecksCount: number;
  incompleteChecksCount: number;
  completedChecksCount: number;
  naChecksCount: number;
  totalApplicableChecksCount: number;
  totalChecksCount: number;
  percentComplete: number;
  isReadyForFinal: boolean;
  blockedRules: ChecklistInstance[];
  unconfirmedFacts: Fact[];
  incompleteRules: ChecklistInstance[];
  passedRules: ChecklistInstance[];
  scopeReadinessMap: Record<string, ScopeReadiness>;
}


