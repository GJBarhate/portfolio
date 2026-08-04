/**
 * store.js — T-030. One key, one parse, one migration chain.
 *
 * Before this module there were nine persisted keys across `localStorage` and
 * `sessionStorage` — `forge-theme`, `forge-progress`, `forge-sparks`,
 * `forge-intro`, `forge-recruiter`, `forge-last-visit` and three arcade
 * high-score keys — each with its own `try/catch(JSON.parse)` and its own
 * idea of a default. There was no schema version, so any change to the shape
 * of `forge-progress` would have broken every returning visitor permanently
 * and silently.
 *
 * Three rules hold this together:
 *
 *  1. **Every read is total.** A corrupt, absent or partially-written store
 *     yields the documented defaults. This module never throws — Safari in
 *     private mode throws on `localStorage.setItem`, and an easter-egg
 *     counter is not worth a white screen.
 *  2. **The version leads the payload.** `migrate()` is a chain, not a
 *     branch: v0 (the nine loose keys) → v1. Adding v2 means appending one
 *     function, never touching the ones before it.
 *  3. **One writer, many readers.** `subscribe()` lets contexts use
 *     `useSyncExternalStore` instead of each holding a private copy of the
 *     same fact, which is how the theme and the palette used to disagree
 *     about what the theme was for one frame after a change.
 */

export const STORE_KEY = 'forge:v1'
export const SCHEMA_VERSION = 1

/** Legacy keys migrated on first read, then deleted. */
const LEGACY = {
  local: [
    'forge-theme', 'forge-progress', 'forge-sparks', 'forge-last-visit',
    'forge-runner-best', 'forge-snake-best', 'forge-memory-best',
    'forge-ludo-best', 'forge-snakes-best', 'forge-run-best',
  ],
  session: ['forge-intro', 'forge-recruiter'],
}

/**
 * The documented shape. Anything not here does not persist.
 *
 * `theme: null` means "no explicit choice yet" — which is what lets T-034
 * follow `prefers-color-scheme` on a first visit without overriding a
 * visitor who has actually picked one.
 */
export const DEFAULTS = {
  version: SCHEMA_VERSION,
  /** 'eclipse' | 'ember' | 'paper' | 'system' | null */
  theme: null,
  /** 'system' | 'full' | 'reduced' | 'off' — T-025 */
  motion: 'system',
  progress: { unlocked: [] },
  sparks: [],
  scores: {},
  /** One-shot flags with timestamps: intro, coachmark, welcome, … */
  seen: {},
  prefs: { recruiter: false, sound: false, tier: null },
}

// ── storage access, never throwing ────────────────────────────────────────

const safeLocal = {
  get(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null } catch { return null }
  },
  set(key, value) {
    try { globalThis.localStorage?.setItem(key, value); return true } catch { return false }
  },
  remove(key) {
    try { globalThis.localStorage?.removeItem(key) } catch { /* private mode */ }
  },
}

const safeSession = {
  get(key) {
    try { return globalThis.sessionStorage?.getItem(key) ?? null } catch { return null }
  },
  set(key, value) {
    try { globalThis.sessionStorage?.setItem(key, value); return true } catch { return false }
  },
  remove(key) {
    try { globalThis.sessionStorage?.removeItem(key) } catch { /* private mode */ }
  },
}

export { safeLocal, safeSession }

// ── migrations ────────────────────────────────────────────────────────────

/** Old theme ids that were retired when the palette went to three. */
const THEME_REMAP = {
  forest: 'eclipse', ocean: 'eclipse', golden: 'ember',
  obsidian: 'ember', dawn: 'paper',
}

const parseJson = (raw, fallback) => {
  if (raw == null) return fallback
  try {
    const value = JSON.parse(raw)
    return value == null ? fallback : value
  } catch { return fallback }
}

/**
 * v0 → v1: gather the nine loose keys into one payload. Runs once; the
 * legacy keys are deleted afterwards so a later downgrade cannot resurrect a
 * stale value and quietly win over the new one.
 */
function migrateV0() {
  const savedTheme = safeLocal.get('forge-theme')
  const theme = savedTheme ? (THEME_REMAP[savedTheme] || savedTheme) : null

  const progress = parseJson(safeLocal.get('forge-progress'), null)
  const sparks = parseJson(safeLocal.get('forge-sparks'), null)

  const num = (key) => {
    const n = parseInt(safeLocal.get(key), 10)
    return Number.isFinite(n) ? n : undefined
  }

  const scores = {}
  const runner = num('forge-runner-best'); if (runner !== undefined) scores.runner = runner
  const snake = num('forge-snake-best'); if (snake !== undefined) scores.snake = snake
  const memory = num('forge-memory-best'); if (memory !== undefined) scores.memory = memory
  const snakes = num('forge-snakes-best'); if (snakes !== undefined) scores.snakes = snakes
  const run = num('forge-run-best'); if (run !== undefined) scores.run = run
  const ludo = safeLocal.get('forge-ludo-best'); if (ludo) scores.ludo = ludo

  const lastVisit = num('forge-last-visit')
  const seen = {}
  if (lastVisit !== undefined) seen.lastVisit = lastVisit
  // The intro flag was per-session; T-031 makes it per-visitor with a TTL, so
  // an in-flight session is honoured but not extended.
  if (safeSession.get('forge-intro') === '1') seen.intro = Date.now()

  const prefs = { ...DEFAULTS.prefs }
  if (safeSession.get('forge-recruiter') === '1') prefs.recruiter = true

  const migrated = {
    ...structuredCloneish(DEFAULTS),
    version: 1,
    theme,
    progress: progress && Array.isArray(progress.unlocked) ? progress : DEFAULTS.progress,
    sparks: Array.isArray(sparks) ? sparks : [],
    scores,
    seen,
    prefs,
  }

  return migrated
}

