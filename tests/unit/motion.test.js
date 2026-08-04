import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * motion.test.js — T-025.
 *
 * The scalar replaced 38 hand-written `@media (prefers-reduced-motion)`
 * blocks. What has to hold for that trade to be sound:
 *
 *   · `system` resolves against the OS
 *   · an explicit visitor choice OUTRANKS the OS in both directions — someone
 *     who has set reduce system-wide and then asks this page for full motion
 *     has said something more specific than their OS did
 *   · the scale reaches exactly 0, because a zero-duration transition is what
 *     "no animation" means without an override to write
 */

async function fresh(reducedMotion = false) {
  vi.resetModules()
  localStorage.clear()
  window.matchMedia = (query) => ({
    media: query,
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  })
  delete document.documentElement.dataset.motion
  return import('../../src/lib/motion.js')
}

beforeEach(() => {
  localStorage.clear()
})

describe('resolveMotionMode', () => {
  it('follows the OS when the mode is `system`', async () => {
    const off = await fresh(true)
    expect(off.resolveMotionMode('system')).toBe('off')

    const on = await fresh(false)
    expect(on.resolveMotionMode('system')).toBe('full')
  })

  it('lets an explicit choice outrank the OS — in both directions', async () => {
    const m = await fresh(true)
    expect(m.resolveMotionMode('full')).toBe('full')
    expect(m.resolveMotionMode('reduced')).toBe('reduced')

    const m2 = await fresh(false)
    expect(m2.resolveMotionMode('off')).toBe('off')
  })

  it('treats an unknown mode as `system`', async () => {
    const m = await fresh(true)
    expect(m.resolveMotionMode('sideways')).toBe('off')
  })
})

describe('the scalars', () => {
  it('reaches exactly zero, not nearly zero', async () => {
    const m = await fresh(false)
    m.setMotionMode('off')
    expect(m.motionScalars().scale).toBe(0)
    expect(m.motionScalars().distance).toBe(0)
    expect(m.motionOff()).toBe(true)
  })

  it('halves time and cuts travel further at `reduced`', async () => {
    const m = await fresh(false)
    m.setMotionMode('reduced')
    // Distance is cut harder than duration on purpose: most people asking for
    // reduced motion object to travel, not to fades.
    expect(m.motionScalars().scale).toBe(0.5)
    expect(m.motionScalars().distance).toBeLessThan(m.motionScalars().scale)
  })

  it('scales a duration', async () => {
    const m = await fresh(false)
    m.setMotionMode('reduced')
    expect(m.scaled(400)).toBe(200)
    m.setMotionMode('off')
    expect(m.scaled(400)).toBe(0)
  })
})

describe('applyMotionMode', () => {
  it('writes the attribute the stylesheet reads', async () => {
    const m = await fresh(false)
    m.applyMotionMode('reduced')
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })

  it('writes NO attribute for `system`, so the media query stays in charge', async () => {
    const m = await fresh(false)
    m.applyMotionMode('off')
    m.applyMotionMode('system')
    expect(document.documentElement.dataset.motion).toBeUndefined()
  })
})

describe('setMotionMode', () => {
  it('persists to the unified store', async () => {
    const m = await fresh(false)
    m.setMotionMode('off')
    expect(JSON.parse(localStorage.getItem('forge:v1')).motion).toBe('off')
  })

  it('falls back to `system` for a value that is not a mode', async () => {
    const m = await fresh(false)
    m.setMotionMode('nonsense')
    expect(JSON.parse(localStorage.getItem('forge:v1')).motion).toBe('system')
  })
})

describe('the easing table', () => {
  it('still exports the curves the components import', async () => {
    const m = await fresh(false)
    for (const name of ['EASE_FORGE', 'EASE_OUT_EXPO', 'EASE_IN_OUT', 'EASE_SNAP']) {
      expect(Array.isArray(m[name]), name).toBe(true)
      expect(m[name]).toHaveLength(4)
    }
    expect(m.DURATIONS.reveal).toBeGreaterThan(0)
  })
})
