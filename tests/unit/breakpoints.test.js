import { describe, it, expect } from 'vitest'
import { BREAKPOINTS, ORDER, query, px } from '../../src/lib/breakpoints.js'

/**
 * breakpoints.test.js — T-010.
 *
 * The defect this guards is D-21: `767px` and `768px` typed as literals in
 * two places, matched only by convention, with a 1px gap that any fractional
 * viewport width falls into. The scale is one object now; these assertions
 * keep it ordered, complete and expressed as ranges.
 */

describe('the scale', () => {
  it('is strictly ascending', () => {
    for (let i = 1; i < ORDER.length; i++) {
      expect(BREAKPOINTS[ORDER[i]], `${ORDER[i]} > ${ORDER[i - 1]}`).toBeGreaterThan(BREAKPOINTS[ORDER[i - 1]])
    }
  })

  it('starts at the device matrix floor', () => {
    // 20rem = 320px: the smallest entry in §3.2, where nothing may overflow.
    expect(BREAKPOINTS.xs).toBe(20)
  })

  it('agrees with the Tailwind variants used across the components', () => {
    // If these ever diverge, "one source of truth" becomes two wearing one
    // name — the CSS and the `sm:`/`lg:` utilities would disagree silently.
    expect(BREAKPOINTS.sm).toBe(40)
    expect(BREAKPOINTS.md).toBe(48)
    expect(BREAKPOINTS.lg).toBe(64)
  })
})

describe('query', () => {
  it('expresses an upward range', () => {
    expect(query('md')).toBe('(width >= 48rem)')
  })

  it('expresses a downward range', () => {
    expect(query(null, 'md')).toBe('(width < 48rem)')
  })

  it('expresses a band with no gap at either end', () => {
    expect(query('md', 'lg')).toBe('(48rem <= width < 64rem)')
  })

  it('produces exact complements — the whole point of range syntax', () => {
    // `>= 48rem` and `< 48rem` partition the line. `min-width: 768px` and
    // `max-width: 767px` do not.
    expect(query('md')).toContain('>=')
    expect(query(null, 'md')).toContain('<')
  })
})

describe('px', () => {
  it('resolves rem against the document root, not a hardcoded 16', () => {
    document.documentElement.style.fontSize = '16px'
    expect(px('md')).toBe(768)
    document.documentElement.style.fontSize = '20px'
    // A visitor who has raised their default text size gets the phone layout
    // in a proportionally larger window — which is what they asked for.
    expect(px('md')).toBe(960)
    document.documentElement.style.fontSize = ''
  })
})
