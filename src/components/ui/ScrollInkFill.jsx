import { Fragment, useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { motionScalars } from '../../lib/motion.js'

/**
 * Prose that wipes in word by word as it enters the viewport.
 *
 * Three things about this component were wrong and are worth naming, because
 * each one looked like a styling problem and was not:
 *
 * 1. It rendered a `<span>`. Two of these stacked in About with `mt-4` on the
 *    second therefore ran together as one unbroken block of text — margin does
 *    nothing on a non-replaced inline box. A paragraph of prose is a `<p>`.
 * 2. `delay: i * 0.05` is a per-word constant, so the stagger grew with the
 *    text. The 55-word manifesto took 2.75s to finish arriving, and the tail
 *    of it was still clipped while the reader was already there. The stagger
 *    is now a *budget* spread across however many words there are.
 * 3. It ignored the motion scalar entirely. At Motion: off the paragraph was
 *    still clipped to nothing until framer-motion decided it was in view —
 *    the one setting whose whole point is that content does not wait.
 *
 * `overflow: hidden` also went: `clip-path` already clips, and an inline-block
 * with `overflow: hidden` establishes its own baseline, which is what was
 * shaving the descenders off every word.
 *
 * And once the wipe is over the whole scaffold is torn down — the paragraph
 * collapses back to a single text node. That is not tidiness: a `clip-path`
 * resting at `inset(0)` keeps clipping, so descenders that overflow the
 * inline-block's line box stay shaved forever, and fifty-odd promoted word
 * layers stay resident on a page that has no further use for them.
 */

/** However long the text, every word has arrived within this many seconds. */
const STAGGER_BUDGET = 0.9

/** How long a single word takes to wipe in. */
const WIPE = 0.6

export default function ScrollInkFill({ children, className = '', as: Tag = 'p' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [settled, setSettled] = useState(false)

  // Read once per render rather than per word — it is a matchMedia call.
  const { scale } = motionScalars()
  const plain = typeof children !== 'string' || scale === 0 || settled

  const words = typeof children === 'string' ? children.split(' ') : []
  const step = words.length > 1 ? (STAGGER_BUDGET * scale) / (words.length - 1) : 0
  const total = (STAGGER_BUDGET * scale + WIPE * scale) * 1000 + 120

  useEffect(() => {
    if (plain || !isInView) return undefined
    const id = setTimeout(() => setSettled(true), total)
    return () => clearTimeout(id)
  }, [plain, isInView, total])

  // Motion off, non-string children, or a reveal that has already run: the
  // text is simply text. No spans, no clip, nothing left holding a layer.
  if (plain) {
    return <Tag ref={ref} className={className}>{children}</Tag>
  }

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, i) => (
        // The separator is a real text node BETWEEN the boxes, not a nbsp
        // inside them. Inside, it is a no-break space and the paragraph loses
        // the line-break opportunity it needs; outside, it collapses to one
        // ordinary space and the text wraps where it should.
        <Fragment key={i}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ clipPath: 'inset(0 100% 0 0)' }}
            animate={isInView ? { clipPath: 'inset(0 0 0 0)' } : { clipPath: 'inset(0 100% 0 0)' }}
            transition={{ duration: WIPE * scale, ease: [0.16, 1, 0.3, 1], delay: i * step }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  )
}
