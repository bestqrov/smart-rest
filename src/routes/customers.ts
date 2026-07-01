import express, { Request, Response } from 'express'
import prisma from '../prisma'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import {
  getCustomerProfile, searchCustomers, addTag, removeTag, setNotes, addFavorite, removeFavorite,
} from '../customers/CustomerService'

const router = express.Router()

// ─── POST /api/customers/optin ────────────────────────────────────────────────
// Called from QR page after order is placed. Saves customer phone + name for
// WhatsApp re-engagement. Uses tableToken to identify the cafe (no auth required).

router.post('/api/customers/optin', async (req: Request, res: Response) => {
  try {
    const { tableToken, phone, name } = req.body
    if (!tableToken || !phone) return res.status(400).json({ error: 'tableToken and phone required' })

    // Normalize phone: strip spaces/dashes, ensure it starts with +
    const normalized = phone.replace(/[\s\-().]/g, '').replace(/^00/, '+')
    if (!/^\+\d{7,15}$/.test(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    // Resolve cafe from tableToken
    const table = await prisma.table.findFirst({
      where: { qrToken: tableToken, isActive: true },
      select: { cafeId: true }
    })
    if (!table) return res.status(404).json({ error: 'Table not found' })

    // Upsert: if same phone already exists for this cafe, update lastVisit + visits
    await prisma.cafeCustomer.upsert({
      where: { cafeId_phone: { cafeId: table.cafeId, phone: normalized } },
      create: {
        cafeId:    table.cafeId,
        phone:     normalized,
        name:      name?.trim() || null,
        lastVisit: new Date(),
        visits:    1,
        optIn:     true,
      },
      update: {
        lastVisit: new Date(),
        visits:    { increment: 1 },
        ...(name?.trim() ? { name: name.trim() } : {}),
      }
    })

    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── GET /api/n8n/inactive-customers ─────────────────────────────────────────
// Called daily by n8n cron to get customers who haven't visited in X days.
// Protected with N8N_WEBHOOK_SECRET env var (sent as x-n8n-secret header).
// Returns array of customers with their cafe's message template ready to send.

router.get('/api/n8n/inactive-customers', async (req: Request, res: Response) => {
  try {
    const secret = process.env.N8N_WEBHOOK_SECRET
    if (!secret) return res.status(503).json({ error: 'Webhook secret not configured' })

    const incomingSecret = req.headers['x-n8n-secret'] as string
    if (!incomingSecret || incomingSecret !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Find all cafes that have at least one opt-in customer + re-engagement configured
    const cafes = await prisma.cafe.findMany({
      where: {
        isActive: true,
        cafeCustomers: { some: { optIn: true } }
      },
      select: {
        id: true,
        name: true,
        reEngagementMessage: true,
        reEngagementDays: true,
        cafeCustomers: {
          where: { optIn: true },
          select: { phone: true, name: true, lastVisit: true }
        }
      }
    })

    const now = new Date()
    const result: Array<{
      cafeId: string
      cafeName: string
      phone: string
      name: string | null
      lastVisitDays: number
      message: string
    }> = []

    for (const cafe of cafes) {
      const triggerDays = cafe.reEngagementDays ?? 7
      const template    = cafe.reEngagementMessage
        ?? `سلام {{name}} 👋، وحشتنا في {{cafe}}! عندنا عروض خاصة ليك اليوم 🎁`

      for (const customer of cafe.cafeCustomers) {
        const daysSince = Math.floor((now.getTime() - customer.lastVisit.getTime()) / 86_400_000)
        if (daysSince < triggerDays) continue

        const displayName = customer.name || 'صديقنا العزيز'
        const message = template
          .replace(/{{name}}/g, displayName)
          .replace(/{{cafe}}/g, cafe.name)

        result.push({
          cafeId:       cafe.id,
          cafeName:     cafe.name,
          phone:        customer.phone,
          name:         customer.name,
          lastVisitDays: daysSince,
          message,
        })
      }
    }

    return res.json({ count: result.length, customers: result })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── DELETE /api/customers/optout ─────────────────────────────────────────────
// Customer can unsubscribe. Called if they tap "إلغاء الاشتراك" in a future flow.

router.delete('/api/customers/optout', async (req: Request, res: Response) => {
  try {
    const { phone, cafeId } = req.body
    if (!phone || !cafeId) return res.status(400).json({ error: 'phone and cafeId required' })

    await prisma.cafeCustomer.updateMany({
      where: { phone, cafeId },
      data:  { optIn: false }
    })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// ─── K19 CRM Foundation — admin-facing endpoints ─────────────────────────────

// GET /api/admin/customers?search=&tag=&page=&limit=
router.get('/api/admin/customers', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const { search, tag, page, limit } = req.query as Record<string, string>
    const result = await searchCustomers(cafeId, {
      search, tag,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: 'Failed' })
  }
})

// GET /api/admin/customers/:phone — full profile (identity, order/visit history, loyalty)
router.get('/api/admin/customers/:phone', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const profile = await getCustomerProfile(cafeId, req.params.phone as string)
    return res.json(profile)
  } catch (err: any) {
    return res.status(404).json({ error: err.message ?? 'Not found' })
  }
})

// PATCH /api/admin/customers/:phone/tags — body: { action: 'add'|'remove', tag }
router.patch('/api/admin/customers/:phone/tags', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const phone  = req.params.phone as string
    const { action, tag } = req.body as { action?: string; tag?: string }
    if (!tag?.trim()) return res.status(400).json({ error: 'tag is required' })

    const updated = action === 'remove'
      ? await removeTag(cafeId, phone, tag.trim())
      : await addTag(cafeId, phone, tag.trim())
    return res.json({ ok: true, customer: updated })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed' })
  }
})

// PATCH /api/admin/customers/:phone/notes — body: { notes }
router.patch('/api/admin/customers/:phone/notes', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const phone  = req.params.phone as string
    const { notes } = req.body as { notes?: string }
    const updated = await setNotes(cafeId, phone, notes ?? '')
    return res.json({ ok: true, customer: updated })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed' })
  }
})

// PATCH /api/admin/customers/:phone/favorites — body: { action: 'add'|'remove', productId }
router.patch('/api/admin/customers/:phone/favorites', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const cafeId = req.admin!.cafeId
    const phone  = req.params.phone as string
    const { action, productId } = req.body as { action?: string; productId?: string }
    if (!productId) return res.status(400).json({ error: 'productId is required' })

    const updated = action === 'remove'
      ? await removeFavorite(cafeId, phone, productId)
      : await addFavorite(cafeId, phone, productId)
    return res.json({ ok: true, customer: updated })
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? 'Failed' })
  }
})

export default router
