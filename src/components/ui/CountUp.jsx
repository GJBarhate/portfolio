import { useCallback, useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { onFrame } from '../../lib/raf.js'
import { motionOff } from '../../lib/motion.js'

export default function CountUp({ value, duration = 1.6, suffix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' })
  const [display, setDisplay] = useState(0)
  const [key, setKey] = useState(0)

  const animate = useCallback(() => {
    // T-025 — a number counting up is motion. With the scalar at zero the
    // honest rendering is the final value, immediately: not a slower count,
    // and not a zero-duration animation that still schedules a frame.
    if (motionOff()) {
      setDisplay(value)
      return () => {}
    }
    const start = performance.now()
    let stop = null
    stop = onFrame((now) => {
      const t = Math.min(1, (now - start) / (duration * 1000))
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * value))
      if (t >= 1) stop?.()
    })
    return () => stop?.()
  }, [value, duration])

  useEffect(() => {
    if (!inView) return
    return animate()
  }, [inView, animate, key])

  const reroll = () => {
    setDisplay(0)
    setKey((k) => k + 1)
  }

  // T-040.1 — this was a `<span>` with an onClick and a pointer cursor: it
  // looked interactive, was not reachable by keyboard, and announced nothing.
  // A real button costs one element and fixes all three.
  return (
    <button
      type="button"
      ref={ref}
      className="tabular count-up"
      onClick={reroll}
      title="Re-roll this number"
      aria-label={`${display}${suffix} — re-roll`}
    >
      <span aria-hidden="true">{display}{suffix}</span>
    </button>
  )
}
