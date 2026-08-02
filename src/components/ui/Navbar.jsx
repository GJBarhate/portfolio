import { useEffect, useRef, useState } from 'react'
import { onFrame } from '../../lib/raf.js'
import { useSmoothScroll } from '../../contexts/SmoothScrollContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import MagneticButton from './MagneticButton.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import RecruiterMode from './RecruiterMode.jsx'
import MorphLink from './MorphLink.jsx'
import { SparkCounter } from './SparkHunt.jsx'

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'stats', label: 'Stats' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Work' },
  { id: 'timeline', label: 'Journey' },
  { id: 'how-i-build', label: 'Process' },
  { id: 'contact', label: 'Contact' },
]

const RING_R = 18
const RING_C = 2 * Math.PI * RING_R

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const scroll = useSmoothScroll()
  const sound = useSound()
  const ringRef = useRef(null)

  // The progress ring is written straight onto the SVG attribute from the
  // shared ticker — no React re-render per scroll frame, and no spring engine
  // in the critical path to draw one circle (§8.3).
  useEffect(() => {
    const circle = ringRef.current
    if (!circle) return
    let value = 0
    return onFrame((_t, dt) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      value += (target - value) * (1 - Math.exp(-(dt / 1000) * 10))
      circle.style.strokeDashoffset = (RING_C * (1 - value)).toFixed(2)
    })
  }, [])

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const goTo = (id) => {
    setOpen(false)
    const el = document.getElementById(id)
    if (!el) return
    if (scroll?.lenis?.current) {
      scroll.lenis.current.scrollTo(el, { offset: -80 })
    } else {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const toggleMute = () => {
    sound?.setMuted((v) => !v)
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 container-px py-4 flex items-center justify-between progressive-blur bg-[color-mix(in_oklch,var(--surface-0)_70%,transparent)] border-b border-[var(--glass-border)]"
      style={{ zIndex: 'var(--z-nav)' }}
    >
      <a href="#hero" data-cursor="view" className="font-display text-sm tracking-wide text-[var(--ink)]">
        Gaurav Barhate
      </a>

      <nav className="hidden md:flex items-center gap-8 font-mono text-xs tracking-wider">
        {LINKS.map((l) => (
          <button
            key={l.id}
            data-cursor="view"
            onClick={() => goTo(l.id)}
            onMouseEnter={() => sound?.play('hover')}
            className={`uppercase ${
              active === l.id ? 'text-[var(--accent-bright)]' : ''
            }`}
          >
            <MorphLink className={active === l.id ? 'text-[var(--accent-bright)]' : ''}>
              {l.label}
            </MorphLink>
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
            data-cursor="view"
            className="arcade-nav-btn group relative px-3 py-1.5 rounded-full font-mono text-[11px] tracking-wider flex items-center gap-1.5 transition-all duration-fast"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <span className="arcade-nav-icon text-[13px]">🎮</span>
              <span className="arcade-nav-text">ARCADE</span>
              <span className="arcade-nav-dot w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
            </span>
          </button>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-fast pointer-events-none">
            <div className="bg-[var(--surface-1)] border border-[var(--accent-dim)] rounded-xl p-3 shadow-2xl min-w-[180px]">
              <p className="font-mono text-[8px] tracking-[0.25em] text-[var(--accent-bright)] mb-2 text-center">5 GAMES</p>
              <div className="space-y-1">
                {[
                  { icon: '🏃', label: 'Forge Runner' },
                  { icon: '🎲', label: 'Ludo: Recruiter' },
                  { icon: '🪜', label: 'Snakes & CV' },
                  { icon: '🧠', label: 'Memory Match' },
                  { icon: '🐍', label: 'Snake Classic' },
                ].map((g) => (
                  <div key={g.label} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                    <span className="text-[11px]">{g.icon}</span>
                    <span className="font-mono text-[9px] text-[var(--ink-mid)]">{g.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex items-center gap-4">
        <RecruiterMode />
        <SparkCounter />
        <ThemeToggle />

        <button
          onClick={toggleMute}
          data-cursor="view"
          aria-label={sound?.muted ? 'Unmute sound' : 'Mute sound'}
          className="w-8 h-8 rounded-full border border-[var(--glass-border)] bg-[var(--surface-2)] flex items-center justify-center hover:border-[var(--accent-dim)] transition-colors duration-fast font-mono text-[9px] text-[var(--ink-mid)]"
        >
          {sound?.muted ? 'OFF' : 'ON'}
        </button>

        <svg width="40" height="40" className="hidden md:block">
          <circle cx="20" cy="20" r={RING_R} fill="none" stroke="var(--surface-3)" strokeWidth="2" />
          <circle
            ref={ringRef}
            cx="20"
            cy="20"
            r={RING_R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray={RING_C}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            style={{ strokeDashoffset: RING_C }}
          />
        </svg>

        <button
          data-cursor="menu"
          onClick={() => setOpen((v) => !v)}
          className="nav-burger md:hidden flex flex-col gap-1.5 w-7 h-7 justify-center"
          data-open={open}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span className="nav-burger__bar" />
          <span className="nav-burger__bar" />
          <span className="nav-burger__bar" />
        </button>

        <MagneticButton
          as="a"
          href="/Gaurav_Resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="view"
          className="hidden sm:inline-flex items-center px-5 py-2 rounded-full border border-[var(--accent-dim)] text-xs font-mono tracking-wider hover:border-[var(--accent)] hover:shadow-[0_0_24px_var(--accent-dim)]"
        >
          RESUME
        </MagneticButton>
      </div>

      {/* `height: auto` cannot be animated by CSS, but `grid-template-rows`
          can — the standard zero-JS accordion. */}
      <div className="nav-drawer md:hidden" data-open={open}>
        <div className="nav-drawer__inner">
          <div className="flex flex-col p-6 gap-4">
            {LINKS.map((l, i) => (
              <button
                key={l.id}
                onClick={() => goTo(l.id)}
                style={{ '--i': i }}
                className="nav-drawer__link text-left font-display text-2xl text-[var(--ink-mid)] hover:text-[var(--accent-bright)]"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
