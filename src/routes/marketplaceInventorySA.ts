import { Router, Request, Response } from 'express'
import {
  getAllInventory,
  getLowStockProducts,
  getInventory,
  setStock,
  adjustStock,
  setLowStockThreshold,
} from '../marketplace/inventory/InventoryService'

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

// GET /api/superadmin/marketplace/inventory
router.get('/api/superadmin/marketplace/inventory', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const inventory = await getAllInventory()
    res.json({ inventory })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/marketplace/inventory/low-stock
router.get('/api/superadmin/marketplace/inventory/low-stock', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const items = await getLowStockProducts()
    res.json({ items })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/marketplace/inventory/:productId
router.get('/api/superadmin/marketplace/inventory/:productId', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const inv = await getInventory(String(req.params.productId))
    if (!inv) return res.status(404).json({ error: 'Inventory record not found' }) as any
    res.json({ inventory: inv })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/inventory/:productId/stock
router.patch('/api/superadmin/marketplace/inventory/:productId/stock', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { stock, threshold } = req.body
    if (typeof stock !== 'number') return res.status(400).json({ error: 'stock (number) is required' }) as any
    const inv = await setStock(String(req.params.productId), stock, threshold)
    res.json({ inventory: inv })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/inventory/:productId/adjust
router.post('/api/superadmin/marketplace/inventory/:productId/adjust', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { delta, reason } = req.body
    if (typeof delta !== 'number') return res.status(400).json({ error: 'delta (number) is required' }) as any
    const inv = await adjustStock(String(req.params.productId), { delta, reason })
    res.json({ inventory: inv })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/inventory/:productId/threshold
router.patch('/api/superadmin/marketplace/inventory/:productId/threshold', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { threshold } = req.body
    if (typeof threshold !== 'number') return res.status(400).json({ error: 'threshold (number) is required' }) as any
    const inv = await setLowStockThreshold(String(req.params.productId), threshold)
    res.json({ inventory: inv })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
