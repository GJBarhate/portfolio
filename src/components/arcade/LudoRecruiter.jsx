import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PROJECTS } from '../../lib/content.js'
import { useSound } from '../../contexts/SoundContext.jsx'
import Dice3D from '../ui/Dice3D.jsx'
import { setStore } from '../../lib/store.js'

const TOKENS = PROJECTS.slice(0, 4).map((p, i) => ({
  id: p.id,
  label: p.title,
  color: p.accent,
  start: i * 6,
  pathLen: 20,
}))

function rollDice() {
  const facts = [
    'Built PeerCode — a real-time interview platform with WebRTC + CRDT.',
    'FlowShield monitors webhooks with automatic retry and analytics.',
    'VoiceAns uses Gemini AI for speech-to-text interview coaching.',
    'OneCart is a full AI-powered e-commerce platform.',
    'Built an LMS with separate student/educator roles and AI search.',
    'All 5 projects are live in production today.',
  ]
  return { val: Math.floor(Math.random() * 6) + 1, fact: facts[Math.floor(Math.random() * 6)] }
}

export default function LudoRecruiter() {
  const [activeToken, setActiveToken] = useState(0)
  const [positions, setPositions] = useState(TOKENS.map(() => 0))
  const [dice, setDice] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [won, setWon] = useState(null)
  const [log, setLog] = useState([])
  /** {idx, kind: 'hop' | 'win'} — a one-shot glow on the track that just moved. */
  const [popRow, setPopRow] = useState(null)
  const rollTimer = useRef(null)
  const popTimer = useRef(null)
  const sound = useSound()

  const roll = useCallback(() => {
    if (rolling || won !== null) return
    setRolling(true)
    setDice(null)
    sound?.play('diceRoll')

    rollTimer.current = setTimeout(() => {
      const r = rollDice()
      setDice(r)
      const idx = activeToken
      let next = positions[idx] + r.val
      const reachedEnd = next >= TOKENS[idx].pathLen

      setPopRow({ idx, kind: reachedEnd ? 'win' : 'hop' })
      popTimer.current = setTimeout(() => setPopRow(null), reachedEnd ? 650 : 300)

      if (reachedEnd) {
        setPositions((p) => { const n = [...p]; n[idx] = TOKENS[idx].pathLen; return n })
        setWon(idx)
        setLog((l) => [`🏆 ${TOKENS[idx].label} reached home! Case study unlocked.`, ...l].slice(0, 10))
        window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'high-scorer' }))
        setStore({ scores: { ludo: TOKENS[idx].label } })
        setRolling(false)
      } else {
        setPositions((p) => { const n = [...p]; n[idx] = next; return n })
        setLog((l) => [`${TOKENS[idx].label} → ${next} (rolled ${r.val})`, ...l].slice(0, 10))
        setActiveToken((a) => (a + 1) % TOKENS.length)
        // A short hold on the roll button so the hop registers as an event
        // rather than blurring into the next one.
        setTimeout(() => setRolling(false), 90)
      }
    }, 500)
  }, [activeToken, positions, rolling, won, sound])

  const reset = () => {
    if (rollTimer.current) clearTimeout(rollTimer.current)
    if (popTimer.current) clearTimeout(popTimer.current)
    setPositions(TOKENS.map(() => 0))
    setDice(null)
    setRolling(false)
    setWon(null)
    setActiveToken(0)
    setLog([])
    setPopRow(null)
  }

  const _maxPos = Math.max(...TOKENS.map((t) => t.pathLen))

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-3 font-mono text-[12px] tracking-wider text-[var(--ink-low)]">
        <span>ACTIVE: <span style={{ color: TOKENS[activeToken].color }}>{TOKENS[activeToken].label}</span></span>
        <button onClick={reset} className="px-2 py-1 rounded border border-[var(--glass-border)] hover:text-[var(--ink)] transition-colors">
          RESET
        </button>
      </div>

      {/* Race track */}
      <div className="w-full p-3 rounded-xl clay--inset space-y-2">
        {TOKENS.map((token, i) => (
          <div key={token.id} className="relative flex items-center gap-2">
            <span className="w-16 font-mono text-[12px] tracking-wider flex-shrink-0 truncate" style={{ color: token.color }}>
              {token.label}
            </span>
            <div
              className={
                'flex-1 h-5 rounded-full overflow-hidden'
                + (popRow?.idx === i ? (popRow.kind === 'win' ? ' token-row-win' : ' token-row-hop') : '')
              }
              style={{ background: 'var(--surface-3)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: token.color, boxShadow: `0 0 8px ${token.color}` }}
                initial={false}
                animate={{ width: `${(positions[i] / token.pathLen) * 100}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 14 }}
              />
            </div>
            <span className="w-6 text-right font-mono text-[12px] text-[var(--ink-low)]">{positions[i]}/{token.pathLen}</span>
          </div>
        ))}
      </div>

      {/* Dice + Roll */}
      <div className="flex items-center gap-4">
        <Dice3D value={dice?.val || 1} rolling={rolling} />
        <button
          onClick={roll}
          disabled={rolling || won !== null}
          className="clay-btn px-5 py-2.5 rounded-full font-mono text-xs tracking-wider disabled:opacity-40"
          style={{ color: 'var(--accent-bright)' }}
        >
          {won !== null ? `${TOKENS[won].label} WINS!` : rolling ? 'ROLLING...' : 'ROLL'}
        </button>
      </div>

      {/* Dice fact */}
      {dice && (
        <p className="text-[12px] text-[var(--ink-mid)] text-center max-w-xs italic">
          &ldquo;{dice.fact}&rdquo;
        </p>
      )}

      {/* Event log */}
      <div className="w-full max-w-xs">
        <p className="font-mono text-[12px] tracking-wider text-[var(--ink-low)] mb-1">RACE LOG</p>
        <div className="space-y-0.5 max-h-24 overflow-y-auto">
          {log.map((entry, i) => (
            <p key={i} className="text-[12px] font-mono text-[var(--ink-mid)]">{entry}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
