import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

const COLS = 20
const ROWS = 20
const CELL = 14
const TICK_MS = 140
const LS_KEY = 'forge-snake-best'

const DIR = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
}

function randomFood(snake) {
  const set = new Set(snake.map((s) => `${s.x},${s.y}`))
  let pos
  do { pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) } }
  while (set.has(`${pos.x},${pos.y}`))
  return pos
}

function getBest() {
  try { return parseInt(localStorage.getItem(LS_KEY)) || 0 } catch { return 0 }
}

export default function SnakeClassic() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(getBest)
  const [playing, setPlaying] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const stateRef = useRef(null)
  const tickRef = useRef(null)
  const canvasW = COLS * CELL
  const canvasH = ROWS * CELL

  const reset = useCallback(() => {
    const mid = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }
    stateRef.current = {
      snake: [{ x: mid.x, y: mid.y }, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: randomFood([mid, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }]),
      score: 0,
    }
    setScore(0)
    setGameOver(false)
    setPlaying(true)
  }, [])

  const endGame = useCallback((finalScore) => {
    setPlaying(false)
    setGameOver(true)
    if (finalScore > getBest()) {
      localStorage.setItem(LS_KEY, String(finalScore))
      setBest(finalScore)
    }
  }, [])

  useEffect(() => {
    if (!playing) return

    const handler = (e) => {
      const d = DIR[e.key]
      if (!d) return
      e.preventDefault()
      const s = stateRef.current
      if (!s) return
      if (s.dir.x + d.x !== 0 || s.dir.y + d.y !== 0) s.nextDir = d
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [playing])

  useEffect(() => {
    if (!playing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const tick = () => {
      const s = stateRef.current
      if (!s) { setPlaying(false); return }

      s.dir = s.nextDir
      const head = s.snake[0]
      const nx = head.x + s.dir.x
      const ny = head.y + s.dir.y

      // Wall collision
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { endGame(s.score); return }

      // Self collision
      if (s.snake.some((seg) => seg.x === nx && seg.y === ny)) { endGame(s.score); return }

      const ate = nx === s.food.x && ny === s.food.y
      s.snake.unshift({ x: nx, y: ny })
      if (!ate) s.snake.pop()
      if (ate) {
        s.score++
        setScore(s.score)
        s.food = randomFood(s.snake)
      }

      // Draw
      ctx.clearRect(0, 0, canvasW, canvasH)
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(0, 0, canvasW, canvasH)

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 0.5
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvasH); ctx.stroke() }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvasW, y * CELL); ctx.stroke() }

      // Food
      ctx.fillStyle = '#f97316'
      ctx.shadowColor = '#f97316'
      ctx.shadowBlur = 8
      ctx.beginPath(); ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0

      // Snake
      s.snake.forEach((seg, i) => {
        const t = i / s.snake.length
        ctx.fillStyle = i === 0 ? '#d946ef' : `oklch(${70 - t * 30}% 0.14 ${280 - t * 60})`
        ctx.shadowColor = i === 0 ? '#d946ef' : 'transparent'
        ctx.shadowBlur = i === 0 ? 6 : 0
        ctx.beginPath(); ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 2); ctx.fill()
      })
      ctx.shadowBlur = 0

      // Score
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '700 10px monospace'
      ctx.fillText(`SCORE ${s.score}`, 6, 14)
      if (s.score > getBest()) {
        ctx.fillStyle = '#f97316'
        ctx.fillText('BEST', canvasW - 36, 14)
      }
    }

    tickRef.current = setInterval(tick, TICK_MS)
    return () => clearInterval(tickRef.current)
  }, [playing, canvasW, canvasH, endGame])

  // Touch swipe
  useEffect(() => {
    if (!playing) return
    const handler = (e) => {
      const touch = e.changedTouches[0]
      if (!touch || !stateRef.current) return
      const dx = touch.clientX - (touch._sx || touch.clientX)
      const dy = touch.clientY - (touch._sy || touch.clientY)
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 10) stateRef.current.nextDir = DIR.ArrowRight
        else if (dx < -10) stateRef.current.nextDir = DIR.ArrowLeft
      } else {
        if (dy > 10) stateRef.current.nextDir = DIR.ArrowDown
        else if (dy < -10) stateRef.current.nextDir = DIR.ArrowUp
      }
    }
    const start = (e) => {
      const t = e.touches[0]
      t._sx = t.clientX; t._sy = t.clientY
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchend', handler, { passive: true })
    return () => {
      window.removeEventListener('touchstart', start)
      window.removeEventListener('touchend', handler)
    }
  }, [playing])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-xl overflow-hidden border border-[var(--glass-border)] clay--inset">
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          className="block touch-none"
          data-cursor="crosshair"
        />
        {(!playing || gameOver) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            {gameOver && (
              <div className="text-center mb-2">
                <p className="font-mono text-[10px] tracking-wider text-[rgba(255,255,255,0.5)]">GAME OVER</p>
                <p className="font-display text-2xl mt-1" style={{ color: '#d946ef' }}>
                  {score}
                </p>
                {score >= best && score > 0 && (
                  <p className="font-mono text-[9px] tracking-wider mt-1" style={{ color: '#f97316' }}>
                    NEW HIGH SCORE
                  </p>
                )}
              </div>
            )}
            <button
              onClick={reset}
              className="clay-btn px-6 py-3 rounded-full font-mono text-xs tracking-wider"
              style={{ color: '#d946ef' }}
            >
              {gameOver ? 'PLAY AGAIN' : 'START'}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3 font-mono text-[9px] tracking-wider text-[var(--ink-faint)]">
        <span className="hidden sm:inline">WASD / ARROWS MOVE</span>
        <span className="sm:hidden">SWIPE TO MOVE</span>
        <span>EAT 🟠 GROW</span>
      </div>
    </div>
  )
}
