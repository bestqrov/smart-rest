import { timingSafeEqual } from 'crypto'

// Single source of truth for the SuperAdmin header check. Every SA router
// keeps its own guard wrapper (response shape differs per file) but delegates
// the actual decision here, so the rule can't drift between copies again.
//
// Fails closed when SUPERADMIN_SECRET is unset (otherwise `undefined ===
// undefined` would let a request with no header through), compares the
// secret in constant time, and requires the email header to match
// SUPERADMIN_EMAIL when that is configured (always, in production — see
// src/config.ts).

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function isSuperAdminRequest(req: { headers: Record<string, unknown> }): boolean {
  const expectedSecret = process.env.SUPERADMIN_SECRET
  const expectedEmail  = process.env.SUPERADMIN_EMAIL
  const secret = req.headers['x-superadmin-secret']
  const email  = req.headers['x-superadmin-email']

  if (!expectedSecret || typeof secret !== 'string' || !safeEqual(secret, expectedSecret)) return false
  if (typeof email !== 'string' || !email) return false
  if (expectedEmail && email !== expectedEmail) return false
  return true
}
