import { Request, Response, NextFunction } from 'express'
import logger from '../logger'

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'token', 'refreshToken', 'accessToken',
  'newPassword', 'currentPassword', 'pinCode', 'secret',
])

const isProd = process.env.NODE_ENV === 'production'

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) =>
      [k, SENSITIVE_KEYS.has(k) ? '[REDACTED]' : v]
    )
  )
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = req.id ?? 'unknown'
  const status    = err?.status ?? err?.statusCode ?? 500

  logger.error({
    msg:       'Unhandled error',
    requestId,
    method:    req.method,
    path:      req.path,
    status,
    body:      sanitizeBody(req.body),
    err:       isProd
      ? { message: err?.message, code: err?.code }
      : err,
  })

  if (res.headersSent) return next(err)

  res.status(status).json({
    error:     status >= 500 && isProd ? 'Internal server error' : (err?.message ?? 'Internal server error'),
    requestId,
  })
}

export default errorHandler
