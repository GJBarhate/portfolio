/**
 * rum.js — T-008. Real-user monitoring, installed before anything else is
 * changed.
 *
 * Every number in the plan's budget table started as `unknown`. A performance
 * plan without measurement is a wish list, and an error boundary that renders
 * a fallback and reports nothing means production failures are invisible.
 *
 * Design constraints, in order of importance:
 *
 *  1. **Never on the critical path.** The whole module is dynamically
 *     imported at idle; `check-budgets.mjs` asserts it is not in the eager
 *     graph. Measuring LCP must not move LCP.
 *  2. **One request per page view.** Metrics accumulate in memory and are
 *     flushed once, with `sendBeacon`, on `visibilitychange → hidden`, which
 *     is the only lifecycle event mobile browsers reliably deliver. `unload`
 *     is not fired on iOS at all.
 *  3. **Dimensions, not just numbers.** "LCP is 2.4 s" is not actionable;
 *     "LCP is 2.4 s at tier 1 on 4G with the preloader" is. Every beacon
 *     carries the resolved graphics tier, theme, memory, connection type,
 *     viewport bucket, motion preference and whether the intro ran.
 *  4. **Errors ride the same channel.** One transport, one payload shape, so
 *     an error and the metrics around it arrive together.
 *
 * Primary sink: Vercel Analytics / Speed Insights when present (zero-config,
 * no cookie banner). Secondary: `POST /api/rum`, which exists from P6; until
 * then a missing endpoint is a silent no-op rather than a console error.
 */
import { getTier } from './raf.js'
import { getProfile } from './deviceProfile.js'
import { getStore } from './store.js'
import { currentViewport } from './breakpoints.js'

const ENDPOINT = '/api/rum'
const MAX_BYTES = 1024

const payload = {
  v: 1,
  metrics: {},
  events: [],
  longTasks: 0,
  longestTask: 0,
  /**
   * P0.4 — the long-task inventory. A count and a maximum tell you the page
   * has a problem; they do not tell you which code has it, which is the only
   * thing that lets anyone fix it. Each bucket is `container → { n, total,
   * max }`, keyed by the attribution the browser gives us (the frame or the
   * script that owned the task). Capped at 12 keys so a pathological page
   * cannot grow the beacon without bound.
   */
  longTaskBuckets: {},
}

const LONG_TASK_KEYS = 12

let installed = false
let flushed = false

function dimensions() {
  const store = getStore()
  const profile = getProfile()
  return {
    tier: getTier(),
    probedTier: profile?.tier ?? null,
    probeMs: profile?.measuredMs ?? null,
    theme: document.documentElement.dataset.theme || 'unknown',
    motion: store.motion,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    memory: navigator.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    conn: navigator.connection?.effectiveType ?? null,
    saveData: navigator.connection?.saveData === true,
    viewport: currentViewport(),
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    intro: !!store.seen?.intro,
  }
}

/** Metrics are rounded — a sub-millisecond LCP digit is noise, and bytes. */
const round = (value) => (typeof value === 'number' ? Math.round(value * 1000) / 1000 : value)

export function recordMetric(name, value, extra) {
  payload.metrics[name] = { value: round(value), ...extra }
}

export function recordEvent(type, detail) {
  // Cap the queue: a page that throws in a loop must not build a 5 MB beacon.
  if (payload.events.length >= 20) return
  payload.events.push({ type, ...detail, at: Math.round(performance.now()) })
}

/**
 * Send once. `sendBeacon` survives the page being torn down, which `fetch`
 * with `keepalive` mostly does and `XMLHttpRequest` does not.
 */
export function flush(reason = 'hidden') {
  if (flushed || !installed) return
  const body = JSON.stringify({ ...payload, reason, dims: dimensions(), url: location.pathname })
  if (body.length > MAX_BYTES * 8) return // pathological; drop rather than upload
  flushed = true

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
        .catch(() => {})
    }
  } catch { /* a blocked beacon is not worth an error */ }

  // Vercel Speed Insights, when the deployment has it enabled, gets the same
  // numbers through its own queue.
  try {
    for (const [name, m] of Object.entries(payload.metrics)) {
      window.si?.('track', name, m.value)
    }
  } catch { /* optional sink */ }
}

