/**
 * appearance.js — one façade over the three settings that change how the page
 * looks: THEME, BACKDROP and MOTION.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * Before it, those three settings were spread across six surfaces with four
 * different interaction models:
 *
 *   ThemeToggle        a 92×32 sliding knob with three unlabelled positions
 *   Theme Atelier      a popover with theme rows AND backdrop rows
 *   SceneToggle        a segmented control, `display: none` below 1,792 CSS px
 *   the drawer         a *cycling* THEME row and a *cycling* BACKDROP row
 *   Command Palette    theme + backdrop + motion, behind ⌘K
 *   window.forge.*     the same three, behind a devtools console
 *
 * The same setting had three UIs; the one in the header was invisible on
 * every laptop screen; and MOTION — four modes, the setting a visitor reaches
 * for when the page is too busy — had **no visible control at all**. It was
 * reachable from a keyboard shortcut and a console, and nowhere else.
 *
 * The fix is not a seventh surface. It is one place that owns the vocabulary,
 * one place that writes it, and one panel that reads it — with the palette and
 * the CLI reduced to callers of these functions rather than dispatchers of
 * their own bespoke events.
 *
 * ── What lives here and what does not ─────────────────────────────────────
 *
 * This module owns the *vocabulary*: the ids, the human labels, the one-line
 * meanings, the honest cost characterisations, the default, and the legacy id
 * remap. The *mechanisms* stay where they were and are re-exported through
 * here — `bgScene.js` still publishes `data-bg-scene`, `motion.js` still owns
 * the scalars and `data-motion`, `ThemeContext` still owns the React state and
 * the view transition. Moving those would have been a rewrite; moving the
 * vocabulary is what makes one control possible.
 *
 * `index.html`'s pre-paint script duplicates the theme list, the legacy map
 * and the default by necessity — it runs before any module is loaded and it
 * must, or the first frame paints in the wrong palette.
 * `scripts/check-appearance-parity.mjs` fails the build if the two ever
 * disagree, which is the only way that duplication is safe.
 */
import { BG_SCENES, bgScene, setBgScene } from './bgScene.js'
import { MOTION_MODES, resolveMotionMode, setMotionMode } from './motion.js'
import { getStore, setStore, subscribe } from './store.js'

// ── Themes ────────────────────────────────────────────────────────────────

/**
 * Three themes, not five. Eclipse is the flagship the site is designed around;
 * the other two are a delightful extra, not equal first-class designs. Each
 * passes the same APCA thresholds independently.
 *
 * `bg` / `accent` / `glow` drive the console's preview cards and the
 * `<meta name="theme-color">` sync — keep them in step with `index.css`.
 */
export const THEMES = [
  {
    id: 'eclipse',
    label: 'Eclipse',
    meaning: 'Blue-black and electric teal — the default',
    bg: '#0e1114',
    accent: '#3ac6c9',
    glow: '#7fe3e5',
  },
  {
    id: 'ember',
    label: 'Ember',
    meaning: 'Warm charcoal and champagne gold — midnight luxury',
    bg: '#0f0e0c',
    accent: '#d4b876',
    glow: '#f0e0b8',
  },
  {
    id: 'paper',
    // §2.1 — `glow` mirrors the --accent-glow token, which in `paper` has to
    // be the dark teal: a near-white glow on a cream swatch is invisible.
    label: 'Paper',
    meaning: 'Pale sunrise paper — the light theme',
    bg: '#f8f4ec',
    accent: '#1f7d86',
    glow: '#1f7d86',
  },
]

export const THEME_IDS = THEMES.map((t) => t.id)

/** The card that follows the operating system rather than naming a palette. */
export const SYSTEM_THEME = {
  id: 'system',
  label: 'Auto',
  meaning: 'Follow my device — light in the day, dark at night',
}

