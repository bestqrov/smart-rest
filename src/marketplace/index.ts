// ─── Marketplace Engine — Public API ─────────────────────────────────────────
// Shared SmartSuite OS engine. No checkout, no payments, no UI store.

export * from './types'

// Categories
export {
  createCategory,
  updateCategory,
  getCategory,
  getCategoryBySlug,
  getAllCategories,
  getChildCategories,
  getCategoryTree,
  archiveCategory,
} from './categories/CategoryService'

// Products
export {
  createProduct,
  updateProduct,
  setProductStatus,
  archiveProduct,
  publishProduct,
  getProduct,
  getProductBySku,
  getProductsByCategory,
  getProductsByModule,
  getProductsBySupplier,
} from './products/ProductService'

// Pricing
export {
  createPricing,
  updatePricing,
  getProductPricing,
  isPricingValid,
  calculateEffectivePrice,
  calculateMargin,
  calculateWithTax,
} from './pricing/PricingService'

// Suppliers
export {
  createSupplier,
  updateSupplier,
  getSupplier,
  getAllSuppliers,
  setSupplierStatus,
} from './suppliers/SupplierService'

// Inventory
export {
  getInventory,
  setStock,
  adjustStock,
  reserveStock,
  releaseReservation,
  setLowStockThreshold,
  getLowStockProducts,
  getAllInventory,
} from './inventory/InventoryService'

// Catalog (high-level read API used by product modules)
export {
  getProducts,
  getProduct as getCatalogProduct,
  getProductBySlug,
  search,
  filter,
  getFeatured,
  getCategories,
  getCategoryTree as getCatalogTree,
  getProductWithDetails,
} from './catalog/CatalogService'

// Orders
export {
  createOrder,
  addItemToOrder,
  removeItemFromOrder,
  submitOrder,
  cancelOrder,
  getOrder,
  getOrders,
  calculateTotals,
} from './orders/OrderService'

export {
  getOrderItems,
} from './order-items/OrderItemService'

export {
  markUnderReview,
  approveOrder,
  rejectOrder,
  fulfillOrder,
} from './approval/ApprovalService'

export {
  calculateOrderTotals,
  calculateItemTotal,
} from './services/OrderTotalsService'

export {
  canTransition,
  assertTransition,
  isFinalStatus,
  isEditableStatus,
} from './workflow/OrderWorkflow'

// Feature flag keys
export const MARKETPLACE_FLAGS = {
  ENABLED:    'marketplace.enabled',
  RESTAURANT: 'marketplace.restaurant',
  HOTEL:      'marketplace.hotel',
  CLINIC:     'marketplace.clinic',
  RETAIL:     'marketplace.retail',
} as const

const MARKETPLACE_MODULE_FLAGS = [
  { key: MARKETPLACE_FLAGS.ENABLED,    name: 'Marketplace Engine',         description: 'Master switch for the Marketplace Engine' },
  { key: MARKETPLACE_FLAGS.RESTAURANT, name: 'Marketplace — Restaurant',   description: 'Marketplace visibility for Restaurant module' },
  { key: MARKETPLACE_FLAGS.HOTEL,      name: 'Marketplace — Hotel',        description: 'Marketplace visibility for Hotel module' },
  { key: MARKETPLACE_FLAGS.CLINIC,     name: 'Marketplace — Clinic',       description: 'Marketplace visibility for Clinic module' },
  { key: MARKETPLACE_FLAGS.RETAIL,     name: 'Marketplace — Retail',       description: 'Marketplace visibility for Retail module' },
]

// Init — seed marketplace feature flags (idempotent, safe on every start)
export async function initMarketplaceEngine(): Promise<void> {
  try {
    const { default: prisma } = await import('../prisma')
    for (const flag of MARKETPLACE_MODULE_FLAGS) {
      await (prisma as any).featureFlag.upsert({
        where:  { key: flag.key },
        update: {},
        create: {
          key:         flag.key,
          name:        flag.name,
          description: flag.description,
          status:      'comingSoon',
          scope:       'global',
          targetIds:   [],
        },
      })
    }
  } catch {
    // Non-fatal — engine still functions without feature flags
  }
}
