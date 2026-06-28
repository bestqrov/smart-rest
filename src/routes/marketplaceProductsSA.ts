import { Router, Request, Response } from 'express'
import {
  createProduct,
  updateProduct,
  archiveProduct,
  publishProduct,
  getProduct,
  getProductBySku,
} from '../marketplace/products/ProductService'
import {
  getProductPricing,
  createPricing,
  updatePricing,
} from '../marketplace/pricing/PricingService'
import {
  getInventory,
  setStock,
  adjustStock,
} from '../marketplace/inventory/InventoryService'
import { getProducts } from '../marketplace/catalog/CatalogService'
import type { ProductType, ProductVisibility, SupportedModule } from '../marketplace/types'

const router = Router()

function requireSuperAdmin(req: Request, res: Response): boolean {
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']
  if (secret !== process.env.SUPERADMIN_SECRET || !email) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// GET /api/superadmin/marketplace/products
router.get('/api/superadmin/marketplace/products', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { search, categoryId, type, status, supplierId, module, page, limit, sortBy, sortOrder } = req.query
    const result = await getProducts({
      search:     search     as string | undefined,
      categoryId: categoryId as string | undefined,
      type:       type       as ProductType | undefined,
      status:     status     as any,
      supplierId: supplierId as string | undefined,
      module:     module     as SupportedModule | undefined,
      page:       page   ? Number(page)  : undefined,
      limit:      limit  ? Number(limit) : undefined,
      sortBy:     sortBy     as any,
      sortOrder:  sortOrder  as any,
    })
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/marketplace/products/:id
router.get('/api/superadmin/marketplace/products/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const [product, pricing, inventory] = await Promise.all([
      getProduct(String(req.params.id)),
      getProductPricing(String(req.params.id)),
      getInventory(String(req.params.id)),
    ])
    if (!product) return res.status(404).json({ error: 'Product not found' }) as any
    res.json({ product, pricing, inventory })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/products
router.post('/api/superadmin/marketplace/products', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { sku, name, slug, description, type, categoryId, brand, visibility, images, tags, metadata, supportedModules, supplierId, pricing } = req.body
    if (!sku || !name || !description || !type || !categoryId) {
      return res.status(400).json({ error: 'sku, name, description, type, categoryId are required' }) as any
    }
    const product = await createProduct({ sku, name, slug, description, type, categoryId, brand, visibility, images, tags, metadata, supportedModules, supplierId, pricing })
    res.status(201).json({ product })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/products/:id
router.patch('/api/superadmin/marketplace/products/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { name, description, categoryId, brand, visibility, images, tags, metadata, supportedModules, supplierId } = req.body
    const product = await updateProduct(String(req.params.id), { name, description, categoryId, brand, visibility, images, tags, metadata, supportedModules, supplierId })
    res.json({ product })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/products/:id/publish
router.post('/api/superadmin/marketplace/products/:id/publish', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const product = await publishProduct(String(req.params.id))
    res.json({ product })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/products/:id/archive
router.post('/api/superadmin/marketplace/products/:id/archive', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    await archiveProduct(String(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/products/:id/pricing
router.patch('/api/superadmin/marketplace/products/:id/pricing', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const productId = String(req.params.id)
    const existing  = await getProductPricing(productId)
    const pricing   = existing
      ? await updatePricing(productId, req.body)
      : await createPricing(productId, req.body)
    res.json({ pricing })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/products/:id/inventory
router.patch('/api/superadmin/marketplace/products/:id/inventory', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const productId = String(req.params.id)
    const { stock, threshold, delta } = req.body
    let inventory
    if (typeof delta === 'number') {
      inventory = await adjustStock(productId, { delta })
    } else {
      inventory = await setStock(productId, Number(stock), threshold !== undefined ? Number(threshold) : undefined)
    }
    res.json({ inventory })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/products/:id/duplicate
router.post('/api/superadmin/marketplace/products/:id/duplicate', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const source = await getProduct(String(req.params.id))
    if (!source) return res.status(404).json({ error: 'Product not found' }) as any

    const suffix  = `-copy-${Date.now()}`
    const newProduct = await createProduct({
      sku:              source.sku + suffix,
      name:             source.name + ' (Copy)',
      description:      source.description,
      type:             source.type,
      categoryId:       source.categoryId,
      brand:            source.brand,
      visibility:       source.visibility,
      images:           source.images,
      tags:             source.tags,
      metadata:         source.metadata,
      supportedModules: source.supportedModules,
      supplierId:       source.supplierId,
    })
    res.status(201).json({ product: newProduct })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
