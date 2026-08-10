import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

import { getStore, setStore } from '../../lib/store.js'
import { claimOverlay } from '../../lib/overlayBus.js'

// T-030 — both facts this component needs live in the one store.

/*
 * P2 — this used to time itself: up at 2.5 s, gone at 6 s, on two setTimeouts
 * of its own. Both numbers were reasonable and neither was coordinated with
 * anything else, so on a first visit it could land on top of the coach chip.
 * It now asks the arbiter and lets the arbiter own the clock.
 *
 * 2.5 s is also inside the 10 s quiet period, which means this toast is now
 * simply refused on a fresh load — correctly. "Welcome back" has nothing to
 * say to someone who is still watching the page assemble.
 */
const VISIBLE_MS = 3500

export default function WelcomeBackToast() {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const releaseRef = useRef(null)

  const dismiss = useCallback(() => {
    setShow(false)
    releaseRef.current?.()
    releaseRef.current = null
  }, [])

  useEffect(() => {
    const store = getStore()
    const lastVisit = store.seen.lastVisit
    const now = Date.now()
    setStore({ seen: { lastVisit: now } })

    if (!Number.isFinite(lastVisit)) return

    const hoursSince = (now - lastVisit) / (1000 * 60 * 60)
    if (hoursSince < 1) return

    const sparksLeft = 5 - store.sparks.length

    if (sparksLeft > 0 && sparksLeft < 5) {
      setMessage(`Welcome back — ${sparksLeft} spark${sparksLeft === 1 ? '' : 's'} left to find`)
    } else {
      setMessage('Welcome back to the forge')
    }

    const t1 = setTimeout(() => {
      const release = claimOverlay('welcome-back', {
        ttl: VISIBLE_MS,
        onExpire: () => setShow(false),
      })
      if (!release) return
      releaseRef.current = release
      setShow(true)
    }, 2500)
    return () => {
      clearTimeout(t1)
      releaseRef.current?.()
      releaseRef.current = null
    }
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
          <span className="font-mono text-[12px] tracking-wide text-[var(--ink-mid)]">
            {message}
          </span>
          <button
            onClick={dismiss}
            className="text-[var(--ink-low)] hover:text-[var(--ink)] text-xs ml-1"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
