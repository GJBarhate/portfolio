/**
 * breakpoints.js — T-010. The JS half of the one breakpoint source.
 *
 * These are the same numbers as `src/styles/breakpoints.css` and the same
 * numbers Tailwind compiles `sm:`/`md:`/`lg:` to. Expressed in rem, resolved
 * against the *root* font size rather than 16 hardcoded, so a visitor who has
 * raised their default text size gets the same layout decision in JS that
 * they get in CSS.
 */

/** rem values — the canonical form. */
export const BREAKPOINTS = {
  xs: 20,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
}

/** Ordered small → large, for range construction. */
export const ORDER = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']

/** Below this height, compose for the short axis (landscape phones). */
export const SHORT_HEIGHT_REM = 30

/**
 * The media query for a named range. Always a *range*, never a bare min/max,
 * for the reason documented in breakpoints.css: complements with no gap.
 *
 *   query('md')            → '(width >= 48rem)'
 *   query('md', 'lg')      → '(48rem <= width < 64rem)'
 *   query(null, 'md')      → '(width < 48rem)'
 */
export function query(from, to = null) {
  const lo = from ? `${BREAKPOINTS[from]}rem` : null
  const hi = to ? `${BREAKPOINTS[to]}rem` : null
  if (lo && hi) return `(${lo} <= width < ${hi})`
  if (lo) return `(width >= ${lo})`
  if (hi) return `(width < ${hi})`
  return 'all'
}

/** px for a named breakpoint, at the document's actual root font size. */
export function px(name) {
  const rootSize = typeof document !== 'undefined'
    ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    : 16
  return BREAKPOINTS[name] * rootSize
}

/**
 * The current viewport bucket: the largest breakpoint the window is at or
 * past. `xs` is the floor, so it is always the answer for anything narrower.
 */
export function currentViewport() {
  if (typeof window === 'undefined') return 'lg'
  for (let i = ORDER.length - 1; i >= 0; i--) {
    if (window.matchMedia(`(width >= ${BREAKPOINTS[ORDER[i]]}rem)`).matches) return ORDER[i]
  }
  return 'xs'
}
