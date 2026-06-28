import crypto from 'crypto'

export function generateId(): string {
  return crypto.randomUUID()
}

export function generateTraceId(): string {
  return crypto.randomBytes(8).toString('hex')
}

export function isValidObjectId(id: string): boolean {
  return /^[0-9a-f]{24}$/i.test(id)
}
