import { useEffect, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { useIsMobile } from '../../lib/useIsMobile.js'

const LEVELS = [
  { id: 'hero', label: 'START', num: '00' },
  { id: 'about', label: 'ORIGIN', num: '01' },
  { id: 'stats', label: 'STATS', num: '02' },
  { id: 'skills', label: 'SKILLS', num: '03' },
  { id: 'projects', label: 'WORK', num: '04' },
  { id: 'timeline', label: 'PATH', num: '05' },
  { id: 'contact', label: 'LINK', num: '06' },
]

function PixelAvatar({ className = '' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" className={className} aria-hidden="true">
      <rect x="5" y="0" width="6" height="3" fill="var(--accent-reward)" />
      <rect x="4" y="3" width="8" height="4" fill="var(--accent-bright)" />
      <rect x="3" y="7" width="10" height="3" fill="var(--accent)" />
      <rect x="5" y="10" width="2" height="3" fill="var(--ink-mid)" />
      <rect x="9" y="10" width="2" height="3" fill="var(--ink-mid)" />
      <rect x="4" y="5" width="2" height="2" fill="var(--surface-0)" />
      <rect x="10" y="5" width="2" height="2" fill="var(--surface-0)" />
    </svg>
  )
}

export default function LevelMap() {
  const [active, setActive] = useState('hero')
  const [passed, setPassed] = useState(new Set())
  const isMobile = useIsMobile()
  const { scrollYProgress } = useScroll()
  const smooth = useSpring(scrollYProgress, { stiffness: 260, damping: 38, mass: 0.3 })
  const fillHeight = useTransform(smooth, (v) => `${(v * 100).toFixed(2)}%`)
  const mobileWidth = useTransform(smooth, (v) => `${(v * 100).toFixed(2)}%`)

  useEffect(() => {
    const sections = LEVELS.map((l) => document.getElementById(l.id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
            setPassed((prev) => new Set([...prev, entry.target.id]))
          }
        })
      },
      { rootMargin: '-40% 0px -40% 0px' }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const goTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const activeIdx = LEVELS.findIndex((l) => l.id === active)

  if (isMobile) {
    return (
      <div className="avatar-track--mobile">
        <motion.div className="avatar-track__fill" style={{ width: mobileWidth }} />
      </div>
    )
  }

  return (
    <nav
      className="fixed right-5 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-0"
      style={{ zIndex: 'var(--z-overlay)' }}
      aria-label="Section navigation"
    >
      <div className="relative flex flex-col items-center">
        <div
          className="absolute top-2 bottom-2 w-px bg-[var(--surface-3)]"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        />
        <motion.div
          className="absolute top-2 w-px bg-gradient-to-b from-[var(--accent)] to-[var(--accent-reward)]"
          style={{
            left: '50%',
            translateX: '-50%',
            boxShadow: '0 0 8px var(--accent)',
            height: fillHeight,
          }}
        />

        {LEVELS.map((level, i) => {
          const isActive = level.id === active
          const isPast = passed.has(level.id)
          return (
            <button
              key={level.id}
              onClick={() => goTo(level.id)}
              className="relative group flex items-center py-3"
              aria-label={`Go to ${level.label}`}
            >
              {isActive && (
                <motion.div
                  className="absolute -left-7 avatar-track__avatar"
                  layoutId="avatar"
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <PixelAvatar />
                </motion.div>
              )}

              <motion.div
                animate={{
                  scale: isActive ? 1.4 : 1,
                  boxShadow: isActive
                    ? '0 0 14px var(--accent), 0 0 4px var(--accent)'
                    : isPast
                    ? '0 0 8px var(--accent-reward)'
                    : '0 0 0px transparent',
                }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={`relative z-10 w-2.5 h-2.5 rounded-full border transition-colors duration-fast ${
                  isPast && !isActive ? 'avatar-track__stamp' : ''
                }`}
                style={{
                  background: isPast
                    ? isActive
                      ? 'var(--accent)'
                      : 'var(--accent-reward)'
                    : 'var(--surface-2)',
                  borderColor: isPast
                    ? isActive
                      ? 'var(--accent)'
                      : 'var(--accent-reward)'
                    : 'var(--surface-3)',
                }}
              />

              <div className="absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-fast">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--glass-border)] whitespace-nowrap">
                  <span className="font-mono text-[9px] tracking-widest" style={{ color: isPast ? 'var(--accent-reward)' : 'var(--accent-bright)' }}>
                    {level.num}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider text-[var(--ink-mid)]">
                    {level.label}
                  </span>
                  {isPast && !isActive && (
                    <span className="text-[9px]" style={{ color: 'var(--accent-reward)' }}>✓</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
