import { useEffect, useRef } from 'react'
import AvatarScrub from './AvatarScrub.jsx'
import { onFrame } from '../../lib/raf.js'

// Three tags and six particles, down from five and twelve: the ornament has
// to scale with the smaller frame or it reads as clutter around it.
const ORBIT_TAGS = ['REACT', 'NODE', 'WEBRTC']
const PARTICLE_COUNT = 6

export default function AvatarShowcase({ sectionId = 'about' }) {
  const containerRef = useRef(null)

  /*
   * J2 — this used to bind a raw `mousemove` driving two Framer springs and
   * two transforms, running whether or not the section was anywhere near the
   * viewport, and reading layout inside every event. It is now: one damped
   * lerp on the shared ticker, gated by an IntersectionObserver, writing CSS
   * custom properties that the card and the specular highlight consume.
   */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const target = { x: 0.5, y: 0.5 }
    const value = { x: 0.5, y: 0.5 }
    let rect = null
    let inView = false
    let stop = null

    const onMove = (e) => {
      if (!rect) rect = el.getBoundingClientRect()
      target.x = (e.clientX - rect.left) / rect.width
      target.y = (e.clientY - rect.top) / rect.height
    }
    const onEnter = () => { rect = el.getBoundingClientRect(); el.dataset.hovering = 'true' }
    const onLeave = () => {
      el.dataset.hovering = 'false'
      target.x = 0.5
      target.y = 0.5
    }
    const invalidate = () => { rect = null }

    const tick = (_t, dt) => {
      const k = 1 - Math.exp(-(dt / 1000) * 9)
      value.x += (target.x - value.x) * k
      value.y += (target.y - value.y) * k
      el.style.setProperty('--av-rx', `${((0.5 - value.y) * 24).toFixed(2)}deg`)
      el.style.setProperty('--av-ry', `${((value.x - 0.5) * 24).toFixed(2)}deg`)
      el.style.setProperty('--av-gx', `${(-20 + value.x * 140).toFixed(1)}%`)
      el.style.setProperty('--av-gy', `${(-20 + value.y * 140).toFixed(1)}%`)
    }

    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting
      if (inView && !stop) stop = onFrame(tick)
      else if (!inView && stop) { stop(); stop = null }
    }, { rootMargin: '10% 0px' })
    io.observe(el)

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)
    window.addEventListener('scroll', invalidate, { passive: true })
    window.addEventListener('resize', invalidate, { passive: true })

    return () => {
      io.disconnect()
      stop?.()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', invalidate)
      window.removeEventListener('resize', invalidate)
    }
  }, [])

  return (
    <div ref={containerRef} className="avatar-showcase" data-hovering="false">
      {/* Outer glow pulse */}
      <div className="avatar-showcase__glow" />

      {/* Orbital rings */}
      <div className="avatar-showcase__orbit avatar-showcase__orbit--1" />
      <div className="avatar-showcase__orbit avatar-showcase__orbit--2" />
      <div className="avatar-showcase__orbit avatar-showcase__orbit--3" />

      {/* Floating orbit tags */}
      {ORBIT_TAGS.map((tag, i) => (
        <span
          key={tag}
          className="avatar-showcase__tag"
          style={{
            '--tag-i': i,
            '--tag-total': ORBIT_TAGS.length,
          }}
        >
          {tag}
        </span>
      ))}

      {/* 3D tilting card */}
      <div className="avatar-showcase__card">
        {/* Holographic scan line */}
        <div className="avatar-showcase__scan" />

        {/* Specular highlight following mouse */}
        <div className="avatar-showcase__specular" />

        {/* Corner accents */}
        <span className="avatar-showcase__corner avatar-showcase__corner--tl" />
        <span className="avatar-showcase__corner avatar-showcase__corner--tr" />
        <span className="avatar-showcase__corner avatar-showcase__corner--bl" />
        <span className="avatar-showcase__corner avatar-showcase__corner--br" />

        {/* The actual avatar */}
        <AvatarScrub sectionId={sectionId} />

        {/* Status indicator */}
        <div className="avatar-showcase__status">
          <span className="avatar-showcase__status-dot" />
          <span>AVAILABLE</span>
        </div>
      </div>

      {/* Particle dots */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <span
          key={i}
          className="avatar-showcase__particle"
          style={{
            '--p-i': i,
            '--p-total': PARTICLE_COUNT,
          }}
        />
      ))}
    </div>
  )
}
