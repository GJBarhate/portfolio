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

/**
 * T-056.1 — priority bands.
 *
 * One shared ticker is the right architecture, and at 176 lines it was doing
 * subscription, timing, tier governance and visibility in one file — which
 * means its failure modes are the site's failure modes. The band is the piece
 * that was missing: when a frame runs long, *something* has to be dropped,
 * and the choice must not be "whichever subscriber happened to be last in a
 * Set".
 *
 *   input    the cursor, magnetic buttons — anything the visitor is currently
 *            doing. Never dropped: dropping input is what makes a page feel
 *            broken rather than slow.
 *   layout   scroll-linked reads and writes. Dropped only under real pressure.
 *   ambient  the canvases. First to go, every time, because nobody has ever
 *            noticed a background field skipping a frame.
 */
export const BANDS = ['input', 'layout', 'ambient']
const subs = { input: new Set(), layout: new Set(), ambient: new Set() }

/**
 * Subscribers that must never miss a frame while they are on screen.
 *
 * Everything else in the ambient band is a field, a haze, a drift — nobody
 * has ever noticed one skip. A rotating solid object is the opposite: a
 * single dropped frame reads as a stutter and a run of them reads as broken.
 * So the two 3-D scenes opt out of all three mechanisms that can hold the
 * ambient band back — the per-frame budget skip, the per-callback cost
 * throttle, and the blur pause — and run every frame the tab is visible.
 *
 * They keep the `inView` check they already had, which is the one that
 * actually matters for cost: an object scrolled off screen renders nothing.
 */
const critical = new Set()

const subCount = () =>
  subs.input.size + subs.layout.size + subs.ambient.size + critical.size

/**
 * Per-frame budget, in ms, above which the ambient band is skipped.
 *
 * 24 ms, not 12. A 12 ms ceiling sounds principled — half a 60 Hz frame — and
 * in practice it starved the ambient band permanently: this page's input and
 * layout work routinely costs more than that on a first paint, so the
 * canvases never got a single frame and the hero gem, the desk scene and the
 * background field all sat perfectly still. An ambient layer that never runs
 * is not a saving, it is a bug with a justification attached.
 *
 * 24 ms is "this frame was already dropped", which is the honest threshold
 * for giving up on decoration. And `MAX_CONSECUTIVE_SKIPS` guarantees the
 * band still runs at least every other frame, so under sustained load the
 * canvases degrade to ~30 fps rather than to zero.
 */
const FRAME_BUDGET_MS = 24
const MAX_CONSECUTIVE_SKIPS = 1
let ambientSkips = 0

let running = false
let last = 0
let paused = false

// ── Graphics tiers ────────────────────────────────────────────────────────
// 3 = everything, 2 = reduced (CSS hero, halved particles, DPR 1.5),
// 1 = WebGL and canvas effects off, CSS transitions only.
let tier = 3
const tierSubs = new Set()

let slowFrames = 0
let fastFrames = 0
let avgDt = 16.7
let frameSamples = 0
let governorEnabled = true

// The governor may not drop more than one tier below where the device STARTED.
// Frame timing is noisy — a lazy chunk landing, a texture upload, a GC pause,
// another tab stealing the GPU — and a machine that was capable at load is
// still capable a second later. Letting a transient dip cascade to tier 1 is
// how the hero gem and the About desk scene ended up vanishing and reappearing
// mid-session: both hard-gate on tier >= 2, so a one-second stutter deleted
// them. Tier 1 remains reachable, but only from initTier()'s device
// heuristics or an explicit setTier() — not from a bad second.
let tierFloor = 2

function applyTier(next) {
  const clamped = Math.max(tierFloor, Math.min(3, next))
  if (clamped === tier) return
  tier = clamped
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
  const target = Math.max(1, Math.min(3, next))
  // An explicit call outranks the governor's floor.
  tierFloor = Math.min(tierFloor, target)
  applyTier(target)
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
  // A machine that was capable enough to start at 2 or 3 keeps WebGL. It can
  // be governed between 3 and 2 — fewer particles, lower DPR — but never down
  // to tier 1, because tier 1 means "no WebGL at all" and the hero gem and the
  // desk scene both hard-gate on it. `Math.max(1, start - 1)` let a laptop
  // that started at 2 fall to 1 after three bad seconds, and a 3-D object
  // that stops dead mid-air reads as a broken page, not as a thrifty one.
  // Tier 1 stays reachable from initTier()'s own heuristics and setTier().
  tierFloor = start >= 2 ? 2 : 1
  document.documentElement.dataset.gfxTier = String(start)
  for (const fn of tierSubs) {
    try { fn(start) } catch { /* a bad listener must not break startup */ }
  }
  return start
}

