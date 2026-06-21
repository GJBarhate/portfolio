import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'

const TEXTURES = {
  forest: {
    track: 'radial-gradient(circle at 30% 25%, #5d8a44, #3e6b2c 55%, #2a4d1c)',
    trackNoise:
      "radial-gradient(circle, rgba(0,0,0,0.25) 0.5px, transparent 0.5px), radial-gradient(circle, rgba(255,255,255,0.07) 0.5px, transparent 0.5px)",
    knob: 'radial-gradient(circle at 35% 30%, #6e4f33, #4a3320 60%, #2c1f12)',
    knobStripe: 'repeating-linear-gradient(100deg, rgba(0,0,0,0.1) 0px, transparent 2px, transparent 4px)',
    glow: '#e8a23d',
    label: 'FOREST',
  },
  ocean: {
    track: 'linear-gradient(155deg, #5e88a8, #3c6486 55%, #274a66)',
    trackNoise: 'none',
    knob: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), #aecfe2 35%, #5f93b3 75%, #3f7194)',
    knobStripe: 'none',
    glow: '#eef7ff',
    label: 'OCEAN',
  },
  golden: {
    track: 'linear-gradient(155deg, #d9a13a, #b87f1f 55%, #8f5e10)',
    trackNoise: 'none',
    knob: 'radial-gradient(circle at 32% 28%, #ffe9b0, #e8b94d 40%, #c2901f 80%, #9c6f12)',
    knobStripe: 'none',
    glow: '#fff0c2',
    label: 'GOLDEN',
  },
  dawn: {
    track: 'linear-gradient(155deg, #fff8ec, #ffe9c2 55%, #f3d59a)',
    trackNoise: 'none',
    knob: 'radial-gradient(circle at 32% 28%, #ffffff, #fff3da 40%, #ffe2ab 80%, #f0c878)',
    knobStripe: 'none',
    glow: '#fff4d6',
    label: 'DAWN',
  },
}

const ORDER = ['forest', 'ocean', 'golden', 'dawn']

// Track/knob geometry — kept in one place so the knob travel distance is
// always (TRACK_W - PAD*2 - KNOB) and can never overflow the pill.
const TRACK_W = 84
const TRACK_H = 32
const PAD = 4
const KNOB = TRACK_H - PAD * 2 // 24
const TRAVEL = TRACK_W - PAD * 2 - KNOB // 30
const STEP = TRAVEL / (ORDER.length - 1) // 15

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const sound = useSound()
  const [showLabel, setShowLabel] = useState(false)
  const idx = Math.max(0, ORDER.indexOf(theme))
  const tex = TEXTURES[theme] || TEXTURES.forest

  const cycle = () => {
    const next = ORDER[(idx + 1) % ORDER.length]
    setTheme(next)
    sound?.play('themeSwitch')
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'shapeshifter' }))
  }

  return (
    <div className="relative flex items-center gap-2">
      <motion.button
        onClick={cycle}
        onMouseEnter={() => setShowLabel(true)}
        onMouseLeave={() => setShowLabel(false)}
        data-cursor="view"
        aria-label={`Switch theme (current: ${tex.label})`}
        title={`Theme: ${tex.label} — click to cycle`}
        whileTap={{ scale: 0.92 }}
        className="relative flex items-center rounded-full transition-shadow duration-500 shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(0,0,0,0.32),0_2px_6px_rgba(0,0,0,0.45)]"
        style={{ width: TRACK_W, height: TRACK_H, padding: PAD, background: tex.track }}
      >
        {tex.trackNoise !== 'none' && (
          <span
            className="absolute inset-0 rounded-full opacity-50 mix-blend-overlay"
            style={{ backgroundImage: tex.trackNoise, backgroundSize: '4px 4px' }}
            aria-hidden="true"
          />
        )}
        {/* Position pips so the 3 stops are legible even before interacting */}
        <span className="absolute inset-0 flex items-center justify-between px-[9px]" aria-hidden="true">
          {ORDER.map((id) => (
            <span
              key={id}
              className="w-1 h-1 rounded-full transition-opacity duration-300"
              style={{ background: 'rgba(255,255,255,0.55)', opacity: id === theme ? 0 : 0.7 }}
            />
          ))}
        </span>
        <motion.span
          className="relative z-10 rounded-full flex items-center justify-center"
          style={{
            width: KNOB,
            height: KNOB,
            background: tex.knob,
            boxShadow: `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.45)`,
          }}
          animate={{ x: idx * STEP }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          {tex.knobStripe !== 'none' && (
            <span
              className="absolute inset-0 rounded-full opacity-60"
              style={{ backgroundImage: tex.knobStripe }}
              aria-hidden="true"
            />
          )}
          <motion.span
            className="relative z-10 w-1.5 h-1.5 rounded-full"
            style={{ background: tex.glow, boxShadow: `0 0 6px 1px ${tex.glow}` }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {showLabel && (
          <motion.span
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2 }}
            className="hidden lg:inline font-mono text-[9px] tracking-[0.2em] whitespace-nowrap"
            style={{ color: tex.glow }}
          >
            {tex.label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
