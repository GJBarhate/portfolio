/**
 * sw.js — T-057.
 *
 * **The kill switch is written first, before any caching logic.** A bad
 * service worker is the worst bug you can ship to a static site: it can serve
 * a broken build to a returning visitor forever, and the visitor has no way
 * to know, no way to clear it, and no reason to try. Everything below is
 * arranged so that the failure mode is "the network, as if there were no
 * service worker", never "a stale page nobody can escape".
 *
 * Three strategies, one per kind of request:
 *
 *   hashed assets, fonts   cache-first    — the filename contains the hash,
 *                                           so a hit is by definition correct
 *   images                 stale-while-revalidate
 *   the document           network-first  — a deploy must be visible on the
 *                                           next load, not the one after
 *
 * The version below is bumped by the build (`scripts/gen-sw.mjs` writes it),
 * so a new deploy always evicts the old caches.
 */

const VERSION = 'forge-v1'
const STATIC_CACHE = `${VERSION}-static`
const IMAGE_CACHE = `${VERSION}-images`
const DOC_CACHE = `${VERSION}-docs`
const CACHES = [STATIC_CACHE, IMAGE_CACHE, DOC_CACHE]

/** The offline page: useful in its own right, not a browser error screen. */
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(DOC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

/**
 * The kill switch. Posting `{ type: 'FORGE_SW_KILL' }` from any page —
 * `navigator.serviceWorker.controller.postMessage({type:'FORGE_SW_KILL'})`,
 * which `sw-register.js` exposes as `forge.swKill()` — drops every cache and
 * unregisters. It exists so that a catastrophic caching mistake is one
 * console line to undo rather than a support problem.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FORGE_SW_KILL') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll())
        .then((clients) => clients.forEach((c) => c.navigate(c.url)))
    )
  }
  if (event.data?.type === 'FORGE_SW_SKIP_WAITING') self.skipWaiting()
})

const isHashedAsset = (url) => /\/assets\/.+-[A-Za-z0-9_-]{6,}\.(js|css)$/.test(url.pathname)
const isFont = (url) => /\.(woff2?|ttf|otf)$/.test(url.pathname)
const isImage = (url) => /\.(png|jpe?g|webp|avif|gif|svg|ico)$/.test(url.pathname)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never touch another origin, and never touch anything that is not http(s):
  // a service worker that intercepts third-party requests is a service worker
  // that can break them.
  if (url.origin !== self.location.origin) return
  if (!url.protocol.startsWith('http')) return

  // The document: network first, cache as a fallback, offline page last.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(DOC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL)))
    )
    return
  }

  if (isHashedAsset(url) || isFont(url)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        }
        return response
      }))
    )
    return
  }

  if (isImage(url)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
          }
          return response
        }).catch(() => hit)
        return hit || network
      })
    )
  }
})
