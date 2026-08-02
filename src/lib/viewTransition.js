/**
 * View Transitions helpers.
 *
 * Every call degrades to running the update directly when the API is missing
 * or the visitor has asked for reduced motion, so callers never have to
 * branch themselves.
 */
function reduced() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function supported() {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
}

/**
 * Run `apply` inside a view transition, tagging the root with a mode so the
 * stylesheet can pick the right animation.
 * @param {() => void} apply
 * @param {{ mode?: string, origin?: {x:number, y:number} }} [opts]
 */
export function withViewTransition(apply, { mode, origin } = {}) {
  if (!supported() || reduced()) {
    apply()
    return
  }
  const root = document.documentElement
  if (origin) {
    root.style.setProperty('--vt-x', `${origin.x}px`)
    root.style.setProperty('--vt-y', `${origin.y}px`)
  }
  if (mode) root.dataset.vt = mode
  const transition = document.startViewTransition(apply)
  transition.finished.finally(() => {
    if (mode) delete root.dataset.vt
  })
}

/** Smoothly navigate to a section, cross-fading rather than jumping. */
export function navigateToSection(id) {
  const el = document.getElementById(id)
  if (!el) return
  // A scroll is not a DOM mutation, so a view transition would capture two
  // identical frames. Smooth scrolling is the right primitive here; the
  // cross-fade mode exists for palette actions that also change the DOM.
  el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
}
