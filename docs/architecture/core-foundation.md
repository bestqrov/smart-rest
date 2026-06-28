# SmartSuite Core Foundation

`src/core/` is the platform layer shared by every current and future SmartSuite application.

---

## Why Core exists

Before Core, each module (Marketing Brain, Billing, AI Center) implemented its own audit logging, retry logic, and error handling. That created diverging patterns and duplicated infrastructure across 3000+ lines of code.

Core is the answer: one place, one contract, consumed by everything.

---

## Dependency Rule

```
Business modules  →  Core  →  Prisma / Logger
                  ↗
Marketing Brain  →  Core
AI Center        →  Core
Billing          →  Core
Certification    →  Core (future)
SmartHotel       →  Core (future)
```

**Core must never import from any business module.**

---

## Services

### 1. Event Bus — `src/core/events/EventBus.ts`

Lightweight in-process pub/sub. No Redis, no external broker.

```typescript
import { eventBus } from 'src/core'

// Publish
eventBus.publish('RestaurantActivated', { cafeId, plan }, 'billing')

// Subscribe
const unsub = eventBus.subscribe('AIGenerationCompleted', async (event) => {
  await NotificationService.createNotification({ ... })
})

// Unsubscribe
unsub()
```

**Typed events** (`PlatformEventName`): `RestaurantCreated`, `BillingPaid`, `TrialExpired`, `CertificateIssued`, `AIGenerationCompleted`, `AutomationExecuted`, and more.

Handlers run concurrently. Individual handler failures are caught and logged — they never block the publisher.

---

### 2. Audit Service — `src/core/audit/AuditService.ts`

Append-only, tamper-evident audit trail across all modules.

```typescript
import { AuditService } from 'src/core'

// Write
await AuditService.createAudit({
  module:      'billing',
  entity:      'Cafe',
  entityId:    cafeId,
  action:      'SWEEP_APPLIED',
  performedBy: 'system',
  metadata:    { amount: 42.50, currency: 'MAD' },
})

// Read
const history = await AuditService.filterByEntity('Cafe', cafeId)
const byUser  = await AuditService.filterByUser('admin@smartrestau.com')
const byMod   = await AuditService.filterByModule('certification', { page: 2 })
```

Stored in MongoDB collection `core_audit_entries`.

---

### 3. Notification Service — `src/core/notifications/NotificationService.ts`

Storage-backed notification layer. No WebSocket or email delivery yet.

```typescript
import { NotificationService } from 'src/core'

// Create
await NotificationService.createNotification({
  level:    'WARNING',
  title:    'Billing overdue',
  message:  'Cafe "Le Rooftop" has outstanding debt of $142',
  targetId: cafeId,
  module:   'billing',
  entityId: invoiceId,
})

// Read
const notifs = await NotificationService.getNotifications(cafeId, { read: false })
const count  = await NotificationService.countUnread(cafeId)

// Mark
await NotificationService.markRead(notifId)
await NotificationService.markAllRead(cafeId)
```

Levels: `INFO | SUCCESS | WARNING | ERROR | SYSTEM`

Stored in `core_notifications`.

---

### 4. File Service — `src/core/files/FileService.ts`

Provider-agnostic file manager. Switch from local to S3/R2/Supabase by registering a new provider — no code changes in consumers.

```typescript
import { FileService } from 'src/core'

// Store
const file = await FileService.store({
  key:          `menus/${cafeId}/${Date.now()}.pdf`,
  originalName: 'menu.pdf',
  mimeType:     'application/pdf',
  sizeBytes:    buffer.length,
  buffer,
  module:       'menu',
  entityId:     cafeId,
})

// Read
const meta = await FileService.getMetadata(fileId)
const url  = await FileService.generatePublicUrl(fileId)

// Move
await FileService.move(fileId, `archived/${file.key}`)

// Delete
await FileService.deleteFile(fileId)
```

**Registering a custom provider:**

```typescript
import { registerProvider } from 'src/core'

registerProvider('r2', new CloudflareR2Provider({ accountId, token, bucket }))
// Now set FILE_PROVIDER=r2 in env
```

Stored in `core_stored_files`.

---

### 5. Feature Flag Service — `src/core/feature-flags/FeatureFlagService.ts`

Controls which features are visible across tenants and roles.

```typescript
import { FeatureFlagService } from 'src/core'

// Check
const ok = await FeatureFlagService.isEnabled('certification')
const tenantOk = await FeatureFlagService.isEnabled('hotel_module', { tenantId: cafeId })

// Read all
const flags = await FeatureFlagService.getAllFlags()

// Update
await FeatureFlagService.setFlag('certification', { status: 'enabled' })
await FeatureFlagService.setFlag('hotel_module',  { scope: 'tenant', targetIds: [cafeId] })

// Seed defaults (call on server start)
await FeatureFlagService.seedDefaultFlags()
```

Default flags: `marketing_brain`, `ai_center`, `ai_jobs`, `certification`, `analytics`, `marketplace`, `hotel_module`, `clinic_module`, `retail_module`, `whatsapp_integration`, `automation`, `client_map`.

Stored in `core_feature_flags`.

---

## Shared Types

All types are exported from `src/core/types/index.ts`:

| Type | Purpose |
|------|---------|
| `Result<T>` | `{ ok: true, data }` or `{ ok: false, error }` |
| `PagedResult<T>` | `{ items, total, page, pages, limit }` |
| `TimestampedEntity` | `{ createdAt, updatedAt? }` |
| `AuditEntry` | Full audit record |
| `Notification` | Full notification record |
| `StoredFile` | File metadata record |
| `FeatureFlag` | Feature flag record |
| `PlatformEvent<T>` | Typed bus event wrapper |
| `PlatformEventName` | Union of all known event names |

---

## Utilities

```typescript
import { generateId, withRetry, validate, required, normalizePage } from 'src/core'

// UUID
const id = generateId()

// Retry with exponential backoff
const result = await withRetry(() => fetchFromAPI(), { attempts: 3, baseDelayMs: 500 })

// Validation
const check = validate([
  required(email, 'email'),
  maxLength(name, 100, 'name'),
])
if (!check.ok) throw new Error(check.error)

// Pagination
const { page, limit, skip } = normalizePage({ page: 2, limit: 20 })
```

---

## Correct Usage

```typescript
// ✅ A new module imports from Core
import { AuditService, eventBus, NotificationService } from 'src/core'

// ✅ Core is imported, not reached into
import { AuditService } from 'src/core'           // correct
import { createAudit } from 'src/core/audit/...' // also fine, but prefer the index

// ✅ Publish event after business action
eventBus.publish('CertificateIssued', { cafeId, certId }, 'certification')
```

---

## Incorrect Usage

```typescript
// ❌ Core importing from a business module
import { MarketingGeneration } from '../marketing-brain/...'  // never do this in Core

// ❌ Skipping Core to write own audit
await prisma.someTable.create({ data: { action: 'did_thing' } })  // use AuditService

// ❌ Reaching into Core internals instead of using the public index
import prisma from 'src/core/prisma'  // Core does not expose Prisma
```

---

## Future Extensions

| Module | Core services it will use |
|--------|--------------------------|
| Certification | AuditService, NotificationService, FileService, eventBus |
| Analytics | AuditService (read-only aggregation) |
| SmartHotel | All services + new HotelEvent types |
| Automation | eventBus (subscribe to all events), AuditService |
| Marketplace | FileService, FeatureFlagService |

When adding a new `PlatformEventName`, add it to `src/core/types/index.ts` only — all subscribers will automatically pick it up.
