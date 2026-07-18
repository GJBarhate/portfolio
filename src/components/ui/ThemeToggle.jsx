import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'

const TEXTURES = {
  forest: {
    track: 'radial-gradient(circle at 30% 25%, #5d8a44, #3e6b2c 55%, #2a4d1c)',
    knob: 'radial-gradient(circle at 35% 30%, #6e4f33, #4a3320 60%, #2c1f12)',
    glow: '#e8a23d',
    label: 'FOREST',
  },
  ocean: {
    track: 'linear-gradient(155deg, #5e88a8, #3c6486 55%, #274a66)',
    knob: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), #aecfe2 35%, #5f93b3 75%, #3f7194)',
    glow: '#eef7ff',
    label: 'OCEAN',
  },
  golden: {
    track: 'linear-gradient(155deg, #d9a13a, #b87f1f 55%, #8f5e10)',
    knob: 'radial-gradient(circle at 32% 28%, #ffe9b0, #e8b94d 40%, #c2901f 80%, #9c6f12)',
    glow: '#fff0c2',
    label: 'GOLDEN',
  },
  dawn: {
    track: 'linear-gradient(155deg, #fff8ec, #ffe9c2 55%, #f3d59a)',
    knob: 'radial-gradient(circle at 32% 28%, #ffffff, #fff3da 40%, #ffe2ab 80%, #f0c878)',
    glow: '#fff4d6',
    label: 'DAWN',
  },
  obsidian: {
    track: 'linear-gradient(155deg, #23201a, #0d0c0a 60%, #060605)',
    knob: 'radial-gradient(circle at 32% 28%, #f4e3b2, #d4b876 45%, #9a7d3f 80%, #6b5426)',
    glow: '#f0e0b8',
    label: 'OBSIDIAN',
  },
}

const ORDER = ['forest', 'ocean', 'golden', 'dawn', 'obsidian']

// Track/knob geometry — knob travel = TRACK_W - PAD*2 - KNOB, never overflows
const TRACK_W = 92
const TRACK_H = 32
const PAD = 4
const KNOB = TRACK_H - PAD * 2 // 24
const TRAVEL = TRACK_W - PAD * 2 - KNOB
const STEP = TRAVEL / (ORDER.length - 1)

// Applies a theme with the circular View-Transition sweep radiating from the
// element that was clicked. Shared by every Atelier card.
function applyThemeWithSweep(el, apply) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (document.startViewTransition && !reduced && el) {
    const rect = el.getBoundingClientRect()
    document.documentElement.style.setProperty('--vt-x', `${rect.left + rect.width / 2}px`)
    document.documentElement.style.setProperty('--vt-y', `${rect.top + rect.height / 2}px`)
    document.startViewTransition(() => flushSync(apply))
  } else {
    apply()
  }
}

export default function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme()
  const sound = useSound()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const idx = Math.max(0, ORDER.indexOf(theme))
  const tex = TEXTURES[theme] || TEXTURES.forest

  // Close the Atelier on outside click or Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (id, e) => {
    if (id === theme) {
      setOpen(false)
      return
    }
    const card = e.currentTarget
    applyThemeWithSweep(card, () => {
      document.documentElement.setAttribute('data-theme', id)
      setTheme(id)
    })
    sound?.play('themeSwitch')
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'shapeshifter' }))
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        data-cursor="view"
        aria-label={`Theme: ${tex.label} — open theme atelier`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Theme: ${tex.label} — choose from all themes`}
        whileTap={{ scale: 0.92 }}
        className="relative flex items-center rounded-full transition-shadow duration-500 shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-2px_4px_rgba(0,0,0,0.32),0_2px_6px_rgba(0,0,0,0.45)]"
        style={{ width: TRACK_W, height: TRACK_H, padding: PAD, background: tex.track }}
      >
        {/* Position pips */}
        <span className="absolute inset-0 flex items-center justify-between px-[9px]" aria-hidden="true">
          {ORDER.map((id) => (
            <span
              key={id}
              className="w-1 h-1 rounded-full transition-opacity duration-300"
              style={{ background: 'rgba(255,255,255,0.55)', opacity: id === theme ? 0 : 0.7 }}
            />
          ))}
        </span>
        {/* Knob slides via CSS transition so it always moves */}
        <span
          className="relative z-10 rounded-full flex items-center justify-center"
          style={{
            width: KNOB,
            height: KNOB,
            background: tex.knob,
            boxShadow: `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.45)`,
            transform: `translateX(${idx * STEP}px)`,
            transition: 'transform 0.45s var(--ease-anticipate), background 0.35s var(--ease-forge)',
          }}
        >
          <motion.span
            className="relative z-10 w-1.5 h-1.5 rounded-full"
            style={{ background: tex.glow, boxShadow: `0 0 6px 1px ${tex.glow}` }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </motion.button>

      {/* ═══ Theme Atelier ═══ */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Theme atelier"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="atelier-panel"
          >
            <p className="font-mono text-[9px] tracking-[0.3em] text-[var(--ink-faint)] px-3 pt-2 pb-2">
              THEME ATELIER
            </p>
            {themes.map((t) => (
              <button
                key={t.id}
                role="menuitem"
                aria-pressed={t.id === theme}
                onClick={(e) => pick(t.id, e)}
                data-cursor="view"
                className="atelier-card"
                style={{ '--card-accent': t.accent }}
              >
                <span className="atelier-swatch" aria-hidden="true">
                  <span className="absolute inset-0" style={{ background: t.bg }} />
                  <span
                    className="absolute inset-y-0 right-[10px] w-[8px]"
                    style={{ background: t.accent }}
                  />
                  <span
                    className="absolute inset-y-0 right-0 w-[6px]"
                    style={{ background: t.glow }}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-mono text-[10px] tracking-[0.2em] text-[var(--ink)]">
                    {t.label.toUpperCase()}
                    {t.id === theme && (
                      <span className="ml-2" style={{ color: t.accent }}>●</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-[var(--ink-faint)] truncate mt-0.5">
                    {t.meaning}
                  </span>
                </span>
                {/* Mini live preview tile */}
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-md overflow-hidden border border-[var(--glass-border)] ml-2"
                  aria-hidden="true"
                >
                  <span className="block w-full h-full" style={{ background: `radial-gradient(ellipse at 30% 40%, ${t.accent}40, ${t.bg} 70%)` }} />
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
