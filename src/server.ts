import express from 'express'
import http from 'http'
import cors from 'cors'
import bodyParser from 'body-parser'
import { Server as SocketIOServer } from 'socket.io'

import logger from './logger'
import errorHandler from './middleware/errorHandler'

// routers
import authRouter from './routes/auth'
import ordersRouter from './routes/orders'
import billRequestsRouter from './routes/billRequests'
import adminStatsRouter from './routes/adminStats'
import clientMenuRouter from './routes/clientMenu'
import { registerSocketHandlers } from './socket/handlers'

const app = express()
app.use(cors())
app.use(bodyParser.json())

// mount API routes
app.use(authRouter)
app.use(ordersRouter)
app.use(billRequestsRouter)
app.use(adminStatsRouter)
app.use(clientMenuRouter)

// health
app.get('/health', (req, res) => res.json({ ok: true }))

// error handler (last)
app.use(errorHandler)

const port = Number(process.env.PORT || 4000)
const httpServer = http.createServer(app)

const io = new SocketIOServer(httpServer, { cors: { origin: '*' } })
// attach io instance to app so routes can use it
app.set('io', io)
registerSocketHandlers(io)

httpServer.listen(port, () => {
  logger.info({ msg: 'Server started', port })
  console.log(`Server listening on http://localhost:${port}`)
})
