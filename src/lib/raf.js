/**
 * Single requestAnimationFrame loop for the whole app.
 *
 * Every canvas / WebGL / cursor / physics component subscribes here instead of
 * calling requestAnimationFrame itself. One callback per frame instead of
 * fifteen, one shared timestamp (so nothing tears against anything else), and
 * a single place to pause everything when the tab is hidden.
 *
 * A frame-rate governor watches the rolling average and drops a graphics tier
 * when the machine cannot keep up, publishing the result on
 * document.documentElement.dataset.gfxTier so CSS can respond too.
 */

const subs = new Set()
let running = false
let last = 0

// ── Graphics tiers ────────────────────────────────────────────────────────
// 3 = everything, 2 = reduced (CSS hero, halved particles, DPR 1.5),
// 1 = WebGL and canvas effects off, CSS transitions only.
let tier = 3
const tierSubs = new Set()

let slowFrames = 0
let fastFrames = 0
let governorEnabled = true

function applyTier(next) {
  if (next === tier) return
  tier = next
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.gfxTier = String(tier)
  }
  for (const fn of tierSubs) {
    try { fn(tier) } catch { /* a bad listener must not break the loop */ }
  }
}

export function getTier() {
  return tier
}

export function onTierChange(fn) {
  tierSubs.add(fn)
  return () => tierSubs.delete(fn)
}

/** Force a tier and stop the governor from overriding it. */
export function setTier(next, { lock = false } = {}) {
  if (lock) governorEnabled = false
  applyTier(Math.max(1, Math.min(3, next)))
}

/**
 * Establish the starting tier from device capability, before any frame has
 * been measured. Cheap heuristics only — the governor corrects from there.
 */
export function initTier() {
  if (typeof window === 'undefined') return 3
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  const saveData = navigator.connection?.saveData === true
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const small = !window.matchMedia('(min-width: 768px)').matches

  let start = 3
  if (cores <= 4 || mem <= 4 || small) start = 2
  if (cores <= 2 || mem <= 2 || saveData || reduced) start = 1

  // applyTier is a no-op when the value has not changed, so the attribute
  // would never be written on a machine that starts at the default tier 3 —
  // and every CSS rule gated on [data-gfx-tier] would silently not apply.
  tier = start
  document.documentElement.dataset.gfxTier = String(start)
  for (const fn of tierSubs) {
    try { fn(start) } catch { /* a bad listener must not break startup */ }
  }
  return start
}

function loop(t) {
  if (!subs.size) { running = false; return }
  requestAnimationFrame(loop)

  const dt = last ? t - last : 16.7
  last = t

  // A hidden tab still gets rAF throttled callbacks in some browsers; skip the
  // work entirely and do not let the long gap poison the governor.
  if (document.hidden) return

  if (governorEnabled && dt < 500) {
    if (dt > 20) {
      slowFrames++
      fastFrames = 0
      if (slowFrames >= 60) { applyTier(tier - 1); slowFrames = 0 }
    } else if (dt < 14) {
      fastFrames++
      slowFrames = 0
      // Recovering is deliberately slower than degrading, so the tier does not
      // oscillate around the threshold.
      if (fastFrames >= 600) { applyTier(tier + 1); fastFrames = 0 }
    }
  }

  for (const fn of subs) {
    try { fn(t, dt) } catch { /* one broken subscriber must not kill the rest */ }
  }
}

/**
 * Subscribe to the shared frame loop.
 * @param {(t: number, dt: number) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onFrame(fn) {
  subs.add(fn)
  if (!running) {
    running = true
    last = 0
    requestAnimationFrame(loop)
  }
  return () => subs.delete(fn)
}

// Restarting on visibility return keeps `last` from carrying a multi-minute
// delta into the first frame back.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      last = 0
      slowFrames = 0
      fastFrames = 0
    }
  })
}
