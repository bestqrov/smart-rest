// ─── SmartSuite OS — Cross-Module Orchestrator ───────────────────────────────
// Subscribes to platform events and triggers cross-module workflows.
// No business logic lives here — only routing between engines.

import { eventBus, AuditService, NotificationService } from '../../core'
import type { PlatformEventName } from '../../core/types'

type WorkflowHandler = (payload: Record<string, unknown>) => Promise<void>

const workflows = new Map<PlatformEventName | string, WorkflowHandler[]>()

// ─── Register a cross-module workflow ─────────────────────────────────────────
export function onPlatformEvent(
  event: PlatformEventName | string,
  handler: WorkflowHandler,
): void {
  const existing = workflows.get(event) ?? []
  existing.push(handler)
  workflows.set(event, existing)
}

// ─── Built-in cross-module workflows ─────────────────────────────────────────

function setupWorkflows(): void {

  // 1. MarketplaceOrderApproved → Audit + Tenant usage + Notification
  onPlatformEvent('MarketplaceOrderApproved', async (payload) => {
    const { orderId, tenantId, total } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'MARKETPLACE',
      action:      'ORDER_APPROVED',
      entity:      'MarketplaceOrder',
      entityId:    orderId,
      performedBy: 'system',
      metadata:    { tenantId, total },
    }).catch(() => undefined)

    // Track usage for tenant
    if (tenantId) {
      import('../../tenant').then(({ increment }) =>
        increment(tenantId, 'marketplaceOrders').catch(() => undefined)
      ).catch(() => undefined)
    }
  })

  // 2. MarketplaceOrderFulfilled → Audit + refresh AI recommendations
  onPlatformEvent('MarketplaceOrderFulfilled', async (payload) => {
    const { orderId, tenantId } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'MARKETPLACE',
      action:      'ORDER_FULFILLED',
      entity:      'MarketplaceOrder',
      entityId:    orderId,
      performedBy: 'system',
      metadata:    { tenantId },
    }).catch(() => undefined)

    // Signal marketplace AI to refresh recommendations
    eventBus.publish('RecommendationGenerated', { tenantId, trigger: 'ORDER_FULFILLED' }, 'Orchestrator')
  })

  // 3. TenantActivated → Audit + notification to platform
  onPlatformEvent('TenantActivated', async (payload) => {
    const { tenantId, activatedBy } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'TENANT',
      action:      'TENANT_ACTIVATED',
      entity:      'TenantProfile',
      entityId:    tenantId,
      performedBy: activatedBy ?? 'system',
      metadata:    { tenantId },
    }).catch(() => undefined)
  })

  // 4. TenantSuspended → Audit
  onPlatformEvent('TenantSuspended', async (payload) => {
    const { tenantId, type, reason } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'TENANT',
      action:      'TENANT_SUSPENDED',
      entity:      'TenantProfile',
      entityId:    tenantId,
      performedBy: 'system',
      metadata:    { tenantId, type, reason },
    }).catch(() => undefined)
  })

  // 5. TenantPlanChanged → Audit
  onPlatformEvent('TenantPlanChanged', async (payload) => {
    const { tenantId, oldPlan, newPlan, changedBy } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'TENANT',
      action:      'PLAN_CHANGED',
      entity:      'TenantProfile',
      entityId:    tenantId,
      performedBy: changedBy ?? 'system',
      metadata:    { tenantId, oldPlan, newPlan },
    }).catch(() => undefined)
  })

  // 6. CertificateIssued → Notification to restaurant + Audit
  onPlatformEvent('CertificateIssued', async (payload) => {
    const { tenantId, certificationId, level } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'CERTIFICATION',
      action:      'CERTIFICATE_ISSUED',
      entity:      'CertificationResult',
      entityId:    certificationId,
      performedBy: 'system',
      metadata:    { tenantId, level },
    }).catch(() => undefined)

    if (tenantId) {
      NotificationService.createNotification({
        level:    'SUCCESS',
        title:    'شهادة جديدة',
        message:  `حصلت على شهادة ${level} من SmartSuite OS.`,
        module:   'CERTIFICATION',
        entityId: certificationId,
        targetId: tenantId,
      }).catch(() => undefined)
    }
  })

  // 7. PaymentSucceeded → Audit
  onPlatformEvent('PaymentSucceeded', async (payload) => {
    const { orderId, tenantId, amount } = payload as Record<string, string>

    AuditService.createAudit({
      module:      'PAYMENT',
      action:      'PAYMENT_SUCCEEDED',
      entity:      'PaymentTransaction',
      entityId:    orderId,
      performedBy: 'system',
      metadata:    { tenantId, amount },
    }).catch(() => undefined)
  })

  // 8. AIGenerationCompleted → Track AI usage
  onPlatformEvent('AIGenerationCompleted', async (payload) => {
    const { tenantId } = payload as Record<string, string>
    if (tenantId) {
      import('../../tenant').then(({ increment }) =>
        increment(tenantId, 'aiRequests').catch(() => undefined)
      ).catch(() => undefined)
    }
  })

  // 9. AutomationExecuted → Track automation usage
  onPlatformEvent('AutomationExecuted', async (payload) => {
    const { tenantId } = payload as Record<string, string>
    if (tenantId) {
      import('../../tenant').then(({ increment }) =>
        increment(tenantId, 'automations').catch(() => undefined)
      ).catch(() => undefined)
    }
  })
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export function initOrchestrator(): void {
  setupWorkflows()

  // Subscribe each workflow to the event bus
  for (const [event, handlers] of workflows.entries()) {
    eventBus.subscribe(event as PlatformEventName, async (platformEvent: any) => {
      const payload = platformEvent.payload as Record<string, unknown>
      for (const handler of handlers) {
        handler(payload).catch(() => undefined)
      }
    })
  }
}

export function listWorkflows(): Array<{ event: string; handlerCount: number }> {
  return Array.from(workflows.entries()).map(([event, handlers]) => ({
    event,
    handlerCount: handlers.length,
  }))
}
