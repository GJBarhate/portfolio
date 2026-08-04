import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useSound } from '../../contexts/SoundContext.jsx'
import { getStore, setStore } from '../../lib/store.js'

const SPARK_IDS = ['spark-hero', 'spark-stats', 'spark-skills', 'spark-timeline', 'spark-footer']

// T-030 — one key, one parse. See src/lib/store.js.
const loadSparks = () => getStore().sparks

const SparkContext = createContext({ collected: [], total: 5, collect: () => {}, reset: () => {} })

export function SparkProvider({ children }) {
  const [collected, setCollected] = useState(loadSparks)
  const sound = useSound()

  const collect = useCallback((id) => {
    setCollected((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      setStore({ sparks: next })
      sound?.play('achievement')
      if (next.length === SPARK_IDS.length) {
        window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'forge-master' }))
      }
      return next
    })
  }, [sound])

  /*
   * Finding all five is a one-way door without this: the sparks live in the
   * store, so a visitor who completed the hunt could never see one again on
   * any future visit, and the site's most playful feature was permanently
   * spent after a single run. `reset` puts all five back.
   */
  const reset = useCallback(() => {
    setCollected([])
    setStore({ sparks: [] })
  }, [])

  return (
    <SparkContext.Provider value={{ collected, total: SPARK_IDS.length, collect, reset }}>
      {children}
    </SparkContext.Provider>
  )
}

function useSparkHunt() {
  return useContext(SparkContext)
}

/** Public hook — RunComplete uses it to offer the hunt again. */
export function useSparks() {
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
      <span className="font-mono text-[12px] tracking-wider text-[var(--accent-bright)]">
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
          <p className="font-mono text-[12px] tracking-[0.3em] text-[var(--warm)] mb-1">
            ALL SPARKS COLLECTED
          </p>
          <p className="font-display text-lg">Forge Master</p>
          <p className="text-[12px] text-[var(--ink-mid)] mt-1">
            You found all 5 hidden sparks
          </p>
          <button
            onClick={() => setShow(false)}
            className="mt-3 font-mono text-[12px] text-[var(--ink-low)] hover:text-[var(--ink)]"
          >
            DISMISS
          </button>
        </div>
  )
}
