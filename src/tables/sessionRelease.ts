// ─── Free table seats once the bill is settled ───────────────────────────────
// Each phone that scans a table QR takes a seat (ClientSession, 1..capacity)
// for 2h, refreshed by the guest page heartbeat. Nothing used to release those
// seats at checkout, so the NEXT group at the same table got "table full" for
// up to two hours. Called after every way a bill can be settled (POS table /
// single order / split-by-seat checkout, online bill payment).
//
// Rules:
//   • Billing table (+ tables merged into it) has no open unpaid order left
//     → every active session on those tables is completed (seats free).
//   • Otherwise (split bill, others still eating) → complete only sessions
//     that ordered and whose own orders are all paid.

import prisma from '../prisma'
import logger from '../logger'

export async function releaseSettledSessions(cafeId: string, anyTableId: string | null | undefined): Promise<number> {
  if (!anyTableId) return 0
  try {
    const t = await prisma.table.findFirst({ where: { id: anyTableId, cafeId }, select: { id: true, mergedIntoTableId: true } })
    if (!t) return 0
    const billingId = t.mergedIntoTableId ?? t.id
    const children  = await prisma.table.findMany({ where: { cafeId, mergedIntoTableId: billingId }, select: { id: true } })
    const tableIds  = [billingId, ...children.map(c => c.id)]

    const openUnpaid = await prisma.order.count({
      where: { cafeId, tableId: billingId, isPaid: false, status: { notIn: ['CANCELLED'] } },
    })

    let released = 0
    if (openUnpaid === 0) {
      const r = await prisma.clientSession.updateMany({
        where: { tableId: { in: tableIds }, status: 'active' },
        data:  { status: 'completed', lastActiveAt: new Date() },
      })
      released = r.count
    } else {
      const sessions = await prisma.clientSession.findMany({
        where: { tableId: { in: tableIds }, status: 'active' }, select: { id: true },
      })
      for (const s of sessions) {
        const [mine, unpaid] = await Promise.all([
          prisma.order.count({ where: { sessionId: s.id, status: { notIn: ['CANCELLED'] } } }),
          prisma.order.count({ where: { sessionId: s.id, isPaid: false, status: { notIn: ['CANCELLED'] } } }),
        ])
        if (mine > 0 && unpaid === 0) {
          await prisma.clientSession.updateMany({ where: { id: s.id, status: 'active' }, data: { status: 'completed', lastActiveAt: new Date() } })
          released++
        }
      }
    }
    if (released) logger.info({ msg: 'Table seats released after checkout', cafeId, billingTableId: billingId, released })
    return released
  } catch (err) {
    // Never fail a checkout because of seat bookkeeping.
    logger.warn({ msg: 'releaseSettledSessions failed', cafeId, anyTableId, err: (err as Error).message })
    return 0
  }
}
