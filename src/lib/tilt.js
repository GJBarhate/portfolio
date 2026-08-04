/**
 * One tilt signal for the whole page.
 *
 * Every "reacts to where you are" effect on this site was written against the
 * cursor — the aurora blobs, the gem's magnetic lean, the card parallax. On a
 * phone there is no cursor, so all of it resolved to a dead centre value and
 * the page read as a poster. This module answers the same question the cursor
 * answered ("which way is the viewer leaning?") from whichever input the
 * device actually has:
 *
 *   fine pointer  → pointer position, normalised against the viewport centre
 *   touch + gyro  → `deviceorientation`, zeroed to however the phone is held
 *
 * Consumers never learn which one they got. They subscribe to a number pair in
 * −1..1 and the signal means the same thing on both.
 *
 * Two deliberate choices:
 *
 * 1. The custom properties are written onto the elements that asked for them,
 *    never onto `:root`. An inherited custom property on the root element
 *    invalidates style for the whole document on every frame it changes; a
 *    property on the eight elements that read it invalidates eight subtrees.
 *
 * 2. The loop stops when the signal settles. A phone lying flat on a desk and
 *    a pointer that has not moved both cost exactly zero.
 */
import { onFrame } from './raf.js'

/** Damping per second — the same exponential form used across the codebase. */
const K = 6
/** Below this delta the signal is considered settled and the loop parks. */
const EPSILON = 0.0015
/** Degrees of device rotation that map to full deflection. */
const GYRO_RANGE = 26

const target = { x: 0, y: 0 }
const current = { x: 0, y: 0 }

/** JS subscribers — WebGL scenes, mostly. */
const subs = new Set()
/** DOM subscribers: element → depth multiplier. */
const bindings = new Map()

let source = 'none'
let running = false
let stopFrame = null
let detach = null
let gyroBase = null
/** Resolves once we know whether gyro is usable, so callers can show UI. */
let gyroState = 'unknown' // 'unknown' | 'granted' | 'denied' | 'unsupported'
const gyroStateSubs = new Set()

function setGyroState(next) {
  if (gyroState === next) return
  gyroState = next
  for (const fn of gyroStateSubs) {
    try { fn(next) } catch { /* a bad listener must not break the signal */ }
  }
}

export function getTiltSource() { return source }
export function getGyroState() { return gyroState }
export function onGyroState(fn) {
  gyroStateSubs.add(fn)
  return () => gyroStateSubs.delete(fn)
}

/** The smoothed signal, both components in −1..1. */
export function getTilt() { return current }

// ── Input adapters ────────────────────────────────────────────────────────

function attachPointer() {
  const onMove = (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1
    target.y = (e.clientY / window.innerHeight) * 2 - 1
    wake()
  }
  const onLeave = () => { target.x = 0; target.y = 0; wake() }
  window.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave, { passive: true })
  source = 'pointer'
  return () => {
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
  }
}

function attachGyro() {
  const onOrient = (e) => {
    // A device with no gyro still fires the event, with nulls.
    if (e.beta == null || e.gamma == null) return

    // Landscape swaps which axis is which, and flipping the phone 180°
    // inverts both. `screen.orientation.angle` is the only thing that
    // reports this reliably across iOS and Android.
    const angle = (screen.orientation?.angle ?? window.orientation ?? 0) || 0
    let gx = e.gamma
    let gy = e.beta
    if (angle === 90) { const t = gx; gx = gy; gy = -t }
    else if (angle === 180) { gx = -gx; gy = -gy }
    else if (angle === 270 || angle === -90) { const t = gx; gx = -gy; gy = t }

    // Zero to however the phone is being held right now, rather than to
    // "flat on a table" — nobody reads a page with the screen facing the
    // ceiling, and an unzeroed signal pins the effect to one extreme.
    if (!gyroBase) gyroBase = { x: gx, y: gy }

    target.x = Math.max(-1, Math.min(1, (gx - gyroBase.x) / GYRO_RANGE))
    target.y = Math.max(-1, Math.min(1, (gy - gyroBase.y) / GYRO_RANGE))
    setGyroState('granted')
    wake()
  }

  // Re-zero on rotation: the baseline was captured in the old frame of
  // reference and is meaningless in the new one.
  const onOrientationChange = () => { gyroBase = null }

  window.addEventListener('deviceorientation', onOrient, { passive: true })
  screen.orientation?.addEventListener?.('change', onOrientationChange)
  source = 'gyro'

  // If nothing has arrived in a second, there is no usable sensor — HTTPS is
  // required for this event, and desktop touchscreens have no gyro at all.
  const probe = setTimeout(() => {
    if (gyroState === 'unknown') setGyroState('unsupported')
  }, 1000)

  return () => {
    clearTimeout(probe)
    window.removeEventListener('deviceorientation', onOrient)
    screen.orientation?.removeEventListener?.('change', onOrientationChange)
  }
}

