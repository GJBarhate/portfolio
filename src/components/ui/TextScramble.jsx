import { useState, useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'

export default function TextScramble({ children, className = '', tag: Tag = 'span' }) {
  const text = typeof children === 'string' ? children : ''
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })
  const [display, setDisplay] = useState(text)
  const hasRun = useRef(false)

  useEffect(() => {
    if (!inView || hasRun.current || !text) return
    hasRun.current = true
    let frame = 0
    const totalFrames = text.length + 10
    const interval = setInterval(() => {
      frame++
      setDisplay(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' '
            if (frame > i + 5) return char
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          })
          .join('')
      )
      if (frame >= totalFrames) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [inView, text])

  return (
    <Tag ref={ref} className={className}>
      {display}
    </Tag>
  )
}
