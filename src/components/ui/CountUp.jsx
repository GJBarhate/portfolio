import { useCallback, useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { onFrame } from '../../lib/raf.js'

export default function CountUp({ value, duration = 1.6, suffix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' })
  const [display, setDisplay] = useState(0)
  const [key, setKey] = useState(0)

  const animate = useCallback(() => {
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

  return (
    <span
      ref={ref}
      className="tabular cursor-pointer"
      onClick={reroll}
      title="Click to re-roll"
    >
      {display}
      {suffix}
    </span>
  )
}
