import type {
  PaymentTransaction, CreateTransactionInput, TransactionFilter, TransactionPage,
} from '../types'

// ─── Transaction CRUD ─────────────────────────────────────────────────────────

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<PaymentTransaction> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).paymentTransaction.create({
    data: {
      orderId:   input.orderId,
      tenantId:  input.tenantId,
      module:    input.module   ?? 'MARKETPLACE',
      provider:  input.provider,
      method:    input.method,
      status:    'PENDING',
      amount:    input.amount,
      currency:  input.currency ?? 'MAD',
      reference: input.reference,
      notes:     input.notes,
      metadata:  input.metadata ? JSON.stringify(input.metadata) : undefined,
    },
  })
}

export async function getTransaction(id: string): Promise<PaymentTransaction | null> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).paymentTransaction.findUnique({ where: { id } })
}

export async function getTransactionByOrderId(
  orderId: string,
  tenantId: string,
): Promise<PaymentTransaction | null> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).paymentTransaction.findFirst({
    where: { orderId, tenantId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTransactions(filter: TransactionFilter): Promise<TransactionPage> {
  const { default: prisma } = await import('../../prisma')
  const page  = filter.page  ?? 1
  const limit = filter.limit ?? 20
  const skip  = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (filter.tenantId) where.tenantId = filter.tenantId
  if (filter.orderId)  where.orderId  = filter.orderId
  if (filter.status)   where.status   = filter.status
  if (filter.provider) where.provider = filter.provider
  if (filter.module)   where.module   = filter.module

  const [transactions, total] = await Promise.all([
    (prisma as any).paymentTransaction.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
    }),
    (prisma as any).paymentTransaction.count({ where }),
  ])

  return { transactions, total, page, limit }
}

export async function updateTransaction(
  id: string,
  patch: Partial<{
    status:       string
    reference:    string
    notes:        string
    paidAt:       Date
    refundedAt:   Date
    refundAmount: number
    metadata:     string
  }>,
): Promise<PaymentTransaction> {
  const { default: prisma } = await import('../../prisma')
  return (prisma as any).paymentTransaction.update({ where: { id }, data: patch })
}
