import { eventBus, AuditService } from '../../core'

// ─── Publish marketplace events to platform EventBus ─────────────────────────

export function emitProductCreated(productId: string, sku: string, type: string, modules: string[]): void {
  eventBus.publish('ProductCreated', { productId, sku, type, supportedModules: modules }, 'marketplace')
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Product',
    entityId:    productId,
    action:      'PRODUCT_CREATED',
    performedBy: 'system',
    metadata:    { sku, type, modules },
  }).catch(() => undefined)
}

export function emitProductUpdated(productId: string, changes: Record<string, unknown>): void {
  eventBus.publish('ProductUpdated', { productId, changes }, 'marketplace')
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Product',
    entityId:    productId,
    action:      'PRODUCT_UPDATED',
    performedBy: 'system',
    metadata:    { changes },
  }).catch(() => undefined)
}

export function emitProductArchived(productId: string): void {
  eventBus.publish('ProductArchived', { productId }, 'marketplace')
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Product',
    entityId:    productId,
    action:      'PRODUCT_ARCHIVED',
    performedBy: 'system',
  }).catch(() => undefined)
}

export function emitSupplierCreated(supplierId: string, company: string): void {
  eventBus.publish('SupplierCreated', { supplierId, company }, 'marketplace')
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Supplier',
    entityId:    supplierId,
    action:      'SUPPLIER_CREATED',
    performedBy: 'system',
    metadata:    { company },
  }).catch(() => undefined)
}

export function emitInventoryUpdated(
  productId:     string,
  previousStock: number,
  newStock:      number,
  available:     number,
): void {
  eventBus.publish('InventoryUpdated', { productId, previousStock, newStock, available }, 'marketplace')
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Inventory',
    entityId:    productId,
    action:      'INVENTORY_UPDATED',
    performedBy: 'system',
    metadata:    { previousStock, newStock, available },
  }).catch(() => undefined)
}

export function emitCategoryCreated(categoryId: string, name: string, parentId?: string): void {
  eventBus.publish('CategoryCreated', { categoryId, name, parentId }, 'marketplace')
  AuditService.createAudit({
    module:      'marketplace',
    entity:      'Category',
    entityId:    categoryId,
    action:      'CATEGORY_CREATED',
    performedBy: 'system',
    metadata:    { name, parentId },
  }).catch(() => undefined)
}
