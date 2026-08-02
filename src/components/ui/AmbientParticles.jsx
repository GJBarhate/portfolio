import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame, getTier } from '../../lib/raf.js'

const THEME_CONFIG = {
  eclipse: { speed: 0.15, count: 18, radius: [0.8, 2.2] },
  ember:   { speed: 0.10, count: 15, radius: [0.6, 1.6] },
  paper:   { speed: 0.40, count: 20, radius: [0.5, 1.5] },
}
const DEFAULT_CONFIG = THEME_CONFIG.eclipse

export default function AmbientParticles({ className = '' }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!isDesktop) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let w = 0
    let h = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let theme = document.documentElement.getAttribute('data-theme') || 'eclipse'
    let config = THEME_CONFIG[theme] || DEFAULT_CONFIG
    // The particle colour follows the palette token rather than a hardcoded
    // per-theme hex, so it can never drift out of sync with the theme.
    let color = '#2fd4d4'

    const createParticles = (cfg) => {
      // Tier 2 halves the count; tier 1 never mounts this at all.
      const count = getTier() >= 3 ? cfg.count : Math.ceil(cfg.count / 2)
      const [rMin, rMax] = cfg.radius
      return Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * cfg.speed,
        vy: (Math.random() - 0.5) * cfg.speed,
        r: rMin + Math.random() * (rMax - rMin),
        alpha: 0.15 + Math.random() * 0.35,
      }))
    }

    const readTheme = () => {
      theme = document.documentElement.getAttribute('data-theme') || 'eclipse'
      config = THEME_CONFIG[theme] || DEFAULT_CONFIG
      color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || color
      particles = createParticles(config)
    }
    readTheme()

    const themeObserver = new MutationObserver(readTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
      particles = createParticles(config)
    }

    window.addEventListener('resize', resize)
    resize()

    // ~30 fps is plenty for slow-drifting dots; the shared scheduler already
    // skips the callback entirely while the tab is hidden.
    let acc = 0
    const stop = onFrame((_, dt) => {
      acc += dt
      if (acc < 33) return
      acc = 0

      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        ctx.globalAlpha = p.alpha
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    })

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      themeObserver.disconnect()
    }
  }, [reduced])

  return (
    <canvas
      ref={canvasRef}
      className={'fixed inset-0 pointer-events-none z-0 ' + className}
      aria-hidden="true"
    />
  )
}
