/**
 * useMedia.js — T-011. The three questions `useIsMobile` was conflating.
 *
 * The hook this replaces returned true for `innerWidth < 768` **OR**
 * `(hover: none)`. That is three different questions wearing one name:
 *
 *   - a 27-inch touchscreen monitor was "mobile" and got the phone layout
 *   - an iPad Pro in landscape was "mobile"
 *   - and because it listened to `resize`, it re-rendered every consumer on
 *     every mobile-browser URL-bar collapse — which fires continuously during
 *     a scroll, in the middle of the scroll it was making janky
 *
 * Width, pointer type and device capability are orthogonal. They are three
 * hooks here, and every call site has to say which one it meant:
 *
 *   useViewport()   → 'xs'|'sm'|'md'|'lg'|'xl'|'2xl'   a question about LAYOUT
 *   usePointer()    → { coarse, hover }                a question about INPUT
 *   useDeviceTier() → 0|1|2|3                          a question about CAPABILITY
 *
 * All of them are `matchMedia`-driven — no `resize`, no polling — and all of
 * them go through `useSyncExternalStore`, so they are concurrent-safe (no
 * tearing between two components reading the same media query in one render
 * pass) and SSR-safe, which P6 will need.
 */
import { useSyncExternalStore, useCallback } from 'react'
import { BREAKPOINTS, ORDER, SHORT_HEIGHT_REM } from './breakpoints.js'
import { getProfile, onProfile } from './deviceProfile.js'
import { getTier, onTierChange } from './raf.js'

/**
 * One `MediaQueryList` per query string, shared by every consumer. Two
 * components asking the same question must observe the same object, or they
 * can disagree for a frame.
 */
const lists = new Map()

function listFor(queryString) {
  let mql = lists.get(queryString)
  if (!mql) {
    mql = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(queryString)
      : { matches: false, addEventListener() {}, removeEventListener() {} }
    lists.set(queryString, mql)
  }
  return mql
}

/**
 * The primitive: subscribe to one media query.
 * `serverValue` is what SSR and the first hydration pass should assume.
 */
export function useMediaQuery(queryString, serverValue = false) {
  const subscribe = useCallback((onChange) => {
    const mql = listFor(queryString)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [queryString])

  const getSnapshot = useCallback(() => listFor(queryString).matches, [queryString])
  const getServerSnapshot = useCallback(() => serverValue, [serverValue])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// ── viewport: a question about layout ─────────────────────────────────────

const VIEWPORT_QUERIES = ORDER.map((name) => ({
  name,
  mql: `(width >= ${BREAKPOINTS[name]}rem)`,
}))

function readViewport() {
  if (typeof window === 'undefined') return 'lg'
  for (let i = VIEWPORT_QUERIES.length - 1; i >= 0; i--) {
    if (listFor(VIEWPORT_QUERIES[i].mql).matches) return VIEWPORT_QUERIES[i].name
  }
  return 'xs'
}

function subscribeViewport(onChange) {
  const unsubs = VIEWPORT_QUERIES.map(({ mql }) => {
    const list = listFor(mql)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  })
  return () => unsubs.forEach((fn) => fn())
}

/** `'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'` — the current layout bucket. */
export function useViewport() {
  return useSyncExternalStore(subscribeViewport, readViewport, () => 'lg')
}

/** True when the viewport is at or past the named breakpoint. */
export function useAtLeast(name) {
  return useMediaQuery(`(width >= ${BREAKPOINTS[name]}rem)`, name === 'lg' || name === 'md')
}

/** True below the named breakpoint. The exact complement of `useAtLeast`. */
export function useBelow(name) {
  return useMediaQuery(`(width < ${BREAKPOINTS[name]}rem)`, false)
}

/**
 * Landscape phones and anything else with a scarce vertical axis. This is the
 * shape that breaks 100vh heroes, and it has nothing to do with width.
 */
export function useShortViewport() {
  return useMediaQuery(`(height < ${SHORT_HEIGHT_REM}rem)`, false)
}

// ── pointer: a question about input ───────────────────────────────────────

const POINTER_COARSE = '(pointer: coarse)'
const POINTER_HOVER = '(hover: hover) and (pointer: fine)'

function subscribePointer(onChange) {
  const a = listFor(POINTER_COARSE)
  const b = listFor(POINTER_HOVER)
  a.addEventListener('change', onChange)
  b.addEventListener('change', onChange)
  return () => {
    a.removeEventListener('change', onChange)
    b.removeEventListener('change', onChange)
  }
}

/**
 * A stable snapshot object. `useSyncExternalStore` compares snapshots by
 * identity, so returning a fresh object each call would loop forever.
 */
let pointerSnapshot = { coarse: false, hover: true }
function readPointer() {
  const coarse = listFor(POINTER_COARSE).matches
  const hover = listFor(POINTER_HOVER).matches
  if (coarse !== pointerSnapshot.coarse || hover !== pointerSnapshot.hover) {
    pointerSnapshot = { coarse, hover }
  }
  return pointerSnapshot
}

const POINTER_SERVER = { coarse: false, hover: true }

/** `{ coarse, hover }` — what the visitor is pointing with, not how wide it is. */
export function usePointer() {
  return useSyncExternalStore(subscribePointer, readPointer, () => POINTER_SERVER)
}

// ── capability: a question about the machine ──────────────────────────────

/**
 * `0|1|2|3` from the T-007 probe, falling back to the governor's live tier
 * until the probe resolves. Two sources, one number: the probe sets the
 * starting tier and the governor moves it, so reading either is reading the
 * same value — this subscribes to both so a change from either is seen.
 */
function subscribeTier(onChange) {
  const offProfile = onProfile(onChange)
  const offTier = onTierChange(onChange)
  return () => { offProfile(); offTier() }
}

function readTier() {
  const profile = getProfile()
  return profile ? Math.min(profile.tier, getTier()) : getTier()
}

export function useDeviceTier() {
  return useSyncExternalStore(subscribeTier, readTier, () => 3)
}

// ── preference axes ───────────────────────────────────────────────────────

export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)', false)
}

export function usePrefersReducedTransparency() {
  return useMediaQuery('(prefers-reduced-transparency: reduce)', false)
}

export function usePrefersContrast() {
  return useMediaQuery('(prefers-contrast: more)', false)
}
