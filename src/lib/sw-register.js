/**
 * sw-register.js — T-057.
 *
 * Registration is deliberately unexciting: at idle, never blocking, never on
 * a dev server, and with an escape hatch reachable from the console.
 *
 * The dev-server exclusion is not a nicety. A service worker registered from
 * `localhost:5173` outlives the dev session and will serve cached module
 * responses to the *next* project on that port, which is a bug that costs an
 * afternoon to diagnose the first time it happens.
 */

const SW_URL = '/sw.js'

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // Only over https (or localhost, which browsers treat as secure) and never
  // from the dev server.
  if (import.meta.env?.DEV) return
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return

  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000))
  idle(() => {
    navigator.serviceWorker.register(SW_URL, { scope: '/' }).then((registration) => {
      // A new worker taking over mid-session would swap the JS under a running
      // app; it waits, and the next navigation gets it.
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('forge:sw-update'))
          }
        })
      })
    }).catch(() => {
      // A failed registration is not worth an error to the visitor: the site
      // works without it, which is the whole design.
    })
  })
}

/**
 * The kill switch, exposed on `window.forge` so it can be run from a phone
 * through the palette terminal as well as from a desktop console. Build the
 * escape hatch before the caching logic, not after.
 */
export async function killServiceWorker() {
  if (!('serviceWorker' in navigator)) return false
  try {
    navigator.serviceWorker.controller?.postMessage({ type: 'FORGE_SW_KILL' })
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    return true
  } catch {
    return false
  }
}
