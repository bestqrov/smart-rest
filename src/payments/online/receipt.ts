// ─── WhatsApp receipt for an online bill payment ─────────────────────────────
// Sent only on explicit guest request, only for PAID payments, at most once
// per payment (deduped on WhatsAppMessage.templateKey = "receipt:<payId>").
// This is a transactional message — it does NOT opt the guest into marketing.

import prisma from '../../prisma'
import { sendMessage } from '../../whatsapp/WhatsAppEngine'
import { BillPaymentError } from './BillPaymentService'

export function normalizePhone(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/[\s\-().]/g, '')
  const d = s.startsWith('+') ? s.slice(1) : s.startsWith('00') ? s.slice(2) : s
  return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null
}

const L = {
  ar: { title: 'إيصال الدفع', date: 'التاريخ', discount: 'الخصم', total: 'الإجمالي', paid: 'مدفوع إلكترونياً', ref: 'المرجع', thanks: 'شكراً لزيارتكم 🌟' },
  en: { title: 'Payment receipt', date: 'Date', discount: 'Discount', total: 'Total', paid: 'Paid online', ref: 'Ref', thanks: 'Thank you for visiting 🌟' },
} as const

export async function sendBillReceipt(payId: string, rawPhone: string, lang: string) {
  const phone = normalizePhone(rawPhone)
  if (!phone) throw new BillPaymentError('BAD_PHONE', 'Invalid phone number')

  const pay = await prisma.onlinePayment.findUnique({ where: { id: payId } })
  if (!pay) throw new BillPaymentError('NOT_FOUND', 'Payment not found', 404)
  if (pay.status !== 'PAID') throw new BillPaymentError('NOT_PAID', 'Payment is not completed', 409)

  const key = `receipt:${pay.id}`
  const already = await prisma.whatsAppMessage.findFirst({ where: { cafeId: pay.cafeId, templateKey: key } })
  if (already) throw new BillPaymentError('ALREADY_SENT', 'Receipt already sent', 409)

  const [cafe, orders] = await Promise.all([
    prisma.cafe.findUnique({ where: { id: pay.cafeId }, select: { name: true } }),
    prisma.order.findMany({
      where:  { id: { in: pay.orderIds }, cafeId: pay.cafeId },
      select: {
        discountAmount: true,
        items: { select: { quantity: true, unitPrice: true, modifiersDelta: true, product: { select: { nameAr: true, nameEn: true } } } },
      },
    }),
  ])

  const t   = L[lang === 'ar' ? 'ar' : 'en']
  const cur = pay.currency
  const lines: string[] = []
  for (const o of orders) {
    for (const i of o.items) {
      const name  = (lang === 'ar' ? i.product.nameAr : i.product.nameEn) || i.product.nameEn || i.product.nameAr
      const price = (i.unitPrice + (i.modifiersDelta ?? 0)) * i.quantity
      lines.push(`${i.quantity}× ${name} — ${price.toFixed(2)} ${cur}`)
    }
  }
  const discount = orders.reduce((s, o) => s + (o.discountAmount ?? 0), 0)
  const when     = (pay.confirmedAt ?? pay.createdAt).toISOString().slice(0, 16).replace('T', ' ')

  const body = [
    `*${cafe?.name ?? ''}*`,
    `🧾 ${t.title}`,
    `${t.date}: ${when}`,
    '',
    ...lines,
    ...(discount > 0 ? [`${t.discount}: −${discount.toFixed(2)} ${cur}`] : []),
    '',
    `*${t.total}: ${pay.amount.toFixed(2)} ${cur}*`,
    `✅ ${t.paid}`,
    `${t.ref}: ${pay.id.slice(-8).toUpperCase()}`,
    '',
    t.thanks,
  ].join('\n')

  const msg = await sendMessage(pay.cafeId, phone, body, { templateKey: key })
  return { status: msg.status }
}
