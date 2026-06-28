// ─── SmartSuite Marketplace Engine — Types ────────────────────────────────────

// ── Category ──────────────────────────────────────────────────────────────────

export interface MarketplaceCategory {
  id:           string
  name:         string
  slug:         string
  parentId?:    string
  icon?:        string
  description?: string
  active:       boolean
  sortOrder:    number
  createdAt:    Date
  updatedAt:    Date
}

export interface CategoryTree extends MarketplaceCategory {
  children: CategoryTree[]
}

export interface CreateCategoryInput {
  name:         string
  slug?:        string
  parentId?:    string
  icon?:        string
  description?: string
  sortOrder?:   number
}

// ── Product ───────────────────────────────────────────────────────────────────

export type ProductType =
  | 'HARDWARE'      // physical devices (tablets, printers, terminals)
  | 'SOFTWARE'      // SaaS apps
  | 'DIGITAL'       // templates, configs, digital content
  | 'SERVICE'       // one-time services (setup, training, consultation)
  | 'SUBSCRIPTION'  // recurring plans
  | 'LICENSE'       // time-limited software licenses

export type ProductStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'ARCHIVED'
  | 'OUT_OF_STOCK'

export type ProductVisibility =
  | 'PUBLIC'        // visible to all
  | 'PRIVATE'       // superadmin only
  | 'MODULE_ONLY'   // visible to specific modules (see supportedModules)

export type SupportedModule =
  | 'RESTAURANT'
  | 'HOTEL'
  | 'CLINIC'
  | 'RETAIL'
  | 'ALL'

export interface MarketplaceProduct {
  id:               string
  sku:              string
  name:             string
  slug:             string
  description:      string
  type:             ProductType
  categoryId:       string
  brand?:           string
  status:           ProductStatus
  visibility:       ProductVisibility
  images:           string[]
  tags:             string[]
  metadata:         Record<string, unknown>
  supportedModules: SupportedModule[]
  supplierId?:      string
  createdAt:        Date
  updatedAt:        Date
}

export interface CreateProductInput {
  sku:              string
  name:             string
  slug?:            string
  description:      string
  type:             ProductType
  categoryId:       string
  brand?:           string
  visibility?:      ProductVisibility
  images?:          string[]
  tags?:            string[]
  metadata?:        Record<string, unknown>
  supportedModules?: SupportedModule[]
  supplierId?:      string
  pricing?:         CreatePricingInput
}

export interface UpdateProductInput {
  name?:            string
  description?:     string
  categoryId?:      string
  brand?:           string
  visibility?:      ProductVisibility
  images?:          string[]
  tags?:            string[]
  metadata?:        Record<string, unknown>
  supportedModules?: SupportedModule[]
  supplierId?:      string
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface ProductPricing {
  id:               string
  productId:        string
  basePrice:        number
  currency:         string          // 'MAD' | 'USD' | 'EUR' | ...
  discount?:        number          // percentage 0–100
  promotionalPrice?: number         // explicit override; takes priority over discount
  taxRate:          number          // percentage
  costPrice?:       number          // for internal margin calculation
  margin?:          number          // (basePrice - costPrice) / basePrice × 100
  effectivePrice:   number          // what buyer pays (after discount/promo)
  isActive:         boolean
  validFrom?:       Date
  validTo?:         Date
  createdAt:        Date
  updatedAt:        Date
}

export interface CreatePricingInput {
  basePrice:         number
  currency?:         string
  discount?:         number
  promotionalPrice?: number
  taxRate?:          number
  costPrice?:        number
  validFrom?:        Date
  validTo?:          Date
}

// ── Supplier ──────────────────────────────────────────────────────────────────

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'

export interface MarketplaceSupplier {
  id:           string
  company:      string
  contact:      string
  email:        string
  phone?:       string
  country:      string
  rating:       number    // 1–5
  notes?:       string
  status:       SupplierStatus
  productCount: number    // resolved dynamically
  createdAt:    Date
  updatedAt:    Date
}

export interface CreateSupplierInput {
  company:  string
  contact:  string
  email:    string
  phone?:   string
  country:  string
  rating?:  number
  notes?:   string
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface ProductInventory {
  id:                string
  productId:         string
  stock:             number    // total units
  reserved:          number    // units pending fulfillment
  available:         number    // stock - reserved
  lowStockThreshold: number
  isLowStock:        boolean   // available <= lowStockThreshold
  lastUpdated:       Date
}

export interface StockAdjustment {
  delta:       number     // positive = add, negative = remove
  reason?:     string
  adjustedBy?: string
}

// ── Catalog filters ───────────────────────────────────────────────────────────

export interface ProductFilter {
  categoryId?:      string
  type?:            ProductType
  status?:          ProductStatus
  visibility?:      ProductVisibility
  module?:          SupportedModule
  supplierId?:      string
  tags?:            string[]
  minPrice?:        number
  maxPrice?:        number
  inStockOnly?:     boolean
  search?:          string
  page?:            number
  limit?:           number
  sortBy?:          'name' | 'price' | 'createdAt' | 'updatedAt'
  sortOrder?:       'asc' | 'desc'
}

export interface ProductPage {
  products: MarketplaceProduct[]
  total:    number
  page:     number
  pages:    number
}

// ── Feature flag keys ─────────────────────────────────────────────────────────

export const MARKETPLACE_FLAGS = {
  ENABLED:    'marketplace.enabled',
  RESTAURANT: 'marketplace.restaurant',
  HOTEL:      'marketplace.hotel',
  CLINIC:     'marketplace.clinic',
  RETAIL:     'marketplace.retail',
} as const
