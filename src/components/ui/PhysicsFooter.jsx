import { useEffect, useRef, useCallback, useState } from 'react'
import { useIsMobile } from '../../lib/useIsMobile.js'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

const LETTER_CHARS = [...'GAURAV BARHATE']

export default function PhysicsFooter() {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const bodiesRef = useRef([])
  const mouseConstraintRef = useRef(null)
  const isMobile = useIsMobile()
  const reduced = useReducedMotion()
  const [loaded, setLoaded] = useState(false)
  const letterEls = useRef([])

  const init = useCallback(async () => {
    if (reduced) return
    const Matter = await import('matter-js')
    const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events } = Matter

    const container = containerRef.current
    if (!container) return

    const w = container.offsetWidth
    const h = 280

    const engine = Engine.create({ gravity: { x: 0, y: 1.2 } })
    engineRef.current = engine

    const canvas = canvasRef.current
    canvas.width = w * 2
    canvas.height = h * 2
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(2, 2)

    const wallOpts = { isStatic: true, restitution: 0.3, friction: 0.8, render: { visible: false } }
    const floor = Bodies.rectangle(w / 2, h + 25, w + 100, 50, wallOpts)
    const wallL = Bodies.rectangle(-25, h / 2, 50, h * 2, wallOpts)
    const wallR = Bodies.rectangle(w + 25, h / 2, 50, h * 2, wallOpts)

    Composite.add(engine.world, [floor, wallL, wallR])

    const fontSize = isMobile ? 28 : 48
    const bodies = []
    const totalWidth = LETTER_CHARS.reduce((acc, c) => acc + (c === ' ' || c === ' ' ? fontSize * 0.3 : fontSize * 0.65), 0)
    let xOffset = (w - totalWidth) / 2

    LETTER_CHARS.forEach((char, i) => {
      if (char === ' ') {
        xOffset += fontSize * 0.3
        bodies.push(null)
        return
      }
      const charW = fontSize * 0.65
      const charH = fontSize * 1.1
      const body = Bodies.rectangle(
        xOffset + charW / 2,
        -60 - Math.random() * 200,
        charW,
        charH,
        {
          restitution: 0.4,
          friction: 0.6,
          density: 0.002,
          chamfer: { radius: 4 },
          label: `letter-${i}`,
        }
      )
      body._charIndex = i
      bodies.push(body)
      Composite.add(engine.world, body)
      xOffset += charW
    })

    bodiesRef.current = bodies

    if (!isMobile) {
      const mouse = Mouse.create(canvas)
      mouse.pixelRatio = 2
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: {
          stiffness: 0.2,
          render: { visible: false },
        },
      })
      Composite.add(engine.world, mouseConstraint)
      mouseConstraintRef.current = mouseConstraint
    }

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-reward').trim() || '#d4af37'
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#e8e0d0'

    const runner = Runner.create()
    Runner.run(runner, engine)

    const render = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.font = `bold ${fontSize}px "Clash Display", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      bodies.forEach((body, i) => {
        if (!body) return
        const { x, y } = body.position
        const angle = body.angle

        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)

        ctx.fillStyle = textColor
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 1
        ctx.strokeText(LETTER_CHARS[i], 0, 0)
        ctx.fillText(LETTER_CHARS[i], 0, 0)

        ctx.restore()
      })

      requestAnimationFrame(render)
    }
    requestAnimationFrame(render)
    setLoaded(true)

    return () => {
      Runner.stop(runner)
      Engine.clear(engine)
    }
  }, [isMobile, reduced])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded) init()
      },
      { rootMargin: '200% 0px' }
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [init, loaded])

  if (reduced) return null

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: 280 }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: isMobile ? 'default' : 'grab' }}
      />
      {!loaded && (
        <p className="absolute inset-0 flex items-center justify-center font-display text-[clamp(1.5rem,5vw,3rem)] text-[var(--ink-faint)]">
          {LETTER_CHARS.join('')}
        </p>
      )}
    </div>
  )
}