function loop(t) {
  if (!subCount()) { running = false; return }
  requestAnimationFrame(loop)

  const dt = last ? t - last : 16.7
  last = t

  // A hidden tab still gets rAF throttled callbacks in some browsers; skip the
  // work entirely and do not let the long gap poison the governor.
  //
  // T-056.3 — `document.hidden` is not the whole story. A window that is
  // visible but not focused (another app on top, a second monitor) is still
  // burning battery on five canvases for nobody, so `blur` pauses the ambient
  // band too. Input and layout keep running: a visitor who clicks back into
  // the window must not find a stale page.
  if (document.hidden) return

  // The governor judges a rolling AVERAGE, not a run of consecutive frames.
  // A counter that resets on a single good frame is trivially tripped by
  // ordinary noise — a lazy chunk arriving, a texture upload, a GC pause — and
  // 60 frames is barely a second. Degrading has to mean "this machine is
  // sustainedly struggling", not "the last second was untidy".
  if (governorEnabled && dt < 500) {
    avgDt += (dt - avgDt) * 0.02   // ~50-frame time constant
    frameSamples++

    // Ignore the first ~2 s: startup is the least representative moment there
    // is, and it is exactly when a first-visit page is doing the most work.
    if (frameSamples > 120) {
      if (avgDt > 24) {
        slowFrames++
        fastFrames = 0
        // ~3 seconds of sustained slowness before giving anything up.
        if (slowFrames >= 180) { applyTier(tier - 1); slowFrames = 0; avgDt = 16.7 }
      } else if (avgDt < 15) {
        fastFrames++
        slowFrames = 0
        // Recovering is deliberately slower than degrading, so the tier does
        // not oscillate around the threshold.
        if (fastFrames >= 900) { applyTier(tier + 1); fastFrames = 0; avgDt = 16.7 }
      } else {
        // In the dead band between the two thresholds, decay both counters
        // rather than holding a partial verdict indefinitely.
        if (slowFrames > 0) slowFrames--
        if (fastFrames > 0) fastFrames--
      }
    }
  }

  // T-056.2 — a per-subscriber budget. One callback that consistently blows
  // the frame is unsubscribed rather than allowed to take the page down with
  // it, and the fact is reported so it is a known problem rather than a
  // mysterious one.
  const budgetStart = performance.now()

  runBand(subs.input, t, dt)
  // Unconditional, and before the budget is even consulted. This is the
  // whole point of the band: no skip, no throttle, no pause.
  if (critical.size) runBand(critical, t, dt, { exempt: true })
  runBand(subs.layout, t, dt)

  // The ambient band runs if the frame still has room — or if it has already
  // been skipped once, so decoration degrades to half rate rather than to
  // nothing. It never runs while the window is unfocused.
  const spent = performance.now() - budgetStart
  if (paused) {
    ambientSkips = 0
  } else if (spent < FRAME_BUDGET_MS || ambientSkips >= MAX_CONSECUTIVE_SKIPS) {
    ambientSkips = 0
    runBand(subs.ambient, t, dt)
  } else {
    ambientSkips += 1
  }
}

/**
 * Per-callback cost control.
 *
 * This used to `band.delete(fn)` — evict a subscriber that averaged more than
 * 8 ms/frame for ninety strikes. That is the wrong remedy, and it is the bug
 * behind "the hero gem spins for a while and then stops": a WebGL render on a
 * GPU that is briefly contended crosses 8 ms easily, and eviction is
 * PERMANENT. Nothing re-adds the callback, the component has no idea it has
 * been dropped, and the visitor is left looking at a 3-D object frozen in
 * mid-air. The page protected its frame rate by breaking the thing the frame
 * rate was for.
 *
 * So an expensive callback is now *throttled* rather than removed: it runs
 * every 2nd, 3rd, then 4th frame, and recovers at half the rate it degrades.
 * The floor is ~15 fps, which still reads as motion. It is passed its own
 * elapsed time rather than the frame's, so a throttled animation runs at the
 * correct SPEED, just less smoothly — which is the whole point of demanding
 * dt-correctness from subscribers in the first place.
 */
