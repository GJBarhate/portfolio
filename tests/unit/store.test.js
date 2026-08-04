import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * store.test.js — T-030.
 *
 * The assertion the plan asks for by name: **a v0 payload upgrades
 * losslessly**. Before the unified store there was no schema version at all,
 * so any change to the shape of `forge-progress` would have silently
 * discarded a returning visitor's achievements, and nothing would have said
 * so. This is the test that makes that impossible.
 */

/** The module keeps process-lifetime state, so each test gets a fresh copy. */
async function freshStore() {
  vi.resetModules()
  return import('../../src/lib/store.js')
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('defaults', () => {
  it('yields the documented shape when nothing is stored', async () => {
    const { getStore, DEFAULTS } = await freshStore()
    const store = getStore()
    expect(store.version).toBe(DEFAULTS.version)
    expect(store.theme).toBeNull()
    expect(store.motion).toBe('system')
    expect(store.progress.unlocked).toEqual([])
    expect(store.sparks).toEqual([])
  })

  it('never throws on a corrupt payload', async () => {
    localStorage.setItem('forge:v1', '{ not json')
    const { getStore } = await freshStore()
    expect(() => getStore()).not.toThrow()
    expect(getStore().progress.unlocked).toEqual([])
  })

  it('never throws when storage itself throws', async () => {
    const throwing = {
      getItem() { throw new Error('SecurityError') },
      setItem() { throw new Error('QuotaExceededError') },
      removeItem() { throw new Error('SecurityError') },
    }
    vi.stubGlobal('localStorage', throwing)
    const { getStore, setStore } = await freshStore()
    expect(() => getStore()).not.toThrow()
    expect(() => setStore({ theme: 'ember' })).not.toThrow()
    expect(getStore().theme).toBe('ember')
    vi.unstubAllGlobals()
  })
})

describe('v0 migration', () => {
  it('carries every legacy key across losslessly', async () => {
    localStorage.setItem('forge-theme', 'eclipse')
    localStorage.setItem('forge-progress', JSON.stringify({ unlocked: ['commander', 'shapeshifter'] }))
    localStorage.setItem('forge-sparks', JSON.stringify(['spark-hero', 'spark-stats']))
    localStorage.setItem('forge-runner-best', '420')
    localStorage.setItem('forge-memory-best', '18')
    localStorage.setItem('forge-ludo-best', 'PeerCode')
    localStorage.setItem('forge-last-visit', '1700000000000')
    sessionStorage.setItem('forge-recruiter', '1')

    const { getStore } = await freshStore()
    const store = getStore()

    expect(store.theme).toBe('eclipse')
    expect(store.progress.unlocked).toEqual(['commander', 'shapeshifter'])
    expect(store.sparks).toEqual(['spark-hero', 'spark-stats'])
    expect(store.scores.runner).toBe(420)
    expect(store.scores.memory).toBe(18)
    expect(store.scores.ludo).toBe('PeerCode')
    expect(store.seen.lastVisit).toBe(1700000000000)
    expect(store.prefs.recruiter).toBe(true)
  })

  it('remaps retired theme ids', async () => {
    localStorage.setItem('forge-theme', 'obsidian')
    const { getStore } = await freshStore()
    expect(getStore().theme).toBe('ember')
  })

  it('deletes the legacy keys only after the new payload is written', async () => {
    localStorage.setItem('forge-theme', 'paper')
    const { getStore } = await freshStore()
    getStore()
    expect(localStorage.getItem('forge:v1')).toBeTruthy()
    expect(localStorage.getItem('forge-theme')).toBeNull()
  })

  it('survives a legacy payload of the wrong shape', async () => {
    localStorage.setItem('forge-progress', '"a string, not an object"')
    localStorage.setItem('forge-sparks', '42')
    const { getStore } = await freshStore()
    expect(getStore().progress.unlocked).toEqual([])
    expect(getStore().sparks).toEqual([])
  })
})

describe('reads and writes', () => {
  it('merges one level deep so a partial patch does not erase siblings', async () => {
    const { setStore, getStore } = await freshStore()
    setStore({ prefs: { recruiter: true } })
    setStore({ prefs: { sound: true } })
    expect(getStore().prefs.recruiter).toBe(true)
    expect(getStore().prefs.sound).toBe(true)
  })

  it('replaces arrays rather than merging them', async () => {
    const { setStore, getStore } = await freshStore()
    setStore({ sparks: ['a', 'b'] })
    setStore({ sparks: ['c'] })
    expect(getStore().sparks).toEqual(['c'])
  })

  it('notifies subscribers and can be unsubscribed', async () => {
    const { subscribe, setStore } = await freshStore()
    const seen = []
    const off = subscribe((state) => seen.push(state.theme))
    setStore({ theme: 'ember' })
    off()
    setStore({ theme: 'paper' })
    expect(seen).toEqual(['ember'])
  })

  it('keeps going when one subscriber throws', async () => {
    const { subscribe, setStore } = await freshStore()
    const seen = []
    subscribe(() => { throw new Error('bad subscriber') })
    subscribe(() => seen.push('ok'))
    expect(() => setStore({ theme: 'ember' })).not.toThrow()
    expect(seen).toEqual(['ok'])
  })
})

describe('one-shot flags', () => {
  it('honours a TTL', async () => {
    const { markSeen, hasSeen } = await freshStore()
    markSeen('intro', Date.now() - 40 * 24 * 60 * 60 * 1000)
    expect(hasSeen('intro', 30 * 24 * 60 * 60 * 1000)).toBe(false)
    expect(hasSeen('intro')).toBe(true)
  })

  it('is false for a flag never set', async () => {
    const { hasSeen } = await freshStore()
    expect(hasSeen('never-happened')).toBe(false)
  })
})

describe('reset', () => {
  it('clears the payload and the legacy keys', async () => {
    localStorage.setItem('forge-theme', 'ember')
    const { getStore, setStore, resetStore } = await freshStore()
    getStore()
    setStore({ sparks: ['spark-hero'] })
    resetStore()
    expect(getStore().sparks).toEqual([])
    expect(localStorage.getItem('forge:v1')).toBeNull()
    expect(localStorage.getItem('forge-theme')).toBeNull()
  })
})
