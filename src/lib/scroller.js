/**
 * The site's one scroller — D-30.
 *
 * Every navigation entry point (navbar, drawer, command palette, terminal,
 * project chips, "back to top") used to roll its own `scrollIntoView` or
 * `window.scrollTo`, and they disagreed in two ways that a visitor can see:
 * some cleared the fixed header and some did not, and some were smooth while
 * others jumped. Both are decided once, here.
 *
 * This is deliberately plain DOM with no React and no dependency: the wheel is
 * the browser's (see SmoothScrollContext for why the hijack was removed), and
 * this module only exists for *programmatic* jumps.
 */

/**
 * Height of the fixed header plus a breathing gap.
 *
 * `--header-h` is measured and published by Navbar's ResizeObserver, so this
 * follows the header across breakpoints rather than assuming the 80px desktop
 * value on a phone where the real height is different.
 */
export function headerOffset() {
  if (typeof document === 'undefined') return 92
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h')
  const h = parseFloat(raw)
  return (Number.isFinite(h) ? h : 80) + 12
}

export function prefersReduced() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** How far off target is worth a second attempt, in px. */
const CORRECTION_EPSILON = 8
/** Bounded, so a section that never stops resizing cannot loop forever. */
const MAX_CORRECTIONS = 3

/** Cancels the in-flight correction for the previous navigation, if any. */
let cancelCorrection = null

/**
 * Wait for the smooth scroll to settle, then check whether the target is
 * actually where it was aimed — D-42.
 *
 * Every section below the fold is a lazy chunk behind a skeleton, and the
 * skeletons only approximate their real heights. So a click on "Contact" from
 * the top of the page starts a ~1 s animated scroll, and *during* that
 * animation two or three sections between here and there swap a skeleton for
 * real content and change height. The target computed at click time is stale
 * before the scroll arrives: measured landing 277px past Contact's heading,
 * which from the visitor's side is a nav link that goes to the wrong place.
 *
 * No arithmetic fixes this, because the height that will be wrong is not
 * known yet. Measuring again once the page has stopped moving does.
 */
function correctAfterSettle(el, offset) {
  cancelCorrection?.()

  let attempts = 0
  let timer = null
  let done = false

  const finish = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    window.removeEventListener('scrollend', onSettle)
    if (cancelCorrection === finish) cancelCorrection = null
  }
  cancelCorrection = finish

  function onSettle() {
    if (done) return
    if (!el.isConnected) return finish()

    const desired = el.getBoundingClientRect().top + window.scrollY - headerOffset() + offset
    const drift = Math.abs(window.scrollY - Math.max(0, desired))
    if (drift <= CORRECTION_EPSILON || ++attempts > MAX_CORRECTIONS) return finish()

    window.scrollTo({
      top: Math.max(0, desired),
      // A small correction snaps; a large one is still a journey and animating
      // it reads as the page finishing its move rather than teleporting.
      behavior: drift < 40 || prefersReduced() ? 'auto' : 'smooth',
    })
    schedule()
  }

  function schedule() {
    clearTimeout(timer)
    // `scrollend` is the precise signal and is not everywhere yet; the timeout
    // is both the fallback and the backstop for a scroll that never fires one
    // because it had nowhere left to go.
    timer = setTimeout(onSettle, 700)
  }

  window.addEventListener('scrollend', onSettle)
  schedule()
}

/**
 * Scroll an element, element id, or absolute y position into view below the
 * header.
 *
 * @param {Element|number|string} target
 * @param {{ offset?: number, behavior?: ScrollBehavior, correct?: boolean }} [opts]
 * @returns {boolean} whether a target was found and a scroll was issued
 */
export function scrollTo(target, { offset = 0, behavior, correct = true } = {}) {
  if (typeof window === 'undefined') return false

  cancelCorrection?.()

  let top
  let el = null
  if (typeof target === 'number') {
    top = target + offset
  } else {
    el = typeof target === 'string' ? document.getElementById(target) : target
    if (!el || typeof el.getBoundingClientRect !== 'function') return false
    top = el.getBoundingClientRect().top + window.scrollY - headerOffset() + offset
  }

  const mode = behavior || (prefersReduced() ? 'auto' : 'smooth')
  window.scrollTo({ top: Math.max(0, top), behavior: mode })
  if (el && correct) correctAfterSettle(el, offset)
  return true
}

export function scrollToTop() {
  if (typeof window === 'undefined') return
  cancelCorrection?.()
  window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' })
}
