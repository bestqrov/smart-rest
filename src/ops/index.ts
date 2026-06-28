// ─── SmartSuite Operations Layer — Public API ─────────────────────────────────

// ── Health ────────────────────────────────────────────────────────────────────
export { getSystemHealth } from './health/HealthService'

// ── Diagnostics ───────────────────────────────────────────────────────────────
export { runDiagnostics } from './diagnostics/DiagnosticsService'

// ── System Metrics ────────────────────────────────────────────────────────────
export { collectSystemMetrics } from './metrics/SystemMetrics'

// ── Logs ──────────────────────────────────────────────────────────────────────
export { getLogs, getLogModules } from './logs/LogService'

// ── Backup ────────────────────────────────────────────────────────────────────
export {
  triggerBackup,
  getBackupHistory,
  getBackup,
  deleteBackup,
} from './backup/BackupService'

// ── Runtime Config ────────────────────────────────────────────────────────────
export {
  getAllSettings,
  getSetting,
  updateSetting,
  isMaintenanceMode,
} from './runtime/RuntimeConfig'

// ── Security ──────────────────────────────────────────────────────────────────
export { getSecurityOverview } from './security/SecurityService'

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  HealthStatus,
  ModuleHealth,
  SystemHealth,
  DiagnosticCheck,
  DiagnosticsReport,
  DiagnosticStatus,
  SystemMetrics,
  LogSeverity,
  LogSource,
  PlatformLogEntry,
  LogFilter,
  LogPage,
  BackupRecord,
  BackupStatus,
  RuntimeSetting,
  SettingType,
  SecurityOverview,
} from './types'
