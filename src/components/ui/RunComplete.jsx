import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'

const STORAGE_KEY = 'forge-best-time'

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function RunComplete() {
  const [show, setShow] = useState(false)
  const [stats, setStats] = useState(null)
  const game = useGame()

  const handleComplete = useCallback(() => {
    if (show) return
    const sparksRaw = localStorage.getItem('forge-sparks')
    const sparks = sparksRaw ? JSON.parse(sparksRaw).length : 0
    const elapsed = Date.now() - (performance.timeOrigin || Date.now())
    const prev = localStorage.getItem(STORAGE_KEY)
    const best = prev ? Math.min(Number(prev), elapsed) : elapsed
    localStorage.setItem(STORAGE_KEY, String(best))

    setStats({
      time: formatTime(elapsed),
      sparks,
      levels: '7/7',
      xp: game?.xp || 0,
      pb: formatTime(best),
      isNewPB: !prev || elapsed <= Number(prev),
    })
    setShow(true)
  }, [show, game?.xp])

  useEffect(() => {
    const el = document.getElementById('contact')
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleComplete()
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleComplete])

  if (!show || !stats) return null

  return (
    <AnimatePresence>
      <motion.div
        className="run-complete"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) setShow(false) }}
      >
        <motion.div
          className="run-complete__card crt-flicker"
          initial={{ scale: 0.85, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="run-complete__title">RUN COMPLETE</h2>
          <p className="run-complete__subtitle">
            {stats.isNewPB ? 'NEW PERSONAL BEST' : 'WELL PLAYED'}
          </p>

          <div className="run-complete__stats">
            <div>
              <div className="run-complete__stat-value">{stats.time}</div>
              <div className="run-complete__stat-label">Time</div>
            </div>
            <div>
              <div className="run-complete__stat-value">{stats.sparks}/5</div>
              <div className="run-complete__stat-label">Sparks</div>
            </div>
            <div>
              <div className="run-complete__stat-value">{stats.levels}</div>
              <div className="run-complete__stat-label">Levels</div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-6">
            <div className="text-center">
              <span className="font-mono text-[10px] text-[var(--ink-low)] tracking-wider">XP EARNED</span>
              <p className="font-display text-lg" style={{ color: 'var(--accent-bright)' }}>{stats.xp}</p>
            </div>
            <div className="text-center">
              <span className="font-mono text-[10px] text-[var(--ink-low)] tracking-wider">BEST TIME</span>
              <p className="font-display text-lg" style={{ color: 'var(--accent-reward)' }}>{stats.pb}</p>
            </div>
          </div>

          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault()
              setShow(false)
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-sm"
            style={{
              background: 'var(--accent-reward)',
              color: 'var(--surface-0)',
              boxShadow: '0 0 32px color-mix(in oklch, var(--accent-reward) 40%, transparent)',
            }}
          >
            Now let&rsquo;s build something — email me
          </a>

          <button
            onClick={() => setShow(false)}
            className="block mx-auto mt-4 font-mono text-[10px] text-[var(--ink-low)] hover:text-[var(--ink)] tracking-wider"
          >
            DISMISS
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