/**
 * iOS 13+ requires an explicit grant, and `requestPermission()` throws unless
 * it is called from inside a user gesture. Callers must therefore invoke this
 * from a real tap — never on mount, which is both a rejected promise and a
 * system dialog nobody asked for.
 *
 * @returns {Promise<boolean>} whether motion data is now flowing
 */
export async function requestTiltPermission() {
  const DOE = window.DeviceOrientationEvent
  if (!DOE) { setGyroState('unsupported'); return false }
  if (typeof DOE.requestPermission !== 'function') {
    // Android and everything else: no gate to pass.
    setGyroState(gyroState === 'unknown' ? 'granted' : gyroState)
    return true
  }
  try {
    const res = await DOE.requestPermission()
    const ok = res === 'granted'
    setGyroState(ok ? 'granted' : 'denied')
    if (ok && source !== 'gyro') restart()
    return ok
  } catch {
    setGyroState('denied')
    return false
  }
}

/** True when the device needs an explicit tap before it will report motion. */
export function needsTiltPermission() {
  return (
    typeof window !== 'undefined' &&
    typeof window.DeviceOrientationEvent?.requestPermission === 'function' &&
    gyroState !== 'granted' &&
    gyroState !== 'denied'
  )
}

// ── Loop ──────────────────────────────────────────────────────────────────

function writeBindings() {
  for (const [el, depth] of bindings) {
    el.style.setProperty('--lean-x', (current.x * depth).toFixed(4))
    el.style.setProperty('--lean-y', (current.y * depth).toFixed(4))
  }
}

function tick(_t, dt) {
  const f = 1 - Math.exp(-(dt / 1000) * K)
  current.x += (target.x - current.x) * f
  current.y += (target.y - current.y) * f

  writeBindings()
  for (const fn of subs) {
    try { fn(current) } catch { /* one broken subscriber must not kill the rest */ }
  }

  // Park once the spring has arrived. `wake()` restarts it on the next input.
  if (Math.abs(target.x - current.x) < EPSILON && Math.abs(target.y - current.y) < EPSILON) {
    current.x = target.x
    current.y = target.y
    writeBindings()
    stopFrame?.()
    stopFrame = null
  }
}

function wake() {
  if (stopFrame || !running) return
  stopFrame = onFrame(tick)
}

function start() {
  if (running) return
  if (typeof window === 'undefined') return
  running = true

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced) {
    // Honour the preference by holding the signal at neutral. Consumers stay
    // subscribed and simply never see it move, which is the whole point.
    source = 'none'
    return
  }

  detach = fine ? attachPointer() : attachGyro()
  wake()
}

function stop() {
  if (!running) return
  running = false
  detach?.()
  detach = null
  stopFrame?.()
  stopFrame = null
  source = 'none'
  gyroBase = null
}

function restart() {
  if (!running) return
  detach?.()
  gyroBase = null
  detach = attachGyro()
  wake()
}

/**
 * Subscribe to the smoothed signal.
 * @param {(t: {x: number, y: number}) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onTilt(fn) {
  subs.add(fn)
  start()
  return () => {
    subs.delete(fn)
    if (!subs.size && !bindings.size) stop()
  }
}

/**
 * Write `--lean-x` / `--lean-y` onto an element for as long as it is bound.
 * `depth` scales the signal, so layers can sit at different parallax depths
 * while sharing one source of truth.
 *
 * @param {HTMLElement} el
 * @param {number} [depth]
 * @returns {() => void} unbind
 */
export function bindTilt(el, depth = 1) {
  if (!el) return () => {}
  bindings.set(el, depth)
  el.style.setProperty('--lean-x', '0')
  el.style.setProperty('--lean-y', '0')
  start()
  wake()
  return () => {
    bindings.delete(el)
    el.style.removeProperty('--lean-x')
    el.style.removeProperty('--lean-y')
    if (!subs.size && !bindings.size) stop()
  }
}
