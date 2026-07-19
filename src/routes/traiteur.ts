import express, { Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Commission per guest based on country and attendee count.
 * Returns amount in the cafe's local currency.
 */
function calcCommission(country: string, attendees: number): number {
  // Per-guest rates (descending brackets — first matching bracket wins)
  const BRACKETS: Record<string, { min: number; max: number; rate: number }[]> = {
    MA: [
      { min: 500, max: Infinity, rate: 1.0  },
      { min: 300, max: 499,      rate: 1.5  },
      { min: 151, max: 299,      rate: 2.0  },
      { min: 51,  max: 150,      rate: 2.5  },
      { min: 1,   max: 50,       rate: 3.0  },
    ],
    DZ: [{ min: 1, max: Infinity, rate: 80  }],
    TN: [{ min: 1, max: Infinity, rate: 1.5 }],
    EG: [{ min: 1, max: Infinity, rate: 15  }],
    SA: [
      { min: 500, max: Infinity, rate: 2.0  },
      { min: 300, max: 499,      rate: 2.5  },
      { min: 151, max: 299,      rate: 3.0  },
      { min: 51,  max: 150,      rate: 4.0  },
      { min: 1,   max: 50,       rate: 5.0  },
    ],
    AE: [
      { min: 500, max: Infinity, rate: 2.0  },
      { min: 300, max: 499,      rate: 2.5  },
      { min: 151, max: 299,      rate: 3.0  },
      { min: 51,  max: 150,      rate: 4.0  },
      { min: 1,   max: 50,       rate: 5.0  },
    ],
    FR: [
      { min: 500, max: Infinity, rate: 0.60 },
      { min: 300, max: 499,      rate: 0.80 },
      { min: 151, max: 299,      rate: 1.00 },
      { min: 51,  max: 150,      rate: 1.20 },
      { min: 1,   max: 50,       rate: 1.50 },
    ],
    // caps (max per event)
  }

  const CAPS: Record<string, number> = {
    MA: 2000, SA: 800, AE: 800, FR: 400, DZ: 20000, TN: 500, EG: 800,
  }

  const brackets = BRACKETS[country.toUpperCase()] ?? BRACKETS['MA']
  const bracket  = brackets.find(b => attendees >= b.min && attendees <= b.max)
  const rate     = bracket?.rate ?? 1.0
  const raw      = parseFloat((attendees * rate).toFixed(2))
  const cap      = CAPS[country.toUpperCase()] ?? 2000
  return Math.min(raw, cap)
}

// ─── GET /api/traiteur/events — list all events ───────────────────────────────

router.get('/api/traiteur/events', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const events = await prisma.event.findMany({
      where:   { cafeId },
      orderBy: { date: 'desc' },
      select: {
        id: true, name: true, type: true, date: true, venue: true,
        guestCount: true, status: true, clientName: true, clientPhone: true,
        quotedPrice: true, depositPaid: true, actualAttendees: true, commissionAmount: true,
        createdAt: true,
        _count: { select: { guests: true } }
      }
    })
    return res.json(events)
  } catch (err) {
    logger.error({ msg: 'GET /api/traiteur/events error', err })
    return res.status(500).json({ error: 'Failed to fetch events' })
  }
})

// ─── POST /api/traiteur/events — create event ─────────────────────────────────

router.post('/api/traiteur/events', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const {
      name, type, date, venue, guestCount,
      clientName, clientPhone, clientEmail,
      quotedPrice, depositPaid, depositDate, notes
    } = req.body as {
      name:         string
      type?:        string
      date:         string
      venue?:       string
      guestCount?:  number
      clientName?:  string
      clientPhone?: string
      clientEmail?: string
      quotedPrice?: number
      depositPaid?: number
      depositDate?: string
      notes?:       string
    }

    if (!name?.trim() || !date) {
      return res.status(400).json({ error: 'name and date are required' })
    }

    const event = await prisma.event.create({
      data: {
        cafeId,
        name:        name.trim(),
        type:        type ?? 'WEDDING',
        date:        new Date(date),
        venue:       venue ?? '',
        guestCount:  guestCount ?? 0,
        clientName:  clientName  ?? '',
        clientPhone: clientPhone ?? '',
        clientEmail: clientEmail ?? '',
        quotedPrice: quotedPrice ?? undefined,
        depositPaid: depositPaid ?? undefined,
        depositDate: depositDate ? new Date(depositDate) : undefined,
        notes:       notes ?? '',
        status:      'DRAFT',
      }
    })

    logger.info({ msg: 'event created', cafeId, eventId: event.id })
    return res.status(201).json(event)
  } catch (err) {
    logger.error({ msg: 'POST /api/traiteur/events error', err })
    return res.status(500).json({ error: 'Failed to create event' })
  }
})