const cost = new WeakMap()
const OVER_BUDGET_MS = 8
const STRIKES = 90
/** 1-in-4 frames ≈ 15 fps at 60 Hz: slow, still unmistakably moving. */
const MAX_DIVISOR = 4
/** A tab restored after minutes must not hand a callback a minutes-long dt. */
const MAX_DT_MS = 100

function runBand(band, t, dt, { exempt = false } = {}) {
  for (const fn of band) {
    const record = cost.get(fn) || { avg: 0, strikes: 0, credit: 0, divisor: 1, phase: 0, last: 0 }

    // Throttled: still subscribed, still on the clock, just not this frame.
    // Exempt subscribers are never throttled — see `critical` above.
    if (!exempt) {
      record.phase += 1
      if (record.phase < record.divisor) {
        cost.set(fn, record)
        continue
      }
      record.phase = 0
    }

    const own = record.last ? Math.min(t - record.last, MAX_DT_MS) : dt
    record.last = t

    const start = performance.now()
    try {
      fn(t, own)
    } catch {
      /* one broken subscriber must not kill the rest */
    }
    const elapsed = performance.now() - start

    record.avg += (elapsed - record.avg) * 0.05
    if (exempt) {
      cost.set(fn, record)
      continue
    }
    if (record.avg > OVER_BUDGET_MS) {
      record.credit = 0
      record.strikes += 1
      if (record.strikes >= STRIKES) {
        record.strikes = 0
        if (record.divisor < MAX_DIVISOR) {
          record.divisor += 1
          import('./rum.js')
            .then((rum) => rum.recordEvent('frame-budget', {
              message: `throttled a callback averaging ${record.avg.toFixed(1)} ms/frame to 1-in-${record.divisor}`,
            }))
            .catch(() => {})
        }
      }
    } else if (record.strikes > 0) {
      record.strikes -= 1
    } else if (record.divisor > 1) {
      // Recovery is deliberately slower than degradation, so a callback
      // hovering at the threshold does not oscillate between rates.
      record.credit += 1
      if (record.credit >= STRIKES * 2) {
        record.credit = 0
        record.divisor -= 1
      }
    }
    cost.set(fn, record)
  }
}

/**
 * Subscribe to the shared frame loop.
 *
 * Every callback must be **dt-correct**: a 120 Hz display delivers dt ≈ 8.3 ms,
 * so any effect that advances by a fixed amount per frame runs at double speed
 * there. The required pattern is the one the Navbar ring uses —
 * `value += (target - value) * (1 - Math.exp(-(dt / 1000) * k))` — which is
 * frame-rate independent by construction rather than by tuning.
 *
 * `critical: true` is for the two 3-D scenes and nothing else: it exempts the
 * callback from the frame-budget skip, the cost throttle and the blur pause,
 * so a rotating object never stalls. Use it only where a dropped frame is
 * visible as a defect rather than as a shimmer.
 *
 * @param {(t: number, dt: number) => void} fn
 * @param {{ band?: 'input'|'layout'|'ambient', critical?: boolean }} [options]
 * @returns {() => void} unsubscribe
 */
export function onFrame(fn, { band = 'layout', critical: isCritical = false } = {}) {
  const target = isCritical ? critical : (subs[band] || subs.layout)
  target.add(fn)
  if (!running) {
    running = true
    last = 0
    requestAnimationFrame(loop)
  }
  return () => target.delete(fn)
}

// Restarting on visibility return keeps `last` from carrying a multi-minute
// delta into the first frame back.
if (typeof document !== 'undefined') {
  const resetTiming = () => {
    last = 0
    slowFrames = 0
    fastFrames = 0
    avgDt = 16.7
    frameSamples = 0
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resetTiming()
  })
  // T-056.3 — an unfocused window pauses the ambient band. Battery on a
  // laptop or a phone is a real cost, and five canvases animating behind
  // another application is indefensible.
  window.addEventListener('blur', () => { paused = true })
  window.addEventListener('focus', () => { paused = false; resetTiming() })
}
