/**
 * View Transitions helpers.
 *
 * Every call degrades to running the update directly when the API is missing
 * or the visitor has asked for reduced motion, so callers never have to
 * branch themselves.
 */
import { scrollTo } from './scroller.js'

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

/**
 * Smoothly navigate to a section.
 *
 * A scroll is not a DOM mutation, so a view transition would capture two
 * identical frames. Smooth scrolling is the right primitive here; the
 * cross-fade mode exists for palette actions that also change the DOM.
 *
 * D-30 — this used to call `scrollIntoView({ block: 'start' })` directly,
 * which lands the section's top edge at the viewport's top edge, i.e. behind
 * the fixed header. It now goes through the site's one header-aware scroller.
 */
export function navigateToSection(id) {
  scrollTo(id)
}
