import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const GRAVITY = 0.6
const JUMP_VEL = -10
const GROUND_Y = 120
const OBSTACLE_SPEED = 4

export default function NotFound() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const stateRef = useRef(null)

  const reset = () => {
    stateRef.current = {
      dino: { y: GROUND_Y, vy: 0, w: 20, h: 24 },
      obstacles: [],
      frame: 0,
      score: 0,
      speed: OBSTACLE_SPEED,
      groundOffset: 0,
    }
    setScore(0)
    setGameOver(false)
    setPlaying(true)
  }

  useEffect(() => {
    if (!playing || gameOver) return
    let raf
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = 320, H = 160
    canvas.width = W
    canvas.height = H

    let spawnTimer = 0

    const tick = () => {
      const s = stateRef.current
      if (!s) return
      s.frame++

      // Dino physics
      s.dino.vy += GRAVITY
      s.dino.y += s.dino.vy
      if (s.dino.y > GROUND_Y) {
        s.dino.y = GROUND_Y
        s.dino.vy = 0
      }

      // Ground scroll
      s.groundOffset = (s.groundOffset - s.speed) % 20

      // Spawn obstacles
      spawnTimer++
      if (spawnTimer > 60 + Math.random() * 80) {
        spawnTimer = 0
        s.obstacles.push({ x: W, y: GROUND_Y, w: 8 + Math.random() * 8, h: 16 + Math.random() * 12, passed: false })
      }

      // Move obstacles
      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i]
        o.x -= s.speed
        if (!o.passed && o.x + o.w < 0) {
          s.obstacles.splice(i, 1)
          s.score++
          setScore(s.score)
          if (s.score % 10 === 0) s.speed = Math.min(10, s.speed + 0.5)
          continue
        }

        // Collision
        const d = s.dino
        if (
          o.x < 30 + d.w &&
          o.x + o.w > 30 &&
          d.y + d.h > o.y - o.h
        ) {
          setGameOver(true)
          setPlaying(false)
          return
        }
      }

      // Draw
      ctx.clearRect(0, 0, W, H)

      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H)
      skyGrad.addColorStop(0, 'oklch(20% 0.02 240)')
      skyGrad.addColorStop(1, 'oklch(12% 0.01 240)')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, W, H)

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      for (let i = 0; i < 20; i++) {
        const sx = (i * 37 + s.frame * 0.02) % W
        const sy = (i * 53) % (H - 40)
        ctx.fillRect(sx, sy, 1.5, 1.5)
      }

      // Ground
      ctx.fillStyle = 'var(--void-3)'
      ctx.fillRect(0, GROUND_Y + 24, W, 4)
      ctx.fillStyle = 'var(--void-2)'
      for (let x = s.groundOffset; x < W; x += 20) {
        ctx.fillRect(x, GROUND_Y + 24, 10, 2)
      }

      // Dino
      const bounce = s.dino.y >= GROUND_Y ? Math.sin(s.frame * 0.3) * 2 : 0
      ctx.fillStyle = 'var(--plasma-bright)'
      ctx.fillRect(30, s.dino.y + bounce, s.dino.w, s.dino.h)
      // Eye
      ctx.fillStyle = 'var(--void-0)'
      ctx.fillRect(42, s.dino.y + bounce + 4, 4, 4)
      // Legs
      ctx.fillStyle = 'var(--plasma)'
      const legAnim = Math.sin(s.frame * 0.2) * 3
      ctx.fillRect(32, s.dino.y + bounce + s.dino.h, 5, 4 + legAnim)
      ctx.fillRect(42, s.dino.y + bounce + s.dino.h, 5, 4 - legAnim)

      // Obstacles
      s.obstacles.forEach((o) => {
        ctx.fillStyle = 'var(--ember)'
        ctx.fillRect(o.x, o.y - o.h, o.w, o.h)
      })

      // Score
      ctx.fillStyle = 'var(--ink-faint)'
      ctx.font = '8px monospace'
      ctx.fillText(`SCORE: ${s.score}`, 8, 12)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, gameOver])

  useEffect(() => {
    if (!playing || gameOver) return
    const handler = (e) => {
      if ((e.key === ' ' || e.key === 'ArrowUp') && stateRef.current) {
        e.preventDefault()
        const s = stateRef.current
        if (s.dino.y >= GROUND_Y) s.dino.vy = JUMP_VEL
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [playing, gameOver])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 container-px" style={{ background: 'var(--void-0)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <span className="level-badge mb-4 inline-block">404 — LOST SIGNAL</span>
        <h1 className="font-display text-[clamp(3rem,10vw,6rem)] leading-[0.95] mb-4">
          This page <span className="text-gradient">doesn&apos;t exist.</span>
        </h1>
        <p className="text-[var(--ink-dim)] mb-8 max-w-md mx-auto">
          The link you followed may be broken, or the page has been removed.
          While you&apos;re here, try the dino runner below.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative rounded-2xl glass overflow-hidden border border-[var(--glass-border)]"
      >
        <canvas
          ref={canvasRef}
          className="block"
          width={320}
          height={160}
          onClick={() => { if (!playing || gameOver) reset() }}
        />
        {(!playing || gameOver) && (
          <div className="absolute inset-0 bg-[var(--void-0)]/80 backdrop-blur-sm flex items-center justify-center">
            <button
              onClick={reset}
              className="clay-btn px-6 py-3 rounded-full font-mono text-xs tracking-wider text-[var(--plasma-bright)]"
            >
              {gameOver ? `GAME OVER · Score: ${score} — Play Again` : 'START RUNNING'}
            </button>
          </div>
        )}
      </motion.div>

      <div className="flex gap-6 mt-4">
        <a href="/" className="font-mono text-xs tracking-wider text-[var(--plasma-bright)] hover:underline">
          &larr; Back to Home
        </a>
        <button onClick={() => window.location.reload()} className="font-mono text-xs tracking-wider text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors">
          Reload Page
        </button>
      </div>
    </div>
  )
}
