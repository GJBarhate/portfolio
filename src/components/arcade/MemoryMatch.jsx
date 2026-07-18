import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TECH = [
  { name: 'React',    hint: 'Component-based UI library I use for every frontend' },
  { name: 'Node.js',  hint: 'Runtime for my backend services and APIs' },
  { name: 'MongoDB',  hint: 'Primary document database across all projects' },
  { name: 'WebSocket',hint: 'Real-time bidirectional communication in PeerCode' },
  { name: 'Redis',    hint: 'Caching and pub/sub in FlowShield and PeerCode' },
  { name: 'Docker',   hint: 'Containerization for consistent deployments' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function MemoryMatch() {
  const cards = useMemo(() => {
    const pairs = TECH.flatMap((t, i) => [
      { id: i * 2, pairId: i, name: t.name, hint: t.hint },
      { id: i * 2 + 1, pairId: i, name: t.name, hint: t.hint },
    ])
    return shuffle(pairs)
  }, [])

  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const [showHint, setShowHint] = useState(null)
  const [moves, setMoves] = useState(0)

  useEffect(() => {
    if (flipped.length !== 2) return
    const [a, b] = flipped
    if (cards[a].pairId === cards[b].pairId) {
      setMatched((m) => [...m, cards[a].pairId])
      setShowHint(cards[a])
      setFlipped([])
      const hintTimer = setTimeout(() => setShowHint(null), 2000)
      return () => clearTimeout(hintTimer)
    } else {
      const timer = setTimeout(() => setFlipped([]), 800)
      return () => clearTimeout(timer)
    }
  }, [flipped, cards])

  const onFlip = (id) => {
    if (flipped.length >= 2 || flipped.includes(id) || matched.includes(cards[id].pairId)) return
    setFlipped((f) => [...f, id])
    setMoves((m) => m + 1)
  }

  const won = matched.length === TECH.length

  useEffect(() => {
    if (!won) return
    try {
      const prev = parseInt(localStorage.getItem('forge-memory-best')) || Infinity
      if (moves < prev) localStorage.setItem('forge-memory-best', String(moves))
    } catch {}
  }, [won, moves])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4 font-mono text-[10px] tracking-wider text-[var(--ink-faint)]">
        <span>MOVES: <span className="text-[var(--ink)]">{moves}</span></span>
        <span>PAIRS: <span className="text-[var(--plasma-bright)]">{matched.length}/{TECH.length}</span></span>
        <button
          onClick={() => { setFlipped([]); setMatched([]); setMoves(0); setShowHint(null) }}
          className="px-3 py-1 rounded-full border border-[var(--glass-border)] text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors"
        >
          RESET
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2" style={{ perspective: 800 }}>
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.id) || matched.includes(card.pairId)
          return (
            <button
              key={card.id}
              onClick={() => onFlip(card.id)}
              className="w-16 h-16 rounded-xl transition-all duration-300"
              style={{
                background: isFlipped ? 'var(--void-2)' : 'var(--void-1)',
                border: `1px solid ${isFlipped ? 'var(--plasma-dim)' : 'var(--glass-border)'}`,
                boxShadow: isFlipped ? '0 0 12px color-mix(in oklch, var(--plasma) 20%, transparent)' : 'none',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                backfaceVisibility: 'hidden',
              }}
            >
              <span
                className="font-mono text-xs font-bold block"
                style={{
                  color: isFlipped ? 'var(--plasma-bright)' : 'transparent',
                  opacity: isFlipped ? 1 : 0,
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {isFlipped ? card.name.slice(0, 2) : '?'}
              </span>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {showHint && (
          <motion.div
            key={showHint.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-[var(--void-2)] border border-[var(--plasma-dim)] text-center max-w-xs"
          >
            <p className="font-mono text-xs text-[var(--plasma-bright)] mb-1">{showHint.name}</p>
            <p className="text-[11px] text-[var(--ink-dim)]">{showHint.hint}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {won && (
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="font-display text-lg text-[var(--plasma-bright)]"
        >
          All matched! You unlocked the tech constellation.
        </motion.p>
      )}
    </div>
  )
}
