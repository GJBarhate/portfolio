import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { onFrame } from '../lib/raf.js'

// bg / accent / glow are used by the Theme Atelier swatches and the
// <meta name="theme-color"> sync — keep them in step with index.css.
// Three themes, not five. Eclipse is the flagship the site is designed around;
// the other two are a delightful extra, not equal first-class designs. Each
// passes the same APCA thresholds independently.
const THEMES = [
  { id: 'eclipse', label: 'Eclipse', meaning: 'Blue-black & electric teal — the default', bg: '#0e1114', accent: '#3ac6c9', glow: '#7fe3e5' },
  { id: 'ember', label: 'Ember', meaning: 'Warm charcoal & champagne gold — midnight luxury', bg: '#0f0e0c', accent: '#d4b876', glow: '#f0e0b8' },
  // §2.1 — `glow` mirrors the --accent-glow token, which in `paper` has to be
  // the dark teal: a near-white glow on a cream swatch is invisible.
  { id: 'paper', label: 'Paper', meaning: 'Pale sunrise paper — the light theme', bg: '#f8f4ec', accent: '#1f7d86', glow: '#1f7d86' },
]

// Old theme ids map onto the survivors so a returning visitor's saved
// preference still resolves. index.html applies the same mapping before first
// paint; this is the runtime half.
export const LEGACY_THEME_MAP = {
  forest: 'eclipse',
  ocean: 'eclipse',
  golden: 'ember',
  obsidian: 'ember',
  dawn: 'paper',
}

// Time-aware suggestions
const TIME_HINTS = {
  paper:   { from: 5,  to: 9,  suggestion: 'paper',   toast: '☀️ Good morning — Paper suits the early light.' },
  ember:   { from: 16, to: 19, suggestion: 'ember',   toast: '🌅 Golden hour — Ember matches the sunset.' },
  eclipse: { from: 20, to: 4,  suggestion: 'eclipse', toast: '🌙 Late night — Eclipse is easier on the eyes.' },
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
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('forge-theme')
    if (THEMES.some((t) => t.id === saved)) return saved
    const migrated = LEGACY_THEME_MAP[saved]
    if (migrated) return migrated
    // Eclipse is the default first impression; first-time light-mode users
    // land on Paper instead.
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
    return prefersLight ? 'paper' : 'eclipse'
  })
  const [suggestion, setSuggestion] = useState(null)
  const suggestedRef = useRef(null)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    // Scrollbars and form controls need the polarity, not the palette, and
    // they flash the wrong one for a frame without this (§6.5).
    root.style.colorScheme = theme === 'paper' ? 'light' : 'dark'
    localStorage.setItem('forge-theme', theme)

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

  useEffect(() => {
    const handler = (e) => {
      const next = LEGACY_THEME_MAP[e.detail] || e.detail
      if (THEMES.some((t) => t.id === next)) setTheme(next)
    }
    window.addEventListener('forge:set-theme', handler)
    return () => window.removeEventListener('forge:set-theme', handler)
  }, [])

  // Time-aware suggestion (polite toast, never automatic)
  useEffect(() => {
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
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, suggestion, acceptSuggestion, dismissSuggestion }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
