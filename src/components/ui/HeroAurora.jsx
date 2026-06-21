import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

// Cursor-tracked aurora — three large drifting blobs of theme color follow the
// mouse with momentum, layered over a subtle animated grid. All GPU-composited
// transforms (no JS layout work per frame).
export default function HeroAurora() {
  const wrapRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const wrap = wrapRef.current
    if (!wrap) return

    let mx = 0.5
    let my = 0.5
    let cx = 0.5
    let cy = 0.5

    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect()
      mx = (e.clientX - rect.left) / rect.width
      my = (e.clientY - rect.top) / rect.height
    }

    let raf
    const tick = () => {
      cx += (mx - cx) * 0.06
      cy += (my - cy) * 0.06
      wrap.style.setProperty('--mx', `${(cx * 100).toFixed(2)}%`)
      wrap.style.setProperty('--my', `${(cy * 100).toFixed(2)}%`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [reduced])

  return (
    <div ref={wrapRef} className="hero-aurora absolute inset-0 pointer-events-none" aria-hidden="true">
      <span className="hero-aurora__blob hero-aurora__blob--a" />
      <span className="hero-aurora__blob hero-aurora__blob--b" />
      <span className="hero-aurora__blob hero-aurora__blob--c" />
      <span className="hero-aurora__grid" />
      <span className="hero-aurora__scan" />
      <span className="hero-aurora__vignette" />
    </div>
  )
}
