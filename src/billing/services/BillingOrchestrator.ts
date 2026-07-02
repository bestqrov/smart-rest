// ─── Billing Platform — Billing Orchestrator ──────────────────────────────

import * as PlanCatalog   from '../plans/PlanCatalogService'
import * as Subscriptions from '../subscriptions/SubscriptionService'
import * as Invoices      from '../invoices/InvoiceService'
import * as Quotas        from '../quotas/QuotaService'
import * as Usage         from '../usage/BillingUsageService'
import * as Taxes         from '../taxes/TaxService'
import {
  emitInvoiceGenerated,
  emitInvoicePaid,
}                         from '../events/BillingEvents'
import {
  notifyInvoiceGenerated,
  notifyInvoicePaid,
}                         from '../notifications/BillingNotifications'
import { getBillingCurrency } from '../settings/BillingSettingsService'
import type { Plan }      from '../../tenant/types'
import type { PlatformInvoice } from '../types'

export const plans        = PlanCatalog
export const subscriptions = Subscriptions
export const invoices     = Invoices
export const quotas       = Quotas
export const usage        = Usage
export const taxes        = Taxes

export async function generateInvoice(input: {
  tenantId:    string
  module:      string
  plan:        Plan
  country:     string
  periodStart: Date
  periodEnd:   Date
  dueDate:     Date
  notes?:      string
}): Promise<PlatformInvoice> {
  const existing = await Invoices.findByPeriod(input.tenantId, input.module, input.periodStart, input.periodEnd)
  if (existing) return existing

  const pricing  = await PlanCatalog.getPriceForTenant(input.plan, input.country)
  const subtotal = pricing?.price ?? 0
  const currency = pricing?.currency ?? await getBillingCurrency()
  const taxType  = Taxes.detectTaxType(input.country)
  const tax      = Taxes.calculateTax(subtotal, currency, input.country, taxType)

  const invoice = await Invoices.createInvoice({
    tenantId:    input.tenantId,
    module:      input.module,
    plan:        input.plan,
    subtotal:    tax.subtotal,
    taxAmount:   tax.taxAmount,
    taxType:     tax.taxType,
    taxRate:     tax.taxRate,
    total:       tax.total,
    currency,
    periodStart: input.periodStart,
    periodEnd:   input.periodEnd,
    dueDate:     input.dueDate,
    notes:       input.notes,
  })

  const published = await Invoices.publishInvoice(invoice.id)

  await emitInvoiceGenerated({
    tenantId: input.tenantId,
    module:   input.module,
    invoiceId: published.id,
    plan:     input.plan,
  }).catch(() => undefined)
  await notifyInvoiceGenerated(input.tenantId, published.invoiceNumber, published.total, currency).catch(() => undefined)

  return published
}

export async function recordPayment(
  invoiceId: string,
  tenantId:  string,
  module:    string,
): Promise<PlatformInvoice> {
  const paid = await Invoices.markPaid(invoiceId)
  // K28 — total/currency added to metadata so referral commission calculation
  // (AffiliateService, subscribed to InvoicePaid) doesn't need a second query.
  await emitInvoicePaid({ tenantId, module, invoiceId, metadata: { total: paid.total, currency: paid.currency } }).catch(() => undefined)
  await notifyInvoicePaid(tenantId, paid.invoiceNumber).catch(() => undefined)
  return paid
}
