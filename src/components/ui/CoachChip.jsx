import { useEffect, useRef, useState } from 'react'
import { markSeen } from '../../lib/store.js'
import { claimOverlay } from '../../lib/overlayBus.js'

/**
 * CoachChip — T-003.4.
 *
 * The terminal is the feature this site is proudest of and the one nobody
 * finds, because "press /, then >" is not guessable and a phone has no keyboard to
 * press. One dismissible chip, once per visitor, eight seconds in — long
 * enough that it is not competing with the hero, short enough that it is
 * still the same visit.
 *
 * It is a hint, not a modal: it never traps focus, never blocks anything, and
 * disappears on its own after twelve seconds if it is ignored.
 */
export default function CoachChip() {
  const [coach, setCoach] = useState(null)
  const releaseRef = useRef(null)

  /*
   * D-47 — the chip is the lowest-priority overlay on the page, so it asks
   * before appearing and simply gives up if something else is already there.
   * A hint that has to queue behind a card the visitor is reading is no longer
   * about what the visitor is doing.
   */
  useEffect(() => {
    const onCoach = (e) => {
      const release = claimOverlay('coach')
      if (!release) return
      releaseRef.current = release
      setCoach(e.detail)
    }
    window.addEventListener('forge:coach', onCoach)
    return () => {
      window.removeEventListener('forge:coach', onCoach)
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!coach) return
    // D-37 — 12 s was long past the point where a hint has either landed or
    // been ignored.
    const id = setTimeout(() => {
      releaseRef.current?.()
      releaseRef.current = null
      setCoach(null)
    }, 7000)
    return () => clearTimeout(id)
  }, [coach])

  if (!coach) return null

  const dismiss = () => {
    markSeen(coach.id)
    releaseRef.current?.()
    releaseRef.current = null
    setCoach(null)
  }

  return (
    <div className="coach-chip" role="status">
      <button
        type="button"
        className="text-left"
        onClick={() => {
          dismiss()
          window.dispatchEvent(new CustomEvent('forge:open-palette'))
        }}
      >
        {coach.text}
      </button>
      <button type="button" className="coach-chip__close" onClick={dismiss} aria-label="Dismiss hint">
        ✕
      </button>
    </div>
  )
}
