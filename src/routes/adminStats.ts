import express, { Request, Response } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'

const prisma = new PrismaClient()
const router = express.Router()

function startOfDay(d: Date) {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  return t
}

function startOfWeek(d: Date) {
  const t = startOfDay(d)
  const day = t.getDay()
  const diff = t.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(t.setDate(diff))
}

function startOfMonth(d: Date) {
  const t = new Date(d)
  t.setDate(1)
  t.setHours(0, 0, 0, 0)
  return t
}

router.get('/api/admin/stats', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const admin = req.admin!
    const cafeId = admin.cafeId

    const now = new Date()
    const todayStart = startOfDay(now)
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = startOfMonth(now)
    const daysBack = 30
    const start30 = new Date(now.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000)

    // Total Revenue (consider paid orders)
    const [revTodayAgg, revWeekAgg, revMonthAgg] = await Promise.all([
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: { cafeId, isPaid: true, createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: { cafeId, isPaid: true, createdAt: { gte: weekStart } } }),
      prisma.order.aggregate({ _sum: { totalPrice: true }, where: { cafeId, isPaid: true, createdAt: { gte: monthStart } } })
    ])

    const revenue = {
      today: (revTodayAgg._sum.totalPrice || 0).toString?.() ?? String(revTodayAgg._sum.totalPrice || 0),
      week: (revWeekAgg._sum.totalPrice || 0).toString?.() ?? String(revWeekAgg._sum.totalPrice || 0),
      month: (revMonthAgg._sum.totalPrice || 0).toString?.() ?? String(revMonthAgg._sum.totalPrice || 0)
    }

    // Most sold products (top 5)
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { cafeId } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    })
    const productIds = topProducts.map((t) => t.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const top = topProducts.map((t) => ({ productId: t.productId, quantity: t._sum.quantity || 0, name: products.find((p) => p.id === t.productId)?.nameEn || '' }))

    // Peak hours (last 30 days) - compute by hour (0-23)
    const orders30 = await prisma.order.findMany({ where: { cafeId, createdAt: { gte: start30 } }, select: { createdAt: true } })
    const hourCounts = new Array(24).fill(0)
    for (const o of orders30) {
      const h = new Date(o.createdAt).getHours()
      hourCounts[h] = hourCounts[h] + 1
    }
    // find top 3 peak hours
    const peakHours = hourCounts.map((count, hour) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 3)

    // Average Order Value (AOV) - over last 30 days
    const aovAgg = await prisma.order.aggregate({ _avg: { totalPrice: true }, where: { cafeId, isPaid: true, createdAt: { gte: start30 } } })
    const aov = aovAgg._avg.totalPrice || 0

    // Daily sales for last 30 days (for line chart)
    const salesOrders = await prisma.order.findMany({ where: { cafeId, isPaid: true, createdAt: { gte: start30 } }, select: { totalPrice: true, createdAt: true } })
    const dailyMap: Record<string, number> = {}
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(start30.getTime() + i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dailyMap[key] = 0
    }
    for (const o of salesOrders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10)
      dailyMap[key] = (dailyMap[key] || 0) + Number(o.totalPrice as unknown as string || 0)
    }
    const dailySales = Object.keys(dailyMap).sort().map((date) => ({ date, total: dailyMap[date] }))

    // Orders count today
    const ordersCountToday = await prisma.order.count({ where: { cafeId, createdAt: { gte: todayStart } } })

    // New customers (unique phone numbers) last 30 days
    const recentOrdersWithPhone = await prisma.order.findMany({ where: { cafeId, createdAt: { gte: start30 }, customerPhone: { not: null } }, select: { customerPhone: true } })
    const uniquePhones = new Set(recentOrdersWithPhone.map((o) => o.customerPhone))
    const newCustomers = uniquePhones.size

    // Recently completed orders
    const recentCompleted = await prisma.order.findMany({ where: { cafeId, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, take: 10 })

    return res.json({ revenue, top, peakHours, aov: Number(aov), dailySales, ordersCountToday, newCustomers, recentCompleted })
  } catch (err) {
    logger.error({ msg: 'admin stats error', err })
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
