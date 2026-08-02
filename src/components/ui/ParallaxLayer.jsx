import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { supportsScrollDriven } from '../../lib/scrollDriven.js'
import { onFrame } from '../../lib/raf.js'

export default function ParallaxLayer({
  speed = 0.2,
  className = '',
  children,
  offset = 0,
}) {
  const reduced = useReducedMotion()

  const moveRange = speed * 200
  const from = moveRange * 0.5 + offset
  const to = -moveRange * 0.5 + offset

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
    <ParallaxLayerJS className={className} from={from} to={to}>
      {children}
    </ParallaxLayerJS>
  )
}

/**
 * Fallback path. Previously `useScroll` + `useTransform`, which is why the
 * hero — the very first thing painted — depended on framer-motion. The shared
 * ticker does the same arithmetic, and only while the element is on screen.
 */
function ParallaxLayerJS({ className, from, to, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let stop = null

    const tick = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 when the element's top hits the viewport bottom, 1 when its bottom
      // clears the top — the same range as offset: ['start end', 'end start'].
      const span = rect.height + vh
      const p = span > 0 ? Math.min(1, Math.max(0, (vh - rect.top) / span)) : 0
      el.style.transform = `translate3d(0, ${(from + (to - from) * p).toFixed(2)}px, 0)`
    }

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !stop) {
        el.style.willChange = 'transform'
        stop = onFrame(tick)
      } else if (!e.isIntersecting && stop) {
        stop()
        stop = null
        el.style.willChange = 'auto'
      }
    }, { rootMargin: '10% 0px' })
    io.observe(el)

    return () => { io.disconnect(); stop?.() }
  }, [from, to])

  return <div ref={ref} className={className}>{children}</div>
}
