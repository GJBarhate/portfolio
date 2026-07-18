import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

const THEME_CONFIG = {
  forest:  { color: '#6a9955', speed: 0.15, count: 18, radius: [0.8, 2.2] },
  ocean:   { color: '#8fb8d9', speed: 0.12, count: 16, radius: [1.0, 2.8] },
  golden:  { color: '#e0b35c', speed: 0.3,  count: 20, radius: [0.6, 1.8] },
  dawn:    { color: '#d9a85e', speed: 0.45, count: 20, radius: [0.5, 1.5] },
  obsidian:{ color: '#d4b876', speed: 0.08, count: 15, radius: [0.6, 1.6] },
}

export default function AmbientParticles({ className = '' }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return

    const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!isDesktop) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let w = 0
    let h = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let visible = !document.hidden
    let theme = document.documentElement.getAttribute('data-theme') || 'forest'
    let config = THEME_CONFIG[theme] || THEME_CONFIG.forest

    const onVisibility = () => { visible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibility)

    const createParticles = (cfg) => {
      const count = cfg.count
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
      theme = document.documentElement.getAttribute('data-theme') || 'forest'
      config = THEME_CONFIG[theme] || THEME_CONFIG.forest
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

    let last = performance.now()
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const dt = now - last
      if (dt < 33) return
      last = now

      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        ctx.globalAlpha = p.alpha
        ctx.fillStyle = config.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
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
