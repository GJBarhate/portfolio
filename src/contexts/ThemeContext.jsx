import { createContext, useContext, useEffect, useRef, useState } from 'react'

// bg / accent / glow are used by the Theme Atelier swatches and the
// <meta name="theme-color"> sync — keep them in step with index.css.
const THEMES = [
  { id: 'forest', label: 'Deep Forest', meaning: 'Moss & walnut — a quiet studio at night', bg: '#10140e', accent: '#6a9955', glow: '#e8a23d' },
  { id: 'ocean', label: 'Serene Ocean', meaning: 'Steel blue on midnight — deep-water calm', bg: '#0b1524', accent: '#8fb8d9', glow: '#b8d0e0' },
  { id: 'golden', label: 'Golden Hour', meaning: 'Amber over ember — late-sun warmth', bg: '#1e1408', accent: '#e0b35c', glow: '#fff3d6' },
  { id: 'dawn', label: 'Dawn', meaning: 'Pale sunrise paper — the only light theme', bg: '#f8f1e3', accent: '#d9a85e', glow: '#fff8e8' },
  { id: 'obsidian', label: 'Obsidian', meaning: 'Black & champagne gold — midnight luxury', bg: '#0d0c0a', accent: '#d4b876', glow: '#f0e0b8' },
]

// Time-aware suggestions
const TIME_HINTS = {
  dawn:    { from: 5,  to: 9,  suggestion: 'dawn',   toast: '☀️ Good morning — Dawn theme suits the early light.' },
  golden:  { from: 16, to: 19, suggestion: 'golden',  toast: '🌅 Golden hour — Golden theme matches the sunset.' },
  obsidian:{ from: 20, to: 4,  suggestion: 'obsidian',toast: '🌙 Late night — Obsidian theme is easier on the eyes.' },
}

function getTimeSuggestion() {
  const h = new Date().getHours()
  for (const key of ['dawn', 'golden', 'obsidian']) {
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
    // Obsidian is the default first impression (black + champagne gold);
    // first-time light-mode users land on Dawn instead (§2).
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches
    return prefersLight ? 'dawn' : 'obsidian'
  })
  const [suggestion, setSuggestion] = useState(null)
  const suggestedRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('forge-theme', theme)
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
  }, [theme])

  useEffect(() => {
    const handler = (e) => {
      if (THEMES.some((t) => t.id === e.detail)) setTheme(e.detail)
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
