import { useEffect, useRef, useState } from 'react'
import { claimOverlay } from '../../lib/overlayBus.js'

/**
 * CoachChip — T-003.4, non-interactive by construction (P2.2).
 *
 * The terminal is the feature this site is proudest of and the one nobody
 * finds, because "press /, then >" is not guessable and a phone has no keyboard to
 * press. One chip, shown once per visitor (App.jsx marks it seen the moment
 * it is dispatched), long enough to read and gone on its own.
 *
 * It is a hint, not a modal: no button, no click target, `pointer-events:
 * none`. Its entire message is a keystroke the visitor can act on without
 * ever touching the chip, so there is nothing here for a button to do —
 * exit-intent is the only overlay allowed to keep one (§2.1).
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
    // D-37 — 7 s was long past the point where a hint has either landed or
    // been ignored.
    const id = setTimeout(() => {
      releaseRef.current?.()
      releaseRef.current = null
      setCoach(null)
    }, 7000)
    return () => clearTimeout(id)
  }, [coach])

  if (!coach) return null

  return (
    <div className="coach-chip" role="status" style={{ pointerEvents: 'none' }}>
      <span className="coach-chip__rail" aria-hidden="true" />
      {coach.text}
    </div>
  )
}
