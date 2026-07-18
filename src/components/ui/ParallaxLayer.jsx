import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

export default function ParallaxLayer({
  speed = 0.2,
  className = '',
  children,
  offset = 0,
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  const moveRange = speed * 200
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [moveRange * 0.5 + offset, -moveRange * 0.5 + offset]
  )

  if (reduced) {
    return <div className={className}>{children}</div>
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
