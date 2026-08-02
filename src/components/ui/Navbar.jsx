import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useSmoothScroll } from '../../contexts/SmoothScrollContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import MagneticButton from './MagneticButton.jsx'
import ThemeToggle from './ThemeToggle.jsx'
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
  // Motion values update the SVG directly — no React re-render per scroll frame
  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 240, damping: 36, mass: 0.3 })
  const ringOffset = useTransform(smoothProgress, [0, 1], [RING_C, 0])

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
            className="arcade-nav-btn group relative px-3 py-1.5 rounded-full font-mono text-[11px] tracking-wider flex items-center gap-1.5 transition-all duration-300"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <span className="arcade-nav-icon text-[13px]">🎮</span>
              <span className="arcade-nav-text">ARCADE</span>
              <span className="arcade-nav-dot w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
            </span>
          </button>
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none">
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
        <SparkCounter />
        <ThemeToggle />

        <button
          onClick={toggleMute}
          data-cursor="view"
          aria-label={sound?.muted ? 'Unmute sound' : 'Mute sound'}
          className="w-8 h-8 rounded-full border border-[var(--glass-border)] bg-[var(--surface-2)] flex items-center justify-center hover:border-[var(--accent-dim)] transition-colors duration-300 font-mono text-[9px] text-[var(--ink-mid)]"
        >
          {sound?.muted ? 'OFF' : 'ON'}
        </button>

        <svg width="40" height="40" className="hidden md:block">
          <circle cx="20" cy="20" r={RING_R} fill="none" stroke="var(--surface-3)" strokeWidth="2" />
          <motion.circle
            cx="20"
            cy="20"
            r={RING_R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray={RING_C}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            style={{ strokeDashoffset: ringOffset }}
          />
        </svg>

        <button
          data-cursor="menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex flex-col gap-1.5 w-7 h-7 justify-center"
          aria-label="Toggle menu"
        >
          <motion.span animate={{ rotate: open ? 45 : 0, y: open ? 6 : 0 }} className="h-px w-full bg-[var(--ink)]" />
          <motion.span animate={{ opacity: open ? 0 : 1 }} className="h-px w-full bg-[var(--ink)]" />
          <motion.span animate={{ rotate: open ? -45 : 0, y: open ? -6 : 0 }} className="h-px w-full bg-[var(--ink)]" />
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

      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="md:hidden absolute top-full left-0 right-0 overflow-hidden bg-[var(--surface-0)] border-b border-[var(--glass-border)]"
      >
        <div className="flex flex-col p-6 gap-4">
          {LINKS.map((l, i) => (
            <motion.button
              key={l.id}
              onClick={() => goTo(l.id)}
              initial={false}
              animate={{ x: open ? 0 : -20 }}
              transition={{ delay: i * 0.04 }}
              className="text-left font-display text-2xl text-[var(--ink-mid)] hover:text-[var(--accent-bright)]"
            >
              {l.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </header>
  )
}
