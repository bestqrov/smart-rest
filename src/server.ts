import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import bodyParser from 'body-parser'
import { Server as SocketIOServer } from 'socket.io'
import next from 'next'
import rateLimit from 'express-rate-limit'

import logger from './logger'
import errorHandler from './middleware/errorHandler'
import { requestId } from './middleware/requestId'
import prisma from './prisma'

// routers
import authRouter from './routes/auth'
import ordersRouter from './routes/orders'
import billRequestsRouter from './routes/billRequests'
import adminStatsRouter from './routes/adminStats'
import clientMenuRouter from './routes/clientMenu'
import waiterCallsRouter from './routes/waiterCalls'
import financeRouter from './routes/finance'
import tablesRouter from './routes/tables'
import menuAdminRouter from './routes/menuAdmin'
import superadminRouter from './routes/superadmin'
import posShiftRouter from './routes/pos/shift'
import posOrdersRouter from './routes/pos/orders'
import posCheckoutRouter from './routes/pos/checkout'
import supervisorTablesRouter from './routes/pos/supervisorTables'
import posCheckoutBySeatsRouter from './routes/pos/checkoutBySeats'
import posTablesStatusRouter from './routes/pos/tablesStatus'
import posWaiterRouter from './routes/pos/waiter'
import kitchenRouter from './routes/kitchen'
import productInteractionsRouter from './routes/productInteractions'
import reviewsRouter from './routes/reviews'
import waiterShiftsRouter from './routes/pos/waiterShifts'
import waitersPerfRouter from './routes/adminWaitersPerf'
import waiterQRRouter from './routes/waiterQR'
import publicCafeRouter from './routes/publicCafe'
import adminExpensesRouter from './routes/adminExpenses'
import adminPayrollRouter from './routes/adminPayroll'
import menuGenerationRouter from './routes/menuGeneration'
import suppliersRouter from './routes/suppliers'
import reservationsRouter from './routes/reservations'
import posParserRouter from './routes/posParser'
import paymentRouter from './routes/payment'
import whatsappWebhookRouter from './routes/whatsappWebhook'
import recipesRouter from './routes/recipes'
import antiFraudRouter from './routes/antiFraud'
import feedbackRouter from './routes/feedback'
import landingConfigRouter from './routes/landingConfig'
import marketingRouter from './routes/marketing'
import traiteurRouter from './routes/traiteur'
import loyaltyRouter from './routes/loyalty'
import adminCertificationRouter from './routes/adminCertification'
import inventoryAdminRouter from './routes/inventoryAdmin'
import reviewGalleryRouter from './routes/reviewGallery'
import demoRequestsRouter from './routes/demoRequests'
import zonesRouter from './routes/zones'
import equipmentRouter from './routes/equipment'
import supplierInvoicesRouter from './routes/supplierInvoices'
import requisitionsRouter     from './routes/requisitions'
import customersRouter        from './routes/customers'
import { registerSocketHandlers } from './socket/handlers'
import { startWeeklyBillingCron } from './cron/weeklyBilling'
import { startDailyDebtDetectionCron } from './cron/dailyDebtDetection'
import { startNightlyCron } from './cron/nightly'
import { startCertificationCron } from './cron/certificationEval'
import { initChangeStreams, closeChangeStreams } from './services/changeStreams'

