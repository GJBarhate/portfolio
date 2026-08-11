import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import { useEffect, useRef } from 'react'
import { claimOverlay } from '../../lib/overlayBus.js'

/**
 * P2.3 — the achievement toast now asks for the slot too.
 *
 * It is the one overlay on the list that is *earned* rather than volunteered:
 * it appears because the visitor did something. That is why it is not simply
 * refused when the budget is spent — it still holds the slot so nothing lands
 * on top of it, but it claims `budgeted: false`, because an interruption the
 * visitor caused is not an interruption.
 *
 * The GameContext already owns the timing (toasts remove themselves from
 * `game.toasts`), so the claim is held for as long as there is a toast and
 * released when the list empties.
 */
export default function AchievementToast() {
  const game = useGame()
  const sound = useSound()
  const seen = useRef(new Set())
  const releaseRef = useRef(null)

  useEffect(() => {
    if (!game) return
    game.toasts.forEach((t) => {
      if (!seen.current.has(t.toastId)) {
        seen.current.add(t.toastId)
        sound?.play('achievement')
      }
    })
  }, [game, sound])

  const toastCount = game?.toasts.length ?? 0
  useEffect(() => {
    if (!toastCount) {
      releaseRef.current?.()
      releaseRef.current = null
      return
    }
    if (releaseRef.current) return
    releaseRef.current = claimOverlay('achievement', {
      // The context removes the toast on its own schedule; the bus must not
      // take the slot back while one is still on screen.
      ttl: Infinity,
      budgeted: false,
    })
  }, [toastCount])

  useEffect(() => () => {
    releaseRef.current?.()
    releaseRef.current = null
  }, [])

  if (!game) return null

  return (
    <div className="fixed top-20 right-4 md:right-6 flex flex-col gap-2.5 pointer-events-none" style={{ zIndex: 'var(--z-overlay)' }}>
      <AnimatePresence>
        {game.toasts.map((t) => (
          <motion.div
            key={t.toastId}
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.25 } }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="achievement-toast glass sheen rounded-2xl px-4 py-3 w-64 border border-[var(--accent-dim)] shadow-[0_0_28px_color-mix(in_oklch,var(--accent)_35%,transparent)]"
            style={{ '--toast-ms': '2200ms' }}
          >
            {/* P2.3 — same countdown rail as the spark and welcome-back toasts:
                a card that vanishes without warning reads as a bug. */}
            <span className="achievement-toast__rail" aria-hidden="true" />
            <p className="font-mono text-[12px] tracking-[0.25em] text-[var(--warm)] mb-1">ACHIEVEMENT UNLOCKED</p>
            <p className="font-display text-sm text-[var(--ink)] mb-0.5">{t.title}</p>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-[var(--ink-low)]">{t.desc}</p>
              <span className="font-mono text-[12px] text-[var(--accent-bright)] flex-shrink-0 ml-2">+{t.xp}xp</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
