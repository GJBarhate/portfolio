import { useCallback, useEffect, useRef, useState } from 'react'
import { getStore, setStore } from '../../lib/store.js'

/**
 * Snake — D-39.
 *
 * The reported bug is that the snake could not be steered on a phone. The
 * cause was in the swipe handler: it stashed the gesture's origin on the
 * `Touch` object itself (`touch._sx = touch.clientX`) and read it back on
 * `touchend`. A `Touch` is a snapshot — the browser constructs fresh ones for
 * every touch event — so the property was always `undefined` by the time it
 * was read, both deltas came out as exactly zero, and neither branch of the
 * comparison could fire. Every swipe was silently discarded.
 *
 * Rewritten around that fix, and around three things the original made
 * impossible on touch:
 *
 *  · **A D-pad.** Swiping is a fine accelerator and a poor primary control for
 *    a game played in ~140 ms ticks — the gesture is not recognised until the
 *    finger lifts, by which time the snake has moved. The pad is the control;
 *    the swipe is the shortcut.
 *  · **An input queue.** One `nextDir` slot means two inputs inside one tick
 *    lose the first, so the very common "up, then immediately right" reads as
 *    a single right turn. Two are buffered now, and each is validated against
 *    the one before it rather than against the snake's current heading.
 *  · **Reversal rejection on touch.** The keyboard path refused a 180° turn;
 *    the swipe path did not, so a downward swipe while travelling up drove the
 *    head into the neck and ended the run instantly.
 *
 * The board also sizes itself to the viewport now (it was a fixed 280px square
 * — a quarter of a phone screen), renders at device pixel ratio, and speeds up
 * as the snake grows, which is the part that makes it a game rather than a
 * demo.
 */

const COLS = 20
const ROWS = 20

/** Tick at the start, tick at full speed, and how many apples separate them. */
const TICK_START_MS = 150
const TICK_FLOOR_MS = 70
const RAMP_OVER = 24

const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }
const LEFT = { x: -1, y: 0 }
const RIGHT = { x: 1, y: 0 }

const KEY_DIR = {
  ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
  w: UP, s: DOWN, a: LEFT, d: RIGHT,
  W: UP, S: DOWN, A: LEFT, D: RIGHT,
}

const opposite = (a, b) => a.x + b.x === 0 && a.y + b.y === 0
const same = (a, b) => a.x === b.x && a.y === b.y

function randomFood(snake) {
  const taken = new Set(snake.map((s) => `${s.x},${s.y}`))
  // 400 cells and a snake that never fills them in practice, so rejection
  // sampling is right — but it is bounded anyway rather than trusting that.
  for (let i = 0; i < 400; i++) {
    const pos = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 }
    if (!taken.has(`${pos.x},${pos.y}`)) return pos
  }
  return { x: 0, y: 0 }
}

// T-030 — `scores.snake` in the unified store.
const getBest = () => getStore().scores.snake || 0

