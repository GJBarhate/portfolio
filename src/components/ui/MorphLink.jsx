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

  return (
    <span
      className={'inline-block ' + className}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      {...props}
    >
      {chars.map((ch, i) => {
        const delay = i * 0.035
        return (
          <span
            key={i}
            className="inline-block transition-all duration-base ease-out"
            aria-hidden={ch === ' ' ? undefined : undefined}
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
  )
}
