import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { frame, cancelFrame } from 'framer-motion'
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
    let update = null

    ;(async () => {
      try {
        const Lenis = (await import('lenis')).default
        if (cancelled) return
        const lenis = new Lenis({
          // `duration` and `lerp` fight each other — Lenis uses one or the
          // other. lerp alone gives a more predictable feel.
          lerp: 0.1,
          smoothWheel: true,
          wheelMultiplier: 1,
          syncTouch: false,
          smoothTouch: false,
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

        // Driving Lenis from Motion's scheduler instead of its own rAF removes
        // the documented 1–2 frame lag caused by the two running on separate
        // loops. `true` keeps the callback subscribed every frame.
        update = ({ timestamp }) => lenis.raf(timestamp)
        frame.update(update, true)
      } catch {
        // Lenis failed to load — native scroll works fine
      }
    })()

    return () => {
      cancelled = true
      if (update) cancelFrame(update)
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
