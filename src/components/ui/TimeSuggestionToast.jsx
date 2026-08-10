import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { claimOverlay } from '../../lib/overlayBus.js'

/** Long enough to read two lines and press a button; short enough to leave. */
const VISIBLE_MS = 8000

/**
 * P2.3 / D-10f — the theme suggestion joins the bus.
 *
 * `ThemeContext` decides WHETHER there is a suggestion; this decides whether
 * the visitor gets to see it, which is a different question and was previously
 * nobody's. It also fires 3 s after a theme change, i.e. potentially inside the
 * quiet period, where the arbiter now refuses it outright.
 */
export default function TimeSuggestionToast() {
  const { suggestion, acceptSuggestion, dismissSuggestion } = useTheme()
  const [granted, setGranted] = useState(false)
  const releaseRef = useRef(null)

  useEffect(() => {
    if (!suggestion) {
      releaseRef.current?.()
      releaseRef.current = null
      setGranted(false)
      return
    }
    const release = claimOverlay('time-suggestion', {
      ttl: VISIBLE_MS,
      onExpire: dismissSuggestion,
    })
    if (!release) {
      // Refused. Clear the suggestion so the context does not hold a pending
      // one forever waiting for a slot that is never coming.
      dismissSuggestion()
      return
    }
    releaseRef.current = release
    setGranted(true)
    return () => {
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [suggestion, dismissSuggestion])

  return (
    <AnimatePresence>
      {suggestion && granted && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          /*
            `left-1/2` + `translateX(-50%)` with only a MAX width is the classic
            centring trap: the box's available width is what remains to the
            right of the 50% offset — half the viewport — not the viewport. At
            390px that left ~195px, and after padding, the gap and two
            `flex-shrink-0` buttons the paragraph was handed a negative
            remainder and wrapped to one character per line. An explicit width
            is what makes the translate honest.
          */
          className="fixed bottom-8 left-1/2 z-[var(--z-cmdpal)] glass rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 shadow-2xl border border-[var(--glass-border)]"
          style={{ width: 'min(420px, calc(100vw - 2rem))' }}
        >
          <p className="text-sm text-[var(--ink-mid)] flex-1">{suggestion.toast}</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={acceptSuggestion}
              className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[var(--surface-0)] text-[12px] font-mono tracking-wider"
            >
              Switch
            </button>
            <button
              onClick={dismissSuggestion}
              className="px-3 py-1.5 rounded-full border border-[var(--glass-border)] text-[var(--ink-low)] text-[12px] font-mono hover:text-[var(--ink)] transition-colors"
            >
              No thanks
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
