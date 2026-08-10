import { useState, useEffect, useRef, useCallback } from 'react'
import { getStore } from '../../lib/store.js'
import { claimOverlay } from '../../lib/overlayBus.js'

/**
 * P2.6 — kept, but only under the conditions that make it defensible.
 *
 * An exit-intent panel on a personal portfolio is a growth-hack pattern
 * borrowed from lead-gen landing pages, and the plan's recommendation was to
 * delete it outright: it is the single most likely thing on this site to make
 * a recruiter close the tab. It is kept because deleting a working feature is
 * a one-way door and the conditions below remove the objection — but the
 * recommendation stands on the record, and the deletion is one commit.
 *
 * Four conditions, all of which it previously failed:
 *
 *  1. **It claims the overlay slot.** It did not, so it could appear over the
 *     run-complete card or the coach chip.
 *  2. **Once per visitor per 90 days.** `let shown = false` was per page load,
 *     so it fired on every single visit forever.
 *  3. **Never on touch.** `mouseleave` fires on some touch devices during a
 *     scroll fling, which means a phone visitor could get an "are you leaving?"
 *     prompt for scrolling. There is no such thing as exit intent without a
 *     pointer.
 *  4. **Never in Recruiter Mode**, which the bus now enforces globally.
 *
 * It also stopped importing `framer-motion`. A fade-and-slide on one element
 * is four lines of CSS, and this component was one of the reasons the motion
 * chunk had to be 45 KB.
 */
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000
const VISIBLE_MS = 4000

export default function ExitIntent() {
  const [show, setShow] = useState(false)
  const [sparksLeft, setSparksLeft] = useState(0)
  const releaseRef = useRef(null)

  const dismiss = useCallback(() => {
    setShow(false)
    releaseRef.current?.()
    releaseRef.current = null
  }, [])

  useEffect(() => {
    // Condition 3. A device without a fine pointer cannot express exit intent,
    // so there is nothing here to detect and nothing to mount.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const handler = (e) => {
      // Only a real exit through the top of the viewport, not a slow drift out
      // of the side towards another window.
      if (e.clientY > 5) return

      // The hint is only meaningful mid-hunt: nothing to say to someone who
      // has found none (they do not know the game exists — that is what the
      // counter is for now) or all five.
      const collected = getStore().sparks.length
      if (collected >= 5 || collected === 0) return

      const release = claimOverlay('exit-intent', {
        ttl: VISIBLE_MS,
        once: true,
        seenTtl: NINETY_DAYS,
        onExpire: () => setShow(false),
      })
      if (!release) return

      releaseRef.current = release
      setSparksLeft(5 - collected)
      setShow(true)
    }

    document.addEventListener('mouseleave', handler)
    return () => {
      document.removeEventListener('mouseleave', handler)
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [])

  if (!show) return null

  return (
    <div className="exit-intent__panel" role="status" aria-live="polite">
      <button type="button" className="exit-intent__tooltip" onClick={dismiss}>
        {sparksLeft} spark{sparksLeft !== 1 ? 's' : ''} left to find
      </button>
    </div>
  )
}
