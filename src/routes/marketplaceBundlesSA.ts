import { Router } from 'express'
import * as BundleEngine from '../marketplace/ai/BundleEngine'

const router = Router()

function requireSuperAdmin(req: any, res: any): boolean {
  const secret = req.headers['x-superadmin-secret']
  if (secret !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

// List bundles
router.get('/api/superadmin/marketplace/bundles', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const activeOnly = req.query.active !== '0'
    const bundles = await BundleEngine.listBundles(activeOnly)
    res.json({ bundles })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Get single bundle
router.get('/api/superadmin/marketplace/bundles/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const bundle = await BundleEngine.getBundle(String(req.params.id))
    if (!bundle) return res.status(404).json({ error: 'Not found' })
    res.json({ bundle })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Create bundle
router.post('/api/superadmin/marketplace/bundles', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { name, slug, description, type, bundlePrice, currency, productIds } = req.body
    if (!name || !slug || !description || !type || bundlePrice == null || !productIds?.length) {
      return res.status(400).json({ error: 'name, slug, description, type, bundlePrice, productIds required' })
    }
    const bundle = await BundleEngine.createBundle({ name, slug, description, type, bundlePrice, currency, productIds })
    res.status(201).json({ bundle })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Update bundle
router.patch('/api/superadmin/marketplace/bundles/:id', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const bundle = await BundleEngine.updateBundle(String(req.params.id), req.body)
    res.json({ bundle })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

// Toggle active
router.patch('/api/superadmin/marketplace/bundles/:id/toggle', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const current = await BundleEngine.getBundle(String(req.params.id))
    if (!current) return res.status(404).json({ error: 'Not found' })
    const bundle = await BundleEngine.updateBundle(String(req.params.id), { active: !current.active })
    res.json({ bundle })
  } catch (err: any) { res.status(500).json({ error: err.message }) }
})

export default router
