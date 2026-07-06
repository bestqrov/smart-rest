// Recomputes a SupplierInvoice's derived status from its amount/amountPaid/dueDate.
// Called whenever a payment is written so `status` (a plain stored string field,
// not a Prisma computed field) stays consistent with the payment ledger.

export type SupplierInvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

export function computeInvoiceStatus(params: {
  amount: number
  amountPaid: number
  dueDate: Date | null
  now?: Date
}): SupplierInvoiceStatus {
  const { amount, amountPaid, dueDate } = params
  const now = params.now ?? new Date()

  if (amountPaid >= amount) return 'paid'
  if (dueDate && dueDate < now) return 'overdue'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}
