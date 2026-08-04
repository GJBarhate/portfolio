/**
 * scrollVelocity.js — one number the whole site moves by.
 *
 * A page with ten independently animated things reads as ten widgets on a
 * page. A page where every moving thing responds to the *same* signal reads as
 * one machine. That signal is scroll velocity: how fast the visitor is
 * travelling, damped, signed, normalised.
 *
 * It is deliberately NOT written to a CSS custom property on :root. Setting a
 * variable on the document element invalidates style for every element that
 * inherits it — every frame, for the whole document — and the cost of that
 * lands on exactly the frames where the visitor is already moving fast. It is
 * a JS read instead, and the consumers are the WebGL scenes, which need it as
 * a uniform anyway.
 *
 * Cost when nobody is scrolling: zero. The ticker subscription drops itself
 * once the value has settled back to rest and re-arms on the next scroll.
 */
import { onFrame } from './raf.js'

/** Pixels per second that counts as "flat out". Beyond this the value clamps. */
const FULL_SPEED = 2600

let velocity = 0
let target = 0
let lastY = 0
let lastT = 0
let stop = null
let armed = false

function tick(_t, dt) {
  // Framerate-independent damping — the same lerp shape used by the tilt rig.
  const k = 1 - Math.exp(-(dt / 1000) * 7)
  velocity += (target - velocity) * k
  // The raw target decays on its own: a scroll event is an impulse, not a
  // state. Without this a visitor who stops mid-flick leaves the site running
  // at speed forever.
  target *= Math.exp(-(dt / 1000) * 5)
  if (Math.abs(velocity) < 0.001 && Math.abs(target) < 0.001) {
    velocity = 0
    target = 0
    stop?.()
    stop = null
  }
}

function onScroll() {
  const now = performance.now()
  const y = window.scrollY
  const elapsed = Math.max(8, now - lastT)
  lastT = now
  const dy = y - lastY
  lastY = y
  const pxPerSec = (dy / elapsed) * 1000
  target = Math.max(-1, Math.min(1, pxPerSec / FULL_SPEED))
  if (!stop) stop = onFrame(tick, { band: 'input' })
}

/** Start listening. Idempotent; safe to call from every consumer's mount. */
export function armScrollVelocity() {
  if (armed || typeof window === 'undefined') return
  armed = true
  lastY = window.scrollY
  lastT = performance.now()
  window.addEventListener('scroll', onScroll, { passive: true })
}

/**
 * Signed, damped, clamped to [-1, 1]. Positive is scrolling down.
 * @returns {number}
 */
export function getScrollVelocity() {
  return velocity
}
