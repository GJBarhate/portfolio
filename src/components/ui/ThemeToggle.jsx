import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'

const TEXTURES = {
  eclipse: {
    track: 'linear-gradient(155deg, #23404a, #14262e 58%, #0d1a20)',
    knob: 'radial-gradient(circle at 32% 28%, #b8f0f2, #3ac6c9 42%, #1d8a8d 80%, #10585a)',
    glow: '#7fe3e5',
    label: 'ECLIPSE',
  },
  ember: {
    track: 'linear-gradient(155deg, #23201a, #0d0c0a 60%, #060605)',
    knob: 'radial-gradient(circle at 32% 28%, #f4e3b2, #d4b876 45%, #9a7d3f 80%, #6b5426)',
    glow: '#f0e0b8',
    label: 'EMBER',
  },
  paper: {
    track: 'linear-gradient(155deg, #fff8ec, #ffe9c2 55%, #f3d59a)',
    // §6.4 — a near-white knob on a cream track lands nowhere near APCA Lc 45;
    // the outer ring is darkened (#7fc4c8 → #5eb3b8) so the knob has an edge
    // you can actually see. The other two knobs sit on dark tracks and pass.
    knob: 'radial-gradient(circle at 32% 28%, #ffffff, #cfe9ec 38%, #5eb3b8 78%, #2f7f84)',
    glow: '#1f7d86',
    label: 'PAPER',
  },
}

const ORDER = ['eclipse', 'ember', 'paper']

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
  const tex = TEXTURES[theme] || TEXTURES.eclipse

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
      <button
        onClick={() => setOpen((v) => !v)}
        data-cursor="view"
        aria-label={`Theme: ${tex.label} — open theme atelier`}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Theme: ${tex.label} — choose from all themes`}
        className="theme-toggle spring-press relative flex items-center rounded-full"
        style={{ width: TRACK_W, height: TRACK_H, padding: PAD, background: tex.track }}
      >
        {/* Position pips */}
        <span className="absolute inset-0 flex items-center justify-between px-[9px]" aria-hidden="true">
          {ORDER.map((id) => (
            <span
              key={id}
              className="w-1 h-1 rounded-full transition-opacity duration-fast"
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
            // §6.3 — 450ms was slower than every other control on the page.
            transition: 'transform var(--dur-base) var(--ease-anticipate), background var(--dur-fast) var(--ease-forge)',
          }}
        >
          {/* J3 — was a Framer `repeat: Infinity` loop running forever in the
              navbar, i.e. permanently outside the animation gate. As CSS with
              data-loop it parks the moment it scrolls out of view. */}
          <span
            className="theme-toggle__pulse relative z-10 w-1.5 h-1.5 rounded-full"
            data-loop="knob-pulse"
            style={{ background: tex.glow, boxShadow: `0 0 6px 1px ${tex.glow}` }}
          />
        </span>
      </button>

      {/* ═══ Theme Atelier ═══ */}
      {open && (
          <div
            role="menu"
            aria-label="Theme atelier"
            className="atelier-panel atelier-panel--in"
          >
            <p className="font-mono text-[9px] tracking-[0.3em] text-[var(--ink-low)] px-3 pt-2 pb-2">
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
                  <span className="block text-[11px] text-[var(--ink-low)] truncate mt-0.5">
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
          </div>
      )}
    </div>
  )
}
