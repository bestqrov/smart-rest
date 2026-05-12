import { Request, Response, NextFunction } from 'express'
import logger from '../logger'

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ msg: 'Unhandled error', err, path: req.path, body: req.body })
  if (res.headersSent) return next(err)
  res.status(500).json({ error: 'Internal server error' })
}

export default errorHandler
