// ─── Smart Intelligence API Gateway — Rate-Limit Hooks (K50) ───────────────
// Same express-rate-limit idiom as server.ts's authLimiter/apiLimiter — a
// dedicated limiter for this namespace, not a new limiting mechanism.

import rateLimit from 'express-rate-limit'

export function createIntelligenceGatewayLimiter() {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { error: 'Too many Intelligence API requests, please try again later.' },
  })
}