// ─── GET /api/traiteur/events/:id — event detail ─────────────────────────────

router.get('/api/traiteur/events/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({
      where:   { id: eventId },
      include: { guests: { orderBy: [{ tableNumber: 'asc' }, { seatNumber: 'asc' }] } }
    })

    if (!event || event.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Event not found' })
    }

    return res.json(event)
  } catch (err) {
    logger.error({ msg: 'GET /api/traiteur/events/:id error', err })
    return res.status(500).json({ error: 'Failed to fetch event' })
  }
})

// ─── PATCH /api/traiteur/events/:id — update event ───────────────────────────

router.patch('/api/traiteur/events/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const existing = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!existing || existing.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Event not found' })
    }

    const {
      name, type, date, venue, guestCount, status,
      clientName, clientPhone, clientEmail,
      quotedPrice, depositPaid, depositDate, notes
    } = req.body as Record<string, any>

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(name        !== undefined && { name: String(name).trim() }),
        ...(type        !== undefined && { type }),
        ...(date        !== undefined && { date: new Date(date) }),
        ...(venue       !== undefined && { venue }),
        ...(guestCount  !== undefined && Number.isFinite(Number(guestCount)) && Number(guestCount) >= 0 && { guestCount: Math.floor(Number(guestCount)) }),
        ...(status      !== undefined && { status }),
        ...(clientName  !== undefined && { clientName }),
        ...(clientPhone !== undefined && { clientPhone }),
        ...(clientEmail !== undefined && { clientEmail }),
        ...(quotedPrice !== undefined && Number.isFinite(Number(quotedPrice)) && { quotedPrice: Number(quotedPrice) }),
        ...(depositPaid !== undefined && Number.isFinite(Number(depositPaid)) && { depositPaid: Number(depositPaid) }),
        ...(depositDate !== undefined && { depositDate: new Date(depositDate) }),
        ...(notes       !== undefined && { notes }),
      }
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH /api/traiteur/events/:id error', err })
    return res.status(500).json({ error: 'Failed to update event' })
  }
})

// ─── DELETE /api/traiteur/events/:id — delete event ──────────────────────────

router.delete('/api/traiteur/events/:id', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const existing = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!existing || existing.cafeId !== cafeId) {
      return res.status(404).json({ error: 'Event not found' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.guest.deleteMany({ where: { eventId } })
      await tx.event.delete({ where: { id: eventId } })
    })

    logger.info({ msg: 'event deleted', cafeId, eventId })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE /api/traiteur/events/:id error', err })
    return res.status(500).json({ error: 'Failed to delete event' })
  }
})

// ─── GET /api/traiteur/events/:id/guests — list guests ───────────────────────

router.get('/api/traiteur/events/:id/guests', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const guests = await prisma.guest.findMany({
      where:   { eventId },
      orderBy: [{ tableNumber: 'asc' }, { seatNumber: 'asc' }]
    })

    return res.json(guests)
  } catch (err) {
    logger.error({ msg: 'GET guests error', err })
    return res.status(500).json({ error: 'Failed to fetch guests' })
  }
})

// ─── POST /api/traiteur/events/:id/guests — add single guest ─────────────────

router.post('/api/traiteur/events/:id/guests', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { name, phone, email, tableNumber, seatNumber, dietaryReq } = req.body as {
      name:          string
      phone?:        string
      email?:        string
      tableNumber?:  number
      seatNumber?:   number
      dietaryReq?:   string
    }

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

    const guest = await prisma.guest.create({
      data: {
        cafeId,
        eventId,
        name:        name.trim(),
        phone:       phone       ?? '',
        email:       email       ?? '',
        tableNumber: tableNumber ?? undefined,
        seatNumber:  seatNumber  ?? undefined,
        dietaryReq:  dietaryReq  ?? '',
        qrToken:     randomUUID(),
      }
    })

    return res.status(201).json(guest)
  } catch (err) {
    logger.error({ msg: 'POST guest error', err })
    return res.status(500).json({ error: 'Failed to add guest' })
  }
})

