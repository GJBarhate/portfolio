/**
 * perfHud.js — P0.8. A live instrument panel, behind `?perf=1`.
 *
 * Every performance claim in this repo's history has been argued from a
 * Lighthouse score, which is a single number produced on a machine nobody
 * owns. The questions that actually decide what to fix are different ones:
 *
 *   is the ambient band being skipped, and how often?
 *   how many rAF subscribers has the cost governor throttled?
 *   how many WebGL contexts are live *right now*?
 *   which overlay is holding the slot, and how much of its TTL is left?
 *   what is the clock's own frame cost? (Phase 3 sets a 2 ms ceiling on it)
 *
 * None of those are visible in a profiler trace without a lot of squinting,
 * and all of them are already tracked internally for other reasons. This just
 * puts them on screen.
 *
 * Three rules, because a perf tool that costs perf is a joke:
 *
 *  1. **It is not in the eager bundle.** The whole module is dynamically
 *     imported from App only when `?perf=1` is present, so a normal visitor
 *     never downloads a byte of it. `check-budgets.mjs`'s reachability check
 *     is what keeps that true.
 *  2. **It does not subscribe to the frame loop.** Adding a subscriber to
 *     measure the subscribers changes the thing being measured. It samples on
 *     a 500 ms interval instead, which is faster than anyone can read and slow
 *     enough to cost nothing.
 *  3. **It writes `textContent` on fixed nodes**, never innerHTML and never a
 *     new element per sample, so it cannot cause layout thrash of its own.
 */
import { frameStats, throttledCount } from './raf.js'
import { liveContextCount } from './glStage.js'
import { currentOverlay } from './overlayBus.js'

const SAMPLE_MS = 500

/** Effects register their own p95 here — see `trackCost`. Phase 3.10 uses it. */
const costs = new Map()

/**
 * Record one frame's cost for a named effect. A ring of the last 60 samples,
 * so the p95 is over ~1–2 seconds of real frames rather than over the whole
 * session, which would never recover from a single bad startup frame.
 *
 * Called unconditionally from the effects (it is three lines and a modulo);
 * when the HUD is not mounted nothing ever reads the ring.
 */
export function trackCost(id, ms) {
  let ring = costs.get(id)
  if (!ring) { ring = { samples: new Float32Array(60), i: 0, n: 0 }; costs.set(id, ring) }
  ring.samples[ring.i] = ms
  ring.i = (ring.i + 1) % 60
  if (ring.n < 60) ring.n += 1
}

/** p95 of the ring, or null if nothing has reported yet. */
export function costP95(id) {
  const ring = costs.get(id)
  if (!ring || !ring.n) return null
  const sorted = Array.from(ring.samples.slice(0, ring.n)).sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
}

/** True when the URL asked for the HUD. */
export function perfRequested() {
  if (typeof window === 'undefined') return false
  try { return new URLSearchParams(location.search).get('perf') === '1' } catch { return false }
}

let root = null
let timer = null

export function mountPerfHud() {
  if (root || typeof document === 'undefined') return () => {}

  root = document.createElement('div')
  root.className = 'perf-hud'
  // A development instrument is not page content: no landmark, no reading
  // order, nothing for a screen reader to announce.
  root.setAttribute('aria-hidden', 'true')
  Object.assign(root.style, {
    position: 'fixed',
    insetBlockStart: 'calc(var(--header-h, 56px) + 8px)',
    insetInlineEnd: '8px',
    zIndex: '2147483000',
    font: '11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#d8f5ff',
    background: 'rgba(4, 10, 14, 0.82)',
    border: '1px solid rgba(120, 220, 235, 0.35)',
    borderRadius: '8px',
    padding: '8px 10px',
    minWidth: '190px',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    // Deliberately NOT backdrop-filter: the HUD must not add the exact class
    // of paint cost it exists to help find.
    boxShadow: '0 8px 30px -12px rgba(0, 0, 0, 0.8)',
  })

  const line = () => {
    const el = document.createElement('div')
    root.appendChild(el)
    return el
  }
  const title = line()
  title.textContent = 'PERF ?perf=1'
  title.style.opacity = '0.55'
  title.style.letterSpacing = '0.14em'
  const rows = {
    frame: line(),
    tier: line(),
    bands: line(),
    gl: line(),
    overlay: line(),
    clock: line(),
  }

  document.body.appendChild(root)

  const sample = () => {
    const s = frameStats()
    rows.frame.textContent = `fps ${String(s.fps).padStart(3)}   frame ${s.avgFrameMs.toFixed(1)}ms`
    rows.tier.textContent = `tier ${s.tier} (floor ${s.tierFloor})  motion ${s.motion}`
    rows.bands.textContent =
      `rAF i${s.bands.input} l${s.bands.layout} a${s.bands.ambient} c${s.bands.critical}` +
      `  thr ${throttledCount()}${s.paused ? '  PAUSED' : ''}`
    rows.gl.textContent = `webgl contexts ${liveContextCount()}`
    rows.overlay.textContent = `overlay ${currentOverlay() ?? '—'}`
    const clock = costP95('moon-forest-clock')
    rows.clock.textContent = clock === null ? 'clock —' : `clock p95 ${clock.toFixed(2)}ms`
    // The Phase-4 acceptance criterion, visible rather than asserted: > 2 ms at
    // tier <= 2 means the material work went too far and the tier-2 rendition
    // is the rollback.
    rows.clock.style.color = clock !== null && clock > (s.tier >= 3 ? 4 : 2) ? '#ff9d9d' : 'inherit'
  }

  sample()
  timer = setInterval(sample, SAMPLE_MS)

  return unmountPerfHud
}

export function unmountPerfHud() {
  if (timer) { clearInterval(timer); timer = null }
  root?.remove()
  root = null
}
