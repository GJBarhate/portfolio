import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*'

export default function TextScramble({ text, className = '', as = 'span', delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (!inView) return

    let frame = 0
    const totalFrames = 28
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        frame++
        const progress = frame / totalFrames
        const resolved = Math.floor(progress * text.length)
        const result = text
          .split('')
          .map((char, i) => {
            if (i < resolved) return char
            if (char === ' ') return ' '
            return CHARS[Math.floor(Math.random() * CHARS.length)]
          })
          .join('')
        setDisplay(result)
        if (frame >= totalFrames) {
          clearInterval(interval)
          setDisplay(text)
        }
      }, 30)
      return () => clearInterval(interval)
    }, delay * 1000)

    return () => clearTimeout(timer)
  }, [inView, text, delay])

  const Tag = as
  return (
    <Tag ref={ref} className={className}>
      {display || ' '}
    </Tag>
  )
}
