/* §4.1 — Motion spec: one global file, luxury-slow defaults.
 *
 * T-025 extends this from "a table of easings" to "the JS half of one motion
 * scalar". `src/styles/motion.css` defines `--motion-scale` and
 * `--motion-distance`; every CSS duration multiplies by them. JS-driven
 * animation (WAAPI, the ticker, the canvases) has to obey the same number or
 * a visitor who set Motion: off would still see the parts of the page that
 * are not CSS moving — which was exactly the situation before, when reduced
 * motion was 38 hand-written `@media` blocks and every new animation was one
 * more chance to forget.
 */
import { getStore, setStore, subscribe } from './store.js'

export const EASE_FORGE = [0.16, 1, 0.3, 1]

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1]

export const EASE_IN_OUT = [0.76, 0, 0.24, 1]

export const EASE_SNAP = [0.34, 1.56, 0.64, 1]

export const SPRING_STIFF = { stiffness: 240, damping: 36, mass: 0.3 }

export const SPRING_SOFT = { stiffness: 80, damping: 18, mass: 0.6 }

export const DURATIONS = {
  reveal: 1.2,
  sectionEnter: 1.4,
  heroChar: 0.6,
  micro: 0.3,
  hover: 0.4,
  transition: 1.2,
}

/** The four states the visitor can be in. `system` follows the OS. */
export const MOTION_MODES = ['system', 'full', 'reduced', 'off']

/** scale, distance — the same pairs `motion.css` publishes. */
const SCALARS = {
  full: { scale: 1, distance: 1 },
  reduced: { scale: 0.5, distance: 0.35 },
  off: { scale: 0, distance: 0 },
}

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The effective mode: `system` resolved against the OS preference. */
export function resolveMotionMode(mode = getStore().motion) {
  if (mode === 'system' || !SCALARS[mode]) return prefersReduced() ? 'off' : 'full'
  return mode
}

/** `{ scale, distance }` for the current effective mode. */
export function motionScalars() {
  return SCALARS[resolveMotionMode()]
}

/** Multiply a duration (ms or s — it is your unit) by the motion scale. */
export const scaled = (duration) => duration * motionScalars().scale

/** True when animation should not run at all. */
export const motionOff = () => motionScalars().scale === 0

/**
 * Publish the mode on `<html data-motion>`, which is what `motion.css` reads.
 * `system` writes no attribute at all so the media query stays in charge —
 * an explicit `data-motion="full"` from a visitor who wants motion *does*
 * override the OS, which is the point of offering the control.
 */
export function applyMotionMode(mode = getStore().motion) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'system' || !SCALARS[mode]) delete root.dataset.motion
  else root.dataset.motion = mode
  root.dispatchEvent(new CustomEvent('forge:motion-changed', { bubbles: false, detail: resolveMotionMode(mode) }))
}

/** Persist and apply in one call — used by the palette, the drawer and the CLI. */
export function setMotionMode(mode) {
  setStore({ motion: MOTION_MODES.includes(mode) ? mode : 'system' })
  applyMotionMode(mode)
}

/** Wire the store, the OS preference and the DOM attribute together, once. */
export function installMotionMode() {
  if (typeof window === 'undefined') return () => {}
  applyMotionMode()
  const offStore = subscribe((state) => applyMotionMode(state.motion))
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  const onOs = () => applyMotionMode()
  mql.addEventListener('change', onOs)
  const onEvent = (e) => setMotionMode(e.detail)
  window.addEventListener('forge:set-motion', onEvent)
  return () => {
    offStore()
    mql.removeEventListener('change', onOs)
    window.removeEventListener('forge:set-motion', onEvent)
  }
}
