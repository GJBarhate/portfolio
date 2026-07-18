import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useTheme } from './ThemeContext.jsx'

const SoundContext = createContext(null)

function makeTone({ freq = 440, duration = 0.08, type = 'sine', volume = 0.05 }) {
  return () => {
    try {
      const ctx = makeTone.ctx || (makeTone.ctx = new (window.AudioContext || window.webkitAudioContext)())
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.value = volume
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      /* audio context unavailable */
    }
  }
}

function makeSweep({ from = 200, to = 800, duration = 0.15, type = 'sine', volume = 0.04 }) {
  return () => {
    try {
      const ctx = makeTone.ctx || (makeTone.ctx = new (window.AudioContext || window.webkitAudioContext)())
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(from, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration)
      gain.gain.setValueAtTime(volume, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      /* audio context unavailable */
    }
  }
}

const THEME_SOUNDS = {
  forest:  { hover: { freq: 660,  type: 'sine',     duration: 0.05 }, click: { freq: 180, type: 'triangle', duration: 0.09 }, desc: 'wood tick' },
  ocean:   { hover: { freq: 1200, type: 'sine',     duration: 0.04 }, click: { freq: 260, type: 'sine',     duration: 0.08 }, desc: 'water drop' },
  golden:  { hover: { freq: 990,  type: 'triangle', duration: 0.05 }, click: { freq: 210, type: 'sawtooth', duration: 0.07 }, desc: 'amber chime' },
  dawn:    { hover: { freq: 780,  type: 'sine',     duration: 0.06 }, click: { freq: 240, type: 'triangle', duration: 0.1  }, desc: 'paper rustle' },
  obsidian:{ hover: { freq: 440,  type: 'sine',     duration: 0.07 }, click: { freq: 110, type: 'sawtooth', duration: 0.12 }, desc: 'metal ping' },
}

export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(true)
  const { theme } = useTheme()

  const sounds = useMemo(() => {
    const ts = THEME_SOUNDS[theme] || THEME_SOUNDS.forest
    return {
      hover: makeTone(ts.hover),
      click: makeTone(ts.click),
      boot: makeTone({ freq: 110, duration: 0.6, type: 'sawtooth', volume: 0.04 }),
      whoosh: makeSweep({ from: 300, to: 1200, duration: 0.18, type: 'sine', volume: 0.03 }),
      themeSwitch: makeSweep({ from: 400, to: 600, duration: 0.12, type: 'triangle', volume: 0.04 }),
      achievement: makeSweep({ from: 600, to: 1400, duration: 0.25, type: 'triangle', volume: 0.05 }),
      diceRoll: makeSweep({ from: 150, to: 500, duration: 0.12, type: 'square', volume: 0.03 }),
      open: makeSweep({ from: 200, to: 900, duration: 0.2, type: 'sine', volume: 0.04 }),
      close: makeSweep({ from: 900, to: 200, duration: 0.15, type: 'sine', volume: 0.03 }),
    }
  }, [theme])

  const play = (name) => {
    if (muted) return
    sounds[name]?.()
  }

  return (
    <SoundContext.Provider value={{ muted, setMuted, play }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  return useContext(SoundContext)
}
