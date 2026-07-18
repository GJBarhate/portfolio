import { useEffect, useRef } from 'react'

export function useScrollVelocity(callback, { throttleMs = 50 } = {}) {
  const lastRef = useRef({ y: 0, time: 0, velocity: 0 })
  const rafRef = useRef(null)
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    let running = true
    const tick = () => {
      if (!running) return
      const now = performance.now()
      const y = window.scrollY
      const dt = now - lastRef.current.time
      if (dt >= throttleMs) {
        const dy = y - lastRef.current.y
        lastRef.current.velocity = dy / dt
        lastRef.current.y = y
        lastRef.current.time = now
        cbRef.current(lastRef.current.velocity)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [throttleMs])
}
