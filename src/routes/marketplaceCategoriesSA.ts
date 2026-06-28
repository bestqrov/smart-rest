import { Router, Request, Response } from 'express'
import {
  getCategoryTree,
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  archiveCategory,
} from '../marketplace/categories/CategoryService'

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

// GET /api/superadmin/marketplace/categories?tree=1&onlyActive=0
router.get('/api/superadmin/marketplace/categories', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const onlyActive = req.query.onlyActive !== '0'
    if (req.query.tree === '1') {
      const tree = await getCategoryTree(onlyActive)
      res.json({ tree })
    } else {
      const categories = await getAllCategories(onlyActive)
      res.json({ categories })
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/marketplace/categories/:id
router.get('/api/superadmin/marketplace/categories/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const category = await getCategory(String(req.params.id))
    if (!category) return res.status(404).json({ error: 'Category not found' }) as any
    res.json({ category })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/superadmin/marketplace/categories
router.post('/api/superadmin/marketplace/categories', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { name, slug, parentId, icon, description, sortOrder } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' }) as any
    const category = await createCategory({ name, slug, parentId, icon, description, sortOrder })
    res.status(201).json({ category })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// PATCH /api/superadmin/marketplace/categories/:id
router.patch('/api/superadmin/marketplace/categories/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { name, slug, parentId, icon, description, active, sortOrder } = req.body
    const category = await updateCategory(String(req.params.id), { name, slug, parentId, icon, description, active, sortOrder })
    res.json({ category })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE /api/superadmin/marketplace/categories/:id  (soft-archive)
router.delete('/api/superadmin/marketplace/categories/:id', async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    await archiveCategory(String(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
