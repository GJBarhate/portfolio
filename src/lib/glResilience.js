/**
 * glResilience.js — T-045.1.
 *
 * WebGL context loss is not an edge case on mobile. Backgrounding the browser,
 * another tab claiming the GPU, a driver reset, or simply too many live
 * contexts will all take the context away, and the browser is entitled to do
 * it at any moment. There was no `webglcontextlost` handler anywhere in this
 * codebase, which means the documented behaviour was: **the canvas goes black
 * and stays black for the rest of the session.**
 *
 * Two rules make the difference:
 *
 *  1. `preventDefault()` on `webglcontextlost`. Without it the browser will
 *     not send `webglcontextrestored` at all, so the "recovery" path can
 *     never run — this one line is the whole difference between recoverable
 *     and permanent.
 *  2. Give up after two attempts. A context that is lost twice in a session
 *     is a device telling you something; the third rebuild is how a page ends
 *     up in a loss/restore loop that drains the battery faster than the
 *     effect ever cost. After that the CSS fallback layer takes over, which
 *     is a tier-1 experience rather than a broken one.
 */

const MAX_RESTORES = 2

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onLost?: () => void, onRestored?: () => void, onGiveUp?: () => void, label?: string }} handlers
 * @returns {() => void} detach
 */
export function guardContext(canvas, { onLost, onRestored, onGiveUp, label = 'canvas' } = {}) {
  if (!canvas) return () => {}
  let restores = 0

  const lost = (event) => {
    // Rule 1. Nothing else in this file works without it.
    event.preventDefault()
    try { onLost?.() } catch { /* teardown must not throw on the way down */ }
    if (restores >= MAX_RESTORES) {
      report(label, 'gave up after repeated context loss')
      try { onGiveUp?.() } catch { /* ignore */ }
    }
  }

  const restored = () => {
    if (restores >= MAX_RESTORES) return
    restores += 1
    report(label, `context restored (${restores}/${MAX_RESTORES})`)
    try { onRestored?.() } catch {
      try { onGiveUp?.() } catch { /* ignore */ }
    }
  }

  canvas.addEventListener('webglcontextlost', lost, false)
  canvas.addEventListener('webglcontextrestored', restored, false)

  return () => {
    canvas.removeEventListener('webglcontextlost', lost)
    canvas.removeEventListener('webglcontextrestored', restored)
  }
}

/** Context loss is worth knowing about in the field; it is not worth a console error. */
function report(label, message) {
  import('./rum.js')
    .then((rum) => rum.recordEvent('webgl', { label, message }))
    .catch(() => {})
}

/**
 * Mark the page as having fallen back, so CSS can present the tier-1 layer
 * without every component needing to know why.
 */
export function markGlUnavailable() {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.glFallback = 'true'
  }
}
