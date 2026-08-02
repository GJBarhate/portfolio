import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame } from '../../lib/raf.js'

const PARTICLE_DENSITY = 2

export default function TextParticleExplosion({ scrollProgress, className = '' }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles = []
    let initX, initY

    const sampleText = () => {
      const heroName = document.querySelector('.hero-name-iridescent')
      if (!heroName) return false
      const rect = heroName.getBoundingClientRect()
      const scale = window.devicePixelRatio || 1
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      // On first mount the heading can still be zero-sized (web font not yet
      // swapped in, or the element not laid out). getImageData throws an
      // IndexSizeError on a zero-width source, which took the whole hero
      // subtree down. The ResizeObserver below re-runs this the moment the
      // heading gains a size.
      if (w < 1 || h < 1) return false
      canvas.width = w * scale
      canvas.height = h * scale
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.scale(scale, scale)

      const style = getComputedStyle(heroName)
      ctx.font = `${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#fff'
      const text = heroName.textContent || ''
      ctx.fillText(text, 0, 0)

      const imageData = ctx.getImageData(0, 0, w, h)
      const data = imageData.data
      ctx.clearRect(0, 0, w, h)

      const newParticles = []
      for (let y = 0; y < h; y += PARTICLE_DENSITY) {
        for (let x = 0; x < w; x += PARTICLE_DENSITY) {
          const i = (y * w + x) * 4
          if (data[i + 3] > 128) {
            newParticles.push({
              ox: x, oy: y,
              x, y,
              vx: 0, vy: 0,
              size: 1 + Math.random() * 1.5,
            })
          }
        }
      }
      particles = newParticles
      initX = rect.left
      initY = rect.top
      return true
    }

    // Sampling may legitimately fail on the first pass (see the size guard
    // above), so the observer is installed unconditionally and the first
    // successful sample can happen later. Bailing out here meant a
    // zero-width first measurement disabled the effect for the whole session.
    let sampled = sampleText()

    const ro = new ResizeObserver(() => { sampled = sampleText() || sampled })
    ro.observe(document.querySelector('.hero-name-iridescent') || canvas)

    // The accent colour is read on theme change only. Reading it inside the
    // draw loop forced a style recalculation on every single frame.
    let color = '#2fd4d4'
    const readColor = () => {
      color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || color
    }
    readColor()
    const mutationObs = new MutationObserver(() => { sampleText(); readColor() })
    mutationObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let settledFrames = 0

    const tick = () => {
      if (!sampled || !particles.length) return
      const pct = Math.min(1, Math.max(0, scrollProgress))
      // Fully reassembled and off-scroll: nothing left to draw.
      if (pct <= 0 && settledFrames > 45) return
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      ctx.clearRect(0, 0, w, h)

      const drift = pct * pct * 120
      const spread = pct * 80
      const alpha = Math.min(1, pct * 3)
      const reassemble = pct < 0.01
      settledFrames = reassemble ? settledFrames + 1 : 0

      for (const p of particles) {
        if (reassemble) {
          p.x += (p.ox - p.x) * 0.08
          p.y += (p.oy - p.y) * 0.08
          p.vx *= 0.9
          p.vy *= 0.9
        } else {
          const angle = Math.atan2(p.oy - h / 2, p.ox - w / 2)
          p.vx += Math.cos(angle + p.ox * 0.01) * drift * 0.0003
          p.vy += Math.sin(angle + p.oy * 0.01) * drift * 0.0003 - spread * 0.0005
          p.vx *= 0.97
          p.vy *= 0.97
          p.x += p.vx
          p.y += p.vy
        }

        ctx.globalAlpha = alpha * (1 - pct * 0.4)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (1 + pct * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }

    }
    const stop = onFrame(tick)

    return () => {
      stop()
      ro.disconnect()
      mutationObs.disconnect()
    }
  }, [reduced, scrollProgress])

  return (
    <canvas
      ref={canvasRef}
      className={'absolute top-0 left-0 pointer-events-none z-[15] ' + className}
      aria-hidden="true"
    />
  )
}
