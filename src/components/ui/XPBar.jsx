import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'

export default function XPBar() {
  const game = useGame()
  if (!game) return null

  return (
    <div
      className="fixed top-[60px] left-0 right-0 h-[3px] bg-[var(--void-3)]/60"
      style={{ zIndex: 'var(--z-nav)' }}
      aria-hidden="true"
    >
      <motion.div
        className="h-full bg-gradient-to-r from-[var(--plasma)] via-[var(--cyan)] to-[var(--plasma-bright)]"
        style={{ boxShadow: '0 0 10px var(--plasma)' }}
        initial={{ width: 0 }}
        animate={{ width: `${game.percent}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}
