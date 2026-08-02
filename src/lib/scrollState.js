/**
 * One scroll read per frame, for everybody.
 *
 * The navbar ring, the progress bar and the hero's cinematic exit all want the
 * same two numbers. Reading `scrollY` and `scrollHeight` separately in each of
 * them is three layout reads a frame for one fact — and `scrollHeight` in
 * particular is a full layout flush.
 *
 * §15.5 puts a hard cap on scroll-linked work on the vertical axis; this is
 * how the cap is kept while more than one thing stays scroll-linked.
 */
import { onFrame } from './raf.js'

const state = { y: 0, max: 0, p: 0, vh: 0 }
const subs = new Set()
let stopFrame = null
let dirty = true

// scrollHeight only changes on resize or when content is added, so it is
// re-measured on those events rather than every frame.
if (typeof window !== 'undefined') {
  const invalidate = () => { dirty = true }
  window.addEventListener('resize', invalidate, { passive: true })
  if ('ResizeObserver' in window) {
    new ResizeObserver(invalidate).observe(document.documentElement)
  }
}

function tick(t, dt) {
  if (dirty) {
    state.vh = window.innerHeight
    state.max = document.documentElement.scrollHeight - state.vh
    dirty = false
  }
  state.y = window.scrollY
  state.p = state.max > 0 ? Math.min(1, Math.max(0, state.y / state.max)) : 0
  for (const fn of subs) {
    try { fn(state, dt) } catch { /* one bad subscriber must not stop the rest */ }
  }
}

/**
 * @param {(state: {y:number,max:number,p:number,vh:number}, dt:number) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onScrollFrame(fn) {
  subs.add(fn)
  if (!stopFrame) stopFrame = onFrame(tick)
  return () => {
    subs.delete(fn)
    if (subs.size === 0) { stopFrame?.(); stopFrame = null }
  }
}

/** Current values, without subscribing. */
export function getScrollState() {
  return state
}

/** Call when something changed the document height outside a resize. */
export function invalidateScrollExtent() {
  dirty = true
}
