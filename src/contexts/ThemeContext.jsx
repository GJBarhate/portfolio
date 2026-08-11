import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onFrame } from '../lib/raf.js'
import { getStore, setStore } from '../lib/store.js'
import {
  THEMES,
  LEGACY_THEME_MAP,
  DEFAULT_THEME,
  systemTheme,
} from '../lib/appearance.js'

/*
 * The theme LIST, the legacy remap and the default now live in
 * `lib/appearance.js`, which is the one place the three appearance settings
 * are described. They used to be declared here, in `bgScene.js` and in
 * `motion.js` respectively — three vocabularies for one idea — and the drawer
 * had a fourth hardcoded copy of the theme ids (D-10g), so adding a theme
 * meant editing four files and forgetting one.
 *
 * This context keeps what is genuinely its own: the React state, the view
 * transition, the canvas broadcast and the time-of-day suggestion.
 */
export { LEGACY_THEME_MAP }

// Time-aware suggestions.
// D.3.5 — no emoji outside the arcade. These are the site speaking in its own
// voice to someone who has already shown they care which theme they are in;
// a leading emoji makes that read as a consumer app's push notification.
const TIME_HINTS = {
  paper:   { from: 5,  to: 9,  suggestion: 'paper',   toast: 'Good morning — Paper suits the early light.' },
  ember:   { from: 16, to: 19, suggestion: 'ember',   toast: 'Golden hour — Ember matches the sunset.' },
  eclipse: { from: 20, to: 4,  suggestion: 'eclipse', toast: 'Late night — Eclipse is easier on the eyes.' },
}

function getTimeSuggestion() {
  const h = new Date().getHours()
  for (const key of ['paper', 'ember', 'eclipse']) {
    const r = TIME_HINTS[key]
    if (r.from <= r.to ? (h >= r.from && h < r.to) : (h >= r.from || h < r.to)) return { id: key, ...r }
  }
  return null
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  /*
   * T-034 / D-33 — three states, not two.
   *
   *   an explicit choice  → that theme, always, and it is remembered
   *   `system`            → follows prefers-color-scheme, live
   *   nothing stored yet  → Eclipse
   *
   * The default moved from `system` to `eclipse`. Following the OS sounds
   * like the respectful default and is the wrong one *here*: this is a single
   * designed page, not an app shell, and Eclipse is the palette every other
   * decision was made against — the hero grade, the background motifs, the
   * accent-on-surface contrast ratios. A visitor on a light-mode laptop was
   * landing on Paper, which is the alternate, and judging the site by it.
   *
   * `system` is not lost: it is one row in the theme toggle and one entry in
   * the command palette, and choosing it is remembered and followed live.
   *
   * The value lives in the unified store (T-030); `index.html` reads the same
   * key before first paint so there is no flash of the wrong palette. The two
   * must agree — change them together.
   */
  const [preference, setPreference] = useState(() => {
    const stored = getStore().theme
    if (stored === 'system') return 'system'
    if (THEMES.some((t) => t.id === stored)) return stored
    const migrated = LEGACY_THEME_MAP[stored]
    if (migrated) return migrated
    return DEFAULT_THEME
  })

  const [theme, setResolved] = useState(() =>
    preference === 'system' ? systemTheme() : preference
  )

  /** `setTheme('system')` is a first-class choice, not an absence of one. */
  const setTheme = (next) => {
    const id = LEGACY_THEME_MAP[next] || next
    if (id !== 'system' && !THEMES.some((t) => t.id === id)) return
    setPreference(id)
    setResolved(id === 'system' ? systemTheme() : id)
    // `themeExplicit` for the same reason as `bgSceneExplicit` — see store.js.
    // Reaching this setter means a human picked a palette.
    setStore({ theme: id, prefs: { ...getStore().prefs, themeExplicit: true } })
  }

  // Following the OS means following it *live* — a visitor whose machine
  // switches to dark mode at sunset should see the site follow, without a
  // reload, if that is what they asked for.
  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const sync = () => setResolved(systemTheme())
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [preference])
  const [suggestion, setSuggestion] = useState(null)
  const suggestedRef = useRef(null)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    // Scrollbars and form controls need the polarity, not the palette, and
    // they flash the wrong one for a frame without this (§6.5).
    root.style.colorScheme = theme === 'paper' ? 'light' : 'dark'

    /*
     * §6.1 — the canvas blind spot.
     *
     * WebGL scenes and 2-D canvases sample CSS variables once, at init. During
     * the sweep they therefore sit frozen at the OLD palette inside the
     * expanding circle — the "colours don't spread properly" complaint. CSS
     * cannot reach them, so the flip is broadcast instead and each layer
     * re-reads the tokens for itself.
     *
     * Dispatched after the attribute is set and on the next frame, so
     * getComputedStyle in the listeners resolves the new values.
     */
    const stopFrame = onFrame(() => {
      stopFrame()
      window.dispatchEvent(new CustomEvent('forge:theme-changed', { detail: { theme } }))
    })

    // Drives the no-View-Transition colour-fade fallback.
    root.setAttribute('data-theme-changing', '')
    const settle = setTimeout(() => root.removeAttribute('data-theme-changing'), 700)

    // Browser chrome follows the theme
    const meta = document.querySelector('meta[name="theme-color"]')
    const t = THEMES.find((x) => x.id === theme)
    if (meta && t) meta.setAttribute('content', t.bg)
    // Favicon follows theme
    const favicon = document.querySelector('link[rel="icon"]')
    if (favicon && t) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${t.bg}"/><text x="16" y="22" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="16" fill="${t.accent}">G</text></svg>`
      favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }

    return () => {
      stopFrame()
      clearTimeout(settle)
    }
  }, [theme])

  /*
   * The one door in. `system` is accepted here now, and it was not before:
   * the guard was `THEMES.some(t => t.id === next)`, which is false for
   * `system`, so every caller that went through this event — the palette, the
   * CLI, and now the Appearance Console — could set three of the four theme
   * choices and silently drop the fourth. `setTheme` itself has always handled
   * it; only the doorway was too narrow.
   */
  useEffect(() => {
    const handler = (e) => {
      const next = e.detail === 'system' ? 'system' : (LEGACY_THEME_MAP[e.detail] || e.detail)
      if (next === 'system' || THEMES.some((t) => t.id === next)) setTheme(next)
    }
    window.addEventListener('forge:set-theme', handler)
    return () => window.removeEventListener('forge:set-theme', handler)
  }, [])

  /*
   * Time-aware suggestion (polite toast, never automatic).
   *
   * D-33 — it no longer fires on a first visit. Landing someone on Eclipse and
   * then, three seconds later, offering to switch them to Paper is the site
   * arguing with its own default in front of the visitor. The nudge is worth
   * making to someone who has already shown they care which theme they are in;
   * it is noise to someone who has been here for three seconds.
   */
  useEffect(() => {
    if (!getStore().theme) return
    const hint = getTimeSuggestion()
    if (hint && hint.suggestion !== theme && !suggestedRef.current) {
      suggestedRef.current = hint.id
      const timer = setTimeout(() => setSuggestion(hint), 3000)
      return () => clearTimeout(timer)
    }
  }, [theme])

  const dismissSuggestion = () => setSuggestion(null)

  const acceptSuggestion = () => {
    if (suggestion) {
      setTheme(suggestion.suggestion)
      setSuggestion(null)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, setTheme, themes: THEMES, suggestion, acceptSuggestion, dismissSuggestion }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
