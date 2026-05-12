import express from 'express'
import http from 'http'
import cors from 'cors'
import bodyParser from 'body-parser'
import { Server as SocketIOServer } from 'socket.io'
import next from 'next'
import dotenv from 'dotenv'

import logger from './logger'
import errorHandler from './middleware/errorHandler'

// routers
import authRouter from './routes/auth'
import ordersRouter from './routes/orders'
import billRequestsRouter from './routes/billRequests'
import adminStatsRouter from './routes/adminStats'
import clientMenuRouter from './routes/clientMenu'
import { registerSocketHandlers } from './socket/handlers'

async function main() {
  // load .env into process.env
  dotenv.config()

  const dev = process.env.NODE_ENV !== 'production'
  const nextApp = next({ dev, dir: '.' })
  const handle = nextApp.getRequestHandler()

  await nextApp.prepare()

  const app = express()

  const allowedOrigin =
    process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL || (dev ? 'http://localhost:3000' : '*')

  // configure CORS for API routes
  app.use(
    cors({ origin: allowedOrigin === '*' ? true : allowedOrigin, credentials: true })
  )
  app.use(bodyParser.json())

  // mount API routes first so /api/* handled by Express
  app.use(authRouter)
  app.use(ordersRouter)
  app.use(billRequestsRouter)
  app.use(adminStatsRouter)
  app.use(clientMenuRouter)

  // health
  app.get('/health', (req, res) => res.json({ ok: true }))

  // error handler (last)
  app.use(errorHandler)

  // Next.js request handler for everything else (pages, assets)
  // Use app.use to avoid path-to-regexp parsing issues with '*'
  app.use((req, res) => {
    return handle(req, res)
  })

  const port = Number(process.env.PORT || 4000)
  const httpServer = http.createServer(app)

  const io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigin === '*' ? '*' : allowedOrigin, methods: ['GET', 'POST'] },
  })
  // attach io instance to app so routes can use it
  app.set('io', io)
  registerSocketHandlers(io)

  httpServer.listen(port, () => {
    logger.info({ msg: 'Server started', port })
    console.log(`Server listening on http://localhost:${port}`)
  })
}

main().catch((err) => {
  console.error('Server failed to start', err)
  process.exit(1)
})
