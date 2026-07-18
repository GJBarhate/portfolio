import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from '../lib/useReducedMotion.js'

const SmoothScrollContext = createContext(null)

export function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    let rafId
    let cancelled = false

    ;(async () => {
      try {
        const Lenis = (await import('lenis')).default
        if (cancelled) return
        const lenis = new Lenis({
          duration: 1.05,
          easing: (t) => 1 - Math.pow(1 - t, 4),
          smoothWheel: true,
          wheelMultiplier: 1,
          touchMultiplier: 1.4,
        })
        lenisRef.current = lenis

        let tick = 0
        lenis.on('scroll', ({ scroll, limit }) => {
          if (++tick % 6 !== 0) return
          const p = limit > 0 ? scroll / limit : 0
          document.documentElement.style.setProperty('--grade-hue', `${(p * 40).toFixed(1)}deg`)
        })

        const raf = (time) => {
          if (cancelled) return
          lenis.raf(time)
          rafId = requestAnimationFrame(raf)
        }
        rafId = requestAnimationFrame(raf)
      } catch {
        // Lenis failed to load — native scroll works fine
      }
    })()

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      if (lenisRef.current) {
        lenisRef.current.destroy()
        lenisRef.current = null
      }
    }
  }, [reduced])

  const value = useMemo(() => ({ lenis: lenisRef, reduced }), [reduced])

  return (
    <SmoothScrollContext.Provider value={value}>
      {children}
    </SmoothScrollContext.Provider>
  )
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}
