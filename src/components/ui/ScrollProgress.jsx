import { useEffect, useRef } from 'react'
import { onFrame } from '../../lib/raf.js'
import { supportsScrollDriven } from '../../lib/scrollDriven.js'

export default function ScrollProgress() {
  // `animation-timeline: scroll(root)` is exactly this effect, expressed
  // natively and driven by the compositor.
  if (supportsScrollDriven) {
    return <div aria-hidden="true" className="scroll-progress scroll-progress--css" />
  }
  return <ScrollProgressJS />
}

/**
 * Fallback for browsers without scroll-driven animations.
 *
 * This used to be a `useSpring` over framer-motion's `useScroll`, which put
 * the whole 42 KB motion chunk on the critical path in order to move one bar.
 * The same damping in four lines on the shared ticker (Research #19, k = 12)
 * costs nothing extra — that loop is already running.
 */
function ScrollProgressJS() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let value = 0
    return onFrame((_t, dt) => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      value += (target - value) * (1 - Math.exp(-(dt / 1000) * 12))
      el.style.transform = `scaleX(${value.toFixed(4)})`
    })
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="scroll-progress"
      style={{ transformOrigin: '0 50%' }}
    />
  )
}
