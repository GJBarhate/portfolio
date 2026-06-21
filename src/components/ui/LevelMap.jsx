import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const LEVELS = [
  { id: 'hero', label: 'START', num: '00' },
  { id: 'about', label: 'ORIGIN', num: '01' },
  { id: 'stats', label: 'STATS', num: '02' },
  { id: 'skills', label: 'SKILLS', num: '03' },
  { id: 'projects', label: 'WORK', num: '04' },
  { id: 'timeline', label: 'PATH', num: '05' },
  { id: 'contact', label: 'LINK', num: '06' },
]

export default function LevelMap() {
  const [active, setActive] = useState('hero')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const sections = LEVELS.map((l) => document.getElementById(l.id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -40% 0px' }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setProgress(h > 0 ? window.scrollY / h : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const activeIdx = LEVELS.findIndex((l) => l.id === active)

  return (
    <nav
      className="fixed right-5 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center gap-0"
      style={{ zIndex: 'var(--z-overlay)' }}
      aria-label="Section navigation"
    >
      <div className="relative flex flex-col items-center">
        {/* Track line */}
        <div
          className="absolute top-2 bottom-2 w-px bg-[var(--void-3)]"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        />
        {/* Filled progress line */}
        <motion.div
          className="absolute top-2 w-px bg-gradient-to-b from-[var(--plasma)] to-[var(--cyan)]"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            boxShadow: '0 0 8px var(--plasma)',
          }}
          animate={{ height: `${progress * 100}%` }}
          transition={{ duration: 0.15, ease: 'linear' }}
        />

        {LEVELS.map((level, i) => {
          const isActive = level.id === active
          const isPast = i <= activeIdx
          return (
            <button
              key={level.id}
              onClick={() => goTo(level.id)}
              className="relative group flex items-center py-3"
              aria-label={`Go to ${level.label}`}
            >
              {/* Node dot */}
              <motion.div
                animate={{
                  scale: isActive ? 1.4 : 1,
                  boxShadow: isActive
                    ? '0 0 14px var(--plasma), 0 0 4px var(--plasma)'
                    : '0 0 0px transparent',
                }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 w-2.5 h-2.5 rounded-full border transition-colors duration-300"
                style={{
                  background: isPast ? 'var(--plasma)' : 'var(--void-2)',
                  borderColor: isPast ? 'var(--plasma)' : 'var(--void-3)',
                }}
              />
              {/* Label tooltip */}
              <div className="absolute right-7 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--void-1)] border border-white/10 whitespace-nowrap">
                  <span className="font-mono text-[9px] tracking-widest text-[var(--plasma-bright)]">
                    {level.num}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider text-[var(--ink-dim)]">
                    {level.label}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
