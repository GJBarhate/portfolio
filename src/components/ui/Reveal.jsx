import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]

export default function Reveal({
  children,
  delay = 0,
  y = 32,
  duration = 0.9,
  className = '',
  as = 'div',
  once = true,
}) {
  const Tag = motion[as] || motion.div
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-10% 0px -10% 0px' }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}
