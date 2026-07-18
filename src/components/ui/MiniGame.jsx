import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext.jsx'

const GRID = 18
const CELL = 18
const CANVAS_SIZE = GRID * CELL
const DIRECTIONS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

const SKILL_FACTS = [
  { icon: 'R', fact: 'React — UI library of choice' },
  { icon: 'N', fact: 'Node.js — server runtime' },
  { icon: 'M', fact: 'MongoDB — document database' },
  { icon: 'S', fact: 'Socket.IO — real-time comms' },
  { icon: 'W', fact: 'WebRTC — peer-to-peer video' },
  { icon: 'Y', fact: 'Yjs CRDT — conflict-free sync' },
  { icon: 'G', fact: 'Gemini AI — LLM integration' },
  { icon: 'V', fact: 'Vite — blazing fast builds' },
  { icon: 'T', fact: 'Tailwind — utility CSS' },
  { icon: 'E', fact: 'Express — server framework' },
]

function randomCell(exclude) {
  let cell
  do {
    cell = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }
  } while (exclude.some((c) => c.x === cell.x && c.y === cell.y))
  return cell
}

export default function MiniGame({ open, onClose, onHighScore }) {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [lastFact, setLastFact] = useState(null)
  const sound = useSound()
  const stateRef = useRef(null)

  const reset = useCallback(() => {
    const snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }]
    stateRef.current = {
      snake,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: randomCell(snake),
      foodIdx: Math.floor(Math.random() * SKILL_FACTS.length),
      speed: 140,
      acc: 0,
      last: performance.now(),
    }
    setScore(0)
    setGameOver(false)
    setLastFact(null)
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      const s = stateRef.current
      if (!s) return
      if (e.key === 'ArrowUp' && s.dir.y === 0) s.nextDir = { x: 0, y: -1 }
      else if (e.key === 'ArrowDown' && s.dir.y === 0) s.nextDir = { x: 0, y: 1 }
      else if (e.key === 'ArrowLeft' && s.dir.x === 0) s.nextDir = { x: -1, y: 0 }
      else if (e.key === 'ArrowRight' && s.dir.x === 0) s.nextDir = { x: 1, y: 0 }
      else if (e.key === 'Escape') onClose()
      if (DIRECTIONS.includes(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open || gameOver) return
    let raf
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const tick = (now) => {
      const s = stateRef.current
      const dt = now - s.last
      s.last = now
      s.acc += dt

      if (s.acc >= s.speed) {
        s.acc = 0
        s.dir = s.nextDir
        const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y }

        const hitWall = head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID
        const hitSelf = s.snake.some((c) => c.x === head.x && c.y === head.y)
        if (hitWall || hitSelf) {
          setGameOver(true)
          sound?.play('close')
          return
        }

        s.snake.unshift(head)
        if (head.x === s.food.x && head.y === s.food.y) {
          setLastFact(SKILL_FACTS[s.foodIdx])
          s.food = randomCell(s.snake)
          s.foodIdx = (s.foodIdx + 1) % SKILL_FACTS.length
          s.speed = Math.max(70, s.speed - 4)
          sound?.play('click')
          setScore((sc) => {
            const next = sc + 1
            if (next === 10) onHighScore?.()
            return next
          })
        } else {
          s.snake.pop()
        }
      }

      // Dark fixed stage
      ctx.fillStyle = '#08090a'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

      // Grid dots
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      for (let gx = 0; gx < GRID; gx++) {
        for (let gy = 0; gy < GRID; gy++) {
          ctx.beginPath()
          ctx.arc(gx * CELL + CELL / 2, gy * CELL + CELL / 2, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Food — pulsing glow
      const pulse = 0.7 + Math.sin(now * 0.005) * 0.3
      ctx.save()
      ctx.shadowColor = '#d4b876'
      ctx.shadowBlur = 16 * pulse
      ctx.fillStyle = '#d4b876'
      const foodSize = CELL - 4 - Math.sin(now * 0.008) * 2
      const foodOffset = (CELL - foodSize) / 2
      ctx.beginPath()
      ctx.roundRect(s.food.x * CELL + foodOffset, s.food.y * CELL + foodOffset, foodSize, foodSize, 3)
      ctx.fill()
      // Skill icon on food
      ctx.shadowBlur = 0
      ctx.fillStyle = '#08090a'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(SKILL_FACTS[s.foodIdx].icon, s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2)
      ctx.restore()

      // Snake body — thick with neon glow
      s.snake.forEach((c, i) => {
        const t = 1 - i / s.snake.length
        const r = i === 0 ? 4 : 3
        ctx.save()
        if (i === 0) {
          ctx.shadowColor = '#6a9955'
          ctx.shadowBlur = 14
        }
        ctx.fillStyle = i === 0
          ? `rgba(140, 200, 120, ${0.9 + t * 0.1})`
          : `rgba(106, 153, 85, ${0.5 + t * 0.4})`
        ctx.beginPath()
        ctx.roundRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2, r)
        ctx.fill()
        ctx.restore()
      })

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '700 9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`SCORE ${s.snake.length - 3}`, 6, 14)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, gameOver, sound, onHighScore])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center px-4"
          style={{ zIndex: 'var(--z-cmdpal)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-theme="obsidian"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass rounded-3xl p-6 flex flex-col items-center gap-4"
          >
            <div className="flex items-center justify-between w-full gap-6">
              <p className="font-mono text-xs tracking-[0.25em] text-[var(--plasma-bright)]">SECRET: SNAKE · CV MODE</p>
              <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] font-mono text-xs flex-shrink-0">
                ESC &#10005;
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-[var(--glass-border)]">
              <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} data-cursor="crosshair" />
              {gameOver && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
                  <p className="font-display text-xl text-[var(--ink)]">Game Over</p>
                  <p className="font-mono text-sm" style={{ color: '#d4b876' }}>Score: {score}</p>
                  <button
                    onClick={reset}
                    className="px-5 py-2 rounded-full text-sm font-medium"
                    style={{ background: '#d4b876', color: '#08090a' }}
                  >
                    Restart
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between w-full font-mono text-xs text-[var(--ink-faint)]">
              <span>
                SCORE: <span className="text-[var(--ink)]">{score}</span>
              </span>
              <span className="hidden sm:inline">ARROW KEYS TO MOVE</span>
            </div>
            <AnimatePresence mode="wait">
              {lastFact && (
                <motion.p
                  key={lastFact.fact}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[10px] tracking-wider text-center"
                  style={{ color: '#d4b876' }}
                >
                  {lastFact.fact}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
