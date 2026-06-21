import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useSmoothScroll } from '../../contexts/SmoothScrollContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import MagneticButton from './MagneticButton.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'stats', label: 'Stats' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Work' },
  { id: 'timeline', label: 'Journey' },
  { id: 'contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const scroll = useSmoothScroll()
  const sound = useSound()
  const progress = scroll?.progress ?? 0

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

  const r = 18
  const circumference = 2 * Math.PI * r

  return (
    <header
      className="fixed top-0 left-0 right-0 container-px py-4 flex items-center justify-between backdrop-blur-md bg-[color-mix(in_oklch,var(--void-0)_70%,transparent)] border-b border-white/5"
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
            className={`uppercase transition-colors duration-300 ${
              active === l.id ? 'text-[var(--plasma-bright)]' : 'text-[var(--ink-dim)] hover:text-[var(--ink)]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <button
          onClick={toggleMute}
          data-cursor="view"
          aria-label={sound?.muted ? 'Unmute sound' : 'Mute sound'}
          className="w-8 h-8 rounded-full border border-white/15 bg-[var(--void-2)] flex items-center justify-center hover:border-[var(--plasma-dim)] transition-colors duration-300 font-mono text-[9px] text-[var(--ink-dim)]"
        >
          {sound?.muted ? 'OFF' : 'ON'}
        </button>

        <svg width="40" height="40" className="hidden md:block">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--void-3)" strokeWidth="2" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke="var(--plasma)"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
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
          className="hidden sm:inline-flex items-center px-5 py-2 rounded-full border border-[var(--plasma-dim)] text-xs font-mono tracking-wider hover:border-[var(--plasma)] hover:shadow-[0_0_24px_var(--plasma-dim)]"
        >
          RESUME
        </MagneticButton>
      </div>

      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="md:hidden absolute top-full left-0 right-0 overflow-hidden bg-[var(--void-0)] border-b border-white/5"
      >
        <div className="flex flex-col p-6 gap-4">
          {LINKS.map((l, i) => (
            <motion.button
              key={l.id}
              onClick={() => goTo(l.id)}
              initial={false}
              animate={{ x: open ? 0 : -20 }}
              transition={{ delay: i * 0.04 }}
              className="text-left font-display text-2xl text-[var(--ink-dim)] hover:text-[var(--plasma-bright)]"
            >
              {l.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </header>
  )
}
