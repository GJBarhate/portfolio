import { useState, useEffect, useRef } from 'react'
import { motionOff } from '../../lib/motion.js'

/**
 * A three-word swap does not need a spring engine. `AnimatePresence` here was
 * one of the reasons framer-motion sat on the hero's critical path; the same
 * enter/exit is a two-keyframe CSS animation restarted on each change.
 */
export default function WordRotator({ words, interval = 3000, className = '' }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const spanRef = useRef(null)

  useEffect(() => {
    if (paused) return
    // T-025 — the CSS animation stops at --motion-scale: 0, but the interval
    // that swaps the WORD does not, and text changing under the reader every
    // three seconds is the most disruptive motion on the page for exactly the
    // people who asked for less of it. It also made the hero unscreenshottable.
    if (motionOff()) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length)
    }, interval)
    return () => clearInterval(timer)
  }, [words.length, interval, paused])

  // Re-trigger the entrance without remounting — this is what AnimatePresence's
  // key swap amounted to.
  useEffect(() => {
    const el = spanRef.current
    if (!el) return
    el.style.animation = 'none'
    // Reading a layout property is the documented way to force the restart.
    void el.offsetWidth
    el.style.animation = ''
  }, [index])

  return (
    <span
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span ref={spanRef} className="word-rotator__word">
        {words[index]}
      </span>
    </span>
  )
}
