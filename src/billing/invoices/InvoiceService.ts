// ─── Billing Platform — Invoice Service ────────────────────────────────────

import type { InvoiceStatus, PlatformInvoice } from '../types'
import { generateInvoiceNumber }               from './InvoiceNumberService'

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

function toInvoice(row: any): PlatformInvoice {
  return {
    id:            row.id,
    invoiceNumber: row.invoiceNumber,
    tenantId:      row.tenantId,
    module:        row.module,
    plan:          row.plan,
    status:        row.status as InvoiceStatus,
    subtotal:      row.subtotal,
    taxAmount:     row.taxAmount,
    taxType:       row.taxType,
    taxRate:       row.taxRate,
    total:         row.total,
    currency:      row.currency,
    periodStart:   row.periodStart,
    periodEnd:     row.periodEnd,
    dueDate:       row.dueDate,
    paidAt:        row.paidAt ?? undefined,
    notes:         row.notes ?? undefined,
    metadata:      row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt:     row.createdAt,
    updatedAt:     row.updatedAt,
  }
}

export async function createInvoice(input: {
  tenantId:    string
  module:      string
  plan:        string
  subtotal:    number
  taxAmount:   number
  taxType:     string
  taxRate:     number
  total:       number
  currency:    string
  periodStart: Date
  periodEnd:   Date
  dueDate:     Date
  notes?:      string
  metadata?:   Record<string, unknown>
}): Promise<PlatformInvoice> {
  const prisma        = await getPrisma()
  const invoiceNumber = await generateInvoiceNumber()
  const row           = await (prisma as any).billingPlatformInvoice.create({
    data: {
      invoiceNumber,
      tenantId:    input.tenantId,
      module:      input.module,
      plan:        input.plan,
      status:      'DRAFT',
      subtotal:    input.subtotal,
      taxAmount:   input.taxAmount,
      taxType:     input.taxType,
      taxRate:     input.taxRate,
      total:       input.total,
      currency:    input.currency,
      periodStart: input.periodStart,
      periodEnd:   input.periodEnd,
      dueDate:     input.dueDate,
      notes:       input.notes,
      metadata:    input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  })
  return toInvoice(row)
}

export async function publishInvoice(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'PENDING' },
  })
  return toInvoice(row)
}

export async function markPaid(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'PAID', paidAt: new Date() },
  })
  return toInvoice(row)
}

export async function markOverdue(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'OVERDUE' },
  })
  return toInvoice(row)
}

export async function cancelInvoice(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'CANCELLED' },
  })
  return toInvoice(row)
}

export async function refundInvoice(id: string): Promise<PlatformInvoice> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.update({
    where: { id },
    data:  { status: 'REFUNDED' },
  })
  return toInvoice(row)
}

export async function getInvoice(id: string): Promise<PlatformInvoice | null> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.findUnique({ where: { id } })
  return row ? toInvoice(row) : null
}

// Used by generateInvoice to avoid creating a duplicate invoice for a period
// that's already been billed (idempotency guard for retried/duplicate calls).
export async function findByPeriod(
  tenantId:    string,
  module:      string,
  periodStart: Date,
  periodEnd:   Date,
): Promise<PlatformInvoice | null> {
  const prisma = await getPrisma()
  const row    = await (prisma as any).billingPlatformInvoice.findFirst({
    where: {
      tenantId, module, periodStart, periodEnd,
      status: { not: 'CANCELLED' },
    },
  })
  return row ? toInvoice(row) : null
}

export async function listInvoices(filter: {
  tenantId?:  string
  status?:    InvoiceStatus
  module?:    string
  page?:      number
  limit?:     number
}): Promise<{ invoices: PlatformInvoice[]; total: number; page: number; pages: number }> {
  const prisma = await getPrisma()
  const page   = Math.max(1, filter.page  ?? 1)
  const limit  = Math.min(100, filter.limit ?? 20)
  const skip   = (page - 1) * limit
  const where: Record<string, unknown> = {}
  if (filter.tenantId) where.tenantId = filter.tenantId
  if (filter.status)   where.status   = filter.status
  if (filter.module)   where.module   = filter.module

  const [rows, total] = await Promise.all([
    (prisma as any).billingPlatformInvoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    (prisma as any).billingPlatformInvoice.count({ where }),
  ])
  return { invoices: rows.map(toInvoice), total, page, pages: Math.ceil(total / limit) }
}

export async function markOverdueInvoices(): Promise<number> {
  const prisma = await getPrisma()
  const result = await (prisma as any).billingPlatformInvoice.updateMany({
    where: { status: 'PENDING', dueDate: { lt: new Date() } },
    data:  { status: 'OVERDUE' },
  })
  return result.count
}
