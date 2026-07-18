import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export default function ScrollInkFill({ children, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  if (typeof children !== 'string') {
    return <span className={className}>{children}</span>
  }

  const words = children.split(' ')

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}
          initial={{ clipPath: 'inset(0 100% 0 0)' }}
          animate={isInView ? { clipPath: 'inset(0 0 0 0)' } : { clipPath: 'inset(0 100% 0 0)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
        >
          {word}{i < words.length - 1 ? '\u00A0' : ''}
        </motion.span>
      ))}
    </span>
  )
}