// ─── POST /api/traiteur/events/:id/guests/bulk — import many guests ──────────
// Body: { guests: [{ name, phone?, tableNumber?, seatNumber?, dietaryReq? }] }

router.post('/api/traiteur/events/:id/guests/bulk', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { guests } = req.body as {
      guests: {
        name:         string
        phone?:       string
        email?:       string
        tableNumber?: number
        seatNumber?:  number
        dietaryReq?:  string
      }[]
    }

    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ error: 'guests array is required' })
    }
    if (guests.length > 500) {
      return res.status(400).json({ error: 'Max 500 guests per import' })
    }

    const created = await prisma.$transaction(
      guests.map(g =>
        prisma.guest.create({
          data: {
            cafeId,
            eventId,
            name:        g.name?.trim() ?? 'Invité',
            phone:       g.phone       ?? '',
            email:       g.email       ?? '',
            tableNumber: g.tableNumber ?? undefined,
            seatNumber:  g.seatNumber  ?? undefined,
            dietaryReq:  g.dietaryReq  ?? '',
            qrToken:     randomUUID(),
          }
        })
      )
    )

    // Update guestCount to reflect total guests in DB (not just this batch)
    const totalGuests = await prisma.guest.count({ where: { eventId } })
    await prisma.event.update({
      where: { id: eventId },
      data:  { guestCount: totalGuests }
    })

    logger.info({ msg: 'bulk guests imported', cafeId, eventId, count: created.length })
    return res.status(201).json({ imported: created.length, guests: created })
  } catch (err) {
    logger.error({ msg: 'POST guests/bulk error', err })
    return res.status(500).json({ error: 'Failed to import guests' })
  }
})

// ─── DELETE /api/traiteur/events/:id/guests/:guestId ─────────────────────────

router.delete('/api/traiteur/events/:id/guests/:guestId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const guestId    = req.params.guestId as string

    const guest = await prisma.guest.findUnique({ where: { id: guestId }, select: { cafeId: true } })
    if (!guest || guest.cafeId !== cafeId) return res.status(404).json({ error: 'Guest not found' })

    await prisma.guest.delete({ where: { id: guestId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE guest error', err })
    return res.status(500).json({ error: 'Failed to delete guest' })
  }
})

// ─── GET /api/traiteur/events/:id/menu — list the event's menu package ───────

router.get('/api/traiteur/events/:id/menu', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({
      where:  { id: eventId },
      select: { cafeId: true, menuPackageName: true, pricePerGuest: true, guestCount: true }
    })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const items = await prisma.eventMenuItem.findMany({
      where:   { eventId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }]
    })

    return res.json({
      menuPackageName: event.menuPackageName,
      pricePerGuest:   event.pricePerGuest,
      guestCount:      event.guestCount,
      items
    })
  } catch (err) {
    logger.error({ msg: 'GET event menu error', err })
    return res.status(500).json({ error: 'Failed to fetch event menu' })
  }
})

// ─── PATCH /api/traiteur/events/:id/menu — set package name / price per guest ─

router.patch('/api/traiteur/events/:id/menu', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { menuPackageName, pricePerGuest } = req.body as { menuPackageName?: string; pricePerGuest?: number | null }

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(menuPackageName !== undefined ? { menuPackageName: menuPackageName.trim() } : {}),
        ...(pricePerGuest   !== undefined ? { pricePerGuest } : {}),
      },
      select: { menuPackageName: true, pricePerGuest: true }
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH event menu error', err })
    return res.status(500).json({ error: 'Failed to update event menu' })
  }
})

// ─── POST /api/traiteur/events/:id/menu/items — add a course/dish to the package ─

router.post('/api/traiteur/events/:id/menu/items', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { category, name, description, order } = req.body as {
      category?:    string
      name:         string
      description?: string
      order?:       number
    }

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

    const VALID_CATEGORIES = ['STARTER', 'MAIN', 'DESSERT', 'DRINK', 'OTHER']
    const cat = VALID_CATEGORIES.includes(category ?? '') ? category! : 'MAIN'

    const item = await prisma.eventMenuItem.create({
      data: {
        cafeId,
        eventId,
        category:    cat,
        name:        name.trim(),
        description: description ?? '',
        order:       order ?? 0,
      }
    })

    return res.status(201).json(item)
  } catch (err) {
    logger.error({ msg: 'POST event menu item error', err })
    return res.status(500).json({ error: 'Failed to add menu item' })
  }
})

