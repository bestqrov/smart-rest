/**
 * Lightweight TTL cache for knowledge objects.
 *
 * Knowledge objects are plain JSON (no Mongoose docs, no circular refs)
 * so they serialise cleanly. This cache is intentionally simple:
 * - In-process Map<string, { value, expiresAt }>
 * - Default TTL: 5 minutes (knowledge data changes rarely)
 * - No eviction strategy beyond TTL — restart the process to force a flush
 *
 * Usage:
 *   const cache = createCache<CountryKnowledge>(300)
 *   const result = await cache.getOrFetch('MA', () => getByCode('MA'))
 *
 * In production, swap this for a Redis adapter by implementing the same
 * { getOrFetch, invalidate, flush } interface.
 */

export interface KnowledgeCache<T> {
  getOrFetch(key: string, fetcher: () => Promise<T | null>): Promise<T | null>
  invalidate(key: string): void
  flush(): void
  size(): number
}

interface CacheEntry<T> {
  value:     T | null
  expiresAt: number
}

/**
 * Create a new in-memory TTL cache.
 * @param ttlSeconds - How long entries live before re-fetching. Default: 300s (5 min).
 */
export function createCache<T>(ttlSeconds = 300): KnowledgeCache<T> {
  const store = new Map<string, CacheEntry<T>>()

  function isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expiresAt
  }

  return {
    async getOrFetch(key, fetcher) {
      const cached = store.get(key)
      if (cached && !isExpired(cached)) return cached.value

      const value = await fetcher()
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
      return value
    },

    invalidate(key) {
      store.delete(key)
    },

    flush() {
      store.clear()
    },

    size() {
      return store.size
    },
  }
}

/**
 * Wrap any async function with a TTL cache keyed by its first string argument.
 * The wrapped function has the same signature as the original.
 *
 * Example:
 *   const cachedGetByCode = withCache(getByCode, 300)
 *   const morocco = await cachedGetByCode('MA')   // fetches from DB
 *   const morocco2 = await cachedGetByCode('MA')  // served from cache
 */
export function withCache<TArg extends string, TResult>(
  fn:         (arg: TArg) => Promise<TResult | null>,
  ttlSeconds = 300,
): (arg: TArg) => Promise<TResult | null> {
  const cache = createCache<TResult>(ttlSeconds)
  return (arg: TArg) => cache.getOrFetch(arg, () => fn(arg))
}
