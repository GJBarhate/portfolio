import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSound } from '../../contexts/SoundContext.jsx'

const GRID = 18
const CELL = 18
const CANVAS_SIZE = GRID * CELL
const DIRECTIONS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

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
  const sound = useSound()
  const stateRef = useRef(null)

  const reset = useCallback(() => {
    const snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }]
    stateRef.current = {
      snake,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: randomCell(snake),
      speed: 140,
      acc: 0,
      last: performance.now(),
    }
    setScore(0)
    setGameOver(false)
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
          s.food = randomCell(s.snake)
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

      ctx.fillStyle = '#0d130d'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath()
        ctx.moveTo(i * CELL, 0)
        ctx.lineTo(i * CELL, CANVAS_SIZE)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * CELL)
        ctx.lineTo(CANVAS_SIZE, i * CELL)
        ctx.stroke()
      }

      ctx.fillStyle = '#e8a23d'
      ctx.shadowColor = '#e8a23d'
      ctx.shadowBlur = 12
      ctx.fillRect(s.food.x * CELL + 3, s.food.y * CELL + 3, CELL - 6, CELL - 6)
      ctx.shadowBlur = 0

      s.snake.forEach((c, i) => {
        ctx.fillStyle = i === 0 ? '#8fc97a' : '#6a9955'
        ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2)
      })

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, gameOver, sound, onHighScore])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center px-4"
          style={{ zIndex: 'var(--z-cmdpal)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
              <p className="font-mono text-xs tracking-[0.25em] text-[var(--cyan)]">SECRET: SNAKE</p>
              <button onClick={onClose} className="text-[var(--ink-faint)] hover:text-[var(--ink)] font-mono text-xs flex-shrink-0">
                ESC &#10005;
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-white/10">
              <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} />
              {gameOver && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3">
                  <p className="font-display text-xl text-[var(--ink)]">Game Over</p>
                  <p className="font-mono text-sm text-[var(--plasma-bright)]">Score: {score}</p>
                  <button
                    onClick={reset}
                    className="px-5 py-2 rounded-full bg-[var(--plasma)] text-[var(--void-0)] text-sm font-medium"
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
