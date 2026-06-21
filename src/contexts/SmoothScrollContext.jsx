import { createContext, useContext, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { useReducedMotion } from '../lib/useReducedMotion.js'

const SmoothScrollContext = createContext(null)

export function SmoothScrollProvider({ children }) {
  const lenisRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ({ scroll, limit }) => {
      setProgress(limit > 0 ? scroll / limit : 0)
      document.documentElement.style.setProperty('--grade-hue', `${(scroll / Math.max(limit, 1)) * 40}deg`)
    })

    function raf(time) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    let rafId = requestAnimationFrame(raf)

    gsap.ticker.add((time) => lenis.raf(time * 1000))

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [reduced])

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisRef, progress, reduced }}>
      {children}
    </SmoothScrollContext.Provider>
  )
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext)
}
