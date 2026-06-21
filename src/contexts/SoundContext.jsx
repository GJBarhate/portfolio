import { createContext, useContext, useMemo, useState } from 'react'

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

export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(true)
  const sounds = useMemo(
    () => ({
      hover: makeTone({ freq: 880, duration: 0.05, volume: 0.03 }),
      click: makeTone({ freq: 220, duration: 0.09, type: 'triangle', volume: 0.06 }),
      boot: makeTone({ freq: 110, duration: 0.6, type: 'sawtooth', volume: 0.04 }),
      whoosh: makeSweep({ from: 300, to: 1200, duration: 0.18, type: 'sine', volume: 0.03 }),
      themeSwitch: makeSweep({ from: 400, to: 600, duration: 0.12, type: 'triangle', volume: 0.04 }),
      open: makeSweep({ from: 200, to: 900, duration: 0.2, type: 'sine', volume: 0.04 }),
      close: makeSweep({ from: 900, to: 200, duration: 0.15, type: 'sine', volume: 0.03 }),
    }),
    []
  )

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
