import { createElement } from 'react'
import { motion } from 'framer-motion'
import { supportsScrollDriven } from '../../lib/scrollDriven.js'

const EASE = [0.16, 1, 0.3, 1]

/**
 * Reveal-on-scroll.
 *
 * Where the browser supports scroll-driven animations this renders a plain
 * element and lets CSS do the work on the compositor — no IntersectionObserver
 * and no Framer Motion subscription. This component is used on nearly every
 * element on the page, so that difference is the bulk of the scroll-linked
 * React work the site used to do.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 32,
  duration = 0.9,
  className = '',
  as = 'div',
  once = true,
  style,
}) {
  if (supportsScrollDriven) {
    return createElement(
      as,
      {
        className: `reveal ${className}`.trim(),
        // A scroll timeline has no notion of `delay`; staggering is done by
        // pushing the start of the animation range instead.
        style: { ...style, '--reveal-shift': `${Math.min(delay, 0.6) * 60}%` },
      },
      children
    )
  }

  const Tag = motion[as] || motion.div
  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-10% 0px -10% 0px' }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </Tag>
  )
}
