import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../../contexts/GameContext.jsx'
import { onFrame } from '../../lib/raf.js'
import { getStore, setStore } from '../../lib/store.js'
import { createHitstop, createShake, createParticles, createInputForgiveness } from '../../lib/juice.js'

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

/*
 * §6.2 — combo. Coins collected without hitting an obstacle multiply score:
 * x1 -> x2 at 5 -> x3 at 12 -> x5 at 25. Resets on hit. This is the single
 * change that creates a reason to keep playing past the first obstacle —
 * everything else on this list is polish around a loop that, without this,
 * has no escalating stake.
 */
const comboMultiplier = (streak) => (streak >= 25 ? 5 : streak >= 12 ? 3 : streak >= 5 ? 2 : 1)

/*
 * §6.2 — a difficulty CURVE, not a step function. A fast ramp so the run has
 * teeth early, a plateau so the player gets to feel competent with the speed
 * they just earned before the next squeeze, then a slow climb. Driven by
 * elapsed seconds rather than by score, so a slow, careful run and a
 * coin-rush run face the same pressure at the same wall-clock moment.
 */
const speedForTime = (seconds) => {
  if (seconds < 20) return BASE_SPEED + (5.0 - BASE_SPEED) * (seconds / 20)
  if (seconds < 35) return 5.0
  return Math.min(9.0, 5.0 + (seconds - 35) * ((9.0 - 5.0) / 40))
}

