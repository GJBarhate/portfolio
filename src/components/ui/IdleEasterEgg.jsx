import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const IDLE_MS = 30_000

export default function IdleEasterEgg() {
  const [idle, setIdle] = useState(false)
  const [walked, setWalked] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const wake = () => {
      setIdle(false)
      setWalked(false)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIdle(true), IDLE_MS)
    }

    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('keydown', wake)
    window.addEventListener('scroll', wake, { passive: true })
    window.addEventListener('touchstart', wake)

    return () => {
      clearTimeout(timerRef.current)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('scroll', wake)
      window.removeEventListener('touchstart', wake)
    }
  }, [])

  useEffect(() => {
    if (idle) {
      const t = setTimeout(() => setWalked(true), 12500)
      return () => clearTimeout(t)
    }
  }, [idle])

  return (
    <AnimatePresence>
      {idle && !walked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-3 left-0 z-40 pointer-events-none idle-bot"
          aria-hidden="true"
        >
          <div className="idle-bot__body flex flex-col items-center">
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none" className="drop-shadow-[0_0_6px_var(--plasma)]">
              {/* head */}
              <rect x="8" y="0" width="8" height="8" rx="1" fill="var(--plasma-bright)" />
              {/* eyes */}
              <rect x="10" y="3" width="2" height="2" fill="var(--void-0)" />
              <rect x="14" y="3" width="2" height="2" fill="var(--void-0)" />
              {/* body */}
              <rect x="6" y="9" width="12" height="10" rx="1" fill="var(--plasma)" />
              {/* arms */}
              <rect x="2" y="10" width="4" height="3" rx="1" fill="var(--plasma-dim)" />
              <rect x="18" y="10" width="4" height="3" rx="1" fill="var(--plasma-dim)" />
              {/* legs */}
              <rect x="7" y="20" width="4" height="6" rx="1" fill="var(--plasma-dim)" />
              <rect x="13" y="20" width="4" height="6" rx="1" fill="var(--plasma-dim)" />
              {/* hammer */}
              <rect x="19" y="6" width="3" height="8" rx="1" fill="var(--ember)" />
              <rect x="18" y="5" width="5" height="3" rx="1" fill="var(--ember-dim)" />
            </svg>
            <motion.span
              className="font-mono text-[8px] text-[var(--ink-faint)] mt-1 whitespace-nowrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 4, delay: 3, times: [0, 0.1, 0.8, 1] }}
            >
              still forging...
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
