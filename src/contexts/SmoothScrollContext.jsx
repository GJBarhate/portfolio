import { createContext, useContext, useMemo } from 'react'
import { scrollTo, scrollToTop } from '../lib/scroller.js'
import { useReducedMotion } from '../lib/useReducedMotion.js'

export { scrollTo, scrollToTop } from '../lib/scroller.js'

const SmoothScrollContext = createContext(null)

/**
 * Scrolling — D-30, the reported bug.
 *
 * This used to hijack the wheel with Lenis. The failure that produced the
 * report is structural rather than a mistuned option, so it is worth writing
 * down: Lenis calls `event.preventDefault()` on every wheel event and then
 * moves the page itself from a `requestAnimationFrame` callback
 * (`onVirtualScroll` → `scrollTo` → `raf` → `window.scrollTo`). The moment
 * that callback stops arriving on time — the shared ticker throttling an
 * over-budget subscriber, the ambient band starving under GPU load, a tab
 * that lost focus mid-gesture — the wheel is still being swallowed but
 * nothing moves. The page is then scrollable ONLY by dragging the scrollbar,
 * which does not go through the wheel path at all. That is exactly the
 * symptom: "two-finger scroll does nothing, I have to grab the bar".
 *
 * There is no tuning that fixes this, because the risk is the hijack itself:
 * it makes scrolling — the one interaction a page may never get wrong —
 * dependent on the health of a main-thread animation loop that this site,
 * with five canvases, cannot guarantee.
 *
 * So scrolling is the browser's again. On every engine this site targets the
 * wheel is already smoothed on the compositor, off the main thread, and it
 * cannot be starved by anything React does. The page also stops paying for a
 * `window.scrollTo` per frame, which is what was forcing every scroll to be a
 * main-thread scroll on a page that has a lot of other work to do — the
 * "takes too much load" half of the same report.
 *
 * What is kept is the part that was actually doing design work: the
 * scroll-linked hue grade, now written from the one scroll read per frame
 * that `scrollState.js` already performs for the navbar ring and the progress
 * bar. Nothing subscribes a second reader, and nothing preventDefaults.
 *
 * The provider stays because `useSmoothScroll()` is the site's scroll API —
 * `scrollTo` is what the navbar and the palette call, and it is header-aware
 * (see `--header-h`), which the raw `scrollIntoView` calls it replaced were
 * not.
 */
export function SmoothScrollProvider({ children }) {
  const reduced = useReducedMotion()

  /*
   * P5.7 — the per-frame root custom-property write is GONE, and it turned out
   * to be worse than the plan assumed.
   *
   * The write was `--grade-hue` on `documentElement`, every 6th scroll frame.
   * Writing ANY custom property on the root invalidates the whole cascade
   * beneath it, and beneath it is a 7,000-line stylesheet — so this was a
   * full style recalculation roughly ten times a second, for the entire
   * duration of every scroll.
   *
   * The plan proposed moving it to a shader uniform. It did not need moving,
   * because de-duplicating `.grade-wash` (D-8.1) revealed that the surviving
   * declaration interpolates `--grade-base-hue`, a static per-theme token —
   * **nothing in any stylesheet reads `--grade-hue` at all.** The two
   * definitions of `.grade-wash` had been written months apart, and the one
   * that won was the one that had stopped using this variable.
   *
   * So the site was paying for a full cascade invalidation, on the hottest
   * path there is, to update a value with no consumer. Deleted outright.
   */

  const value = useMemo(() => ({ reduced, scrollTo, scrollToTop }), [reduced])

  return (
    <SmoothScrollContext.Provider value={value}>
      {children}
    </SmoothScrollContext.Provider>
  )
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}
