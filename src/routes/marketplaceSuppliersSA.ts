import { Router, Request, Response } from 'express'
import {
  getAllSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  setSupplierStatus,
} from '../marketplace/suppliers/SupplierService'
import type { SupplierStatus } from '../marketplace/types'

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

// GET /api/superadmin/marketplace/suppliers
router.get('/api/superadmin/marketplace/suppliers', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const status    = req.query.status as SupplierStatus | undefined
    const suppliers = await getAllSuppliers(status)
    res.json({ suppliers })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/marketplace/suppliers/:id
router.get('/api/superadmin/marketplace/suppliers/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const supplier = await getSupplier(String(req.params.id))
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' }) as any
    res.json({ supplier })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/suppliers
router.post('/api/superadmin/marketplace/suppliers', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { company, contact, email, phone, country, rating, notes } = req.body
    if (!company || !contact || !email || !country) {
      return res.status(400).json({ error: 'company, contact, email, country are required' }) as any
    }
    const supplier = await createSupplier({ company, contact, email, phone, country, rating, notes })
    res.status(201).json({ supplier })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/suppliers/:id
router.patch('/api/superadmin/marketplace/suppliers/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { company, contact, email, phone, country, rating, notes } = req.body
    const supplier = await updateSupplier(String(req.params.id), { company, contact, email, phone, country, rating, notes })
    res.json({ supplier })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/suppliers/:id/status
router.patch('/api/superadmin/marketplace/suppliers/:id/status', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { status } = req.body as { status: SupplierStatus }
    if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' }) as any
    }
    const supplier = await setSupplierStatus(String(req.params.id), status)
    res.json({ supplier })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
