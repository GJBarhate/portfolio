import { useEffect, useRef } from 'react'
import { usePointer } from '../../lib/useMedia.js'
import { onFrame } from '../../lib/raf.js'

const TRAIL_COUNT = 5

export default function CustomCursor() {
  const dotRef = useRef(null)
  const trailRefs = useRef([])
  // Capability, not size: a 1440px touchscreen has no cursor to replace,
  // and a 600px window with a mouse does (T-011).
  const { coarse } = usePointer()

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const disabled =
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-cursor-disabled') === 'true' ||
      document.documentElement.hasAttribute('data-no-custom-cursor'))

  useEffect(() => {
    if (coarse || disabled || reducedMotion) return

    const dot = dotRef.current
    const trails = trailRefs.current
    if (!dot) return

    document.documentElement.style.cursor = 'none'
    document.querySelectorAll('canvas, iframe, video, [data-cursor-restore]').forEach((el) => {
      el.style.cursor = 'auto'
    })

    // Colours come from the palette tokens rather than a hardcoded per-theme
    // map, so a new or renamed theme cannot silently fall back to the wrong
    // colour.
    const applyTheme = () => {
      const cs = getComputedStyle(document.documentElement)
      const dotColor = cs.getPropertyValue('--accent-bright').trim() || cs.getPropertyValue('--ink').trim()
      const trailColor = cs.getPropertyValue('--accent').trim() || dotColor
      if (dot) dot.style.background = dotColor
      trails.forEach((t) => { if (t) t.style.background = trailColor })
    }
    applyTheme()

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    const trailPositions = trails.map(() => ({ x: mouseX, y: mouseY }))
    let idle = 0
    let stop = null

    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const tick = () => {
      let moved = false
      for (let i = 0; i < trails.length; i++) {
        const target = i === 0 ? { x: mouseX, y: mouseY } : trailPositions[i - 1]
        const ease = 0.12 - i * 0.018
        const dx = target.x - trailPositions[i].x
        const dy = target.y - trailPositions[i].y
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) moved = true
        trailPositions[i].x += dx * ease
        trailPositions[i].y += dy * ease
        trails[i].style.transform = `translate3d(${trailPositions[i].x}px, ${trailPositions[i].y}px, 0) translate(-50%, -50%)`
        trails[i].style.opacity = String(0.35 - i * 0.06)
      }
      // Once the trail has caught up there is nothing left to interpolate;
      // the subscription is dropped until the pointer moves again.
      if (!moved && ++idle > 20) {
        stop?.()
        stop = null
      }
    }

    const start = () => {
      idle = 0
      if (!stop) stop = onFrame(tick, { band: 'input' })
    }

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`
      dot.style.opacity = '1'
      start()
    }

    window.addEventListener('mousemove', onMove)
    start()

    const onLeave = () => { dot.style.opacity = '0'; trails.forEach(t => t.style.opacity = '0') }
    const onEnter = () => { dot.style.opacity = '1'; start() }

    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)

    return () => {
      stop?.()
      observer.disconnect()
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      document.documentElement.style.cursor = ''
    }
  }, [coarse, disabled, reducedMotion])

  if (coarse || disabled || reducedMotion) return null

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-cursor)' }}>
      {Array.from({ length: TRAIL_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => (trailRefs.current[i] = el)}
          className="cursor-trail"
          style={{ width: 6 - i * 0.6, height: 6 - i * 0.6, filter: `blur(${1 + i * 0.5}px)` }}
        />
      ))}
      <div ref={dotRef} className="cursor-dot" />
    </div>
  )
}
