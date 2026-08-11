import { useCallback, useRef, useState } from 'react'
import { TIMELINE } from '../../lib/content.js'
import { useSound } from '../../contexts/SoundContext.jsx'
import Dice3D from '../ui/Dice3D.jsx'
import { setStore } from '../../lib/store.js'

const BOARD_SIZE = 25
const SNAKES = { 16: 6, 21: 12, 24: 5, 19: 8, 11: 2 }
const LADDERS = { 3: 14, 7: 17, 10: 20, 15: 23, 4: 13 }

function rollDice() {
  const val = Math.floor(Math.random() * 6) + 1
  const facts = [
    'Started with DSA — the foundation of every algorithm I write.',
    'Competitive programming taught me to optimize ruthlessly.',
    'I treat each project as a product, not an assignment.',
    'Real-time systems require thinking in state machines.',
    'AI integration is just another API — if you design it right.',
    'Production debugging is where real learning happens.',
  ]
  return { val, fact: facts[val - 1] }
}

export default function SnakeLaddersCV() {
  const [position, setPosition] = useState(0)
  const [dice, setDice] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [history, setHistory] = useState([])
  const [won, setWon] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const rollTimer = useRef(null)
  const stepTimer = useRef(null)
  const sound = useSound()

  const moveCountRef = useRef(0)

  const roll = useCallback(() => {
    if (rolling || won) return
    setRolling(true)
    setDice(null)
    sound?.play('diceRoll')

    rollTimer.current = setTimeout(() => {
      const r = rollDice()
      const landed = Math.min(BOARD_SIZE, position + r.val)
      const snake = SNAKES[landed]
      const ladder = LADDERS[landed]
      const finalPos = snake || ladder || landed

      moveCountRef.current += 1
      setDice(r)
      setMoveCount(moveCountRef.current)
      setHistory((h) => [{ from: position, to: finalPos, val: r.val, snake: !!snake, ladder: !!ladder, fact: r.fact }, ...h].slice(0, 10))

      const finish = () => {
        if (finalPos >= BOARD_SIZE) { setWon(true); setStore({ scores: { snakes: moveCountRef.current } }) }
        setRolling(false)
      }

      // The token hops one square at a time across the dice roll rather than
      // teleporting straight to the landing square — a snake or ladder still
      // teleports once the steps reach it, because that IS what one does.
      let step = position
      const advance = () => {
        step += 1
        setPosition(Math.min(step, landed))
        if (step < landed) {
          stepTimer.current = setTimeout(advance, 110)
        } else if (finalPos !== landed) {
          stepTimer.current = setTimeout(() => { setPosition(finalPos); finish() }, 260)
        } else {
          finish()
        }
      }
      advance()
    }, 600)
  }, [position, rolling, won, sound])

  const reset = () => {
    if (rollTimer.current) clearTimeout(rollTimer.current)
    if (stepTimer.current) clearTimeout(stepTimer.current)
    moveCountRef.current = 0
    setPosition(0)
    setDice(null)
    setRolling(false)
    setMoveCount(0)
    setHistory([])
    setWon(false)
  }

  const cellEvents = new Map()
  Object.entries(SNAKES).forEach(([k, v]) => cellEvents.set(Number(k), { type: 'snake', to: v }))
  Object.entries(LADDERS).forEach(([k, v]) => cellEvents.set(Number(k), { type: 'ladder', to: v }))

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4 font-mono text-[12px] tracking-wider text-[var(--ink-low)]">
        <span>POSITION: <span className="text-[var(--ink)]">{position}</span> / 25</span>
        <span>MOVES: <span className="text-[var(--accent-bright)]">{moveCount}</span></span>
      </div>

      {/* Board */}
      <div className="grid grid-cols-5 gap-1 p-3 rounded-xl clay--inset">
        {Array.from({ length: BOARD_SIZE }, (_, i) => {
          const cellNum = i + 1
          const event = cellEvents.get(cellNum)
          const isCurrent = position === cellNum && cellNum < BOARD_SIZE
          const isSnake = event?.type === 'snake'
          const isLadder = event?.type === 'ladder'
          const tlEvent = TIMELINE[i]
          return (
            <div
              key={cellNum}
              className="relative w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-mono transition-all duration-fast"
              style={{
                background: isCurrent ? 'var(--accent)' : isSnake ? 'color-mix(in oklch, var(--warm) 20%, var(--surface-2))' : isLadder ? 'color-mix(in oklch, var(--accent) 20%, var(--surface-2))' : 'var(--surface-1)',
                border: `1px solid ${isCurrent ? 'var(--accent-bright)' : isSnake ? 'var(--warm-dim)' : isLadder ? 'var(--accent-dim)' : 'var(--glass-border)'}`,
                color: isCurrent ? 'var(--surface-0)' : 'var(--ink-low)',
                boxShadow: isCurrent ? '0 0 12px var(--accent)' : 'none',
              }}
              title={tlEvent ? `${tlEvent.year}: ${tlEvent.title}` : ''}
            >
              <span className={isCurrent ? 'font-bold' : ''}>{cellNum}</span>
              {event && (
                <span className="absolute -top-1 -right-1 text-[12px]">{isSnake ? '🐍' : '🪜'}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Dice + Roll */}
      <div className="flex items-center gap-4">
        <Dice3D value={dice?.val || 1} rolling={rolling} />
        <button
          onClick={roll}
          disabled={rolling || won}
          className="clay-btn px-5 py-2.5 rounded-full font-mono text-xs tracking-wider disabled:opacity-40"
          style={{ color: 'var(--accent-bright)' }}
        >
          {won ? 'WON!' : rolling ? 'ROLLING...' : 'ROLL DICE'}
        </button>
        <button onClick={reset} className="px-3 py-1.5 rounded-full border border-[var(--glass-border)] text-[12px] font-mono text-[var(--ink-low)] hover:text-[var(--ink)]">
          RESET
        </button>
      </div>

      {/* Dice fact */}
      {dice && (
        <p className="text-[12px] text-[var(--ink-mid)] text-center max-w-xs italic">
          &ldquo;{dice.fact}&rdquo;
        </p>
      )}

      {/* Career events on each cell */}
      <div className="w-full max-w-xs">
        <p className="font-mono text-[12px] tracking-wider text-[var(--ink-low)] mb-2">CAREER MILESTONES</p>
        <div className="space-y-1">
          {history.slice(0, 5).map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] font-mono">
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[12px]" style={{ background: h.snake ? 'var(--warm-dim)' : h.ladder ? 'var(--accent-dim)' : 'var(--surface-3)' }}>
                {h.snake ? '🐍' : h.ladder ? '🪜' : h.val}
              </span>
              <span className="text-[var(--ink-mid)]">{h.fact}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
