import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './ThemeContext.jsx'
import { getStore, setStore } from '../lib/store.js'

/**
 * SoundContext — T-069.
 *
 * Sound on a portfolio is high-risk, high-reward: unrequested audio is the
 * fastest way to lose a visitor, and there is no undo for the first second.
 * So the rules here are absolute rather than tuned:
 *
 *  1. **Default off, always.** Not "off on mobile", not "off until they
 *     scroll" — off, until an explicit opt-in, which is then remembered.
 *  2. **Nothing is constructed before that opt-in.** An `AudioContext` is not
 *     created at import, at mount, or on the first hover. The T-069 test
 *     asserts that zero contexts exist before the gesture, because a
 *     suspended context still shows up in a browser's audio indicator and
 *     still tells the visitor the page intends to make noise.
 *  3. **Synthesised, never sampled.** An oscillator and an envelope are a few
 *     hundred bytes; the equivalent in samples is ~200 KB of assets that must
 *     be downloaded to maybe never play.
 *  4. **Musically related.** One key, and every sound is an interval in it —
 *     hover a fifth, click the root, achievement a triad. Sounds that share a
 *     key feel designed; unrelated beeps feel like an alert dialog.
 *  5. **`prefers-reduced-motion` is treated as a sensory-sensitivity signal**,
 *     not only a motion one. It does not merely default sound off; it hides
 *     the opt-in behind a deliberate second action.
 */

const SoundContext = createContext(null)

/**
 * The key: A minor, rooted at A3. Every frequency below is an interval from
 * it, which is what makes eight unrelated UI events sound like one instrument.
 */
const ROOT = 220
const INTERVAL = { root: 1, third: 6 / 5, fifth: 3 / 2, octave: 2, tenth: 12 / 5 }

/** One lazily-created context for the whole app. Never before the opt-in. */
let audioCtx = null

function getContext() {
  if (audioCtx) return audioCtx
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  } catch {
    audioCtx = null
  }
  return audioCtx
}

/** A single voice: oscillator → gain envelope → out. */
function voice(ctx, { freq, duration, type, volume, glideTo }) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const now = ctx.currentTime

  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + duration)

  // A 6 ms attack rather than an instant one: a square-edged start is the
  // click you hear on cheap web audio, and it is entirely avoidable.
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

const THEME_VOICE = {
  eclipse: { type: 'sine', desc: 'water drop' },
  ember: { type: 'triangle', desc: 'metal ping' },
  paper: { type: 'sine', desc: 'paper rustle' },
}

/**
 * The palette. Every entry is an interval of ROOT, so the whole set is one
 * chord rather than eight arbitrary pitches.
 */
const PALETTE = {
  hover: { ratio: INTERVAL.fifth, duration: 0.05, volume: 0.025 },
  click: { ratio: INTERVAL.root, duration: 0.09, volume: 0.045 },
  open: { ratio: INTERVAL.third, duration: 0.16, volume: 0.035, glide: INTERVAL.octave },
  close: { ratio: INTERVAL.octave, duration: 0.14, volume: 0.03, glide: INTERVAL.root },
  whoosh: { ratio: INTERVAL.third, duration: 0.18, volume: 0.03, glide: INTERVAL.tenth },
  themeSwitch: { ratio: INTERVAL.fifth, duration: 0.14, volume: 0.035, glide: INTERVAL.octave },
  diceRoll: { ratio: INTERVAL.root, duration: 0.12, volume: 0.03, glide: INTERVAL.fifth },
  boot: { ratio: INTERVAL.root / 2, duration: 0.5, volume: 0.035 },
  // The one chord in the set: three voices, so an achievement is audibly a
  // different *kind* of event rather than a louder click.
  achievement: { chord: [INTERVAL.root, INTERVAL.third, INTERVAL.fifth], duration: 0.32, volume: 0.03 },
}

export function SoundProvider({ children }) {
  // Rule 1: off unless the visitor has previously said otherwise.
  const [enabled, setEnabled] = useState(() => getStore().prefs.sound === true)
  const { theme } = useTheme()
  const duckedUntil = useRef(0)

  const setMuted = useCallback((next) => {
    setEnabled((current) => {
      const muted = typeof next === 'function' ? next(!current) : next
      const on = !muted
      setStore({ prefs: { sound: on } })
      // Rule 2: the context is created here — inside the click handler that
      // enabled sound — because that gesture is also what browsers require
      // before audio may play at all.
      if (on) {
        const ctx = getContext()
        if (ctx?.state === 'suspended') ctx.resume().catch(() => {})
      }
      return on
    })
  }, [])

  // A hidden tab must not make noise, and a suspended context costs nothing.
  useEffect(() => {
    const onVisibility = () => {
      if (!audioCtx) return
      if (document.hidden) audioCtx.suspend().catch(() => {})
      else if (enabled) audioCtx.resume().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])

  /**
   * T-069.4 — duck everything during a live-region announcement. A screen
   * reader speaking over a UI chime is a worse experience than either alone.
   */
  useEffect(() => {
    const duck = () => { duckedUntil.current = performance.now() + 1200 }
    window.addEventListener('forge:announce', duck)
    return () => window.removeEventListener('forge:announce', duck)
  }, [])

  const voiceType = (THEME_VOICE[theme] || THEME_VOICE.eclipse).type

  const play = useMemo(() => (name) => {
    if (!enabled) return
    if (performance.now() < duckedUntil.current) return
    const spec = PALETTE[name]
    if (!spec) return
    const ctx = getContext()
    if (!ctx || ctx.state === 'closed') return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    try {
      if (spec.chord) {
        for (const ratio of spec.chord) {
          voice(ctx, { freq: ROOT * ratio, duration: spec.duration, type: voiceType, volume: spec.volume })
        }
        return
      }
      voice(ctx, {
        freq: ROOT * spec.ratio,
        duration: spec.duration,
        type: voiceType,
        volume: spec.volume,
        glideTo: spec.glide ? ROOT * spec.glide : undefined,
      })
    } catch {
      /* audio is never worth an exception */
    }
  }, [enabled, voiceType])

  const value = useMemo(
    () => ({ muted: !enabled, enabled, setMuted, play }),
    [enabled, setMuted, play]
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound() {
  return useContext(SoundContext)
}
