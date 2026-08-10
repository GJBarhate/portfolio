/**
 * One scroll lock for every overlay — D-40.
 *
 * Three components locked the page independently and each of them got it
 * slightly wrong in a different way:
 *
 *   Drawer          root-level `overflow: hidden`, with an iOS body-fixed
 *                   fallback and a scroll restore. Correct, and the model for
 *                   this module.
 *   ProjectLightbox `document.body.style.overflow = 'hidden'`. Body overflow
 *                   only propagates to the viewport while the ROOT's overflow
 *                   is `visible`, and this site's root has never been visible
 *                   (`overflow-x: clip`). The lightbox therefore did not lock
 *                   anything: the page scrolled behind an open case study.
 *   ArcadeHub       no lock at all — a swipe aimed at Snake scrolled the page
 *                   underneath the cabinet.
 *
 * Independent locks also cannot nest. Two overlays open at once (a case study
 * launched from the deck, then the palette) meant the first to close restored
 * `overflow` to whatever it had captured, unlocking the page while the second
 * was still up. So this is a counter, not a boolean: the page unlocks when the
 * last holder releases it, and never before.
 */

let depth = 0
let saved = null
let savedScrollY = 0

/**
 * iOS Safari is the only engine that ignores root-level `overflow: hidden` for
 * touch scrolling, and the technique it does honour — `position: fixed` on the
 * body — collapses the document and loses the scroll offset, so it has to be
 * saved and put back by hand. Nobody else pays for that.
 */
function needsBodyLock() {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform || ''
  return /iP(ad|hone|od)/.test(platform) ||
    (navigator.maxTouchPoints > 1 && /Mac/.test(platform))
}

/**
 * Lock page scrolling. Returns the matching release function; calling it more
 * than once is a no-op, so it is safe to hand straight to a React cleanup.
 */
export function lockScroll() {
  if (typeof document === 'undefined') return () => {}

  if (depth === 0) {
    const root = document.documentElement
    savedScrollY = window.scrollY
    saved = {
      overflow: root.style.overflow,
      overscroll: root.style.overscrollBehavior,
      paddingRight: root.style.paddingRight,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
      body: needsBodyLock(),
    }

    /*
     * Removing the scrollbar shifts every centred element by its width, which
     * reads as the whole page twitching sideways the instant a modal opens.
     * Padding the root by the width it is about to lose keeps the layout
     * still. On overlay scrollbars (every phone, and macOS by default) the
     * measured width is 0 and this does nothing.
     */
    const barWidth = window.innerWidth - root.clientWidth
    if (barWidth > 0) root.style.paddingRight = `${barWidth}px`

    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'contain'
    if (saved.body) {
      document.body.style.position = 'fixed'
      document.body.style.top = `-${savedScrollY}px`
      document.body.style.width = '100%'
    }
  }

  depth += 1

  let released = false
  return () => {
    if (released) return
    released = true
    depth = Math.max(0, depth - 1)
    if (depth > 0 || !saved) return

    const root = document.documentElement
    root.style.overflow = saved.overflow
    root.style.overscrollBehavior = saved.overscroll
    root.style.paddingRight = saved.paddingRight
    if (saved.body) {
      document.body.style.position = saved.bodyPosition
      document.body.style.top = saved.bodyTop
      document.body.style.width = saved.bodyWidth
    }
    saved = null

    /*
     * Restored unconditionally, and twice.
     *
     * `overflow: hidden` on the root stops it being a scrollport, and a
     * browser is free to clamp the offset while that is true — measured
     * losing 197px on a 844x390 landscape viewport with no body-fixed lock in
     * play at all. The first call lands correctly only if layout has already
     * been recomputed; the second costs a macrotask and makes it exact.
     */
    const y = savedScrollY
    window.scrollTo({ top: y, behavior: 'instant' })
    setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 0)
  }
}

/** Test seam: the number of holders currently keeping the page locked. */
export const lockDepth = () => depth