// ─── PATCH /api/traiteur/events/:id/menu/items/:itemId — edit a course/dish ───

router.patch('/api/traiteur/events/:id/menu/items/:itemId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const itemId     = req.params.itemId as string

    const item = await prisma.eventMenuItem.findUnique({ where: { id: itemId }, select: { cafeId: true } })
    if (!item || item.cafeId !== cafeId) return res.status(404).json({ error: 'Menu item not found' })

    const { category, name, description, order } = req.body as {
      category?:    string
      name?:        string
      description?: string
      order?:       number
    }

    const VALID_CATEGORIES = ['STARTER', 'MAIN', 'DESSERT', 'DRINK', 'OTHER']

    const updated = await prisma.eventMenuItem.update({
      where: { id: itemId },
      data: {
        ...(category    !== undefined && VALID_CATEGORIES.includes(category) ? { category } : {}),
        ...(name        !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(order       !== undefined ? { order } : {}),
      }
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH event menu item error', err })
    return res.status(500).json({ error: 'Failed to update menu item' })
  }
})

// ─── DELETE /api/traiteur/events/:id/menu/items/:itemId ──────────────────────

router.delete('/api/traiteur/events/:id/menu/items/:itemId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const itemId     = req.params.itemId as string

    const item = await prisma.eventMenuItem.findUnique({ where: { id: itemId }, select: { cafeId: true } })
    if (!item || item.cafeId !== cafeId) return res.status(404).json({ error: 'Menu item not found' })

    await prisma.eventMenuItem.delete({ where: { id: itemId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE event menu item error', err })
    return res.status(500).json({ error: 'Failed to delete menu item' })
  }
})

// ─── GET /api/traiteur/events/:id/services — list extra services ─────────────
// Decor, sound system, DJ, photography, etc. — a free-form checklist, not an
// enum, since caterers offer very different add-ons.

router.get('/api/traiteur/events/:id/services', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const services = await prisma.eventService.findMany({
      where:   { eventId },
      orderBy: { createdAt: 'asc' }
    })

    return res.json(services)
  } catch (err) {
    logger.error({ msg: 'GET event services error', err })
    return res.status(500).json({ error: 'Failed to fetch event services' })
  }
})

// ─── POST /api/traiteur/events/:id/services — add an extra service ───────────

router.post('/api/traiteur/events/:id/services', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { name, details, vendor, cost, status } = req.body as {
      name:     string
      details?: string
      vendor?:  string
      cost?:    number
      status?:  string
    }

    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })

    const VALID_STATUS = ['NEEDED', 'CONFIRMED', 'DONE']
    const st = VALID_STATUS.includes(status ?? '') ? status! : 'NEEDED'

    const service = await prisma.eventService.create({
      data: {
        cafeId,
        eventId,
        name:    name.trim(),
        details: details ?? '',
        vendor:  vendor  ?? '',
        cost:    cost ?? undefined,
        status:  st,
      }
    })

    return res.status(201).json(service)
  } catch (err) {
    logger.error({ msg: 'POST event service error', err })
    return res.status(500).json({ error: 'Failed to add service' })
  }
})

// ─── PATCH /api/traiteur/events/:id/services/:serviceId ──────────────────────

router.patch('/api/traiteur/events/:id/services/:serviceId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId }  = req.admin!
    const serviceId   = req.params.serviceId as string

    const service = await prisma.eventService.findUnique({ where: { id: serviceId }, select: { cafeId: true } })
    if (!service || service.cafeId !== cafeId) return res.status(404).json({ error: 'Service not found' })

    const { name, details, vendor, cost, status } = req.body as {
      name?:    string
      details?: string
      vendor?:  string
      cost?:    number | null
      status?:  string
    }

    const VALID_STATUS = ['NEEDED', 'CONFIRMED', 'DONE']

    const updated = await prisma.eventService.update({
      where: { id: serviceId },
      data: {
        ...(name    !== undefined ? { name: name.trim() } : {}),
        ...(details !== undefined ? { details } : {}),
        ...(vendor  !== undefined ? { vendor } : {}),
        ...(cost    !== undefined ? { cost } : {}),
        ...(status  !== undefined && VALID_STATUS.includes(status) ? { status } : {}),
      }
    })

    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH event service error', err })
    return res.status(500).json({ error: 'Failed to update service' })
  }
})

