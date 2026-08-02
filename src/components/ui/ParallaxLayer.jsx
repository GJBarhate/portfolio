import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { supportsScrollDriven } from '../../lib/scrollDriven.js'

export default function ParallaxLayer({
  speed = 0.2,
  className = '',
  children,
  offset = 0,
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  const moveRange = speed * 200
  const from = moveRange * 0.5 + offset
  const to = -moveRange * 0.5 + offset

  // Hooks must run unconditionally, so the Motion values are always created;
  // they are simply not attached when the native path is taken.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [from, to])

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  if (supportsScrollDriven) {
    return (
      <div
        className={`parallax-layer--css ${className}`.trim()}
        style={{ '--parallax-from': `${from}px`, '--parallax-to': `${to}px` }}
      >
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y, willChange: 'transform' }}
    >
      {children}
    </motion.div>
  )
}
