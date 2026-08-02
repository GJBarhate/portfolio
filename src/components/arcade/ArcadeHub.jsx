import { useState, useEffect } from 'react'
import '../../styles/arcade.css'
import { motion, AnimatePresence } from 'framer-motion'
import ForgeRunner from './ForgeRunner.jsx'
import MemoryMatch from './MemoryMatch.jsx'
import SnakeLaddersCV from './SnakeLaddersCV.jsx'
import LudoRecruiter from './LudoRecruiter.jsx'
import SnakeClassic from './SnakeClassic.jsx'
import { useGame } from '../../contexts/GameContext.jsx'

function getBest(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

const GAMES = [
  { id: 'runner',   label: 'FORGE RUNNER',     icon: '🏃', color: 'var(--accent)', lsKey: 'forge-runner-highscore', desc: '3-lane endless runner' },
  { id: 'ludo',     label: 'LUDO: RECRUITER',  icon: '🎲', color: 'var(--warm)',  lsKey: 'forge-ludo-best', desc: 'Race 4 project tokens' },
  { id: 'snakes',   label: 'SNAKES & CV',      icon: '🪜', color: 'var(--violet)',  lsKey: 'forge-snakes-best', desc: 'Career board — ladders & snakes' },
  { id: 'memory',   label: 'MEMORY MATCH',     icon: '🧠', color: 'var(--accent)', lsKey: 'forge-memory-best', desc: 'Flip tech pairs' },
  { id: 'snake',    label: 'SNAKE (CLASSIC)',  icon: '🐍', color: 'var(--warm)', lsKey: null, desc: 'Konami code classic' },
]

export default function ArcadeHub({ open, onClose, initialGame = null }) {
  // The Konami code used to summon a second, near-identical Snake in its own
  // chunk (`MiniGame.jsx`). It now lands straight on this cabinet's classic.
  const [activeGame, setActiveGame] = useState(initialGame)
  const [best, setBest] = useState(() => Object.fromEntries(GAMES.filter(g => g.lsKey).map(g => [g.id, getBest(g.lsKey)])))
  const { xp, percent } = useGame()

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (activeGame) setActiveGame(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, activeGame, onClose])

  if (!open) return null

  return (
    <motion.div
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center px-4"
      style={{ zIndex: 'var(--z-cmdpal)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="arcade-cabinet rounded-3xl p-6 md:p-8 w-full max-w-2xl scanline"
        data-theme="ember"
      >
        <AnimatePresence mode="wait">
          {!activeGame ? (
            <motion.div key="menu" exit={{ opacity: 0, y: -10 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--accent-bright)] insert-coin">
                    INSERT COIN TO PLAY
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl mt-1">ARCADE</h2>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-full border border-[var(--glass-border)] flex items-center justify-center text-[var(--ink-low)] hover:text-[var(--ink)] transition-colors font-mono text-xs">
                  ESC ✕
                </button>
              </div>

              <div className="mb-6 p-3 rounded-xl clay--inset">
                <div className="flex justify-between font-mono text-[10px] text-[var(--ink-low)] mb-1.5">
                  <span>PLAYER XP</span>
                  <span>{xp} / 140</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--accent-dim), var(--accent))' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>

              <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {GAMES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGame(g.id)
                      window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'compiler' }))
                    }}
                    className="clay-btn w-full text-left p-3 rounded-xl flex items-center gap-3 group"
                  >
                    <span className="text-xl flex-shrink-0">{g.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] tracking-[0.15em]" style={{ color: g.color }}>{g.label}</p>
                      <p className="text-[10px] text-[var(--ink-low)] mt-0.5 truncate">{g.desc}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {best[g.id] && (
                        <span className="font-mono text-[8px] text-[var(--accent-bright)]">BEST: {best[g.id]}</span>
                      )}
                      <motion.span className="font-mono text-[9px] text-[var(--ink-low)] group-hover:text-[var(--ink)] transition-colors" whileHover={{ x: 3 }}>
                        PLAY &rarr;
                      </motion.span>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-4 font-mono text-[8px] tracking-[0.2em] text-[var(--ink-low)] text-center">
                Keyboard + touch &middot; Reduced-motion: turn-based games only
              </p>
            </motion.div>
          ) : (
            <motion.div key={activeGame} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setActiveGame(null)} className="font-mono text-[10px] tracking-wider text-[var(--ink-low)] hover:text-[var(--accent-bright)] transition-colors">
                  &larr; BACK TO ARCADE
                </button>
                <button onClick={onClose} className="font-mono text-[10px] text-[var(--ink-low)] hover:text-[var(--ink)]">
                  ESC ✕
                </button>
              </div>
              <div className="arcade-game-area">
                {activeGame === 'runner' && <ForgeRunner />}
                {activeGame === 'memory' && <MemoryMatch />}
                {activeGame === 'snakes' && <SnakeLaddersCV />}
                {activeGame === 'ludo' && <LudoRecruiter />}
                {activeGame === 'snake' && <SnakeClassic />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