// ─── DELETE /api/traiteur/events/:id/services/:serviceId ─────────────────────

router.delete('/api/traiteur/events/:id/services/:serviceId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId }  = req.admin!
    const serviceId   = req.params.serviceId as string

    const service = await prisma.eventService.findUnique({ where: { id: serviceId }, select: { cafeId: true } })
    if (!service || service.cafeId !== cafeId) return res.status(404).json({ error: 'Service not found' })

    await prisma.eventService.delete({ where: { id: serviceId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE event service error', err })
    return res.status(500).json({ error: 'Failed to delete service' })
  }
})

// ─── Payments (installment schedule) ──────────────────────────────────────────

router.get('/api/traiteur/events/:id/payments', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const payments = await prisma.eventPayment.findMany({
      where:   { eventId },
      orderBy: { createdAt: 'asc' }
    })
    return res.json(payments)
  } catch (err) {
    logger.error({ msg: 'GET event payments error', err })
    return res.status(500).json({ error: 'Failed to fetch payments' })
  }
})

router.post('/api/traiteur/events/:id/payments', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { label, amount, dueDate, method } = req.body as {
      label: string; amount: number; dueDate?: string; method?: string
    }

    if (!label?.trim())            return res.status(400).json({ error: 'label is required' })
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' })

    const payment = await prisma.eventPayment.create({
      data: {
        cafeId, eventId,
        label:   label.trim(),
        amount,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        method:  method ?? '',
      }
    })
    return res.status(201).json(payment)
  } catch (err) {
    logger.error({ msg: 'POST event payment error', err })
    return res.status(500).json({ error: 'Failed to add payment' })
  }
})

router.patch('/api/traiteur/events/:id/payments/:paymentId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId }  = req.admin!
    const paymentId   = req.params.paymentId as string

    const payment = await prisma.eventPayment.findUnique({ where: { id: paymentId }, select: { cafeId: true } })
    if (!payment || payment.cafeId !== cafeId) return res.status(404).json({ error: 'Payment not found' })

    const { label, amount, dueDate, method, status, markPaid } = req.body as {
      label?: string; amount?: number; dueDate?: string | null; method?: string; status?: string; markPaid?: boolean
    }

    const VALID_STATUS = ['PENDING', 'PAID']

    const updated = await prisma.eventPayment.update({
      where: { id: paymentId },
      data: {
        ...(label   !== undefined ? { label: label.trim() } : {}),
        ...(amount  !== undefined ? { amount } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(method  !== undefined ? { method } : {}),
        ...(status  !== undefined && VALID_STATUS.includes(status) ? { status } : {}),
        ...(markPaid ? { status: 'PAID', paidDate: new Date() } : {}),
      }
    })
    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH event payment error', err })
    return res.status(500).json({ error: 'Failed to update payment' })
  }
})

router.delete('/api/traiteur/events/:id/payments/:paymentId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId }  = req.admin!
    const paymentId   = req.params.paymentId as string

    const payment = await prisma.eventPayment.findUnique({ where: { id: paymentId }, select: { cafeId: true } })
    if (!payment || payment.cafeId !== cafeId) return res.status(404).json({ error: 'Payment not found' })

    await prisma.eventPayment.delete({ where: { id: paymentId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE event payment error', err })
    return res.status(500).json({ error: 'Failed to delete payment' })
  }
})

// ─── Tasks (checklist / timeline) ─────────────────────────────────────────────

router.get('/api/traiteur/events/:id/tasks', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const tasks = await prisma.eventTask.findMany({
      where:   { eventId },
      orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { order: 'asc' }]
    })
    return res.json(tasks)
  } catch (err) {
    logger.error({ msg: 'GET event tasks error', err })
    return res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

router.post('/api/traiteur/events/:id/tasks', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { title, dueDate } = req.body as { title: string; dueDate?: string }
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' })

    const task = await prisma.eventTask.create({
      data: { cafeId, eventId, title: title.trim(), dueDate: dueDate ? new Date(dueDate) : undefined }
    })
    return res.status(201).json(task)
  } catch (err) {
    logger.error({ msg: 'POST event task error', err })
    return res.status(500).json({ error: 'Failed to add task' })
  }
})

