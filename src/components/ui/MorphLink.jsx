import { useState, useCallback, useRef } from 'react'

const _charsRx = /[\s\S]/gu

export default function MorphLink({ children, className = '', ...props }) {
  const [hovered, setHovered] = useState(false)
  const timer = useRef(null)

  const onEnter = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setHovered(true)
  }, [])

  const onLeave = useCallback(() => {
    timer.current = setTimeout(() => setHovered(false), 300)
  }, [])

  const text = typeof children === 'string' ? children : ''
  const chars = [...text]

  /*
   * P7 — the per-character spans are HIDDEN from assistive technology, and the
   * word is provided once as real text.
   *
   * The effect splits "Work" into four `inline-block` spans so each glyph can
   * animate its own weight and tracking. The accessible-name algorithm inserts
   * a separator between block-level children, so the computed name of every
   * primary nav item was "W o r k" — announced letter by letter, and not
   * matchable by name at all. Found by a Playwright `getByRole('button',
   * { name: /^work$/i })` failing to locate the main navigation, which is a
   * fair proxy for a screen-reader user failing to find it too.
   *
   * The visible glyphs become decoration; one `sr-only` copy carries the word.
   */
  return (
    <span
      className={'inline-block ' + className}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      {...props}
    >
      {text && <span className="sr-only">{text}</span>}
      <span aria-hidden="true">
      {chars.map((ch, i) => {
        const delay = i * 0.035
        return (
          <span
            key={i}
            className="inline-block transition-all duration-base ease-out"
            style={{
              fontWeight: hovered ? 700 : 400,
              fontStretch: hovered ? '120%' : '100%',
              letterSpacing: hovered && ch !== ' ' ? '-0.02em' : '0em',
              color: hovered ? 'var(--accent-bright)' : undefined,
              transitionDelay: hovered ? `${delay}s` : `${(chars.length - 1 - i) * 0.025}s`,
            }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        )
      })}
      </span>
    </span>
  )
}
