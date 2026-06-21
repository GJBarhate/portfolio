import { useEffect, useRef } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'

const TRAIL_COUNT = 4

export default function CustomCursor() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)
  const labelRef = useRef(null)
  const trailRefs = useRef([])
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isMobile) return

    const dot = dotRef.current
    const ring = ringRef.current
    const label = labelRef.current
    const trails = trailRefs.current

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX = mouseX
    let ringY = mouseY
    const stiffness = 0.18

    const trailPositions = trails.map(() => ({ x: mouseX, y: mouseY }))

    const onMove = (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`
    }
    window.addEventListener('mousemove', onMove)

    let raf
    const tick = () => {
      ringX += (mouseX - ringX) * stiffness
      ringY += (mouseY - ringY) * stiffness
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`

      for (let i = 0; i < trails.length; i++) {
        const target = i === 0 ? { x: mouseX, y: mouseY } : trailPositions[i - 1]
        const ease = 0.12 - i * 0.02
        trailPositions[i].x += (target.x - trailPositions[i].x) * ease
        trailPositions[i].y += (target.y - trailPositions[i].y) * ease
        trails[i].style.transform = `translate3d(${trailPositions[i].x}px, ${trailPositions[i].y}px, 0) translate(-50%, -50%)`
        trails[i].style.opacity = String(0.3 - i * 0.06)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const handleEnter = (e) => {
      const target = e.target.closest('[data-cursor]')
      if (!target) return
      const variant = target.getAttribute('data-cursor')
      ring.dataset.variant = variant
      if (label) label.textContent = variant.toUpperCase()
    }
    const handleLeave = (e) => {
      const target = e.target.closest('[data-cursor]')
      if (!target) return
      delete ring.dataset.variant
      if (label) label.textContent = ''
    }
    document.addEventListener('mouseover', handleEnter)
    document.addEventListener('mouseout', handleLeave)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', handleEnter)
      document.removeEventListener('mouseout', handleLeave)
      cancelAnimationFrame(raf)
    }
  }, [isMobile])

  if (isMobile) return null

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: 'var(--z-cursor)' }}>
      {Array.from({ length: TRAIL_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => (trailRefs.current[i] = el)}
          className="cursor-trail"
          style={{ width: 6 - i, height: 6 - i }}
        />
      ))}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full bg-[var(--ink)]"
        style={{ mixBlendMode: 'difference' }}
      />
      <div
        ref={ringRef}
        className="cursor-ring fixed top-0 left-0 w-10 h-10 rounded-full border border-[var(--plasma)] flex items-center justify-center transition-[width,height,opacity] duration-300"
        style={{ willChange: 'transform' }}
      >
        <span ref={labelRef} className="text-[8px] font-mono tracking-widest text-[var(--plasma-bright)]" />
      </div>
      <style>{`
        .cursor-ring[data-variant] { width: 64px; height: 64px; background: color-mix(in oklch, var(--plasma) 15%, transparent); border-color: var(--cyan); }
      `}</style>
    </div>
  )
}
