/**
 * P1.1 — the v1 → v2 migration.
 *
 * The migration has to answer one question it cannot know the answer to: was a
 * stored backdrop CHOSEN, or INHERITED from a build that wrote it eagerly?
 * v1 recorded no difference between the two, and the two deserve opposite
 * treatment — preserve forever vs correct once.
 *
 * These tests pin the inference, because it is the kind of logic that looks
 * obviously right and is trivially broken by a later refactor. The three cases
 * in PLAN.md §1.1's Proof are the first three below; the rest close the holes
 * that the plan's three leave open.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const KEY = 'forge:v1'

/** A v1 payload, with whatever the test wants layered on top. */
const v1 = (over = {}) => JSON.stringify({
  version: 1,
  theme: null,
  motion: 'system',
  progress: { unlocked: [] },
  sparks: [],
  scores: {},
  seen: {},
  prefs: { recruiter: false, sound: false, tier: null },
  ...over,
})

/**
 * The store caches its state in a module-level variable, so every case needs a
 * genuinely fresh module. `resetModules` + a dynamic import is the only way to
 * get one; re-importing without it silently reuses the first test's payload.
 */
async function loadStore(raw) {
  localStorage.clear()
  if (raw !== undefined) localStorage.setItem(KEY, raw)
  vi.resetModules()
  return import('../../src/lib/store.js')
}

describe('store v1 → v2 migration', () => {
  beforeEach(() => { localStorage.clear() })

  it('a fresh visitor gets no backdrop preference at all, so the default applies', async () => {
    const { getStore } = await loadStore(undefined)
    const store = await getStore()
    expect(store.prefs.bgScene).toBeUndefined()
    expect(store.prefs.bgSceneExplicit).toBe(false)
  })

  it('a v1 profile with a non-default backdrop and NO other activity is returned to the default', async () => {
    // This is the inherited-write case: something put `calm` in the store and
    // there is no evidence a human was ever involved.
    const { getStore } = await loadStore(v1({ prefs: { bgScene: 'calm' } }))
    const store = await getStore()
    expect(store.prefs.bgScene, 'an inherited backdrop must be dropped').toBeUndefined()
    expect(store.prefs.bgSceneExplicit).toBe(false)
  })

  it('a v1 profile with a non-default backdrop AND collected sparks keeps its choice', async () => {
    const { getStore } = await loadStore(v1({ prefs: { bgScene: 'calm' }, sparks: ['spark-hero'] }))
    const store = await getStore()
    expect(store.prefs.bgScene, 'a real visitor’s choice must survive').toBe('calm')
    expect(store.prefs.bgSceneExplicit).toBe(true)
  })

  // ── the holes the plan's three cases leave open ─────────────────────────

  it('any other evidence of use also counts — unlocked achievements', async () => {
    const { getStore } = await loadStore(v1({
      prefs: { bgScene: 'motifs' },
      progress: { unlocked: ['shapeshifter'] },
    }))
    expect((await getStore()).prefs.bgScene).toBe('motifs')
  })

  it('a stored theme counts as evidence, and marks the theme explicit too', async () => {
    const { getStore } = await loadStore(v1({ theme: 'ember', prefs: { bgScene: 'calm' } }))
    const store = await getStore()
    expect(store.prefs.bgScene).toBe('calm')
    expect(store.prefs.themeExplicit).toBe(true)
  })

  it('`lastVisit` alone is NOT evidence of a choice', async () => {
    // Every visitor gets a `lastVisit`, including one who has never touched a
    // control. Counting it would make the migration a no-op for everybody and
    // quietly defeat its entire purpose.
    const { getStore } = await loadStore(v1({
      prefs: { bgScene: 'calm' },
      seen: { lastVisit: Date.now() },
    }))
    expect((await getStore()).prefs.bgScene).toBeUndefined()
  })

  it('a v1 profile already on the default still resolves to the default', async () => {
    /*
     * The first version of this test asserted that `prefs.bgScene` stayed
     * `'forest'` AND that `bgSceneExplicit` became true. Those are
     * contradictory — the flag is what decides whether the value is kept — and
     * the test was wrong, not the migration.
     *
     * What actually matters here is not which key survives but what the
     * visitor sees, and dropping a stored value that equals the default is
     * indistinguishable from keeping it: `bgScene()` returns DEFAULT_SCENE
     * either way. So the assertion is on the resolved scene, and the flag
     * stays false because landing on the default was never a choice.
     */
    const { getStore } = await loadStore(v1({ prefs: { bgScene: 'forest' } }))
    const store = await getStore()
    expect(store.prefs.bgSceneExplicit, 'the default is not a choice').toBe(false)

    vi.resetModules()
    const { bgScene } = await import('../../src/lib/bgScene.js')
    expect(bgScene(), 'what the visitor actually gets').toBe('forest')
  })

  it('choosing a backdrop after migrating marks it explicit, permanently', async () => {
    const { getStore } = await loadStore(v1({ prefs: { bgScene: 'calm' } }))
    await getStore()
    vi.resetModules()
    const { setBgScene } = await import('../../src/lib/bgScene.js')
    const { getStore: get2 } = await import('../../src/lib/store.js')
    setBgScene('calm')
    const store = await get2()
    expect(store.prefs.bgScene).toBe('calm')
    expect(store.prefs.bgSceneExplicit, 'a human moved the control').toBe(true)
  })

  it('a corrupt payload still yields the documented defaults rather than throwing', async () => {
    const { getStore } = await loadStore('{not json')
    expect((await getStore()).prefs.bgSceneExplicit).toBe(false)
  })
})
