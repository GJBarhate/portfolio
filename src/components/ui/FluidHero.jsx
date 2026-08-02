import { lazy, Suspense, useEffect, useState } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { getTier, onTierChange } from '../../lib/raf.js'

// The fluid simulation lives in its own chunk so that `three` never sits on
// the hero's critical path. Nothing here imports three.
const FluidCanvas = lazy(() => import('./FluidCanvas.jsx'))

/**
 * Everyone gets a fast, GPU-composited CSS mesh gradient. Strong machines
 * additionally get the Navier-Stokes showpiece layered on top of it, loaded
 * at idle so it never competes with first paint.
 */
function wantsFluid() {
  if (typeof window === 'undefined') return false
  if (getTier() < 3) return false
  if ((navigator.hardwareConcurrency || 0) < 8) return false
  if (navigator.connection?.saveData) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  if (!window.matchMedia('(min-width: 768px)').matches) return false
  return true
}

export default function FluidHero({ children, className = '' }) {
  const reduced = useReducedMotion()
  const [fluid, setFluid] = useState(false)

  useEffect(() => {
    if (reduced) return
    let cancelled = false
    const decide = () => { if (!cancelled) setFluid(wantsFluid()) }

    const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200))
    const cic = window.cancelIdleCallback || clearTimeout
    const id = ric(decide, { timeout: 2500 })

    // If the governor later drops a tier, the sim unmounts with it.
    const offTier = onTierChange(() => { if (!cancelled) setFluid(wantsFluid()) })

    return () => {
      cancelled = true
      cic(id)
      offTier()
    }
  }, [reduced])

  return (
    <div className={'relative ' + className}>
      <div className="hero-mesh" data-animated={reduced ? 'false' : 'true'} aria-hidden="true">
        <span className="hero-mesh__layer hero-mesh__layer--a" />
        <span className="hero-mesh__layer hero-mesh__layer--b" />
        <span className="hero-mesh__layer hero-mesh__layer--c" />
      </div>
      {fluid && (
        <Suspense fallback={null}>
          <FluidCanvas />
        </Suspense>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}
