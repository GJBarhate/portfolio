import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, TOTAL_XP, getAchievement } from '../lib/achievements.js'
import { getStore, setStore } from '../lib/store.js'

const GameContext = createContext(null)
const SECTION_IDS = ['about', 'stats', 'skills', 'projects', 'timeline', 'how-i-build', 'contact']

// T-030 — progress lives in the one versioned store. The `forge-progress`
// key and its private try/catch(JSON.parse) are gone; a corrupt payload now
// yields the documented default instead of throwing inside a state
// initialiser, which is the one place a throw takes the whole app down.

export function GameProvider({ children }) {
  const [unlocked, setUnlocked] = useState(() => getStore().progress.unlocked)
  const [toasts, setToasts] = useState([])
  const unlockedRef = useRef(unlocked)
  unlockedRef.current = unlocked

  const unlock = (id) => {
    if (unlockedRef.current.includes(id)) return
    const achievement = getAchievement(id)
    if (!achievement) return
    const next = [...unlockedRef.current, id]
    setUnlocked(next)
    setStore({ progress: { unlocked: next } })
    const toastId = `${id}-${Date.now()}`
    setToasts((t) => [...t, { ...achievement, toastId }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.toastId !== toastId))
    }, 4200)
  }

  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) unlock(entry.target.id)
        })
      },
      { threshold: 0.35 }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handler = (e) => unlock(e.detail)
    window.addEventListener('forge:unlock', handler)
    return () => window.removeEventListener('forge:unlock', handler)
  }, [])

  const xp = unlocked.reduce((sum, id) => sum + (getAchievement(id)?.xp || 0), 0)
  const percent = Math.min(100, Math.round((xp / TOTAL_XP) * 100))

  return (
    <GameContext.Provider value={{ unlocked, xp, totalXp: TOTAL_XP, percent, toasts, unlock, achievements: ACHIEVEMENTS }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  return useContext(GameContext)
}
