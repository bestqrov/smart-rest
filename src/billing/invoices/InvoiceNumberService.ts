// ─── Billing Platform — Invoice Number Generator ───────────────────────────

async function getPrisma() {
  const { default: prisma } = await import('../../prisma')
  return prisma
}

export async function generateInvoiceNumber(): Promise<string> {
  const prisma = await getPrisma()
  const year   = new Date().getUTCFullYear()
  const count  = await (prisma as any).billingPlatformInvoice.count({
    where: { invoiceNumber: { startsWith: `BIL-${year}-` } },
  })
  const seq = String(count + 1).padStart(5, '0')
  return `BIL-${year}-${seq}`
}
