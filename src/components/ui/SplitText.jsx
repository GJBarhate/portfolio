import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

/**
 * Word-level reveal behind clip-path masks (§4 headline rule).
 *
 * Two changes from the character-level Framer version: it splits on WORDS, not
 * characters — a 60-character headline was 60 motion components and 60 DOM
 * nodes for an effect nobody reads letter by letter — and the animation is
 * CSS, triggered once by an IntersectionObserver at 30% in-view. Stagger is
 * `animation-delay`, so the whole reveal is compositor work.
 *
 * Reduced motion gets the text, instantly, with no wrapper spans at all.
 */
export default function SplitText({
  children,
  className = '',
  as: Tag = 'span',
  stagger = 45,
  delay = 0,
  once = true,
}) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          if (once) io.disconnect()
        } else if (!once) {
          setShown(false)
        }
      },
      { threshold: 0.3 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced, once])

  if (reduced || typeof children !== 'string') {
    return <Tag className={className}>{children}</Tag>
  }

  // Spaces stay as their own tokens so wrapping and word-spacing behave
  // exactly as they would in plain text.
  const tokens = children.split(/(\s+)/)
  let wordIndex = 0

  return (
    <Tag
      ref={ref}
      className={`split-text ${className}`.trim()}
      data-split={shown ? 'in' : 'out'}
      style={{ '--split-stagger': `${stagger}ms`, '--split-delay': `${delay}s` }}
    >
      {tokens.map((token, i) => {
        if (!token.trim()) return <span key={i}>{token}</span>
        const idx = wordIndex++
        return (
          <span key={i} className="split-word" style={{ '--i': idx }}>
            <span className="split-word__inner">{token}</span>
          </span>
        )
      })}
    </Tag>
  )
}
