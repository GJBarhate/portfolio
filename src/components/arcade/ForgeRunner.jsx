import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'
import { onFrame } from '../../lib/raf.js'

const LANES = [0, 1, 2]
const LANE_WIDTH = 70
const CANVAS_W = 240
const CANVAS_H = 360
const PLAYER_W = 28
const PLAYER_H = 36
const PLAYER_SLIDE_H = 16
const GRAVITY = 0.5
const JUMP_VEL = -9
const BASE_SPEED = 3
const SLIDE_DURATION = 20

const LS_KEY = 'forge-runner-highscore'

function getHighScore() {
  try { return parseInt(localStorage.getItem(LS_KEY)) || 0 } catch { return 0 }
}

export default function ForgeRunner() {
  const canvasRef = useRef(null)
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(getHighScore)
  const [gameOver, setGameOver] = useState(false)
  const [playing, setPlaying] = useState(false)
  const stateRef = useRef(null)
  const { unlock } = useGame()

  const reset = useCallback(() => {
    stateRef.current = {
      lane: 1,
      y: 0,
      vy: 0,
      jumping: false,
      sliding: false,
      slideTimer: 0,
      obstacles: [],
      frame: 0,
      score: 0,
      speed: BASE_SPEED,
      coins: [],
      particles: [],
      nearMiss: 0,
    }
    setScore(0)
    setGameOver(false)
    setPlaying(true)
  }, [])

  useEffect(() => {
    if (!playing || gameOver) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const tick = () => {
      const s = stateRef.current
      if (!s) return
      s.frame++

      if (s.sliding) {
        s.slideTimer--
        if (s.slideTimer <= 0) s.sliding = false
      }

      if (s.jumping) {
        s.vy += GRAVITY
        s.y += s.vy
        if (s.y >= 0) {
          s.y = 0
          s.vy = 0
          s.jumping = false
        }
      }

      if (s.frame % Math.max(18, 55 - Math.floor(s.speed * 3)) === 0) {
        const lane = LANES[Math.floor(Math.random() * LANES.length)]
        const tall = Math.random() > 0.6
        if (!s.obstacles.some((o) => o.lane === lane && o.x > CANVAS_W - 80)) {
          s.obstacles.push({
            lane,
            x: CANVAS_W,
            w: 16 + Math.random() * 12,
            h: tall ? 36 + Math.random() * 12 : 18 + Math.random() * 10,
            tall,
          })
        }
      }

      if (s.frame % 35 === 0) {
        s.coins.push({ lane: LANES[Math.floor(Math.random() * LANES.length)], x: CANVAS_W, collected: false })
      }

      const pH = s.sliding ? PLAYER_SLIDE_H : PLAYER_H
      const playerLeft = 55 + s.lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_W) / 2
      const playerTop = CANVAS_H - 40 - pH - (s.jumping ? Math.abs(s.y) : 0)

      for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i]
        o.x -= s.speed
        if (o.x + o.w < 0) { s.obstacles.splice(i, 1); continue }

        if (o.lane === s.lane && o.x < playerLeft + PLAYER_W && o.x + o.w > playerLeft) {
          if (s.sliding && o.tall) continue
          if (s.jumping && o.x + o.w > playerLeft) continue
          const obstacleTop = CANVAS_H - 40 - o.h
          if (playerTop + pH > obstacleTop) {
            const finalScore = s.score
            if (finalScore > getHighScore()) {
              localStorage.setItem(LS_KEY, String(finalScore))
              setHighScore(finalScore)
            }
            setGameOver(true)
            setPlaying(false)
            if (finalScore >= 20) unlock('high-scorer')
            return
          }
        }

        if (o.lane === s.lane && Math.abs(o.x - playerLeft) < 8 && !o.missed) {
          o.missed = true
          s.nearMiss = 8
        }
      }

      for (let i = s.coins.length - 1; i >= 0; i--) {
        const c = s.coins[i]
        c.x -= s.speed
        if (c.x < 0) { s.coins.splice(i, 1); continue }
        if (c.lane === s.lane && !c.collected && c.x < playerLeft + PLAYER_W && c.x > playerLeft - 8) {
          c.collected = true
          s.score++
          setScore(s.score)
          if (s.score % 5 === 0) s.speed = Math.min(9, s.speed + 0.25)
          s.particles.push(...Array.from({ length: 4 }, () => ({
            x: c.x, y: CANVAS_H - 90,
            vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4 - 1,
            life: 15,
          })))
        }
      }

      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i]
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--
        if (p.life <= 0) s.particles.splice(i, 1)
      }

      if (s.nearMiss > 0) s.nearMiss--

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      grad.addColorStop(0, 'oklch(16% 0.02 260)')
      grad.addColorStop(1, 'oklch(8% 0.01 260)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let l = 0; l <= LANES.length; l++) {
        const x = 55 + l * LANE_WIDTH
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke()
      }

      ctx.fillStyle = 'oklch(22% 0.02 145)'
      ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 40)
      ctx.fillStyle = 'oklch(45% 0.12 145)'
      ctx.fillRect(55 + s.lane * LANE_WIDTH, CANVAS_H - 42, LANE_WIDTH, 2)

      const px = playerLeft
      const py = CANVAS_H - 40 - pH - (s.jumping ? Math.abs(s.y) : 0)
      if (s.nearMiss > 0) {
        ctx.save()
        ctx.shadowColor = 'rgba(255,255,255,0.4)'
        ctx.shadowBlur = 12
      }
      ctx.fillStyle = 'oklch(80% 0.14 145)'
      ctx.fillRect(px, py, PLAYER_W, pH)
      ctx.fillStyle = 'oklch(68% 0.11 70)'
      ctx.fillRect(px + 6, py + 4, 16, s.sliding ? 4 : 8)
      if (!s.sliding) {
        ctx.fillStyle = 'oklch(65% 0.14 145)'
        const legSwing = Math.sin(s.frame * 0.3) * 4
        ctx.fillRect(px + 4, py + pH, 7, 6 + (s.jumping ? 0 : legSwing))
        ctx.fillRect(px + PLAYER_W - 11, py + pH, 7, 6 - (s.jumping ? 0 : legSwing))
      }
      if (s.nearMiss > 0) ctx.restore()

      s.obstacles.forEach((o) => {
        const ox = 55 + o.lane * LANE_WIDTH + (LANE_WIDTH - o.w) / 2
        const oy = CANVAS_H - 40 - o.h
        ctx.fillStyle = o.tall ? 'oklch(65% 0.14 25)' : 'oklch(72% 0.14 70)'
        ctx.fillRect(ox, oy, o.w, o.h)
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(ox, oy, o.w, 2)
      })

      s.coins.forEach((c) => {
        if (c.collected) return
        const cx = 55 + c.lane * LANE_WIDTH + LANE_WIDTH / 2
        const cy = CANVAS_H - 40 - 50 + Math.sin(s.frame * 0.08 + c.x) * 6
        ctx.fillStyle = 'oklch(80% 0.16 85)'
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
        ctx.save()
        ctx.shadowColor = 'oklch(80% 0.16 85)'; ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      })

      s.particles.forEach((p) => {
        ctx.globalAlpha = p.life / 15
        ctx.fillStyle = 'oklch(80% 0.16 85)'
        ctx.fillRect(p.x, p.y, 2, 2)
      })
      ctx.globalAlpha = 1

      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '700 9px monospace'
      ctx.fillText(`COINS ${s.score}`, 8, 16)
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '8px monospace'
      ctx.fillText(`SPD ${s.speed.toFixed(1)}`, 8, 28)
      ctx.fillText(`HI ${Math.max(s.score, getHighScore())}`, CANVAS_W - 48, 16)

    }
    // Game loops ride the shared scheduler like everything else, so a
    // hidden tab pauses them for free.
    const stop = onFrame(tick)
    return stop
  }, [playing, gameOver, unlock])

  const applyAction = useCallback((action) => {
    const s = stateRef.current
    if (!s) return
    if (action === 'left') s.lane = Math.max(0, s.lane - 1)
    else if (action === 'right') s.lane = Math.min(2, s.lane + 1)
    else if (action === 'jump' && !s.jumping && !s.sliding) {
      s.jumping = true
      s.vy = JUMP_VEL
    } else if (action === 'slide' && !s.jumping && !s.sliding) {
      s.sliding = true
      s.slideTimer = SLIDE_DURATION
    }
  }, [])

  useEffect(() => {
    if (!playing || gameOver) return
    const handler = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') applyAction('left')
      else if (e.key === 'ArrowRight' || e.key === 'd') applyAction('right')
      else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        e.preventDefault()
        applyAction('jump')
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault()
        applyAction('slide')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [playing, gameOver, applyAction])

  // Touch swipe controls (§6.5) — left/right = lane change, up = jump, down = slide.
  useEffect(() => {
    if (!playing || gameOver) return
    const canvas = canvasRef.current
    if (!canvas) return
    let startX = 0
    let startY = 0
    let tracking = false

    const onTouchStart = (e) => {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      tracking = true
    }
    const onTouchEnd = (e) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      const THRESHOLD = 24
      if (Math.max(absX, absY) < THRESHOLD) return
      if (absX > absY) applyAction(dx > 0 ? 'right' : 'left')
      else applyAction(dy > 0 ? 'slide' : 'jump')
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [playing, gameOver, applyAction])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-xl overflow-hidden border border-[var(--glass-border)] clay--inset">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block touch-none" data-cursor="crosshair" />
        {(!playing || gameOver) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            {gameOver && (
              <div className="text-center mb-2">
                <p className="font-mono text-[10px] tracking-wider text-[rgba(255,255,255,0.5)]">GAME OVER</p>
                <p className="font-display text-2xl mt-1" style={{ color: 'oklch(80% 0.14 145)' }}>
                  {score} coins
                </p>
                {score >= highScore && score > 0 && (
                  <p className="font-mono text-[9px] tracking-wider mt-1" style={{ color: 'oklch(80% 0.16 85)' }}>
                    NEW HIGH SCORE
                  </p>
                )}
              </div>
            )}
            <button
              onClick={reset}
              className="clay-btn px-6 py-3 rounded-full font-mono text-xs tracking-wider"
              style={{ color: 'oklch(80% 0.14 145)' }}
            >
              {gameOver ? 'TRY AGAIN' : 'START RUN'}
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3 font-mono text-[9px] tracking-wider text-[var(--ink-low)]">
        <span className="hidden sm:inline">← → LANE</span>
        <span className="hidden sm:inline">↑ / SPACE JUMP</span>
        <span className="hidden sm:inline">↓ SLIDE</span>
        <span className="sm:hidden">SWIPE ← → LANE · ↑ JUMP · ↓ SLIDE</span>
      </div>
    </div>
  )
}
