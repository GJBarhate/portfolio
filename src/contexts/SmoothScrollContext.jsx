import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { onFrame } from '../lib/raf.js'
import { useReducedMotion } from '../lib/useReducedMotion.js'

const SmoothScrollContext = createContext(null)

export function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    // Lenis on touch is the single biggest source of "scrolling feels wrong":
    // mobile browsers already do momentum scrolling natively and far better.
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (isTouch) return

    let cancelled = false
    let stopFrame = null

    ;(async () => {
      try {
        const Lenis = (await import('lenis')).default
        if (cancelled) return
        // §15.1 — config locked. `duration` and `lerp` fight each other; lerp
        // IS the damping constant, and it is the one that does not argue with
        // native inertia. syncTouch stays false: touch scrolls natively.
        const lenis = new Lenis({
          lerp: 0.1,
          smoothWheel: true,
          wheelMultiplier: 1,
          touchMultiplier: 1.5,
          syncTouch: false,
          smoothTouch: false,
          autoResize: true,
        })
        lenisRef.current = lenis

        // The scroll-linked hue grade has exactly one writer. Hero.jsx used to
        // write --grade-hue too, on a different schedule with a different
        // formula, and the two fought each other.
        let tick = 0
        lenis.on('scroll', ({ scroll, limit }) => {
          if (++tick % 6 !== 0) return
          const p = limit > 0 ? scroll / limit : 0
          document.documentElement.style.setProperty('--grade-hue', `${(p * 40).toFixed(1)}deg`)
        })

        // §15.1 — ONE ticker. Lenis used to be driven by Motion's scheduler,
        // which meant importing framer-motion into the critical path purely
        // for a rAF loop the site already owns, and left two schedulers to
        // drift against each other.
        stopFrame = onFrame((t) => lenis.raf(t))
      } catch {
        // Lenis failed to load — native scroll works fine
      }
    })()

    return () => {
      cancelled = true
      stopFrame?.()
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
