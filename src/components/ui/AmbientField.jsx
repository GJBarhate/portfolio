import { useEffect, useRef } from 'react'
import { useSound } from '../../contexts/SoundContext.jsx'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame, getTier } from '../../lib/raf.js'

// A calm constellation of drifting nodes — a fraction of the weight of a WebGL
// scene (plain Canvas2D, no GPU shader pipeline), and deliberately quiet so it
// sits behind the hero copy instead of competing with it for attention.
const NODE_COUNT_DESKTOP = 46
const NODE_COUNT_MOBILE = 22
const LINK_DIST = 150
const SPEED = 0.12

export default function AmbientField() {
  const canvasRef = useRef(null)
  const rippleRef = useRef([])
  const reduced = useReducedMotion()
  const sound = useSound()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let w = 0
    let h = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let nodes = []

    // Theme colors are read once per theme change, NOT per stroke — calling
    // getComputedStyle inside the draw loop cost hundreds of forced style
    // reads per frame.
    let colorA = '#2fd4d4'
    let colorB = '#8b5cf6'
    const readColors = () => {
      const root = getComputedStyle(document.documentElement)
      colorA = root.getPropertyValue('--accent').trim() || colorA
      colorB = root.getPropertyValue('--violet').trim() || colorB
    }
    readColors()
    const themeObserver = new MutationObserver(readColors)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const colorFor = (mix) => (mix ? colorB : colorA)

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      w = rect.width
      h = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      // The link pass is O(n²), so the node count is what the tier governor
      // has to act on.
      const base = w < 768 ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP
      const count = getTier() >= 3 ? base : Math.ceil(base * 0.55)
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        r: Math.random() * 1.6 + 0.6,
        mix: Math.random() > 0.6,
      }))
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    resize()

    let acc = 0
    const stop = onFrame((_, dt) => {
      acc += dt
      if (acc < 33) return // cap ~30fps
      acc = 0

      ctx.clearRect(0, 0, w, h)

      for (const n of nodes) {
        if (!reduced) {
          n.x += n.vx
          n.y += n.vy
          if (n.x < 0 || n.x > w) n.vx *= -1
          if (n.y < 0 || n.y > h) n.vy *= -1
        }
      }

      // links between nearby nodes
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINK_DIST) {
            ctx.globalAlpha = (1 - dist / LINK_DIST) * 0.18
            ctx.strokeStyle = colorFor(nodes[i].mix)
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // nodes
      for (const n of nodes) {
        ctx.globalAlpha = 0.55
        ctx.fillStyle = colorFor(n.mix)
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // click ripples
      ctx.globalAlpha = 1
      rippleRef.current = rippleRef.current.filter((r) => r.life > 0)
      for (const r of rippleRef.current) {
        r.radius += 3.5
        r.life -= 0.025
        ctx.globalAlpha = Math.max(r.life, 0) * 0.5
        ctx.strokeStyle = colorFor(false)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    })

    return () => {
      stop()
      ro.disconnect()
      themeObserver.disconnect()
    }
  }, [reduced])

  const onClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    rippleRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, radius: 0, life: 1 })
    sound?.play('click')
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'compiler' }))
  }

  return (
    <div className="absolute inset-0 hero-poster cursor-pointer" onClick={onClick} data-cursor="explore">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  )
}
