import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSound } from '../../contexts/SoundContext.jsx'

const STORAGE_KEY = 'forge-sparks'
const SPARK_IDS = ['spark-hero', 'spark-stats', 'spark-skills', 'spark-timeline', 'spark-footer']

function loadSparks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

const SparkContext = createContext({ collected: [], total: 5, collect: () => {} })

export function SparkProvider({ children }) {
  const [collected, setCollected] = useState(loadSparks)
  const sound = useSound()

  const collect = useCallback((id) => {
    setCollected((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      sound?.play('achievement')
      if (next.length === SPARK_IDS.length) {
        window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'forge-master' }))
      }
      return next
    })
  }, [sound])

  return (
    <SparkContext.Provider value={{ collected, total: SPARK_IDS.length, collect }}>
      {children}
    </SparkContext.Provider>
  )
}

function useSparkHunt() {
  return useContext(SparkContext)
}

export function Spark({ id, className = '' }) {
  const { collected, collect } = useSparkHunt()
  const found = collected.includes(id)

  if (found) return null

  return (
    <button
      onClick={() => collect(id)}
      className={`spark-collectible ${className}`}
      aria-label="Collect hidden spark"
    >
      <span className="spark-glow" />
    </button>
  )
}

export function SparkCounter() {
  const { collected, total } = useSparkHunt()

  if (collected.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--glass-border)] bg-[var(--surface-2)]">
      <span className="spark-mini" />
      <span className="font-mono text-[9px] tracking-wider text-[var(--accent-bright)]">
        {collected.length}/{total}
      </span>
    </div>
  )
}

export function SparkCompleteToast() {
  const { collected, total } = useSparkHunt()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (collected.length === total && total > 0) {
      const timer = setTimeout(() => setShow(true), 800)
      return () => clearTimeout(timer)
    }
  }, [collected.length, total])

  if (!show) return null

  return (
        <div
          className="toast-rise fixed bottom-8 left-1/2 -translate-x-1/2 z-50 glass sheen rounded-2xl px-6 py-4 border border-[var(--accent-dim)] text-center"
        >
          <p className="font-mono text-[9px] tracking-[0.3em] text-[var(--warm)] mb-1">
            ALL SPARKS COLLECTED
          </p>
          <p className="font-display text-lg">Forge Master</p>
          <p className="text-[11px] text-[var(--ink-mid)] mt-1">
            You found all 5 hidden sparks
          </p>
          <button
            onClick={() => setShow(false)}
            className="mt-3 font-mono text-[10px] text-[var(--ink-low)] hover:text-[var(--ink)]"
          >
            DISMISS
          </button>
        </div>
  )
}