/**
 * Old theme ids map onto the survivors so a returning visitor's saved
 * preference still resolves. `index.html` applies the same mapping before
 * first paint; this is the runtime half, and the parity gate holds them level.
 */
export const LEGACY_THEME_MAP = {
  forest: 'eclipse',
  ocean: 'eclipse',
  golden: 'ember',
  obsidian: 'ember',
  dawn: 'paper',
}

/**
 * D-33 — Eclipse, not `system`.
 *
 * Following the OS sounds like the respectful default and is the wrong one
 * *here*: this is a single designed page, not an app shell, and Eclipse is the
 * palette every other decision was made against — the hero grade, the
 * background motifs, the accent-on-surface contrast ratios. A visitor on a
 * light-mode laptop was landing on Paper, the alternate, and judging the site
 * by it. `system` is not lost; it is a first-class card in the console.
 */
export const DEFAULT_THEME = 'eclipse'

/** The stored *preference*, which may be `system`. */
export function themePreference() {
  const stored = getStore().theme
  if (stored === 'system') return 'system'
  if (THEME_IDS.includes(stored)) return stored
  return LEGACY_THEME_MAP[stored] || DEFAULT_THEME
}

/** What the OS says, for `system`. */
export const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'paper'
    : 'eclipse'

/** The theme actually on screen — `system` resolved. */
export function resolvedTheme() {
  const preference = themePreference()
  return preference === 'system' ? systemTheme() : preference
}

// ── Backdrops ─────────────────────────────────────────────────────────────

/**
 * Every card states its consequence.
 *
 * `Forest — a living scene. Costs the most.` is not an apology, it is the
 * premium signal: a control that tells you what a choice will do to your
 * battery is a control written by someone who measured it. The old labels
 * described the *picture* ("a different pattern per section"); these describe
 * the effect on the thing the visitor is actually doing, which is reading.
 */
export const BACKDROPS = [
  {
    id: 'calm',
    label: 'Calm',
    meaning: 'Nothing moving behind the text',
    cost: 'Cheapest',
    glyph: '▁',
  },
  {
    id: 'motifs',
    label: 'Motifs',
    meaning: 'A different pattern per section',
    cost: 'Moderate',
    glyph: '◎',
  },
  {
    id: 'forest',
    label: 'Forest',
    meaning: 'A living scene — wind, water and wildlife',
    cost: 'Costs the most',
    glyph: '▲',
  },
]

export const BACKDROP_IDS = BACKDROPS.map((b) => b.id)

// ── Motion ────────────────────────────────────────────────────────────────

/**
 * Human labels, and one deliberate rename.
 *
 * `off` is presented as **Minimal**, not "Off". The internal id stays `off`
 * because `motion.css`, `raf.js` and `data-motion` all speak it — but the word
 * on screen has to be true, and "Off" was not: the mode used to delete the
 * corner clock and the background entirely rather than stopping them. Under
 * P5 ("degrade by resolution, never by deletion") it now means *freeze*, and
 * "Minimal" is the honest word for a page that still has all its content and
 * none of its movement.
 *
 * `system` is presented as **Auto** for the same reason it is on the theme
 * card: "system" is a word about the software, "Auto" is a word about the
 * outcome.
 */
export const MOTIONS = [
  { id: 'full', label: 'Full', meaning: 'Everything moves, at full travel' },
  { id: 'reduced', label: 'Balanced', meaning: 'Half speed, shorter travel' },
  { id: 'off', label: 'Minimal', meaning: 'Nothing moves. Everything is still there.' },
  { id: 'system', label: 'Auto', meaning: 'Follow my device’s reduced-motion setting' },
]

/** Ordered as the console renders them; `MOTION_MODES` is the storage order. */
export const MOTION_IDS = MOTIONS.map((m) => m.id)

/** The stored motion *preference*, which may be `system`. */
export function motionPreference() {
  const stored = getStore().motion
  return MOTION_MODES.includes(stored) ? stored : 'system'
}

