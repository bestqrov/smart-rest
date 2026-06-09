import { Request, Response, NextFunction } from 'express'

// Protects routes called by n8n or other internal services.
// Set INTERNAL_API_SECRET in .env (generate with: openssl rand -hex 32)
// n8n sends it as: Authorization: Bearer <secret>
export function requireInternal(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return res.status(500).json({ error: 'INTERNAL_API_SECRET not configured' })

  const auth = req.headers.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (token !== secret) {
    return res.status(401).json({ error: 'Unauthorized — invalid internal token' })
  }
  next()
}