router.patch('/api/traiteur/events/:id/tasks/:taskId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const taskId     = req.params.taskId as string

    const task = await prisma.eventTask.findUnique({ where: { id: taskId }, select: { cafeId: true } })
    if (!task || task.cafeId !== cafeId) return res.status(404).json({ error: 'Task not found' })

    const { title, dueDate, done } = req.body as { title?: string; dueDate?: string | null; done?: boolean }

    const updated = await prisma.eventTask.update({
      where: { id: taskId },
      data: {
        ...(title   !== undefined ? { title: title.trim() } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(done    !== undefined ? { done, doneAt: done ? new Date() : null } : {}),
      }
    })
    return res.json(updated)
  } catch (err) {
    logger.error({ msg: 'PATCH event task error', err })
    return res.status(500).json({ error: 'Failed to update task' })
  }
})

router.delete('/api/traiteur/events/:id/tasks/:taskId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const taskId     = req.params.taskId as string

    const task = await prisma.eventTask.findUnique({ where: { id: taskId }, select: { cafeId: true } })
    if (!task || task.cafeId !== cafeId) return res.status(404).json({ error: 'Task not found' })

    await prisma.eventTask.delete({ where: { id: taskId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE event task error', err })
    return res.status(500).json({ error: 'Failed to delete task' })
  }
})

// ─── Staff assignment ──────────────────────────────────────────────────────────

router.get('/api/traiteur/events/:id/staff', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const assignments = await prisma.eventStaffAssignment.findMany({
      where:   { eventId },
      orderBy: { createdAt: 'asc' },
      include: { staff: { select: { id: true, name: true, role: true } } }
    })
    return res.json(assignments)
  } catch (err) {
    logger.error({ msg: 'GET event staff error', err })
    return res.status(500).json({ error: 'Failed to fetch staff assignments' })
  }
})

// GET /api/traiteur/events/:id/staff/available — cafe staff not yet assigned to this event
router.get('/api/traiteur/events/:id/staff/available', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const [allStaff, assigned] = await Promise.all([
      prisma.staff.findMany({ where: { cafeId, isActive: true }, select: { id: true, name: true, role: true } }),
      prisma.eventStaffAssignment.findMany({ where: { eventId }, select: { staffId: true } }),
    ])
    const assignedIds = new Set(assigned.map(a => a.staffId))
    return res.json(allStaff.filter(s => !assignedIds.has(s.id)))
  } catch (err) {
    logger.error({ msg: 'GET available staff error', err })
    return res.status(500).json({ error: 'Failed to fetch available staff' })
  }
})

router.post('/api/traiteur/events/:id/staff', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { cafeId: true } })
    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const { staffId, role, notes } = req.body as { staffId: string; role?: string; notes?: string }
    if (!staffId) return res.status(400).json({ error: 'staffId is required' })

    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { cafeId: true } })
    if (!staff || staff.cafeId !== cafeId) return res.status(404).json({ error: 'Staff member not found' })

    const existing = await prisma.eventStaffAssignment.findFirst({ where: { eventId, staffId } })
    if (existing) return res.status(409).json({ error: 'Staff member already assigned to this event' })

    const assignment = await prisma.eventStaffAssignment.create({
      data: { cafeId, eventId, staffId, role: role ?? '', notes: notes ?? '' },
      include: { staff: { select: { id: true, name: true, role: true } } }
    })
    return res.status(201).json(assignment)
  } catch (err) {
    logger.error({ msg: 'POST event staff error', err })
    return res.status(500).json({ error: 'Failed to assign staff' })
  }
})

router.delete('/api/traiteur/events/:id/staff/:assignmentId', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId }    = req.admin!
    const assignmentId  = req.params.assignmentId as string

    const assignment = await prisma.eventStaffAssignment.findUnique({ where: { id: assignmentId }, select: { cafeId: true } })
    if (!assignment || assignment.cafeId !== cafeId) return res.status(404).json({ error: 'Assignment not found' })

    await prisma.eventStaffAssignment.delete({ where: { id: assignmentId } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'DELETE event staff error', err })
    return res.status(500).json({ error: 'Failed to remove staff assignment' })
  }
})

