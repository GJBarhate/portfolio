import { motion, useScroll, useSpring } from 'framer-motion'
import { supportsScrollDriven } from '../../lib/scrollDriven.js'

export default function ScrollProgress() {
  // `animation-timeline: scroll(root)` is exactly this effect, expressed
  // natively and driven by the compositor.
  if (supportsScrollDriven) {
    return <div aria-hidden="true" className="scroll-progress scroll-progress--css" />
  }
  return <ScrollProgressJS />
}

function ScrollProgressJS() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 280, damping: 40, mass: 0.2 })

  return (
    <motion.div
      aria-hidden="true"
      className="scroll-progress"
      style={{ scaleX }}
    />
  )
}
