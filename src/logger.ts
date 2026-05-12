import pino from 'pino'
import path from 'path'
import fs from 'fs'

const logDir = path.join(process.cwd(), 'logs')
const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
}

// In development prefer stdout to avoid file locking/sonic-boom readiness issues
const destination = isProd
  ? pino.destination({ dest: path.join(logDir, 'app.log'), sync: false })
  : pino.destination(1)

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: { pid: false },
    timestamp: pino.stdTimeFunctions.isoTime
  },
  destination
)

export default logger
