import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }
}

/**
 * Assigns a unique request ID to every incoming request.
 * Propagates X-Request-Id from upstream proxy if present (e.g. nginx, load balancer).
 * Sets X-Request-Id on the response so clients can correlate logs.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
}
