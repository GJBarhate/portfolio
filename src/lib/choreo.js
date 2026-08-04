/**
 * Choreography tokens (§P4.4).
 *
 * Named stagger/timing relationships so new sequenced-reveal work has a
 * shared vocabulary instead of each component inventing its own delay math.
 * Values mirror the frozen motion tokens in index.css (--ease-forge,
 * --ease-spring, --dur-*) rather than introducing a second source of truth.
 *
 * Existing components already route through those CSS custom properties
 * directly (see `.reveal`, `--reveal-shift` in Reveal.jsx) — this module is
 * for new sequenced groups (card grids, stat rows) that want a named
 * relationship rather than a hand-picked delay per item.
 */

/** Stagger tokens, in ms — everything that reveals in sequence uses these. */
export const STAGGER = { tight: 40, base: 70, loose: 120, dramatic: 180 }

/** Named entrance choreographies, referenced via a `--i` index on the item. */
export const CHOREO = {
  heroLine: { delay: 0, stagger: STAGGER.dramatic, ease: 'var(--ease-forge)' },
  sectionHead: { delay: 0, stagger: STAGGER.base, ease: 'var(--ease-forge)' },
  cardGrid: { delay: 80, stagger: STAGGER.tight, ease: 'var(--ease-spring)' },
  statRow: { delay: 120, stagger: STAGGER.base, ease: 'var(--ease-spring)' },
}

/** Inline style for the Nth item of a `data-choreo` group: sets --i and the resolved delay. */
export function choreoItemStyle(name, index) {
  const c = CHOREO[name]
  if (!c) return {}
  return {
    '--i': index,
    '--choreo-delay': `${c.delay + index * c.stagger}ms`,
  }
}
