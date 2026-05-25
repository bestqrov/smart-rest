/**
 * SmartResto Service Worker  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy map:
 *   /_next/static/**  → CacheFirst  (7 days)
 *   /assets/**        → CacheFirst  (30 days)
 *   images (any host) → CacheFirst  (14 days)
 *   /api/menu/**      → StaleWhileRevalidate  (serve cached, refresh silently)
 *   /*\/menu*         → StaleWhileRevalidate  (customer QR menu pages)
 *   POST /api/orders  → NetworkFirst → IndexedDB queue → Background Sync
 *   everything else   → NetworkFirst → cache fallback
 */

const SW_VERSION    = 'v2.1'
const STATIC_CACHE  = `sr-static-${SW_VERSION}`
const MENU_CACHE    = `sr-menu-${SW_VERSION}`
const IMAGE_CACHE   = `sr-images-${SW_VERSION}`
const RUNTIME_CACHE = `sr-runtime-${SW_VERSION}`
const ORDER_DB      = 'sr-orders-db'
const ORDER_STORE   = 'pending-orders'
const SYNC_TAG      = 'smartresto-order-sync'

const ALL_CACHES = [STATIC_CACHE, MENU_CACHE, IMAGE_CACHE, RUNTIME_CACHE]

// Shell assets to precache on install
const SHELL_URLS = [
  '/manifest.json',
  '/assets/logo.png',
]

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers for pending-orders queue
// ─────────────────────────────────────────────────────────────────────────────

function openOrderDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ORDER_DB, 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        db.createObjectStore(ORDER_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function queueOrder(payload) {
  const db    = await openOrderDB()
  const tx    = db.transaction(ORDER_STORE, 'readwrite')
  const store = tx.objectStore(ORDER_STORE)
  store.add({ ...payload, queuedAt: Date.now() })
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}

async function getPendingOrders() {
  const db    = await openOrderDB()
  const tx    = db.transaction(ORDER_STORE, 'readonly')
  const store = tx.objectStore(ORDER_STORE)
  return new Promise((res, rej) => {
    const req = store.getAll()
    req.onsuccess = () => res(req.result)
    req.onerror   = rej
  })
}

async function removeOrder(id) {
  const db    = await openOrderDB()
  const tx    = db.transaction(ORDER_STORE, 'readwrite')
  tx.objectStore(ORDER_STORE).delete(id)
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej })
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache strategy helpers
// ─────────────────────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    const date = cached.headers.get('sw-cached-at')
    if (!date || Date.now() - Number(date) < maxAgeSeconds * 1000) {
      return cached
    }
  }

  try {
    const network = await fetch(request)
    if (network.ok) {
      const clone = network.clone()
      const headers = new Headers(clone.headers)
      headers.set('sw-cached-at', String(Date.now()))
      const stamped = new Response(await clone.blob(), { status: clone.status, statusText: clone.statusText, headers })
      await cache.put(request, stamped)
    }
    return network
  } catch {
    return cached ?? new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchAndStore = fetch(request)
    .then(async response => {
      if (response.ok) {
        const clone   = response.clone()
        const headers = new Headers(clone.headers)
        headers.set('sw-cached-at', String(Date.now()))
        const stamped = new Response(await clone.blob(), { status: clone.status, statusText: clone.statusText, headers })
        await cache.put(request, stamped)
      }
      return response
    })
    .catch(() => null)

  return cached ?? await fetchAndStore ?? new Response(JSON.stringify({ error: 'Offline' }), {
    status:  503,
    headers: { 'Content-Type': 'application/json', 'x-sw-offline': '1' }
  })
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    return cached ?? new Response('Offline', { status: 503, headers: { 'x-sw-offline': '1' } })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST order handler — NetworkFirst → queue on failure
// ─────────────────────────────────────────────────────────────────────────────

async function handleOrderPost(request) {
  // Clone body before attempting network (body can only be read once)
  const bodyText = await request.text()

  try {
    const response = await fetch(new Request(request.url, {
      method:  'POST',
      headers: request.headers,
      body:    bodyText,
    }))
    if (response.ok) return response

    // 4xx = server error, don't queue
    if (response.status < 500) return response

    throw new Error(`Server ${response.status}`)
  } catch {
    // Network unreachable or 5xx — queue the order
    await queueOrder({
      url:     request.url,
      method:  'POST',
      headers: Object.fromEntries(request.headers.entries()),
      body:    bodyText,
    })

    // Register for background sync (Chrome/Android) — silently fail if unsupported
    try {
      const reg = await self.registration
      if (reg.sync) await reg.sync.register(SYNC_TAG)
    } catch {}

    // Notify the page so it can show "order queued" UI
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) {
      client.postMessage({ type: 'ORDER_QUEUED', body: JSON.parse(bodyText) })
    }

    return new Response(JSON.stringify({ queued: true, message: 'Order saved offline — will sync when connected' }), {
      status:  202,
      headers: { 'Content-Type': 'application/json', 'x-sw-queued': '1' }
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Sync — replay queued orders
// ─────────────────────────────────────────────────────────────────────────────

async function flushOrderQueue() {
  const orders = await getPendingOrders()
  const clients = await self.clients.matchAll({ type: 'window' })

  for (const order of orders) {
    try {
      const resp = await fetch(order.url, {
        method:  order.method,
        headers: order.headers,
        body:    order.body,
      })
      if (resp.ok || resp.status < 500) {
        await removeOrder(order.id)
        for (const client of clients) {
          client.postMessage({ type: 'ORDER_SYNCED', orderId: order.id })
        }
      }
    } catch {
      // Still offline — leave in queue
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — purge old caches
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('sr-') && !ALL_CACHES.includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — route every request to the right strategy
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin + known CDN patterns
  const isSameOrigin = url.origin === self.location.origin
  const isExternal   = !isSameOrigin

  // ── POST /api/orders → offline queue ──────────────────────────────────────
  if (request.method === 'POST' && url.pathname === '/api/orders') {
    event.respondWith(handleOrderPost(request))
    return
  }

  // Skip non-GET from here
  if (request.method !== 'GET') return

  // ── Static Next.js bundles → CacheFirst 7 days ────────────────────────────
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 7 * 86400))
    return
  }

  // ── Local static assets → CacheFirst 30 days ──────────────────────────────
  if (isSameOrigin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 30 * 86400))
    return
  }

  // ── Images from any origin → CacheFirst 14 days ───────────────────────────
  if (request.destination === 'image' || /\.(png|jpe?g|webp|gif|svg|ico)(\?|$)/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 14 * 86400))
    return
  }

  // ── Menu data API → StaleWhileRevalidate ──────────────────────────────────
  if (isSameOrigin && (
    url.pathname.startsWith('/api/menu') ||
    url.pathname.includes('/menu')
  )) {
    event.respondWith(staleWhileRevalidate(request, MENU_CACHE))
    return
  }

  // ── Google Fonts → CacheFirst 30 days ─────────────────────────────────────
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 30 * 86400))
    return
  }

  // ── HTML document pages → NetworkFirst → cache fallback ───────────────────
  if (isSameOrigin && (request.destination === 'document' || request.mode === 'navigate')) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE))
    return
  }

  // ── Everything else → NetworkFirst ────────────────────────────────────────
  if (isSameOrigin) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE))
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND SYNC  (Android Chrome)
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOrderQueue())
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE — allow page to trigger manual flush
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('message', event => {
  if (event.data?.type === 'FLUSH_ORDERS') {
    flushOrderQueue()
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
