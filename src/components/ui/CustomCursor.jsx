import { useEffect, useRef } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'

const TRAIL_COUNT = 5

const THEME_COLORS = {
  forest:  { trail: '#6a9955', dot: '#e8a23d' },
  ocean:   { trail: '#8fb8d9', dot: '#b8d0e0' },
  golden:  { trail: '#e0b35c', dot: '#fff3d6' },
  dawn:    { trail: '#d9a85e', dot: '#fff8e8' },
  obsidian:{ trail: '#d4b876', dot: '#f0e0b8' },
}

export default function CustomCursor() {
  const dotRef = useRef(null)
  const trailRefs = useRef([])
  const isMobile = useIsMobile()

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const disabled =
    typeof document !== 'undefined' &&
    (document.documentElement.getAttribute('data-cursor-disabled') === 'true' ||
      document.documentElement.hasAttribute('data-no-custom-cursor'))

  useEffect(() => {
    if (isMobile || disabled || reducedMotion) return

    const dot = dotRef.current
    const trails = trailRefs.current
    if (!dot) return

    document.documentElement.style.cursor = 'none'
    document.querySelectorAll('canvas, iframe, video, [data-cursor-restore]').forEach((el) => {
      el.style.cursor = 'auto'
    })

    const applyTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme') || 'forest'
      const c = THEME_COLORS[theme] || THEME_COLORS.forest
      if (dot) dot.style.background = c.dot
      trails.forEach((t) => {
        if (t) t.style.background = c.trail
      })
    }
    applyTheme()

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    const trailPositions = trails.map(() => ({ x: mouseX, y: mouseY }))
    let raf

    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`
      dot.style.opacity = '1'
    }

    window.addEventListener('mousemove', onMove)

    const tick = () => {
      for (let i = 0; i < trails.length; i++) {
        const target = i === 0 ? { x: mouseX, y: mouseY } : trailPositions[i - 1]
        const ease = 0.12 - i * 0.018
        trailPositions[i].x += (target.x - trailPositions[i].x) * ease
        trailPositions[i].y += (target.y - trailPositions[i].y) * ease
        trails[i].style.transform = `translate3d(${trailPositions[i].x}px, ${trailPositions[i].y}px, 0) translate(-50%, -50%)`
        trails[i].style.opacity = String(0.35 - i * 0.06)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onLeave = () => { dot.style.opacity = '0'; trails.forEach(t => t.style.opacity = '0') }
    const onEnter = () => { dot.style.opacity = '1' }

    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      document.documentElement.style.cursor = ''
    }
  }, [isMobile, disabled, reducedMotion])

  if (isMobile || disabled || reducedMotion) return null

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
