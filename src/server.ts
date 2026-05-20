import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
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
import { registerSocketHandlers } from './socket/handlers'
import { startWeeklyBillingCron } from './cron/weeklyBilling'

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

  const allowedOrigin =
    process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL || (dev ? 'http://localhost:3000' : '*')

  // configure CORS for API routes
  app.use(
    cors({ origin: allowedOrigin === '*' ? true : allowedOrigin, credentials: true })
  )
  logger.info({ msg: 'CORS/socket origin', allowedOrigin })
  app.use(bodyParser.json())

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

  // health
  app.get('/health', (req, res) => res.json({ ok: true }))

  // Next.js handles all non-API routes (pages, assets, etc.)
  app.use((req, res) => {
    return handle(req, res)
  })

  // error handler must be absolute last — after Next.js handler
  app.use(errorHandler)

  const port = Number(process.env.PORT || 4000)
  const httpServer = http.createServer(app)

  const io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigin === '*' ? '*' : allowedOrigin, methods: ['GET', 'POST'] },
  })
  // attach io instance to app so routes can use it
  app.set('io', io)
  registerSocketHandlers(io)

  // Start automated billing governance cron
  startWeeklyBillingCron()

  httpServer.listen(port, '0.0.0.0', () => {
    logger.info({ msg: 'Server started', port, host: '0.0.0.0' })
    console.log(`Server listening on http://0.0.0.0:${port}`)
  })
}

main().catch((err) => {
  console.error('Server failed to start', err)
  process.exit(1)
})
