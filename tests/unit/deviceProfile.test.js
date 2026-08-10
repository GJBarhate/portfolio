import { describe, it, expect } from 'vitest'
import { resolveTier } from '../../src/lib/deviceProfile.js'

/**
 * deviceProfile.test.js — T-007.
 *
 * `resolveTier` is deliberately a pure function of its signals, separate from
 * the browser probe that gathers them, precisely so this file can exist. The
 * defect it exists to prevent is the one it replaced: a gate that read
 * `hardwareConcurrency >= 4` and therefore admitted every phone sold since
 * 2019, including the ones that then ran the page at 20 fps.
 */

const base = {
  cores: 8,
  memory: 8,
  effectiveType: '4g',
  saveData: false,
  reducedMotion: false,
  renderer: 'ANGLE (NVIDIA GeForce RTX 3060)',
  measuredMs: 0.4,
}

describe('resolveTier', () => {
  it('gives a capable desktop tier 3', () => {
    expect(resolveTier(base).tier).toBe(3)
  })

  it('never puts a device above tier 3', () => {
    expect(resolveTier({ ...base, cores: 64, memory: 64, measuredMs: 0.01 }).tier).toBeLessThanOrEqual(3)
  })

  /*
   * D-46 — reduced motion caps the tier; it does not switch the graphics off.
   *
   * This asserted `tier === 0`, and that assertion was the bug: tier 0 means
   * no WebGL, so every visitor whose OS had "show animations" off — which on
   * Windows is a single unrelated-looking toggle — lost the background engine
   * entirely and saw one flat gradient behind all eight sections instead of
   * eight motifs. The preference is about movement, and it is honoured by
   * freezing the shader clock in BackgroundEngine rather than by refusing to
   * draw. Only an explicit `Motion: off` still means nothing at all.
   */
  it('caps at tier 2 when motion is reduced, keeping the motifs', () => {
    const profile = resolveTier({ ...base, reducedMotion: true })
    expect(profile.tier).toBe(2)
    expect(profile.reasons.join(' ')).toMatch(/reduced-motion/)
  })

  it('drops to 0 only when motion is turned off outright', () => {
    expect(resolveTier({ ...base, reducedMotion: true, motionOff: true }).tier).toBe(0)
  })

  it('drops to 0 when data is being rationed', () => {
    expect(resolveTier({ ...base, saveData: true }).tier).toBe(0)
  })

  it('demotes a four-core phone to tier 2 — the exact case the old gate let through', () => {
    // hardwareConcurrency >= 4 used to be the whole test, and this device
    // passed it.
    const profile = resolveTier({ ...base, cores: 4, memory: 4, measuredMs: 0.5 })
    expect(profile.tier).toBe(2)
  })

  it('demotes on low memory regardless of core count', () => {
    expect(resolveTier({ ...base, cores: 8, memory: 2 }).tier).toBeLessThanOrEqual(1)
  })

  it('demotes on a known-weak GPU', () => {
    const profile = resolveTier({ ...base, renderer: 'Mali-G52 MC2' })
    expect(profile.tier).toBeLessThanOrEqual(1)
    expect(profile.reasons.join(' ')).toMatch(/known-weak GPU/)
  })

  it('lets the measurement override every proxy', () => {
    // Everything on paper says "fast"; the actual shader says otherwise, and
    // the measurement is the only signal that is not a guess.
    const profile = resolveTier({ ...base, measuredMs: 4.2 })
    expect(profile.tier).toBeLessThanOrEqual(1)
    expect(profile.reasons.join(' ')).toMatch(/probe/)
  })

  it('a merely slow reading stops at tier 2 — it may not switch WebGL off', () => {
    // The probe runs after LCP, while the page is already driving four
    // canvases, so it measures throughput under contention it created itself.
    // One such sample reaching tier 1 froze the hero gem and the desk scene
    // mid-air permanently. Slow demotes to 2; only the hopeless reaches 1.
    const profile = resolveTier({ ...base, measuredMs: 2.6 })
    expect(profile.tier).toBe(2)
    expect(profile.reasons.join(' ')).toMatch(/probe/)
  })

  it('demotes when WebGL is unavailable so the probe could not run', () => {
    expect(resolveTier({ ...base, measuredMs: null }).tier).toBeLessThanOrEqual(1)
  })

  it('demotes on a 2g connection', () => {
    expect(resolveTier({ ...base, effectiveType: 'slow-2g' }).tier).toBeLessThanOrEqual(1)
  })

  it('always explains itself', () => {
    for (const signals of [base, { ...base, reducedMotion: true }, { ...base, cores: 2 }]) {
      expect(resolveTier(signals).reasons.length).toBeGreaterThan(0)
    }
  })

  it('takes the lowest verdict, not the last one', () => {
    // A device with one fatal signal and several good ones is not "mostly ok".
    const profile = resolveTier({ ...base, memory: 2, cores: 8, measuredMs: 0.2 })
    expect(profile.tier).toBeLessThanOrEqual(1)
  })
})
