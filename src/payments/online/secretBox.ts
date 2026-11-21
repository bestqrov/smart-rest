// ─── Secret box — AES-256-GCM for restaurant-owned gateway secret keys ───────
// Key comes from PAYMENT_ENCRYPTION_KEY (32 bytes, base64 or 64-char hex).
// Ciphertext format: "v1:<iv b64>:<tag b64>:<data b64>". Never log plaintext.

import crypto from 'crypto'

function getKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY
  if (!raw) throw new Error('PAYMENT_ENCRYPTION_KEY not configured')
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('PAYMENT_ENCRYPTION_KEY must decode to 32 bytes')
  return key
}

export function isEncryptionConfigured(): boolean {
  try { getKey(); return true } catch { return false }
}

export function encryptSecret(plain: string): string {
  const iv     = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const data   = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return ['v1', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':')
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, data] = enc.split(':')
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Malformed secret ciphertext')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}
