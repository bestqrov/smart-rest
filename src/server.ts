import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import { Server as SocketIOServer } from 'socket.io'
import next from 'next'
import rateLimit from 'express-rate-limit'

import logger from './logger'
import errorHandler from './middleware/errorHandler'

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
import { registerSocketHandlers } from './socket/handlers'
import { startWeeklyBillingCron } from './cron/weeklyBilling'
import { startNightlyCron } from './cron/nightly'
import { initChangeStreams, closeChangeStreams } from './services/changeStreams'

async function main() {
  if (process.env.DEMO_SEED === 'true') {
    const { default: seed } = await import('../prisma/seed')
    await seed()
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

  const allowedOrigin =
    process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL || (dev ? 'http://localhost:3000' : '*')

  // configure CORS for API routes
  app.use(
    cors({ origin: allowedOrigin === '*' ? true : allowedOrigin, credentials: true })
  )
  logger.info({ msg: 'CORS/socket origin', allowedOrigin })

  // Stripe webhook needs raw body — mount BEFORE bodyParser.json()
  app.use('/api/payment/gulf/stripe-webhook', express.raw({ type: 'application/json' }))

  app.use(bodyParser.json({ limit: '10mb' }))

  // Rate limiting — protects against brute force and volumetric attacks
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,             // 60 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  })
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,                   // 10 login attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again in 15 minutes.' }
  })
  app.use('/api/auth', authLimiter)
  app.use('/api', apiLimiter)

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

  // health (both paths — /api/health used by SW offline detection)
  app.get(['/health', '/api/health'], (req, res) => res.json({ ok: true }))

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
  // attach io instance to app so routes can use it
  app.set('io', io)
  registerSocketHandlers(io)

  // Start automated billing governance cron
  startWeeklyBillingCron()
  // Start nightly anti-fraud + EOD WhatsApp report cron
  startNightlyCron()

  httpServer.listen(port, '0.0.0.0', () => {
    logger.info({ msg: 'Server started', port, host: '0.0.0.0' })
    console.log(`Server listening on http://0.0.0.0:${port}`)
    // Start change streams after server is listening
    initChangeStreams(io).catch((err) => {
      logger.warn({ msg: 'initChangeStreams failed at boot', err: err?.message })
    })
  })

  process.on('SIGTERM', async () => {
    await closeChangeStreams()
    process.exit(0)
  })
  process.on('SIGINT', async () => {
    await closeChangeStreams()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Server failed to start', err)
  process.exit(1)
})
