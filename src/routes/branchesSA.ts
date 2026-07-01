import { Router } from 'express'
import { addBranch, removeBranch, listBranches, getBranchGroupReport } from '../branches/BranchService'
import { requireSuperAdmin, saEmail } from './_billingAuthGuard'

const router = Router()

// GET /api/superadmin/branches/:parentCafeId
router.get('/api/superadmin/branches/:parentCafeId', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const result = await listBranches(req.params.parentCafeId)
    res.json(result)
  } catch (err: any) { res.status(404).json({ error: err.message }) }
})

// GET /api/superadmin/branches/:parentCafeId/report?from=&to=
router.get('/api/superadmin/branches/:parentCafeId/report', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { from, to } = req.query as Record<string, string>
    const report = await getBranchGroupReport(
      req.params.parentCafeId,
      from ? new Date(from) : undefined,
      to   ? new Date(to)   : undefined,
    )
    res.json(report)
  } catch (err: any) { res.status(404).json({ error: err.message }) }
})

// POST /api/superadmin/branches/link — body: { parentCafeId, branchCafeId }
router.post('/api/superadmin/branches/link', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { parentCafeId, branchCafeId } = req.body as { parentCafeId?: string; branchCafeId?: string }
    if (!parentCafeId || !branchCafeId) return res.status(400).json({ error: 'parentCafeId and branchCafeId are required' })
    const result = await addBranch(parentCafeId, branchCafeId, saEmail(req))
    res.json(result)
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

// POST /api/superadmin/branches/unlink — body: { branchCafeId }
router.post('/api/superadmin/branches/unlink', async (req, res) => {
  if (!requireSuperAdmin(req, res)) return
  try {
    const { branchCafeId } = req.body as { branchCafeId?: string }
    if (!branchCafeId) return res.status(400).json({ error: 'branchCafeId is required' })
    await removeBranch(branchCafeId, saEmail(req))
    res.json({ ok: true })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

export default router
