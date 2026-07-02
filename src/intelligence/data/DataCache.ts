// ─── Smart Intelligence Data Hub — Cache Hooks (K32) ───────────────────────
// Minimal pluggable cache (in-memory, TTL-based) so DataProvider can avoid
// recomputing tenant metrics on every call. No new external dependency
// (Redis, etc.) — that's a future swap-in behind the same get/set contract.

export interface DataCache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs: number): void
}

class InMemoryDataCache implements DataCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
}

let activeCache: DataCache = new InMemoryDataCache()

// Swap the default in-memory cache for another implementation (same
// interface) — e.g. a future Redis-backed cache — without touching callers.
export function setDataCache(cache: DataCache): void {
  activeCache = cache
}

export function getDataCache(): DataCache {
  return activeCache
}
