import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const VISIT_KEY = 'forge-last-visit'
const SPARK_KEY = 'forge-sparks'

export default function WelcomeBackToast() {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const lastVisit = localStorage.getItem(VISIT_KEY)
    const now = Date.now()
    localStorage.setItem(VISIT_KEY, String(now))

    if (!lastVisit) return

    const hoursSince = (now - Number(lastVisit)) / (1000 * 60 * 60)
    if (hoursSince < 1) return

    let sparks = []
    try { sparks = JSON.parse(localStorage.getItem(SPARK_KEY)) || [] } catch {}
    const sparksLeft = 5 - sparks.length

    if (sparksLeft > 0 && sparksLeft < 5) {
      setMessage(`Welcome back — ${sparksLeft} spark${sparksLeft === 1 ? '' : 's'} left to find`)
    } else {
      setMessage('Welcome back to the forge')
    }

    const t1 = setTimeout(() => setShow(true), 2500)
    const t2 = setTimeout(() => setShow(false), 7000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 welcome-toast glass rounded-full px-5 py-2.5 border border-[var(--glass-border)] flex items-center gap-3"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
          <span className="font-mono text-[11px] tracking-wide text-[var(--ink-mid)]">
            {message}
          </span>
          <button
            onClick={() => setShow(false)}
            className="text-[var(--ink-low)] hover:text-[var(--ink)] text-xs ml-1"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
