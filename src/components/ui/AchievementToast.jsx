import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import { useEffect, useRef } from 'react'

export default function AchievementToast() {
  const game = useGame()
  const sound = useSound()
  const seen = useRef(new Set())

  useEffect(() => {
    if (!game) return
    game.toasts.forEach((t) => {
      if (!seen.current.has(t.toastId)) {
        seen.current.add(t.toastId)
        sound?.play('achievement')
      }
    })
  }, [game, sound])

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
            className="glass sheen rounded-2xl px-4 py-3 w-64 border border-[var(--accent-dim)] shadow-[0_0_28px_color-mix(in_oklch,var(--accent)_35%,transparent)]"
          >
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
