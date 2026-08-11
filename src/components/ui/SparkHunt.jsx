import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSound } from '../../contexts/SoundContext.jsx'
import { getStore, setStore } from '../../lib/store.js'
import { claimOverlay } from '../../lib/overlayBus.js'
import { isRecruiter, onRecruiterChange } from '../../lib/recruiter.js'

const SPARK_IDS = ['spark-hero', 'spark-stats', 'spark-skills', 'spark-timeline', 'spark-footer']

/** How long the completion toast stays. The rail below animates over it.
 *  P2.3 — matched to overlayBus's DEFAULT_TTL: gone within a second-and-change,
 *  no cross to click, the rail says so before it happens. */
const TOAST_MS = 2200

// T-030 — one key, one parse. See src/lib/store.js.
const loadSparks = () => getStore().sparks

const SparkContext = createContext({ collected: [], total: 5, enabled: true, collect: () => {}, reset: () => {} })

export function SparkProvider({ children }) {
  const [collected, setCollected] = useState(loadSparks)
  const sound = useSound()

  /*
   * P2.5 — the hunt does not EXIST in Recruiter Mode.
   *
   * `html[data-recruiter] .spark-collectible { display: none }` hid the five
   * dots and left five buttons in the accessible tree, five React components
   * mounted, and the completion toast eligible to fire. A mode whose entire
   * purpose is "this page does less" cannot be implemented by making things
   * invisible.
   */
  const [enabled, setEnabled] = useState(() => !isRecruiter())
  useEffect(() => onRecruiterChange((on) => setEnabled(!on)), [])

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

  /*
   * P2.4 — the counter returns to 0/5 on its own, not a reset of the
   * visitor's achievement: `forge:unlock` has already fired and the XP is
   * banked in GameContext. This is the hunt becoming available again, which
   * is the difference between a collectible and a trophy case. Timed to fire
   * after the toast has left (800 ms pre-delay + TOAST_MS + a beat), so the
   * visitor sees 5/5 for the length of the celebration and 0/5 after.
   */
  useEffect(() => {
    if (collected.length !== SPARK_IDS.length) return
    const id = setTimeout(reset, 800 + TOAST_MS + 400)
    return () => clearTimeout(id)
  }, [collected.length, reset])

  return (
    <SparkContext.Provider value={{ collected, total: SPARK_IDS.length, enabled, collect, reset }}>
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
  const { collected, collect, total, enabled } = useSparkHunt()
  const found = collected.includes(id)

  if (!enabled || found) return null

  return (
    <button
      onClick={() => collect(id)}
      className={`spark-collectible ${className}`}
      /* D.1 — "Collect hidden spark" tells a screen-reader user what the
         control is called and nothing about the game they are in. The number
         is the part a sighted visitor gets free from the counter. */
      aria-label={`Hidden spark — ${collected.length + 1} of ${total}. Collect it.`}
    >
      <span className="spark-glow" />
    </button>
  )
}

/**
 * P2.7 — the counter is always there.
 *
 * It used to render nothing until the first spark was found, which made the
 * whole hunt undiscoverable: there are five 18px dots scattered through a long
 * page and no indication anywhere that they exist or are worth clicking. A
 * collectible nobody knows about is dead code with a runtime cost.
 *
 * So `0/5` is always visible, and *quiet* until the first find — ink-low, no
 * glow, no accent. It is a question mark, not an announcement, which is the
 * right volume for an easter egg: enough to make the first dot legible as part
 * of something, not enough to compete with the work.
 */
export function SparkCounter() {
  const { collected, total, enabled } = useSparkHunt()
  const started = collected.length > 0
  const complete = collected.length === total

  if (!enabled) return null

  return (
    <div
      className="spark-counter"
      data-started={started ? 'true' : 'false'}
      title={started ? `${collected.length} of ${total} hidden sparks found` : `Five sparks are hidden in this page. None found yet.`}
    >
      <span className="spark-mini" aria-hidden="true" />
      <span className="spark-counter__value">
        {collected.length}/{total}
      </span>
      {/* The visible text is a bare fraction; on its own it is meaningless
          read aloud. */}
      <span className="sr-only">
        {complete
          ? `All ${total} hidden sparks found.`
          : `${collected.length} of ${total} hidden sparks found.`}
      </span>
    </div>
  )
}

/**
 * The completion toast — the D-4 rewrite, non-interactive by construction (P2.2).
 *
 * Every one of the four original faults is fixed by *deleting* the local
 * mechanism and deferring to the bus: the component describes what it wants
 * ("2.2 seconds, once ever, and only if nothing more important is happening")
 * and the arbiter decides. There is no Close button and no Escape/click-outside
 * handler — a thing that cannot be clicked cannot need a way to dismiss it, and
 * the countdown rail below says so before it happens.
 */
export function SparkCompleteToast() {
  const { collected, total } = useSparkHunt()
  const [show, setShow] = useState(false)
  const releaseRef = useRef(null)

  useEffect(() => {
    if (collected.length !== total || total === 0) return

    // 800 ms so the celebration follows the collection rather than landing on
    // top of it — the fifth spark's own sound and glow need a beat.
    const timer = setTimeout(() => {
      const release = claimOverlay('spark-complete', {
        ttl: TOAST_MS,
        // Never twice. This is the fix for the report that the popup "returns
        // forever": completion is stored, so without this the effect fired on
        // every subsequent page load for the rest of the visitor's life.
        once: true,
        onExpire: () => setShow(false),
      })
      // Refused — recruiter mode, the quiet period, the budget, or already
      // seen. Rendering nothing is the correct response to a refusal.
      if (!release) return
      releaseRef.current = release
      setShow(true)
    }, 800)

    return () => {
      clearTimeout(timer)
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [collected.length, total])

  if (!show) return null

  return (
    <div className="spark-toast toast-rise" role="status" aria-live="polite">
      {/* The countdown rail, reusing the pattern RunComplete already ships —
          a celebration that is about to leave should say so, or its
          disappearance reads as a bug. */}
      <span
        className="spark-toast__rail"
        style={{ '--toast-ms': `${TOAST_MS}ms` }}
        aria-hidden="true"
      />
      {/* D.1 — plain language. "ALL SPARKS COLLECTED" uses a word the visitor
          was never taught, in a register nothing else on the page uses. */}
      <p className="spark-toast__title">You found all five</p>
      <p className="spark-toast__name">Forge Master — nice.</p>
    </div>
  )
}
