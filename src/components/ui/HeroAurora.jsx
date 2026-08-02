import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame } from '../../lib/raf.js'

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
    let cx = 0.5   // fast-follow blob (a)
    let cy = 0.5
    let cx2 = 0.5  // lazy-follow blob (b) — slower lerp gives parallax depth
    let cy2 = 0.5
    let idle = 0

    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect()
      mx = (e.clientX - rect.left) / rect.width
      my = (e.clientY - rect.top) / rect.height
      idle = 0
    }

    const tick = () => {
      // Stop updating once everything has settled — zero idle cost
      if (Math.abs(mx - cx) < 0.0005 && Math.abs(my - cy) < 0.0005 && ++idle > 30) return
      cx += (mx - cx) * 0.06
      cy += (my - cy) * 0.06
      cx2 += (mx - cx2) * 0.025
      cy2 += (my - cy2) * 0.025
      const rect = wrap.getBoundingClientRect()
      // Percentage vars feed the grid mask; px vars feed GPU blob transforms
      wrap.style.setProperty('--mx', `${(cx * 100).toFixed(2)}%`)
      wrap.style.setProperty('--my', `${(cy * 100).toFixed(2)}%`)
      wrap.style.setProperty('--mxp', `${(cx * rect.width).toFixed(1)}px`)
      wrap.style.setProperty('--myp', `${(cy * rect.height).toFixed(1)}px`)
      wrap.style.setProperty('--mxp2', `${(cx2 * rect.width).toFixed(1)}px`)
      wrap.style.setProperty('--myp2', `${(cy2 * rect.height).toFixed(1)}px`)
    }
    const stop = onFrame(tick)

    window.addEventListener('pointermove', onMove)
    return () => {
      stop()
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
      {/* Animated mesh-gradient overlay (4.20) — theme-aware, slow drift */}
      <span
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 20% 30%, color-mix(in oklch, var(--accent) 25%, transparent), transparent 60%),
            radial-gradient(ellipse 100% 70% at 80% 70%, color-mix(in oklch, var(--violet) 20%, transparent), transparent 55%)
          `,
          animation: reduced ? 'none' : 'meshDrift 14s ease-in-out infinite alternate',
        }}
      />
      <style>{`
        @keyframes meshDrift {
          0% { transform: translate(0, 0) scale(1); opacity: 0.2; }
          50% { transform: translate(2%, -1%) scale(1.03); opacity: 0.3; }
          100% { transform: translate(-1%, 2%) scale(0.98); opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