/** Read a live theme token, so the board is in the site's palette. */
function token(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export default function SnakeClassic() {
  const canvasRef = useRef(null)
  const boardRef = useRef(null)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(getBest)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [cell, setCell] = useState(14)
  const stateRef = useRef(null)

  const canvasW = COLS * cell
  const canvasH = ROWS * cell

  /*
   * The board is square and must fit the arcade cabinet on a 320px phone as
   * well as it fits a desktop. Measuring the container rather than reading a
   * media query keeps it correct inside the modal, whose width is not the
   * viewport's.
   */
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const measure = () => {
      const avail = Math.min(el.clientWidth || 320, window.innerHeight * 0.5)
      setCell(Math.max(10, Math.min(20, Math.floor(avail / COLS))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const reset = useCallback(() => {
    const mid = { x: (COLS / 2) | 0, y: (ROWS / 2) | 0 }
    const snake = [
      { x: mid.x, y: mid.y },
      { x: mid.x - 1, y: mid.y },
      { x: mid.x - 2, y: mid.y },
    ]
    stateRef.current = {
      snake,
      dir: RIGHT,
      /** Up to two buffered turns — see the note at the top of the file. */
      queue: [],
      food: randomFood(snake),
      score: 0,
    }
    setScore(0)
    setGameOver(false)
    setPaused(false)
    setPlaying(true)
  }, [])

  const endGame = useCallback((finalScore) => {
    setPlaying(false)
    setPaused(false)
    setGameOver(true)
    if (finalScore > getBest()) {
      setStore({ scores: { snake: finalScore } })
      setBest(finalScore)
    }
  }, [])

  /**
   * Accept a turn from any input — key, swipe or pad button.
   *
   * Validated against the last *queued* direction rather than the snake's
   * current heading: while a turn is waiting to be applied, the heading it
   * must not reverse is that one, not the one still on screen.
   */
  const steer = useCallback((dir) => {
    const s = stateRef.current
    if (!s || !dir) return
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir
    if (opposite(last, dir) || same(last, dir)) return
    if (s.queue.length >= 2) return
    s.queue.push(dir)
  }, [])

  // ── keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return
    const handler = (e) => {
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setPaused((v) => !v)
        return
      }
      const d = KEY_DIR[e.key]
      if (!d) return
      // Arrow keys scroll the page behind the modal otherwise.
      e.preventDefault()
      steer(d)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [playing, steer])

  // ── swipe ───────────────────────────────────────────────────────────────
  /*
   * The origin lives in a ref, which is the whole fix. Listeners are on the
   * board rather than on `window` so a swipe meant for the snake cannot also
   * scroll the cabinet behind it, and `touchmove` is non-passive so the
   * gesture can be claimed.
   */
  useEffect(() => {
    const el = boardRef.current
    if (!el || !playing) return
    const origin = { x: 0, y: 0, live: false }
    const THRESHOLD = 24

    const onStart = (e) => {
      const t = e.touches[0]
      if (!t) return
      origin.x = t.clientX
      origin.y = t.clientY
      origin.live = true
    }
    const onMove = (e) => {
      if (!origin.live) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - origin.x
      const dy = t.clientY - origin.y
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return
      e.preventDefault()
      steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP))
      // Re-origin so a long drag can chain turns without lifting the finger.
      origin.x = t.clientX
      origin.y = t.clientY
    }
    const onEnd = () => { origin.live = false }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [playing, steer])

  // ── the game ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || paused) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Crisp on a phone: back the canvas with real device pixels and scale the
    // drawing space once, rather than drawing a 280px board into 280 CSS px on
    // a 3x display.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvasW * dpr)
    canvas.height = Math.round(canvasH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const palette = {
      board: token('--surface-0', '#0a0a0f'),
      grid: 'color-mix(in oklch, ' + token('--ink', '#fff') + ' 6%, transparent)',
      food: token('--warm', '#f97316'),
      head: token('--accent-bright', '#7fe3e5'),
      body: token('--accent', '#3ac6c9'),
      dim: token('--accent-dim', '#2a8a8c'),
    }

    const draw = () => {
      const s = stateRef.current
      if (!s) return
      ctx.clearRect(0, 0, canvasW, canvasH)
      ctx.fillStyle = palette.board
      ctx.fillRect(0, 0, canvasW, canvasH)

      ctx.strokeStyle = palette.grid
      ctx.lineWidth = 0.5
      ctx.beginPath()
      for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, canvasH) }
      for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * cell); ctx.lineTo(canvasW, y * cell) }
      ctx.stroke()

      ctx.fillStyle = palette.food
      ctx.shadowColor = palette.food
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(s.food.x * cell + cell / 2, s.food.y * cell + cell / 2, cell / 2 - 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      for (let i = s.snake.length - 1; i >= 0; i--) {
        const seg = s.snake[i]
        const head = i === 0
        ctx.fillStyle = head ? palette.head : (i % 2 ? palette.dim : palette.body)
        ctx.shadowColor = head ? palette.head : 'transparent'
        ctx.shadowBlur = head ? 8 : 0
        ctx.beginPath()
        ctx.roundRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, head ? cell / 3 : 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    let timer = null
    const tick = () => {
      const s = stateRef.current
      if (!s) return

      if (s.queue.length) s.dir = s.queue.shift()

      const head = s.snake[0]
      const nx = head.x + s.dir.x
      const ny = head.y + s.dir.y

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { endGame(s.score); return }
      // The tail cell is vacated on this same tick unless the snake is
      // growing, so moving into it is legal — checking the whole body ended
      // runs that should have continued.
      const growing = nx === s.food.x && ny === s.food.y
      const body = growing ? s.snake : s.snake.slice(0, -1)
      if (body.some((seg) => seg.x === nx && seg.y === ny)) { endGame(s.score); return }

      s.snake.unshift({ x: nx, y: ny })
      if (growing) {
        s.score++
        setScore(s.score)
        s.food = randomFood(s.snake)
      } else {
        s.snake.pop()
      }

      draw()
      timer = setTimeout(tick, speedFor(s.score))
    }

    draw()
    timer = setTimeout(tick, speedFor(stateRef.current?.score || 0))
    return () => clearTimeout(timer)
  }, [playing, paused, cell, canvasW, canvasH, endGame])

  const showOverlay = !playing || gameOver || paused

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center justify-between w-full max-w-[380px] font-mono text-[12px] tracking-[0.2em] text-[var(--ink-low)]">
        <span>SCORE <b className="text-[var(--accent-bright)]">{score}</b></span>
        <span>BEST <b className="text-[var(--warm)]">{best}</b></span>
      </div>

      <div
        ref={boardRef}
        className="snake-board relative rounded-xl overflow-hidden border border-[var(--glass-border)] clay--inset w-full max-w-[380px] flex justify-center"
      >
        <canvas
          ref={canvasRef}
          style={{ width: canvasW, height: canvasH }}
          className="block touch-none"
          data-cursor="crosshair"
          aria-label={`Snake board, score ${score}`}
          role="img"
        />
        {showOverlay && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-4 text-center">
            {gameOver && (
              <div className="mb-1">
                <p className="font-mono text-[12px] tracking-wider text-[rgba(255,255,255,0.5)]">GAME OVER</p>
                <p className="font-display text-2xl mt-1 text-[var(--accent-bright)]">{score}</p>
                {score >= best && score > 0 && (
                  <p className="font-mono text-[12px] tracking-wider mt-1 text-[var(--warm)]">NEW HIGH SCORE</p>
                )}
              </div>
            )}
            {paused && !gameOver && (
              <p className="font-mono text-[12px] tracking-[0.3em] text-[rgba(255,255,255,0.6)]">PAUSED</p>
            )}
            <button
              type="button"
              onClick={paused && !gameOver ? () => setPaused(false) : reset}
              className="clay-btn px-6 py-3 rounded-full font-mono text-xs tracking-wider text-[var(--accent-bright)]"
            >
              {gameOver ? 'PLAY AGAIN' : paused ? 'RESUME' : 'START'}
            </button>
          </div>
        )}
      </div>

      {/*
        D-39 — the control that makes this playable without a keyboard. It is
        shown to everyone rather than gated on a touch media query: a hybrid
        laptop has both, and a pad nobody needs costs one row of buttons while
        a pad that fails to appear costs the game.
      */}
      <div className="snake-pad" role="group" aria-label="Direction controls">
        <button type="button" className="snake-pad__btn snake-pad__btn--up" onPointerDown={() => steer(UP)} aria-label="Up">▲</button>
        <button type="button" className="snake-pad__btn snake-pad__btn--left" onPointerDown={() => steer(LEFT)} aria-label="Left">◀</button>
        <button
          type="button"
          className="snake-pad__btn snake-pad__btn--mid"
          onPointerDown={() => (playing ? setPaused((v) => !v) : reset())}
          aria-label={playing ? (paused ? 'Resume' : 'Pause') : 'Start'}
        >
          {playing && !paused ? '❚❚' : '▶'}
        </button>
        <button type="button" className="snake-pad__btn snake-pad__btn--right" onPointerDown={() => steer(RIGHT)} aria-label="Right">▶</button>
        <button type="button" className="snake-pad__btn snake-pad__btn--down" onPointerDown={() => steer(DOWN)} aria-label="Down">▼</button>
      </div>

      <p className="font-mono text-[12px] tracking-wider text-[var(--ink-low)] text-center">
        <span className="hidden sm:inline">ARROWS / WASD &middot; SPACE PAUSES &middot; </span>
        <span className="sm:hidden">TAP THE PAD OR SWIPE &middot; </span>
        EAT TO GROW
      </p>
    </div>
  )
}

/** Faster as the snake grows, with a floor so it stays humanly playable. */
function speedFor(score) {
  const t = Math.min(1, score / RAMP_OVER)
  return Math.round(TICK_START_MS + (TICK_FLOOR_MS - TICK_START_MS) * t)
}
