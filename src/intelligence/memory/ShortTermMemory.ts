// ─── Smart Intelligence Memory Engine — Short-Term Store (K44) ─────────────
// In-memory, TTL-based, tenant-isolated by construction (tenantId is part
// of the composite key). Same lazy-expiration idiom as K32's DataCache,
// extended with compound keys and an explicit delete for forget().

interface Entry {
  value:     unknown
  expiresAt: number
}

const store = new Map<string, Entry>()

function compositeKey(tenantId: string, namespace: string, key: string): string {
  return `${tenantId}:${namespace}:${key}`
}

export function setShortTerm<T>(tenantId: string, namespace: string, key: string, value: T, ttlMs: number): void {
  store.set(compositeKey(tenantId, namespace, key), { value, expiresAt: Date.now() + ttlMs })
}

export function getShortTerm<T>(tenantId: string, namespace: string, key: string): T | undefined {
  const k = compositeKey(tenantId, namespace, key)
  const entry = store.get(k)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(k)
    return undefined
  }
  return entry.value as T
}

export function forgetShortTerm(tenantId: string, namespace: string, key: string): void {
  store.delete(compositeKey(tenantId, namespace, key))
}

export function listShortTermKeys(tenantId: string, namespace: string): string[] {
  const prefix = `${tenantId}:${namespace}:`
  const now = Date.now()
  const keys: string[] = []
  for (const [k, entry] of store) {
    if (!k.startsWith(prefix)) continue
    if (now > entry.expiresAt) { store.delete(k); continue }
    keys.push(k.slice(prefix.length))
  }
  return keys
}