// ── Reading ───────────────────────────────────────────────────────────────

/** Everything at once — what the console renders from. */
export function getAppearance() {
  return {
    theme: resolvedTheme(),
    themePreference: themePreference(),
    backdrop: bgScene(),
    motion: motionPreference(),
    resolvedMotion: resolveMotionMode(),
  }
}

// ── Writing ───────────────────────────────────────────────────────────────

/**
 * Set the theme.
 *
 * Routed through the `forge:set-theme` event rather than writing the store
 * directly, because `ThemeContext` owns the React state, the view-transition
 * sweep and the favicon/`theme-color` sync. Two writers for one value is how
 * the palette and the toggle used to disagree for a frame.
 */
export function setTheme(id) {
  const next = id === 'system' ? 'system' : (LEGACY_THEME_MAP[id] || id)
  if (next !== 'system' && !THEME_IDS.includes(next)) return
  if (typeof window === 'undefined') {
    setStore({ theme: next })
    return
  }
  window.dispatchEvent(new CustomEvent('forge:set-theme', { detail: next }))
}

/** Set the backdrop. `bgScene.js` publishes `data-bg-scene` and persists. */
export function setBackdrop(id) {
  if (!BACKDROP_IDS.includes(id)) return
  setBgScene(id)
}

/** Set the motion mode. `motion.js` publishes `data-motion` and persists. */
export function setMotion(id) {
  if (!MOTION_MODES.includes(id)) return
  setMotionMode(id)
}

// ── Subscribing ───────────────────────────────────────────────────────────

/**
 * Fires whenever any of the three changes.
 *
 * Three different mechanisms publish three different events — `forge:theme-changed`
 * on `window`, `forge:bg-scene-changed` and `forge:motion-changed` on
 * `<html>` — plus the store itself. Every consumer used to subscribe to
 * whichever subset it remembered, which is why the drawer's BACKDROP row could
 * print a stale value after a change made from the terminal. One subscription
 * covers all of them.
 *
 * @param {(state: ReturnType<typeof getAppearance>) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onAppearanceChange(fn) {
  if (typeof window === 'undefined') return () => {}
  const notify = () => fn(getAppearance())
  const root = document.documentElement

  window.addEventListener('forge:theme-changed', notify)
  root.addEventListener('forge:bg-scene-changed', notify)
  root.addEventListener('forge:motion-changed', notify)
  const offStore = subscribe(notify)

  // `system` for either theme or motion means the OS can change the answer
  // with no interaction at all, so the two media queries are part of the
  // subscription rather than a separate thing every consumer forgets.
  const colour = window.matchMedia('(prefers-color-scheme: light)')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  colour.addEventListener('change', notify)
  reduce.addEventListener('change', notify)

  return () => {
    window.removeEventListener('forge:theme-changed', notify)
    root.removeEventListener('forge:bg-scene-changed', notify)
    root.removeEventListener('forge:motion-changed', notify)
    offStore()
    colour.removeEventListener('change', notify)
    reduce.removeEventListener('change', notify)
  }
}

// ── The one door into the panel ───────────────────────────────────────────

export const OPEN_CONSOLE_EVENT = 'forge:open-appearance'

/**
 * Open the Appearance Console from anywhere.
 *
 * Exactly one door, for the same reason the Command Palette has exactly one
 * (`forge:open-palette`): the header button, the drawer row, the palette row,
 * the `Shift+A` shortcut and the first-run choreography all knock here, so the
 * next entry point cannot be wired to a private setter.
 */
export function openAppearanceConsole(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_CONSOLE_EVENT, { detail }))
}

/** `Shift+A` — printed in the panel footer and in the palette. */
export function isAppearanceShortcut(e) {
  return (
    e.shiftKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    (e.key === 'A' || e.key === 'a') &&
    !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') &&
    !e.target?.isContentEditable
  )
}

export { BG_SCENES, MOTION_MODES }
