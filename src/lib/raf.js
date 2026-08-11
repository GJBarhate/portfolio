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

/**
 * P0.8 — what the loop is actually doing right now.
 *
 * Everything here is already tracked for the governor's own decisions; none of
 * it was readable from outside, so "is the ambient band being starved?" and
 * "how many subscribers are throttled?" were questions that could only be
 * answered by adding a console.log and rebuilding. The `?perf=1` HUD reads
 * this; nothing else does, and it allocates one object per call rather than
 * per frame.
 */
export function frameStats() {
  return {
    tier,
    tierFloor,
    // The governor's smoothed frame time, which is the number it acts on —
    // not an instantaneous fps, which is too noisy to read off a HUD.
    avgFrameMs: Math.round(avgDt * 10) / 10,
    fps: Math.round(1000 / Math.max(avgDt, 1)),
    bands: {
      input: subs.input.size,
      layout: subs.layout.size,
      ambient: subs.ambient.size,
      critical: critical.size,
    },
    ambientSkips,
    paused,
    motion: motionMode(),
  }
}

/**
 * Per-callback cost records, keyed by the callback itself. Declared here
 * rather than beside `runBand` so it precedes `throttledCount()`, which reads
 * it — execution order and reading order match.
 */
const cost = new WeakMap()

/**
 * The per-callback divisors, for the HUD's "who is being throttled" row.
 * `cost` is a WeakMap keyed by function, so the callbacks have to be walked to
 * read it — which is fine once a second and would not be fine per frame.
 */
export function throttledCount() {
  let n = 0
  for (const band of [subs.input, subs.layout, subs.ambient]) {
    for (const fn of band) if ((cost.get(fn)?.divisor ?? 1) > 1) n += 1
  }
  return n
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
 * The EFFECTIVE reduced-motion answer — D-45.
 *
 * The OS media query is the default and it is not the last word. The site
 * offers Motion: full / reduced / off / system, `motion.js` publishes the
 * choice as `<html data-motion>`, and `motion.css` has always honoured it —
 * but the graphics ladder went on consulting the raw media query. So a
 * visitor whose OS says "reduce" (which on Windows is just the "show
 * animations" switch, frequently off by default on laptops) and who then
 * explicitly chose Motion: full got the CSS animations back and no WebGL at
 * all: tier 1, no background field, no hero fluid, no 3-D scenes. The control
 * appeared not to work, and the only way to actually turn the site on was to
 * pin the tier by hand from the terminal.
 *
 * Reading the override first means the OS is still respected by default and
 * an explicit, informed choice wins — which is what offering the control
 * meant in the first place. `data-motion` is set by index.html before first
 * paint, so this is correct on the very first call.
 *
 * Deliberately reads the DOM rather than importing `motion.js`: this module is
 * the bottom of the dependency graph and must stay free of the store.
 */
export function motionMode() {
  if (typeof window === 'undefined') return 'full'
  const override = document.documentElement.dataset.motion
  if (override === 'full' || override === 'reduced' || override === 'off') return override
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full'
}

export function prefersReducedMotion() {
  return motionMode() !== 'full'
}

/** Only an explicit `Motion: off` means "render nothing". */
export function motionIsOff() {
  return motionMode() === 'off'
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
  const mode = motionMode()
  const small = !window.matchMedia('(min-width: 768px)').matches

  let start = 3
  /*
   * D-45 — `cores <= 4 || mem <= 4` was too eager on its own.
   *
   * `navigator.deviceMemory` is quantised and capped: Chrome reports the
   * largest of 0.25/0.5/1/2/4/8 that does not exceed the real figure, so a
   * machine with 6 GB reports 4 and lands in the same bucket as a Chromebook.
   * Either signal alone is weak; both together is a real statement about the
   * machine. A 4-core desktop with 8 GB now starts at 3 and is demoted by the
   * frame governor if — and only if — it actually cannot keep up, which is
   * the measurement the proxies were standing in for.
   */
  if (small || (cores <= 4 && mem <= 4)) start = 2
  /*
   * D-46 — reduced motion caps the tier, it does not switch WebGL off.
   *
   * `reduced` used to land here alongside `saveData` and force tier 1, which
   * means no background engine at all: one flat gradient behind every section
   * instead of eleven motifs. On Windows `prefers-reduced-motion: reduce` is
   * just the "Show animations" switch, frequently off on laptops and not
   * something its owner associates with graphics. `BackgroundEngine` freezes
   * the shader clock instead, so the motifs are all present and none of them
   * move. See resolveTier() for the same decision on the probe's side.
   */
  if (mode === 'reduced') start = Math.min(start, 2)
  /*
   * P5.14 — `off` caps the tier at 2; it no longer forces tier 1.
   *
   * Tier 1 on this site means "no WebGL at all" (effects/registry.js budgets
   * it at 0 ms GPU), so `mode === 'off'` here was deleting the background
   * field, the hero gem and the desk scene outright. That is why the console
   * had to label the mode carefully: it said "Off" while removing CONTENT,
   * when what the visitor asked for was no MOVEMENT.
   *
   * Under P5's rule — degrade by resolution, never by deletion — `off` now
   * means FREEZE. `BackgroundEngine` already stops its shader clock for
   * `reduced` (see below); extending that to `off` gives a still, complete
   * page instead of an empty one, which is what "Minimal" promises.
   *
   * The genuinely weak-machine signals (2 cores, 2 GB, Save-Data) still force
   * tier 1, because those are statements about the hardware rather than about
   * the visitor's preference.
   */
  if (mode === 'off') start = Math.min(start, 2)
  if (cores <= 2 || mem <= 2 || saveData) start = 1

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
    /*
     * 600 frames of warm-up, not 120.
     *
     * MEASURED: the tier oscillated 3 -> 2 -> 3 -> 2 -> 3 -> 1 across a single
     * 42-second session, and every element gated on tier appeared and
     * disappeared with it. 120 frames is ~2 seconds, which on this page is
     * still inside the lazy-chunk wave, the shader compiles and the first
     * scroll — i.e. the governor was judging the machine on the least
     * representative work it will ever do, and then acting on that judgement
     * for the rest of the session.
     *
     * The demotion threshold also moves from 180 to 420 slow frames (~7 s of
     * sustained slowness, not 3), because a demotion is visible and a
     * promotion is not: getting it wrong in the "demote" direction costs the
     * visitor something they can see.
     */
    if (frameSamples > 600) {
      if (avgDt > 24) {
        slowFrames++
        fastFrames = 0
        if (slowFrames >= 420) { applyTier(tier - 1); slowFrames = 0; avgDt = 16.7 }
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
    } catch (err) {
      /* One broken subscriber must not kill the rest — the SILENCE was the
         bug. A subscriber that throws used to fail with zero trace: no
         console output, nothing to search for, just a canvas that stopped
         updating. DEV-only, so production stays exactly as quiet as before. */
      if (import.meta.env.DEV) console.error('[raf] a frame subscriber threw and was skipped this frame:', err)
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
