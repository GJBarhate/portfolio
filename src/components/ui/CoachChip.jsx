import { useEffect, useState } from 'react'
import { markSeen } from '../../lib/store.js'

/**
 * CoachChip — T-003.4.
 *
 * The terminal is the feature this site is proudest of and the one nobody
 * finds, because "press ⌘K, then >" is not guessable and a phone has no ⌘K to
 * press. One dismissible chip, once per visitor, eight seconds in — long
 * enough that it is not competing with the hero, short enough that it is
 * still the same visit.
 *
 * It is a hint, not a modal: it never traps focus, never blocks anything, and
 * disappears on its own after twelve seconds if it is ignored.
 */
export default function CoachChip() {
  const [coach, setCoach] = useState(null)

  useEffect(() => {
    const onCoach = (e) => setCoach(e.detail)
    window.addEventListener('forge:coach', onCoach)
    return () => window.removeEventListener('forge:coach', onCoach)
  }, [])

  useEffect(() => {
    if (!coach) return
    const id = setTimeout(() => setCoach(null), 12000)
    return () => clearTimeout(id)
  }, [coach])

  if (!coach) return null

  const dismiss = () => {
    markSeen(coach.id)
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
