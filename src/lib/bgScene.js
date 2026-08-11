/**
 * Which backdrop the visitor is looking at — §14.5.
 *
 * The background engine used to have exactly one behaviour, and "one
 * behaviour" turned out to be three different opinions fighting:
 *
 *   someone reading the page          wants it quiet enough to read over
 *   someone judging the front-end     wants to see what it can do
 *   someone who has seen it once      wants it to be a place, not a texture
 *
 * So there are three scenes and the visitor picks:
 *
 *   calm    a slow theme-tinted wash. No motifs, no scene — the version that
 *           is never in the way of a paragraph. This is what the old tier-1
 *           CSS gradient looked like, promoted to a real choice.
 *   motifs  the eleven per-section motifs (fog, cells, dots, net, waves,
 *           topology, trunk, halo, globe, clouds, rings), crossfading on the
 *           damped section index. This is what shipped before.
 *   forest  a living forest: parallax tree lines moving in real wind, ridges
 *           receding into haze, water with a rippled reflection, drifting
 *           motes, birds, and wildlife on the near bank. Each section gets a
 *           different forest, each theme gets its own light.
 *
 * `forest` is the default. `calm` and `motifs` are one keystroke away.
 *
 * The mode is a uniform, not a separate shader: all three live in the same
 * program and the branch is on `uScene`, which is uniform across the draw, so
 * the GPU genuinely skips the other two rather than executing them and
 * discarding the result. Switching scenes costs no recompile and no context.
 */
import { getStore, setStore, subscribe } from './store.js'

/** Ordered as they appear in the palette and the drawer. */
export const BG_SCENES = ['calm', 'motifs', 'forest']

/**
 * D.1 — these describe the effect on READING, which is what the visitor is
 * actually choosing between, rather than describing the picture.
 *
 * The authoritative copy now lives in `lib/appearance.js` alongside the cost
 * characterisations; these remain for the CLI's one-line output and are kept
 * deliberately identical in wording.
 */
export const BG_SCENE_LABELS = {
  calm: 'Calm — nothing moving behind the text',
  motifs: 'Motifs — a different pattern per section',
  forest: 'Forest — a living scene. The default.',
}

/** The value the shader reads. Keep in step with `uScene` in bgEngine.js. */
export const BG_SCENE_ID = { calm: 0, motifs: 1, forest: 2 }

const DEFAULT_SCENE = 'forest'

/** The stored choice, falling back to the default for anything unrecognised. */
export function bgScene() {
  const stored = getStore().prefs?.bgScene
  return BG_SCENES.includes(stored) ? stored : DEFAULT_SCENE
}

/** The numeric id for the current scene. */
export function bgSceneId() {
  return BG_SCENE_ID[bgScene()]
}

/**
 * Publish on `<html data-bg-scene>` so CSS can react — the legibility scrim is
 * tuned per scene, because a forest with a bright horizon needs more help
 * behind a paragraph than a flat wash does.
 */
export function applyBgScene(scene = bgScene()) {
  if (typeof document === 'undefined') return
  const value = BG_SCENES.includes(scene) ? scene : DEFAULT_SCENE
  document.documentElement.dataset.bgScene = value
  document.documentElement.dispatchEvent(
    new CustomEvent('forge:bg-scene-changed', { bubbles: false, detail: value })
  )
}

/**
 * Persist and apply — used by the palette, the drawer and the console CLI.
 *
 * `bgSceneExplicit` is set here and only here. Reaching this function means a
 * human moved a control, which is exactly the fact v1 could not record and
 * which the v1→v2 migration otherwise has to guess (see store.js). Once it is
 * true, no future migration will ever second-guess this choice again.
 */
export function setBgScene(scene) {
  const value = BG_SCENES.includes(scene) ? scene : DEFAULT_SCENE
  setStore({ prefs: { ...getStore().prefs, bgScene: value, bgSceneExplicit: true } })
  applyBgScene(value)
}

/** The designed default, for §1.5's "Restore recommended". */
export { DEFAULT_SCENE }

/** Wire the store and the DOM attribute together, once, from App. */
export function installBgScene() {
  if (typeof window === 'undefined') return () => {}
  applyBgScene()
  const offStore = subscribe((state) => applyBgScene(state.prefs?.bgScene))
  const onEvent = (e) => setBgScene(e.detail)
  window.addEventListener('forge:set-bg-scene', onEvent)
  return () => {
    offStore()
    window.removeEventListener('forge:set-bg-scene', onEvent)
  }
}