async function main() {
  if (process.env.DEMO_SEED === 'true') {
    try {
      const { default: seed } = await import('../prisma/seed')
      await seed()
    } catch (e) {
      console.error('⚠️  Demo seed failed — server will continue without demo data', e)
    }
  }

  const dev = process.env.NODE_ENV !== 'production'
  const nextApp = next({ dev, dir: '.' })
  const handle = nextApp.getRequestHandler()

  await nextApp.prepare().catch((err: unknown) => {
    console.error('❌ Next.js prepare() failed — did you run `npm run build` first?', err)
    process.exit(1)
  })

  const app = express()
  app.set('trust proxy', 1)

  // ── Security headers (Helmet) ────────────────────────────────────────────────
  app.use(helmet({
    // HSTS: force HTTPS for 1 year, including subdomains, eligible for preload
    hsts: {
      maxAge:            31536000,
      includeSubDomains: true,
      preload:           true,
    },
    // CSP: Next.js requires unsafe-inline for its runtime scripts/styles
    contentSecurityPolicy: {
      directives: {
        defaultSrc:              ["'self'"],
        scriptSrc:               ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc:                ["'self'", "'unsafe-inline'"],
        imgSrc:                  ["'self'", 'data:', 'https:'],
        connectSrc:              ["'self'", 'wss:', 'ws:', 'https:'],
        fontSrc:                 ["'self'", 'https:', 'data:'],
        frameSrc:                ["'none'"],
        objectSrc:               ["'none'"],
        upgradeInsecureRequests: dev ? null : [],
      },
    },
    referrerPolicy:          { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions:     true,
    xFrameOptions:           { action: 'deny' },
    crossOriginEmbedderPolicy: false, // disabled — Cloudinary images would fail
  }))

  // ── CORS ─────────────────────────────────────────────────────────────────────
  // Production: FRONTEND_URL required — never allow wildcard with credentials
  const allowedOrigin =
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    (dev ? 'http://localhost:3000' : null)

  if (!allowedOrigin) {
    throw new Error('FRONTEND_URL must be set in production (CORS wildcard is not allowed)')
  }

  app.use(cors({ origin: allowedOrigin, credentials: true }))
  logger.info({ msg: 'CORS/socket origin', allowedOrigin })

  // ── Request ID ───────────────────────────────────────────────────────────────
  // Must come before all route handlers so req.id is available everywhere
  app.use(requestId)

  // ── Body parsing ─────────────────────────────────────────────────────────────
  // Stripe webhook needs raw body — mount BEFORE bodyParser.json()
  app.use('/api/payment/gulf/stripe-webhook', express.raw({ type: 'application/json' }))

  app.use(bodyParser.json({ limit: '10mb' }))

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many login attempts, please try again in 15 minutes.' },
  })
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many requests, please try again later.' },
  })
  const optInLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,                    // 5 opt-in attempts per IP per hour
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many opt-in attempts, please try again later.' },
  })

  // More specific limiters must come BEFORE the general /api limiter
  app.use('/api/auth',                    authLimiter)
  app.use('/api/customers/optin',         optInLimiter)
  app.use('/api',                         apiLimiter)

  // Serve uploaded hero images directly — must come before Next.js catch-all
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  app.use('/uploads', express.static(uploadsDir))

  // mount API routes first so /api/* handled by Express
  app.use(authRouter)
  app.use(ordersRouter)
  app.use(billRequestsRouter)
  app.use(adminStatsRouter)
  app.use(clientMenuRouter)
  app.use(waiterCallsRouter)
  app.use(financeRouter)
  app.use(tablesRouter)
  app.use(menuAdminRouter)
  app.use(superadminRouter)
  app.use(posShiftRouter)
  app.use(posOrdersRouter)
  app.use(posCheckoutRouter)
  app.use(posCheckoutBySeatsRouter)
  app.use(supervisorTablesRouter)
  app.use(posTablesStatusRouter)
  app.use(posWaiterRouter)
  app.use(kitchenRouter)
  app.use(productInteractionsRouter)
  app.use(reviewsRouter)
  app.use(waiterShiftsRouter)
  app.use(waitersPerfRouter)
  app.use(waiterQRRouter)
  app.use(publicCafeRouter)
  app.use(adminExpensesRouter)
  app.use(adminPayrollRouter)
  app.use(menuGenerationRouter)
  app.use(suppliersRouter)
  app.use(reservationsRouter)
  app.use(posParserRouter)
  app.use(paymentRouter)
  app.use(whatsappWebhookRouter)
  app.use(recipesRouter)
  app.use(antiFraudRouter)
  app.use(feedbackRouter)
  app.use(landingConfigRouter)
  app.use('/api/marketing', marketingRouter)
  app.use('/api/v1/equipment', equipmentRouter)
  app.use('/api/v1/invoices',     supplierInvoicesRouter)
  app.use('/api/v1/requisitions', requisitionsRouter)
  app.use(traiteurRouter)
  app.use(loyaltyRouter)
  app.use(adminCertificationRouter)
  app.use(inventoryAdminRouter)
  app.use(reviewGalleryRouter)
  app.use(demoRequestsRouter)
  app.use(zonesRouter)
  app.use(customersRouter)

  // ── Liveness probe (/health) ─────────────────────────────────────────────────
  // Fast check — process is alive. Used by SW offline detection and load balancers.
  app.get(['/health', '/api/health'], (_req, res) => res.json({ ok: true }))

  // ── Readiness probe (/ready) ──────────────────────────────────────────────────
  // Confirms the process can serve traffic: DB reachable + no startup errors.
  // Use this for Kubernetes/Docker readinessProbe, not livenessProbe.
  app.get('/ready', async (_req, res) => {
    try {
      await prisma.$runCommandRaw({ ping: 1 })
      res.json({ ok: true, db: true })
    } catch (err) {
      logger.error({ msg: '/ready: db check failed', err })
      res.status(503).json({ ok: false, db: false })
    }
  })

  // Next.js handles all non-API routes (pages, assets, etc.)
  app.use((req, res) => {
    return handle(req, res)
  })

  // error handler must be absolute last — after Next.js handler
  app.use(errorHandler)

  const port = Number(process.env.PORT || 3000)
  const httpServer = http.createServer(app)

  const io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigin === '*' ? '*' : allowedOrigin, methods: ['GET', 'POST'] },
  })
  app.set('io', io)
  registerSocketHandlers(io)

  // Collect cron task handles for graceful shutdown
  const cronTasks = [
    startDailyDebtDetectionCron(),
    startWeeklyBillingCron(),
    startNightlyCron(),
    startCertificationCron(),
  ]

  httpServer.listen(port, '0.0.0.0', () => {
    logger.info({ msg: 'Server started', port, host: '0.0.0.0' })
    console.log(`Server listening on http://0.0.0.0:${port}`)
    initChangeStreams(io).catch((err) => {
      logger.warn({ msg: 'initChangeStreams failed at boot', err: err?.message })
    })
  })

  // ── Graceful shutdown ─────────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    logger.info({ msg: `Graceful shutdown initiated (${signal})` })

    // 1. Stop cron jobs — no new scheduled runs
    cronTasks.forEach(t => t.stop())

    // 2. Stop accepting new HTTP connections; wait for in-flight requests to finish
    await new Promise<void>(resolve => httpServer.close(() => resolve()))
    logger.info({ msg: 'HTTP server closed' })

    // 3. Close WebSocket connections
    await new Promise<void>(resolve => io.close(() => resolve()))
    logger.info({ msg: 'Socket.io closed' })

    // 4. Close change streams before disconnecting DB
    await closeChangeStreams()

    // 5. Disconnect from database
    await prisma.$disconnect()
    logger.info({ msg: 'Database disconnected' })

    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM').catch(err => {
    logger.error({ msg: 'Shutdown error', err })
    process.exit(1)
  }))
  process.on('SIGINT',  () => shutdown('SIGINT').catch(err => {
    logger.error({ msg: 'Shutdown error', err })
    process.exit(1)
  }))
}

// ── Process-level safety nets ───────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error({ msg: 'Unhandled promise rejection', reason })
})
process.on('uncaughtException', (err) => {
  logger.error({ msg: 'Uncaught exception', err })
  process.exit(1)
})

main().catch((err) => {
  console.error('Server failed to start', err)
  process.exit(1)
})
