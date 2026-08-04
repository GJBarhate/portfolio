import { useSyncExternalStore } from 'react'
import { subscribe } from './store.js'
import { resolveMotionMode } from './motion.js'

/**
 * True when motion should not run.
 *
 * T-025 changes what this asks. It used to read `prefers-reduced-motion`
 * directly, which meant the visitor's own choice in the palette ("Motion:
 * off" on a machine whose OS says nothing) had no effect on any JS-driven
 * animation. It now reads the *effective* mode — the OS preference unless the
 * visitor has overridden it — so the CSS scalar and every JS consumer answer
 * the same question the same way.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, snapshot, () => false)
}

function subscribeMotion(onChange) {
  const offStore = subscribe(onChange)
  const mql = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
  mql?.addEventListener('change', onChange)
  const onCustom = () => onChange()
  if (typeof window !== 'undefined') window.addEventListener('forge:set-motion', onCustom)
  return () => {
    offStore()
    mql?.removeEventListener('change', onChange)
    if (typeof window !== 'undefined') window.removeEventListener('forge:set-motion', onCustom)
  }
}

const snapshot = () => resolveMotionMode() === 'off'

/** The graded answer, for effects that can run at half strength rather than off. */
export function useMotionMode() {
  return useSyncExternalStore(subscribeMotion, () => resolveMotionMode(), () => 'full')
}
