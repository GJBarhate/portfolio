import { createContext, useContext, useEffect, useState } from 'react'

const THEMES = [
  { id: 'forest', label: 'Deep Forest', accent: '#6a9955', glow: '#e8a23d', texture: 'felt' },
  { id: 'ocean', label: 'Serene Ocean', accent: '#8fb8d9', glow: '#f4f7fa', texture: 'ceramic' },
  { id: 'golden', label: 'Golden Hour', accent: '#e0b35c', glow: '#fff3d6', texture: 'smooth' },
  { id: 'dawn', label: 'Dawn', accent: '#d9a85e', glow: '#fff8e8', texture: 'porcelain' },
]

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('forge-theme') || 'forest')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('forge-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
