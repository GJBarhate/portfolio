import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame } from '../../lib/raf.js'

/** Framerate-independent damping (Research #19). */
function damp(current, target, dt, k) {
  return current + (target - current) * (1 - Math.exp(-(dt / 1000) * k))
}

/**
 * Magnetic tilt with a specular sheen.
 *
 * This was six `useMotionValue`s and two `useSpring`s — a spring engine per
 * button, three of them in the hero, all on the critical path. The same
 * physics is one damped lerp on the shared ticker writing CSS custom
 * properties, and it only runs while a pointer is actually inside.
 */
export default function MagneticTilt({
  className = '',
  children,
  magneticStrength = 0.3,
  tiltMax = 8,
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const target = { rx: 0, ry: 0, tx: 0, ty: 0 }
    const value = { rx: 0, ry: 0, tx: 0, ty: 0 }
    let stop = null
    let resting = true

    const tick = (_t, dt) => {
      value.rx = damp(value.rx, target.rx, dt, 12)
      value.ry = damp(value.ry, target.ry, dt, 12)
      value.tx = damp(value.tx, target.tx, dt, 14)
      value.ty = damp(value.ty, target.ty, dt, 14)

      el.style.setProperty('--tilt-rx', `${value.rx.toFixed(2)}deg`)
      el.style.setProperty('--tilt-ry', `${value.ry.toFixed(2)}deg`)
      el.style.setProperty('--tilt-tx', `${value.tx.toFixed(2)}px`)
      el.style.setProperty('--tilt-ty', `${value.ty.toFixed(2)}px`)

      // Settled and no longer being driven — unsubscribe entirely.
      const settled =
        Math.abs(value.rx - target.rx) < 0.01 && Math.abs(value.ry - target.ry) < 0.01 &&
        Math.abs(value.tx - target.tx) < 0.05 && Math.abs(value.ty - target.ty) < 0.05
      if (resting && settled) {
        stop?.(); stop = null
        el.style.willChange = 'auto'
      }
    }

    const start = () => {
      if (!stop) {
        el.style.willChange = 'transform'
        stop = onFrame(tick, { band: 'input' })
      }
    }

    const onPointerMove = (e) => {
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      target.ry = (px - 0.5) * tiltMax * 2
      target.rx = (0.5 - py) * tiltMax * 2
      target.tx = (e.clientX - (rect.left + rect.width / 2)) * magneticStrength
      target.ty = (e.clientY - (rect.top + rect.height / 2)) * magneticStrength
      el.style.setProperty('--sheen-x', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--sheen-y', `${(py * 100).toFixed(1)}%`)
      resting = false
      start()
    }

    const onPointerEnter = () => { el.dataset.tilting = 'true' }
    const onPointerLeave = () => {
      el.dataset.tilting = 'false'
      target.rx = 0; target.ry = 0; target.tx = 0; target.ty = 0
      resting = true
      start()
    }

    el.addEventListener('pointermove', onPointerMove, { passive: true })
    el.addEventListener('pointerenter', onPointerEnter)
    el.addEventListener('pointerleave', onPointerLeave)
    return () => {
      stop?.()
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerenter', onPointerEnter)
      el.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reduced, magneticStrength, tiltMax])

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <div ref={ref} className={`magnetic-tilt ${className}`.trim()} data-tilting="false">
      {children}
      <span className="magnetic-tilt__sheen" aria-hidden="true" />
    </div>
  )
}
