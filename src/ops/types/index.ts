// ─── SmartSuite Operations Layer — Types ──────────────────────────────────────

// ── Health ────────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unavailable'

export interface ModuleHealth {
  module:    string
  label:     string
  status:    HealthStatus
  latencyMs?: number
  message?:  string
  checkedAt: Date
  details?:  Record<string, unknown>
}

export interface SystemHealth {
  overall:   HealthStatus
  modules:   ModuleHealth[]
  checkedAt: Date
  uptimeMs:  number
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export type DiagnosticStatus = 'passed' | 'warning' | 'error'

export interface DiagnosticCheck {
  name:           string
  category:       'connectivity' | 'resources' | 'configuration' | 'data' | 'security'
  status:         DiagnosticStatus
  message:        string
  value?:         string | number
  recommendation?: string
  durationMs:     number
}

export interface DiagnosticsReport {
  runAt:           Date
  durationMs:      number
  passed:          number
  warnings:        number
  errors:          number
  checks:          DiagnosticCheck[]
  recommendations: string[]
}

// ── System Metrics ────────────────────────────────────────────────────────────

export interface SystemMetrics {
  cpu: {
    loadAvg:    [number, number, number]
    cores:      number
    userPercent: number | null
  }
  memory: {
    heapUsedMB:  number
    heapTotalMB: number
    rssMB:       number
    externalMB:  number
    freeMB:      number
    totalMB:     number
  }
  process: {
    uptimeSeconds: number
    pid:           number
    nodeVersion:   string
    env:           string
  }
  database: {
    latencyMs: number
    connected: boolean
  }
  jobs: {
    running:     number
    queued:      number
    failedToday: number
    completed:   number
  }
  collectedAt: Date
}

// ── Platform Logs ─────────────────────────────────────────────────────────────

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error'
export type LogSource = 'audit' | 'system' | 'ai' | 'billing' | 'certification' | 'analytics'

export interface PlatformLogEntry {
  id:           string
  module:       string
  severity:     LogSeverity
  message:      string
  entity?:      string
  entityId?:    string
  performedBy?: string
  timestamp:    Date
  metadata?:    Record<string, unknown>
  source:       LogSource
}

export interface LogFilter {
  module?:    string
  severity?:  LogSeverity
  source?:    LogSource
  search?:    string
  from?:      Date
  to?:        Date
  page?:      number
  limit?:     number
}

export interface LogPage {
  entries: PlatformLogEntry[]
  total:   number
  page:    number
  pages:   number
}

// ── Backup ────────────────────────────────────────────────────────────────────

export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface BackupRecord {
  id:           string
  label:        string
  status:       BackupStatus
  sizeBytes?:   number
  entities:     Record<string, number>
  triggeredBy:  string
  createdAt:    Date
  completedAt?: Date
  error?:       string
  metadata?:    Record<string, unknown>
}

// ── Runtime Config ────────────────────────────────────────────────────────────

export type SettingType = 'string' | 'number' | 'boolean' | 'json'

export interface RuntimeSetting {
  key:         string
  value:       unknown
  type:        SettingType
  description: string
  category:    string
  updatedAt:   Date
  updatedBy?:  string
  readonly?:   boolean
}

// ── Security Overview ─────────────────────────────────────────────────────────

export interface SecurityOverview {
  activeSessions:   number
  fraudAlerts: {
    pending:  number
    total:    number
    recent:   number
  }
  auditActivity: {
    last24h:    number
    last7d:     number
    topModules: { module: string; count: number }[]
  }
  suspiciousPatterns: string[]
  securityScore:      number   // 0–100
  generatedAt:        Date
}
