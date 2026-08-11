/**
 * juice.js — §6.1. The five effects that make a canvas game feel like a game.
 *
 * Deliberately a plain module with no React and no framer-motion: every game
 * here drives its own canvas from an already-tight requestAnimationFrame
 * loop (via `raf.js`'s single `onFrame`), and a re-render per particle would
 * be the opposite of the point. Every effect is built to cost nothing when
 * `prefersReducedMotion()` is true — juice IS motion, and the site's own
 * rule is that motion is a preference, not a feature a visitor cannot turn
 * off.
 *
 * Every factory returns a small stateful object with `step(dt)` (advance by
 * `dt` seconds) and whatever read/trigger methods that effect needs — no
 * class hierarchy, no shared base, because the five things below share
 * nothing but the file they live in.
 */
import { prefersReducedMotion } from './raf.js'

// ── 1. Hitstop ──────────────────────────────────────────────────────────────
// 60-80ms of frozen game time on a consequential event — not a frozen
// FRAME (the render loop keeps running so nothing looks stuck), but frozen
// SIMULATION: the caller stops advancing physics/position for the duration.
// The micro-pause is what gives the player's brain a beat to register that
// something happened, and it is the single highest-impact effect on this
// list for the cost of one countdown.
export function createHitstop() {
  let remaining = 0
  return {
    /** True while time should NOT advance for gameplay purposes. */
    get active() { return remaining > 0 },
    trigger(ms = 70) {
      if (prefersReducedMotion()) return
      remaining = Math.max(remaining, ms)
    },
    /** Call once per frame with the raw frame delta, in ms. Returns the
     *  delta the CALLER should actually simulate with — 0 while frozen. */
    step(dtMs) {
      if (remaining <= 0) return dtMs
      remaining -= dtMs
      return 0
    },
  }
}

// ── 2. Screen shake ──────────────────────────────────────────────────────────
// Trauma-based, not duration-based (Squirrel Eiserloh, GDC 2016): `trauma`
// decays at a fixed rate and the offset is `trauma^2 * maxOffset * noise(t)`.
// Squaring is what makes a small hit barely shake and a big one slam — a
// LINEAR shake reads as a rattle at every magnitude, because the difference
// between a 0.2 and a 0.4 trauma value is nearly invisible without the curve.
// Capped at 8px: past that it reads as nausea, not impact.
export function createShake({ maxOffsetPx = 8, decayPerSec = 1.6 } = {}) {
  let trauma = 0
  let t = 0
  const seed = Math.random() * 1000
  // A cheap 1-D noise: three summed sines at incommensurate frequencies is
  // smoother than pure random jitter (which reads as flicker, not shake)
  // and costs nothing extra per axis.
  const noise = (time, offset) => {
    const x = time * 11.3 + offset
    return (Math.sin(x) * 0.5 + Math.sin(x * 2.7 + 1.3) * 0.3 + Math.sin(x * 5.1 + 2.6) * 0.2)
  }
  return {
    get trauma() { return trauma },
    /** Add trauma, 0..1. Additive, clamped — a second hit while shaking
     *  compounds rather than resets. */
    add(amount) {
      if (prefersReducedMotion()) return
      trauma = Math.min(1, trauma + amount)
    },
    step(dtSec) {
      t += dtSec
      if (trauma > 0) trauma = Math.max(0, trauma - decayPerSec * dtSec)
    },
    /** The offset to add to the camera/canvas transform this frame. */
    offset() {
      if (trauma <= 0) return { x: 0, y: 0, rotation: 0 }
      const k = trauma * trauma
      return {
        x: noise(t, seed) * k * maxOffsetPx,
        y: noise(t, seed + 41.7) * k * maxOffsetPx,
        rotation: noise(t, seed + 83.1) * k * 3, // degrees
      }
    },
  }
}

