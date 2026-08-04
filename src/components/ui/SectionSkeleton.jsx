/**
 * SectionSkeleton — T-029 / D-32.
 *
 * The skeleton this replaces rendered a hardcoded four-card grid for *every*
 * section, so it matched none of them. A skeleton whose shape differs from
 * the content that replaces it does not reduce perceived latency — it
 * guarantees a layout shift at the exact moment the visitor started reading,
 * which is the worst possible time to move the page.
 *
 * Each section now names its own shape and reserves its own height. The
 * heights are the measured real heights at that breakpoint rounded down —
 * *down*, deliberately: a skeleton slightly shorter than the content shifts
 * the page a few pixels up, while one slightly taller shifts it down and
 * pushes what the visitor is reading off the screen.
 */

/**
 * @param {{ variant?: 'prose'|'cards'|'stats'|'lanes'|'timeline'|'form'|'ticker',
 *           minHeight?: string, label?: string }} props
 */
export default function SectionSkeleton({ variant = 'prose', minHeight, label }) {
  const height = minHeight || DEFAULT_HEIGHTS[variant] || '60svh'
  return (
    <div
      className="section-rhythm container-px section-skeleton"
      aria-hidden="true"
      data-variant={variant}
      style={{ minBlockSize: height, containIntrinsicSize: `auto ${height}` }}
    >
      <div className="section-shell l-stack" style={{ '--gap': 'var(--space-m)' }}>
        <div className="skel skel--eyebrow" />
        <div className="skel skel--title" />
        {label && <span className="sr-only">Loading {label}</span>}
        {SHAPES[variant]?.()}
      </div>
    </div>
  )
}

const DEFAULT_HEIGHTS = {
  prose: '52svh',
  cards: '90svh',
  stats: '70svh',
  lanes: '75svh',
  timeline: '85svh',
  form: '80svh',
  ticker: '4rem',
}

const box = (i, className, style) => <div key={i} className={`skel ${className}`} style={style} />

const SHAPES = {
  prose: () => (
    <div className="l-stack" style={{ '--gap': 'var(--space-2xs)' }}>
      {[0, 1, 2].map((i) => box(i, 'skel--line', { inlineSize: ['92%', '86%', '64%'][i] }))}
    </div>
  ),
  cards: () => (
    <div className="l-grid" style={{ '--min': '18rem' }}>
      {[0, 1, 2, 3].map((i) => box(i, 'skel--card'))}
    </div>
  ),
  stats: () => (
    <div className="l-grid" style={{ '--min': '12rem' }}>
      {[0, 1, 2, 3].map((i) => box(i, 'skel--tile'))}
    </div>
  ),
  lanes: () => (
    <div className="l-grid" style={{ '--min': '14rem' }}>
      {[0, 1, 2].map((i) => box(i, 'skel--lane'))}
    </div>
  ),
  timeline: () => (
    <div className="l-stack" style={{ '--gap': 'var(--space-m)' }}>
      {[0, 1, 2, 3, 4].map((i) => box(i, 'skel--row'))}
    </div>
  ),
  form: () => (
    <div className="l-stack" style={{ '--gap': 'var(--space-s)' }}>
      {[0, 1].map((i) => box(i, 'skel--field'))}
      {box(2, 'skel--field', { blockSize: '8rem' })}
      {box(3, 'skel--button')}
    </div>
  ),
  ticker: () => null,
}