/**
 * Deleting the legacy keys is deliberately *not* part of reading them. It
 * happens only after the unified payload has been written back, so a browser
 * that refuses the write (private mode) keeps the old data rather than losing
 * both copies.
 */
export function dropLegacy() {
  for (const key of LEGACY.local) safeLocal.remove(key)
  for (const key of LEGACY.session) safeSession.remove(key)
}

/** Small structural clone — `structuredClone` is not in every test env. */
function structuredCloneish(value) {
  return JSON.parse(JSON.stringify(value))
}

/** Fill in anything a newer default added that an older payload lacks. */
function withDefaults(value) {
  const out = { ...structuredCloneish(DEFAULTS), ...value }
  out.progress = { ...DEFAULTS.progress, ...(value.progress || {}) }
  out.prefs = { ...DEFAULTS.prefs, ...(value.prefs || {}) }
  out.seen = { ...(value.seen || {}) }
  out.scores = { ...(value.scores || {}) }
  out.sparks = Array.isArray(value.sparks) ? value.sparks : []
  out.version = SCHEMA_VERSION
  return out
}

/**
 * The migration chain. Index N upgrades a vN payload to v(N+1).
 * Exported for the unit test that proves a v0 payload upgrades losslessly.
 */
export const MIGRATIONS = []

export function readRaw() {
  const raw = safeLocal.get(STORE_KEY)
  if (raw == null) return migrateV0()

  const parsed = parseJson(raw, null)
  if (!parsed || typeof parsed !== 'object') return structuredCloneish(DEFAULTS)

  let value = parsed
  let version = Number.isFinite(parsed.version) ? parsed.version : 0
  while (version < SCHEMA_VERSION && MIGRATIONS[version]) {
    value = MIGRATIONS[version](value)
    version += 1
  }
  return withDefaults(value)
}

// ── the live store ────────────────────────────────────────────────────────

let state = null
const listeners = new Set()

/** The whole payload. Stable by reference until something changes. */
export function getStore() {
  if (state === null) {
    const wasAbsent = safeLocal.get(STORE_KEY) == null
    state = readRaw()
    if (wasAbsent) {
      // Write the migrated payload before dropping what it was migrated from.
      if (safeLocal.set(STORE_KEY, JSON.stringify(state))) dropLegacy()
    }
  }
  return state
}

function persist() {
  safeLocal.set(STORE_KEY, JSON.stringify(state))
}

function emit() {
  for (const fn of listeners) {
    try { fn(state) } catch { /* a bad subscriber must not stop the others */ }
  }
}

/**
 * Merge a patch (shallow at the top level, one level deep for the known
 * object fields) and notify. Returns the new state.
 */
export function setStore(patch) {
  const prev = getStore()
  const next = { ...prev }
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && prev[key] && typeof prev[key] === 'object' && !Array.isArray(prev[key])) {
      next[key] = { ...prev[key], ...value }
    } else {
      next[key] = value
    }
  }
  state = next
  persist()
  emit()
  return state
}

/** Functional update, for read-modify-write that must not race a re-render. */
export function updateStore(fn) {
  return setStore(fn(getStore()))
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Read one top-level field with the documented default. */
export function get(key) {
  const value = getStore()[key]
  return value === undefined ? DEFAULTS[key] : value
}

/** `forge.reset()` and the palette's "Reset progress" row both land here. */
export function resetStore() {
  state = structuredCloneish(DEFAULTS)
  safeLocal.remove(STORE_KEY)
  for (const key of LEGACY.local) safeLocal.remove(key)
  for (const key of LEGACY.session) safeSession.remove(key)
  emit()
  return state
}

// ── one-shot flags ────────────────────────────────────────────────────────

/**
 * `seen` entries are timestamps, not booleans, so every one of them can have
 * a TTL. T-031 wants the intro curtain once per visitor per month; a boolean
 * cannot express that and a second key to hold the date would recreate the
 * problem this module exists to solve.
 */
export function hasSeen(id, ttlMs = Infinity) {
  const at = getStore().seen[id]
  if (!Number.isFinite(at)) return false
  return ttlMs === Infinity || Date.now() - at < ttlMs
}

export function markSeen(id, at = Date.now()) {
  return setStore({ seen: { [id]: at } })
}

// ── React binding ─────────────────────────────────────────────────────────

/**
 * `useSyncExternalStore` rather than `useState` + an effect: this is external
 * mutable state, and tearing during a concurrent render is exactly the bug
 * class React added this hook for. It is also SSR-safe, which P6 needs.
 */
export function subscribeReact(onChange) {
  return subscribe(onChange)
}

export const getSnapshot = getStore
/** The server has no `localStorage`; the defaults are the honest answer. */
export const getServerSnapshot = () => DEFAULTS
