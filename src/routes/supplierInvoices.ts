import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import prisma from '../prisma'
import logger from '../logger'
import { computeInvoiceStatus } from '../services/supplierInvoiceStatus'

const router = express.Router()

router.get('/summary/stats', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const invoices = await prisma.supplierInvoice.findMany({
      where: { cafeId },
      select: { status: true, amount: true, dueDate: true, createdAt: true, updatedAt: true },
    })

    const unpaidTotal = invoices
      .filter(i => i.status === 'unpaid' || i.status === 'overdue')
      .reduce((s, i) => s + i.amount, 0)

    const overdueCount = invoices.filter(i =>
      (i.status === 'unpaid' || i.status === 'overdue') && i.dueDate && new Date(i.dueDate) < now
    ).length

    const paidThisMonth = invoices
      .filter(i => i.status === 'paid' && new Date(i.updatedAt) >= startOfMonth)
      .reduce((s, i) => s + i.amount, 0)

    return res.json({ unpaidTotal, overdueCount, paidThisMonth, total: invoices.length })
  } catch (err) {
    logger.error({ msg: 'invoice stats error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const { status } = req.query as { status?: string }
  try {
    const invoices = await prisma.supplierInvoice.findMany({
      where: { cafeId, ...(status && status !== 'all' ? { status } : {}) },
      orderBy: { issueDate: 'desc' },
    })
    return res.json({ items: invoices })
  } catch (err) {
    logger.error({ msg: 'invoice list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const {
    supplierName, invoiceNumber, amount, currency,
    issueDate, dueDate, status, documentUrl, notes,
  } = req.body as Record<string, any>

  if (!supplierName || amount == null || !issueDate) {
    return res.status(400).json({ error: 'supplierName, amount and issueDate are required' })
  }

  try {
    const invoice = await prisma.supplierInvoice.create({
      data: {
        cafeId,
        supplierName,
        invoiceNumber: invoiceNumber ?? null,
        amount:        Number(amount),
        currency:      currency      ?? 'MAD',
        issueDate:     new Date(issueDate),
        dueDate:       dueDate       ? new Date(dueDate) : null,
        status:        status        ?? 'unpaid',
        documentUrl:   documentUrl   ?? null,
        notes:         notes         ?? null,
      },
    })
    return res.status(201).json(invoice)
  } catch (err) {
    logger.error({ msg: 'invoice create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const body = req.body as Record<string, any>

  try {
    const existing = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Invoice not found' })

    const data: Record<string, any> = {}
    if (body.supplierName  !== undefined) data.supplierName  = body.supplierName
    if (body.invoiceNumber !== undefined) data.invoiceNumber = body.invoiceNumber
    if (body.amount        !== undefined) data.amount        = Number(body.amount)
    if (body.currency      !== undefined) data.currency      = body.currency
    if (body.issueDate     !== undefined) data.issueDate     = new Date(body.issueDate)
    if (body.dueDate       !== undefined) data.dueDate       = body.dueDate ? new Date(body.dueDate) : null
    if (body.documentUrl   !== undefined) data.documentUrl   = body.documentUrl
    if (body.notes         !== undefined) data.notes         = body.notes
    if (body.status        !== undefined) {
      data.status = body.status
      // The legacy "mark paid" shortcut fully pays the invoice so
      // amountPaid stays consistent with status for anyone still using it.
      if (body.status === 'paid') data.amountPaid = body.amount !== undefined ? Number(body.amount) : existing.amount
    }

    const invoice = await prisma.supplierInvoice.update({ where: { id }, data })
    return res.json(invoice)
  } catch (err) {
    logger.error({ msg: 'invoice update error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/:id', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const existing = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Invoice not found' })
    await prisma.supplierInvoice.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    logger.error({ msg: 'invoice delete error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Payments ──────────────────────────────────────────────────────────────

router.get('/:id/payments', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  try {
    const invoice = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
    const payments = await prisma.supplierPayment.findMany({
      where:   { invoiceId: id, cafeId },
      orderBy: { paidAt: 'desc' },
    })
    return res.json({ items: payments })
  } catch (err) {
    logger.error({ msg: 'invoice payments list error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/:id/payments', authorizeAdmin, async (req: Request, res: Response) => {
  const { cafeId } = req.admin!
  const id = req.params.id as string
  const { amount, method, notes, paidAt } = req.body as Record<string, any>

  if (amount == null || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' })
  }

  try {
    const existing = await prisma.supplierInvoice.findFirst({ where: { id, cafeId } })
    if (!existing) return res.status(404).json({ error: 'Invoice not found' })

    // MongoDB's transaction engine detects write conflicts optimistically:
    // when two of these transactions race on the same invoice document, one
    // of them is aborted with P2034 rather than allowed to silently clobber
    // the other. Retry on that specific error so concurrent payments both
    // land instead of one failing the request.
    let result!: { payment: unknown; invoice: { amountPaid: number; status: string } }
    const maxAttempts = 5
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const payment = await tx.supplierPayment.create({
            data: {
              invoiceId: id,
              cafeId,
              amount:    Number(amount),
              method:    method ?? 'cash',
              notes:     notes ?? null,
              ...(paidAt && { paidAt: new Date(paidAt) }),
            },
          })

          // Atomic increment (not a read-then-write of a value captured before
          // the transaction) so concurrent payments on the same invoice can't
          // lose each other's updates.
          const afterIncrement = await tx.supplierInvoice.update({
            where: { id },
            data:  { amountPaid: { increment: Number(amount) } },
          })

          const newStatus = computeInvoiceStatus({
            amount:     afterIncrement.amount,
            amountPaid: afterIncrement.amountPaid,
            dueDate:    afterIncrement.dueDate,
          })

          const invoice = await tx.supplierInvoice.update({
            where: { id },
            data:  { status: newStatus },
          })

          return { payment, invoice }
        })
        break
      } catch (txErr: any) {
        const isWriteConflict = txErr?.code === 'P2034'
        if (isWriteConflict && attempt < maxAttempts) continue
        throw txErr
      }
    }

    return res.status(201).json({
      payment:    result.payment,
      amountPaid: result.invoice.amountPaid,
      status:     result.invoice.status,
    })
  } catch (err) {
    logger.error({ msg: 'invoice payment create error', err })
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
