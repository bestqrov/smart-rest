// ─── SmartSuite Core — Public API ─────────────────────────────────────────────
//
// Import from '@core' or 'src/core' in any SmartSuite module.
// Never import from sub-paths directly — always go through this index.

// ── Events ────────────────────────────────────────────────────────────────────
export { eventBus } from './events/EventBus'

// ── Audit ─────────────────────────────────────────────────────────────────────
export * as AuditService from './audit/AuditService'

// ── Notifications ─────────────────────────────────────────────────────────────
export * as NotificationService from './notifications/NotificationService'

// ── File Manager ──────────────────────────────────────────────────────────────
export * as FileService from './files/FileService'
export { registerProvider } from './files/providers/LocalProvider'
export type { FileProvider } from './files/providers/LocalProvider'

// ── Feature Flags ─────────────────────────────────────────────────────────────
export * as FeatureFlagService from './feature-flags/FeatureFlagService'

// ── Types (re-exported for consumers) ────────────────────────────────────────
export type {
  Result,
  PageOptions,
  PagedResult,
  TimestampedEntity,
  AuditEntry,
  CreateAuditInput,
  AuditFilter,
  Notification,
  NotificationLevel,
  CreateNotificationInput,
  NotificationFilter,
  StoredFile,
  StoreFileInput,
  FileProviderType,
  FeatureFlag,
  FlagStatus,
  FlagScope,
  FlagContext,
  PlatformEventName,
  PlatformEvent,
} from './types'

export { ok, err } from './types'

// ── Utils ─────────────────────────────────────────────────────────────────────
export * from './utils'