/** Errors reach here from the boundary, `onerror` and `unhandledrejection`. */
export function reportError(error, info = {}) {
  recordEvent('error', {
    message: String(error?.message || error).slice(0, 240),
    stack: String(error?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 480),
    ...info,
  })
  // An error is worth its own beacon: the page may be about to stop working,
  // and a report that waits for `visibilitychange` may never be sent.
  if (!flushed) {
    try {
      navigator.sendBeacon?.(
        ENDPOINT,
        new Blob([JSON.stringify({ v: 1, reason: 'error', dims: dimensions(), events: payload.events.slice(-3) })], { type: 'application/json' })
      )
    } catch { /* ignore */ }
  }
}

export async function install() {
  if (installed) return
  installed = true

  try {
    const { onLCP, onINP, onCLS, onTTFB, onFCP } = await import('web-vitals')
    const bind = (fn, name) => fn((metric) => recordMetric(name, metric.value, { rating: metric.rating }))
    bind(onLCP, 'LCP')
    bind(onINP, 'INP')
    bind(onCLS, 'CLS')
    bind(onTTFB, 'TTFB')
    bind(onFCP, 'FCP')
  } catch { /* web-vitals unavailable — the observers below still work */ }

  /*
   * P0.7 — INP WITH ATTRIBUTION.
   *
   * "INP is 340 ms" is a number you can put in a table and do nothing about.
   * The attribution build answers the three questions that make it
   * actionable: which element was interacted with, and how the 340 ms split
   * between waiting for the main thread (input delay), running the handler
   * (processing) and painting the result (presentation delay). Those three
   * have completely different fixes — a long task somewhere else, a slow
   * handler, and a heavy style/layout pass respectively.
   *
   * A SECOND dynamic import rather than replacing the one above: the
   * attribution build is meaningfully larger, and if it fails to load (an old
   * browser, an ad blocker, a bad cache) the plain INP number above still
   * arrives. Both call `recordMetric('INP', …)`; the attributed one lands
   * second and wins, which is the ordering we want.
   */
  try {
    const { onINP } = await import('web-vitals/attribution')
    onINP((metric) => {
      const a = metric.attribution || {}
      recordMetric('INP', metric.value, {
        rating: metric.rating,
        target: String(a.interactionTarget || '').slice(0, 120) || null,
        type: a.interactionType ?? null,
        id: a.interactionId ?? null,
        // The three phases, rounded — see above for why each matters.
        delay: round(a.inputDelay),
        processing: round(a.processingDuration),
        presentation: round(a.presentationDelay),
        loadState: a.loadState ?? null,
      })
    })
  } catch { /* plain INP from the block above still applies */ }

  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        payload.longTasks += 1
        payload.longestTask = Math.max(payload.longestTask, Math.round(entry.duration))

        // P0.4 — attribute it. `containerName`/`containerSrc` name the frame
        // or element that owned the task; `containerType` ('window',
        // 'iframe', …) is the fallback when neither is populated, which is
        // the common case for same-document script.
        const source = entry.attribution?.[0]
        const key = (
          source?.containerName ||
          source?.containerId ||
          source?.containerSrc ||
          source?.containerType ||
          'unknown'
        ).slice(0, 40)
        const bucket = payload.longTaskBuckets[key]
        if (bucket) {
          bucket.n += 1
          bucket.total += Math.round(entry.duration)
          bucket.max = Math.max(bucket.max, Math.round(entry.duration))
        } else if (Object.keys(payload.longTaskBuckets).length < LONG_TASK_KEYS) {
          payload.longTaskBuckets[key] = { n: 1, total: Math.round(entry.duration), max: Math.round(entry.duration) }
        }
      }
    })
    po.observe({ type: 'longtask', buffered: true })
  } catch { /* Safari has no longtask entries */ }

  window.addEventListener('error', (e) => reportError(e.error || e.message, { kind: 'window' }))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, { kind: 'promise' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('hidden')
  })
  // `pagehide` is the one iOS Safari actually fires on a swipe-away.
  window.addEventListener('pagehide', () => flush('pagehide'))
}

export default install
