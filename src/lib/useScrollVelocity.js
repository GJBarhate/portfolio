import { useEffect, useRef } from 'react'
import { onFrame } from './raf.js'

/**
 * Reports scroll velocity (px/ms) on a throttled cadence.
 *
 * Rides the shared frame loop rather than opening its own — this used to be one
 * of ~15 independent rAF callbacks, each doing its own layout reads.
 */
export function useScrollVelocity(callback, { throttleMs = 50 } = {}) {
  const lastRef = useRef({ y: 0, time: 0, velocity: 0 })
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    const stop = onFrame((now) => {
      const y = window.scrollY
      const dt = now - lastRef.current.time
      if (dt < throttleMs) return
      const dy = y - lastRef.current.y
      lastRef.current.velocity = dy / dt
      lastRef.current.y = y
      lastRef.current.time = now
      cbRef.current(lastRef.current.velocity)
    })
    return stop
  }, [throttleMs])
}