// T-030 — `scores.runner` in the unified store.
const getHighScore = () => getStore().scores.runner || 0

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
      elapsed: 0,
      coins: [],
      particles: [],
      nearMiss: 0,
      // §6.2 — the combo streak: coins collected since the last hit.
      combo: 0,
      grounded: true,
      // §6.1 juice, owned by the game loop, not by React — see juice.js.
      hitstop: createHitstop(),
      shake: createShake({ maxOffsetPx: 6 }),
      burst: createParticles(96),
      jumpForgiveness: createInputForgiveness({ coyoteMs: 100, bufferMs: 120 }),
    }
    setScore(0)
    setGameOver(false)
    setPlaying(true)
  }, [])

  useEffect(() => {
    if (!playing || gameOver) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const tick = (_frameNow, dtMs) => {
      const s = stateRef.current
      if (!s) return
      s.frame++

      // §6.1 — hitstop freezes GAMEPLAY, not the render: the loop keeps
      // drawing every frame (so nothing looks stuck), it just stops
      // advancing anything below while `frozenDt` is 0.
      const frozenDt = s.hitstop.step(dtMs || 16.7)
      s.shake.step(frozenDt / 1000)
      let crashed = false

      if (frozenDt > 0) {
        s.elapsed += frozenDt / 1000
        // §6.2 — a curve, not a step: fast ramp, plateau, slow climb.
        s.speed = speedForTime(s.elapsed)

        if (s.sliding) {
          s.slideTimer--
          if (s.slideTimer <= 0) s.sliding = false
        }

        // §6.1 — coyote time + input buffer: a jump requested up to 100ms
        // after leaving the ground, or up to 120ms before landing, still
        // fires. `grounded` here just means "not mid-jump-arc".
        s.jumpForgiveness.setGrounded(!s.jumping)
        s.jumpForgiveness.step(frozenDt)
        if (s.jumpForgiveness.consumeJump() && !s.sliding) {
          s.jumping = true
          s.vy = JUMP_VEL
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

        const pH0 = s.sliding ? PLAYER_SLIDE_H : PLAYER_H
        const playerLeft0 = 55 + s.lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_W) / 2
        const playerTop0 = CANVAS_H - 40 - pH0 - (s.jumping ? Math.abs(s.y) : 0)

        for (let i = s.obstacles.length - 1; i >= 0; i--) {
          const o = s.obstacles[i]
          o.x -= s.speed
          if (o.x + o.w < 0) { s.obstacles.splice(i, 1); continue }

          if (o.lane === s.lane && o.x < playerLeft0 + PLAYER_W && o.x + o.w > playerLeft0) {
            if (s.sliding && o.tall) continue
            if (s.jumping && o.x + o.w > playerLeft0) continue
            const obstacleTop = CANVAS_H - 40 - o.h
            if (playerTop0 + pH0 > obstacleTop) {
              crashed = true
              // §6.1 — 70ms hitstop, trauma 0.55 shake, a 24-particle radial
              // burst at the point of contact. §6.2 — the combo resets.
              s.hitstop.trigger(70)
              s.shake.add(0.55)
              s.combo = 0
              s.burst.emit(24, playerLeft0 + PLAYER_W / 2, playerTop0 + pH0 / 2, 0, Math.PI * 2, {
                speed: 90, speedVar: 60, life: 0.5, lifeVar: 0.2, size: 2.4, color: 'oklch(65% 0.18 25)', gravity: 220,
              })
              break
            }
          }

          // §6.2 — near-miss: passing within 6px of an obstacle without
          // collision awards +1 and flashes the lane. Rewards skill instead
          // of caution.
          if (o.lane === s.lane && Math.abs(o.x - playerLeft0) < 6 && !o.missed) {
            o.missed = true
            s.nearMiss = 8
            s.score++
            setScore(s.score)
          }
        }

        if (!crashed) {
          for (let i = s.coins.length - 1; i >= 0; i--) {
            const c = s.coins[i]
            c.x -= s.speed
            if (c.x < 0) { s.coins.splice(i, 1); continue }
            if (c.lane === s.lane && !c.collected && c.x < playerLeft0 + PLAYER_W && c.x > playerLeft0 - 8) {
              c.collected = true
              s.combo++
              const mult = comboMultiplier(s.combo)
              s.score += mult
              setScore(s.score)
              s.shake.add(0.12)
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
        }

        s.burst.step(frozenDt / 1000)
      }

      const shakeOffset = s.shake.offset()
      ctx.save()
      ctx.translate(shakeOffset.x, shakeOffset.y)
      ctx.rotate((shakeOffset.rotation * Math.PI) / 180)

      ctx.clearRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40)

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

      // Recomputed unconditionally — the player is drawn every frame
      // regardless of whether hitstop froze the simulation this tick.
      const pH = s.sliding ? PLAYER_SLIDE_H : PLAYER_H
      const px = 55 + s.lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_W) / 2
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
      // §6.1 — the crash burst, on its own additive-feeling pass.
      s.burst.draw(ctx)

      /*
       * §6.2 — read: score, combo and speed in three separate corners with
       * different type sizes, not one flat mono line. The combo multiplier
       * only appears once it is above x1 — a visible "x1" reads as a bug
       * ("why does this number matter") where its absence reads correctly
       * as "nothing special yet".
       */
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '700 11px monospace'
      ctx.fillText(`${s.score}`, 8, 18)
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '700 8px monospace'
      ctx.fillText('COINS', 8, 27)
      const mult = comboMultiplier(s.combo)
      if (mult > 1) {
        ctx.fillStyle = 'oklch(80% 0.16 85)'
        ctx.font = '700 10px monospace'
        ctx.fillText(`x${mult} COMBO`, 8, 40)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.font = '8px monospace'
      ctx.fillText(`SPD ${s.speed.toFixed(1)}`, CANVAS_W - 56, 28)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.fillText(`HI ${Math.max(s.score, getHighScore())}`, CANVAS_W - 48, 16)

      ctx.restore() // matches the shake ctx.save() above

      // Only after the crash frame has actually drawn — with the shake and
      // the burst both visible in it — does the run actually end.
      if (crashed) {
        const finalScore = s.score
        if (finalScore > getHighScore()) {
          setStore({ scores: { runner: finalScore } })
          setHighScore(finalScore)
        }
        setGameOver(true)
        setPlaying(false)
        if (finalScore >= 20) unlock('high-scorer')
      }
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
    // §6.1 — the press is only RECORDED here; `tick` decides whether it was
    // eligible (grounded now, or within the coyote window) and fires it.
    // Sliding still blocks it outright — you cannot jump out of a slide.
    else if (action === 'jump' && !s.sliding) s.jumpForgiveness.pressJump()
    else if (action === 'slide' && !s.jumping && !s.sliding) {
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
                <p className="font-mono text-[12px] tracking-wider text-[rgba(255,255,255,0.5)]">GAME OVER</p>
                <p className="font-display text-2xl mt-1" style={{ color: 'oklch(80% 0.14 145)' }}>
                  {score} coins
                </p>
                {score >= highScore && score > 0 && (
                  <p className="font-mono text-[12px] tracking-wider mt-1" style={{ color: 'oklch(80% 0.16 85)' }}>
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
      {/*
        D-39 — real buttons, not only a swipe.

        A swipe is not recognised until the finger lifts, so in a game whose
        obstacles arrive every few hundred milliseconds the input lands after
        the moment it was aimed at. The swipe handler above is kept as an
        accelerator; this is the control. `onPointerDown` rather than
        `onClick`, because the difference between the two is a whole frame of
        reaction time.
      */}
      <div className="runner-pad" role="group" aria-label="Runner controls">
        <button type="button" className="snake-pad__btn" onPointerDown={() => applyAction('left')} aria-label="Move left" disabled={!playing || gameOver}>◀</button>
        <button type="button" className="snake-pad__btn" onPointerDown={() => applyAction('jump')} aria-label="Jump" disabled={!playing || gameOver}>▲</button>
        <button type="button" className="snake-pad__btn" onPointerDown={() => applyAction('slide')} aria-label="Slide" disabled={!playing || gameOver}>▼</button>
        <button type="button" className="snake-pad__btn" onPointerDown={() => applyAction('right')} aria-label="Move right" disabled={!playing || gameOver}>▶</button>
      </div>
      <div className="flex flex-wrap justify-center gap-3 font-mono text-[12px] tracking-wider text-[var(--ink-low)]">
        <span className="hidden sm:inline">← → LANE</span>
        <span className="hidden sm:inline">↑ / SPACE JUMP</span>
        <span className="hidden sm:inline">↓ SLIDE</span>
        <span className="sm:hidden">TAP THE PAD OR SWIPE</span>
      </div>
    </div>
  )
}