// ── 3. Particles ─────────────────────────────────────────────────────────────
// A fixed-size pool, no allocation after construction — every particle slot
// is reused, so a long play session never grows the array or triggers GC
// churn from the particle system itself. Particles erupt ALONG the vector of
// the triggering event, because directionality is what separates "impact"
// from "confetti": a coin picked up mid-run should spray upward-and-back,
// not in a uniform ring.
export function createParticles(capacity = 256) {
  const pool = Array.from({ length: capacity }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff',
  }))
  let cursor = 0

  return {
    /**
     * @param {number} n how many
     * @param {number} x origin
     * @param {number} y origin
     * @param {number} dirAngle radians — the vector this burst erupts along
     * @param {number} spread radians — how wide a fan around `dirAngle`
     * @param {object} [opts]
     */
    emit(n, x, y, dirAngle, spread, opts = {}) {
      if (prefersReducedMotion()) return
      const { speed = 120, speedVar = 60, life = 0.5, lifeVar = 0.2, size = 2, color = '#fff', gravity = 0 } = opts
      for (let i = 0; i < n; i++) {
        const p = pool[cursor]
        cursor = (cursor + 1) % capacity
        const angle = dirAngle + (Math.random() - 0.5) * spread
        const spd = speed + (Math.random() - 0.5) * speedVar
        p.active = true
        p.x = x; p.y = y
        p.vx = Math.cos(angle) * spd
        p.vy = Math.sin(angle) * spd
        p.gravity = gravity
        p.life = 0
        p.maxLife = life + (Math.random() - 0.5) * lifeVar
        p.size = size
        p.color = color
      }
    },
    step(dtSec) {
      for (const p of pool) {
        if (!p.active) continue
        p.life += dtSec
        if (p.life >= p.maxLife) { p.active = false; continue }
        p.vy += (p.gravity || 0) * dtSec
        p.x += p.vx * dtSec
        p.y += p.vy * dtSec
      }
    },
    /** @param {CanvasRenderingContext2D} ctx */
    draw(ctx) {
      for (const p of pool) {
        if (!p.active) continue
        const a = 1 - p.life / p.maxLife
        ctx.globalAlpha = Math.max(0, a)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    },
  }
}

// ── 4. Squash & stretch ──────────────────────────────────────────────────────
// scaleY compresses on landing, scaleX stretches on launch, both recovering
// toward 1 over ~120ms. Two floats, no allocation — call `trigger()` on the
// event and read `[sx, sy]` every frame.
export function createSquash({ recoverMs = 120 } = {}) {
  let sx = 1
  let sy = 1
  let elapsed = recoverMs
  let fromSx = 1
  let fromSy = 1
  return {
    /** `axis: 'land' | 'launch'`, `amount` 0..1 (how hard). */
    trigger(axis = 'land', amount = 0.3) {
      if (prefersReducedMotion()) return
      elapsed = 0
      if (axis === 'land') { fromSx = 1 + amount; fromSy = 1 - amount }
      else { fromSx = 1 - amount * 0.6; fromSy = 1 + amount * 0.6 }
    },
    step(dtMs) {
      elapsed = Math.min(recoverMs, elapsed + dtMs)
      const k = recoverMs > 0 ? elapsed / recoverMs : 1
      // ease-out cubic back toward 1,1
      const e = 1 - Math.pow(1 - k, 3)
      sx = fromSx + (1 - fromSx) * e
      sy = fromSy + (1 - fromSy) * e
    },
    get scale() { return [sx, sy] },
  }
}

// ── 5. Input forgiveness ─────────────────────────────────────────────────────
// COYOTE TIME: a jump pressed up to `coyoteMs` after leaving the ground still
// counts as grounded. INPUT BUFFER: a jump pressed up to `bufferMs` before
// landing still fires the instant the ground is reached. Neither is a cheat
// — both remove the class of failure a player correctly feels was not their
// fault (a frame-perfect input demand), which is the difference between a
// game that is hard and one that is unfair.
export function createInputForgiveness({ coyoteMs = 100, bufferMs = 120 } = {}) {
  let sinceGrounded = Infinity // ms since the player was last on the ground
  let sinceJumpPressed = Infinity // ms since jump was last pressed

  return {
    /** Call every frame with whether the player is grounded RIGHT NOW. */
    setGrounded(isGrounded) {
      if (isGrounded) sinceGrounded = 0
    },
    /** Call when the jump input fires. */
    pressJump() { sinceJumpPressed = 0 },
    step(dtMs) {
      if (sinceGrounded < Infinity) sinceGrounded += dtMs
      if (sinceJumpPressed < Infinity) sinceJumpPressed += dtMs
    },
    /** True the one frame a buffered/coyote jump should actually execute.
     *  Consumes both windows so it does not fire twice for one press. */
    consumeJump() {
      const eligible = sinceGrounded <= coyoteMs && sinceJumpPressed <= bufferMs
      if (eligible) { sinceGrounded = Infinity; sinceJumpPressed = Infinity }
      return eligible
    },
  }
}
