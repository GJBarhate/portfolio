import { motion } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

const charVariants = {
  hidden: { opacity: 0, y: 20, rotateX: -40 },
  visible: { opacity: 1, y: 0, rotateX: 0 },
}

const EASE = [0.16, 1, 0.3, 1]

export default function SplitText({
  children,
  className = '',
  as = 'span',
  stagger = 0.02,
  delay = 0,
  once = true,
}) {
  const reduced = useReducedMotion()

  if (reduced || typeof children !== 'string') {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }

  const chars = [...children].map((c) => (c === ' ' ? ' ' : c))

  return (
    <motion.span
      className={className}
      style={{ display: 'inline-block', perspective: '600px' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-10% 0px -10% 0px' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {chars.map((char, i) => (
        <motion.span
          key={i}
          variants={charVariants}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  )
}
