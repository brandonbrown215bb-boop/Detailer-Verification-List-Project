export const STORAGE_KEYS = {
  DETAILER_NAME: 'dvl_detailer_name',
  SHARED_EXPORT_PATH: 'dvl_shared_export_path',
  CENTRAL_RULEPACK_PATH: 'dvl_central_rulepack_path',
  AUTO_SYNC_RULEPACK: 'dvl_auto_sync_rulepack',
  AUTOSAVE_PROJECT: 'ahu_dvl_autosave',
  THEME: 'dvl_theme_mode'
} as const;

export const FACT_KEYS = {
  JOB_NAME: 'unit.jobName',
  COM_NUMBER: 'unit.comNumber',
  ORDER_NUMBER: 'unit.orderNumber',
  TAG: 'unit.tag',
  DETAILER: 'unit.detailer',
  DATE: 'unit.date',
  BASE_HEIGHT: 'unit.baseHeight',
  CURBREST: 'unit.curbrest',
  LIP_HEIGHT: 'unit.lipHeight',
  HAS_UTL: 'unit.hasUTL',
  SHELL_TYPE: 'unit.shellType',
  UNIT_TYPE: 'unit.unitType',
  WALL_THICKNESS: 'unit.wallThickness',
  THERMAL_BREAK: 'unit.thermalBreak',
  ROOF_PEAK: 'roof.roofPeak',
  IS_SEISMIC: 'unit.isSeismic',
  NOA: 'unit.noa',
  TOTAL_WEIGHT: 'unit.totalWeight',
  TOTAL_STATIC_PRESSURE: 'unit.totalStaticPressure'
} as const;

export const DEFAULT_VALUES = {
  FALLBACK_JOB_NAME: 'Medical Center Phase 3',
  FALLBACK_COM_NUMBER: 'COM-000000',
  FALLBACK_DETAILER: 'Detailer',
  TEMPLATE_REV_LEVEL: 14,
  RULEPACK_NAME: 'AHU Detailing Verification Rule Pack'
} as const;