// ─── GET /api/traiteur/events/:id/cards — generate QR card URLs ──────────────
// Returns the full list of guests with their QR URL for the admin print page.

router.get('/api/traiteur/events/:id/cards', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const [event, cafe] = await Promise.all([
      prisma.event.findUnique({
        where:   { id: eventId },
        include: { guests: { orderBy: [{ tableNumber: 'asc' }, { seatNumber: 'asc' }] } }
      }),
      prisma.cafe.findUnique({ where: { id: cafeId }, select: { subdomain: true } })
    ])

    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${cafe?.subdomain}.smartrestau.com`

    const cards = event.guests.map(g => ({
      guestId:     g.id,
      guestName:   g.name,
      phone:       g.phone,
      tableNumber: g.tableNumber,
      seatNumber:  g.seatNumber,
      dietaryReq:  g.dietaryReq,
      checkedIn:   g.checkedIn,
      // URL encoded in the physical QR code on their place card
      qrUrl: `${baseUrl}/${cafe?.subdomain}/event/${eventId}?guest=${g.qrToken}`,
      qrToken:     g.qrToken,
    }))

    return res.json({
      eventId,
      eventName: event.name,
      eventDate: event.date,
      venue:     event.venue,
      cards
    })
  } catch (err) {
    logger.error({ msg: 'GET /cards error', err })
    return res.status(500).json({ error: 'Failed to generate cards' })
  }
})

// ─── POST /api/traiteur/events/:id/guests/:guestId/checkin ───────────────────
// Called when the guest scans at the entrance (check-in gate).

router.post('/api/traiteur/events/:id/guests/:guestId/checkin', async (req: Request, res: Response) => {
  try {
    const guestToken = req.body.qrToken as string | undefined
    const guestId    = req.params.guestId as string

    // Allow look-up by guestId OR qrToken
    const where = guestToken ? { qrToken: guestToken } : { id: guestId }
    const guest = await prisma.guest.findUnique({ where: where as any, select: { id: true, checkedIn: true, name: true, tableNumber: true, seatNumber: true, eventId: true } })

    if (!guest) return res.status(404).json({ error: 'Guest not found' })
    if (guest.checkedIn) return res.json({ already: true, guest })

    const updated = await prisma.guest.update({
      where: { id: guest.id },
      data:  { checkedIn: true, checkedInAt: new Date() }
    })

    return res.json({ ok: true, guest: updated })
  } catch (err) {
    logger.error({ msg: 'checkin error', err })
    return res.status(500).json({ error: 'Check-in failed' })
  }
})

// ─── POST /api/traiteur/events/:id/guest-scan ─────────────────────────────────
// Called by the guest's browser when they land on their event page.
// Creates (or resumes) a ClientSession with their pre-assigned seat.
// Body: { qrToken: string, deviceId: string }

router.post('/api/traiteur/events/:id/guest-scan', async (req: Request, res: Response) => {
  try {
    const eventId              = req.params.id as string
    const { qrToken, deviceId } = req.body as { qrToken?: string; deviceId?: string }

    if (!qrToken || !deviceId) {
      return res.status(400).json({ error: 'qrToken and deviceId are required' })
    }

    const guest = await prisma.guest.findUnique({
      where:  { qrToken },
      select: { id: true, name: true, tableNumber: true, seatNumber: true, eventId: true, cafeId: true, sessionId: true, checkedIn: true }
    })

    if (!guest || guest.eventId !== eventId) {
      return res.status(404).json({ error: 'Invalid guest QR code' })
    }

    const event = await prisma.event.findUnique({
      where:  { id: eventId },
      select: { id: true, name: true, type: true, date: true, venue: true, status: true, cafeId: true }
    })
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const cafe = await prisma.cafe.findUnique({
      where:  { id: event.cafeId },
      select: { isActive: true, subdomain: true }
    })
    if (!cafe?.isActive) return res.status(403).json({ error: 'Venue unavailable' })

    // If guest already has an active session, resume it
    if (guest.sessionId) {
      const existing = await prisma.clientSession.findUnique({
        where:  { id: guest.sessionId },
        select: { id: true, status: true, expiresAt: true, seatNumber: true }
      })
      const now = new Date()
      if (existing && existing.status === 'active' && existing.expiresAt > now) {
        // Refresh TTL
        const refreshed = await prisma.clientSession.update({
          where: { id: existing.id },
          data:  { lastActiveAt: now, expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000) }
        })
        return res.json({
          sessionId:   refreshed.id,
          seatNumber:  refreshed.seatNumber,
          guestName:   guest.name,
          event,
          subdomain:   cafe.subdomain,
          isNew:       false
        })
      }
    }

    // Need a Table record for the ClientSession — find or create a virtual one
    // For Traiteur, we use tableNumber = guest.tableNumber ?? 0
    const tableNumber = guest.tableNumber ?? 1
    let table = await prisma.table.findFirst({
      where: { cafeId: event.cafeId, tableNumber }
    })
    if (!table) {
      table = await prisma.table.create({
        data: { cafeId: event.cafeId, tableNumber, qrToken: randomUUID(), capacity: 20 }
      })
    }

    const now        = new Date()
    const expiresAt  = new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4h for events
    const seatNumber = guest.seatNumber ?? 1

    const session = await prisma.clientSession.create({
      data: {
        cafeId:      event.cafeId,
        tableId:     table.id,
        seatNumber,
        deviceId,
        status:      'active',
        expiresAt,
        lastActiveAt: now
      }
    })

    // Link session to guest
    await prisma.guest.update({
      where: { id: guest.id },
      data:  { sessionId: session.id }
    })

    // Auto check-in when they scan at their seat
    if (!guest.checkedIn) {
      await prisma.guest.update({
        where: { id: guest.id },
        data:  { checkedIn: true, checkedInAt: now }
      })
    }

    logger.info({ msg: 'guest scanned event card', eventId, guestId: guest.id, seatNumber })

    return res.json({
      sessionId:  session.id,
      seatNumber: session.seatNumber,
      tableId:    table.id,
      guestName:  guest.name,
      event,
      subdomain:  cafe.subdomain,
      isNew:      true
    })
  } catch (err) {
    logger.error({ msg: 'guest-scan error', err })
    return res.status(500).json({ error: 'Guest scan failed' })
  }
})

// ─── POST /api/traiteur/events/:id/close — mark completed + calc commission ──

router.post('/api/traiteur/events/:id/close', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!
    const eventId    = req.params.id as string

    const event = await prisma.event.findUnique({
      where:  { id: eventId },
      select: { id: true, cafeId: true, status: true }
    })

    if (!event || event.cafeId !== cafeId) return res.status(404).json({ error: 'Event not found' })

    const [cafe, attendedGuests] = await Promise.all([
      prisma.cafe.findUnique({ where: { id: cafeId }, select: { country: true } }),
      prisma.guest.count({ where: { eventId, checkedIn: true } })
    ])

    const actualAttendees = attendedGuests
    const commission      = calcCommission(cafe?.country ?? 'MA', actualAttendees)

    const updated = await prisma.event.update({
      where: { id: eventId },
      data:  {
        status:          'COMPLETED',
        actualAttendees,
        commissionAmount: commission
      }
    })

    logger.info({ msg: 'event closed', cafeId, eventId, actualAttendees, commission })
    return res.json({ ok: true, actualAttendees, commission, event: updated })
  } catch (err) {
    logger.error({ msg: 'close event error', err })
    return res.status(500).json({ error: 'Failed to close event' })
  }
})

// ─── GET /api/traiteur/stats — dashboard stats ───────────────────────────────

router.get('/api/traiteur/stats', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { cafeId } = req.admin!

    const [totalEvents, upcomingEvents, totalGuests, totalCommission] = await Promise.all([
      prisma.event.count({ where: { cafeId } }),
      prisma.event.count({ where: { cafeId, status: { in: ['DRAFT', 'CONFIRMED', 'ACTIVE'] }, date: { gte: new Date() } } }),
      prisma.guest.count({ where: { cafeId } }),
      prisma.event.aggregate({
        where:  { cafeId, commissionAmount: { not: null } },
        _sum:   { commissionAmount: true }
      })
    ])

    const recentEvents = await prisma.event.findMany({
      where:   { cafeId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take:    5,
      select:  { id: true, name: true, type: true, date: true, venue: true, guestCount: true, status: true }
    })

    return res.json({
      totalEvents,
      upcomingEvents,
      totalGuests,
      totalCommission: totalCommission._sum.commissionAmount ?? 0,
      recentEvents
    })
  } catch (err) {
    logger.error({ msg: 'GET /api/traiteur/stats error', err })
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
