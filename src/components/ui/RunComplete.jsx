import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'
import { getStore, setStore, markSeen } from '../../lib/store.js'
import { useSparks } from './SparkHunt.jsx'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { claimOverlay } from '../../lib/overlayBus.js'

// T-030 — `scores.run` in the unified store, not a private key.

/**
 * How long the toast holds before it retires itself. Mirrored by --hold.
 *
 * D-37 — 14 s was a third of a minute of a card sitting over the footer with
 * a countdown rail running. It is a summary of a visit that has just ended,
 * not something to be read twice; 7 s is long enough to take in four figures,
 * and hovering still holds it open indefinitely (see `held`) for anyone who
 * wants longer.
 */
const HOLD_MS = 7000

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function RunComplete() {
  const [show, setShow] = useState(false)
  const [stats, setStats] = useState(null)
  // Bumped whenever the hold timer restarts, so the progress rail remounts and
  // its CSS animation restarts in step with the JS timeout instead of drifting.
  const [cycle, setCycle] = useState(0)
  const [held, setHeld] = useState(false)
  const game = useGame()
  const { reset: resetSparks } = useSparks()
  const reduced = useReducedMotion()

  /*
   * The latch.
   *
   * `if (show) return` guarded only the case where the card was ALREADY up.
   * The IntersectionObserver stayed connected for the whole session, so the
   * moment the card was dismissed `show` went false and the very next
   * intersection — a scroll of a few pixels, the layout settling, the smooth
   * scroll from the email button — opened it straight back up. Dismiss, and
   * it returns. Dismiss again, and it returns again, indefinitely.
   *
   * A ref rather than state because the observer callback closes over it and
   * must see the current value without being torn down and rebuilt.
   */
  const spent = useRef(false)
  /* D-47 — the overlay slot, released whichever way the card leaves. */
  const releaseRef = useRef(null)

  const dismiss = useCallback(() => {
    spent.current = true
    markSeen('run-complete')
    releaseRef.current?.()
    releaseRef.current = null
    setShow(false)
  }, [])

  const handleComplete = useCallback(() => {
    if (show || spent.current) return
    const store = getStore()
    const sparks = store.sparks.length
    const elapsed = Date.now() - (performance.timeOrigin || Date.now())
    const prev = store.scores.run
    const best = Number.isFinite(prev) ? Math.min(prev, elapsed) : elapsed
    setStore({ scores: { run: best } })

    // One showing per visit, decided here rather than by the observer, so
    // every path that can open the card goes through the same latch.
    spent.current = true

    /*
     * D-47 — this outranks the coach chip, so the claim displaces it rather
     * than being refused. Measured at 390x844: both were on screen at once on
     * a first visit, the chip over the hero and this card over that.
     *
     * P2.1 — `budgeted: false`, matching overlayBus's own contract for this
     * id (see claimOverlay's jsdoc): a run summary is earned by finishing the
     * run, not volunteered by the site, so it must not compete with a genuine
     * interruption for the session's one-per-visit budget — and, at `brief`
     * (budget 1), an unbudgeted claim is also the only way this can still
     * displace the coach chip once that budget is already spent.
     */
    releaseRef.current = claimOverlay('run-complete', { budgeted: false })

    setStats({
      time: formatTime(elapsed),
      sparks,
      levels: '7/7',
      xp: game?.xp || 0,
      pb: formatTime(best),
      isNewPB: !Number.isFinite(prev) || elapsed <= prev,
    })
    setShow(true)
  }, [show, game?.xp])

  /*
   * It fires at the FOOTER, not at the contact section — and never over a
   * form the visitor has started using.
   *
   * Observing `#contact` at 50 % meant this appeared the moment someone
   * scrolled to the form: the single most important action on the site,
   * interrupted by a congratulations card. The footer is past the form, so
   * reaching it genuinely means "finished the page". The two guards below
   * cover the rest: a focused field means they are mid-sentence, and a field
   * with content means they intend to send something even if focus has
   * wandered.
   */
  useEffect(() => {
    const el = document.querySelector('footer') || document.getElementById('contact')
    if (!el) return
    // Already celebrated on a previous visit: nothing to arm.
    if (getStore().seen?.['run-complete']) return

    const busyWithForm = () => {
      const form = document.querySelector('.contact-form')
      if (!form) return false
      if (form.contains(document.activeElement)) return true
      return [...form.querySelectorAll('input:not([type=hidden]), textarea')]
        .some((field) => field.value.trim() && !field.closest('.form-honeypot'))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        if (spent.current) { observer.disconnect(); return }
        if (busyWithForm()) return
        handleComplete()
        // Nothing left to watch for. Disconnecting here rather than relying on
        // the latch alone means the callback cannot run at all after this.
        observer.disconnect()
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleComplete])

  useEffect(() => {
    if (!show) return
    const onKey = (e) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, dismiss])

  /*
   * It leaves on its own.
   *
   * A full-screen card can demand to be dismissed because it has taken the
   * page hostage and the visitor has to deal with it. A toast has no such
   * claim: if nobody engages with it, the correct behaviour is to go away
   * quietly. Pointer or keyboard focus on the card holds it open — reading it
   * should never be a race — and releasing restarts the full hold rather than
   * resuming a nearly-expired one, which is also why the rail is keyed.
   */
  useEffect(() => {
    if (!show || held) return
    const t = setTimeout(dismiss, HOLD_MS)
    return () => clearTimeout(t)
  }, [show, held, cycle, dismiss])

  const hold = useCallback(() => setHeld(true), [])
  const release = useCallback(() => { setHeld(false); setCycle((c) => c + 1) }, [])

  return (
    <AnimatePresence>
      {show && stats && (
        /*
         * A notification, not a modal.
         *
         * This used to be `position: fixed; inset: 0` with `aria-modal` and a
         * blurred backdrop: reaching the bottom of the page took the whole
         * site away and handed back a card about a game the visitor may never
         * have known they were playing. A recruiter reading the contact
         * section is the last person who should have to work out how to close
         * something. So: no backdrop, no focus trap, nothing swallowed — it
         * sits in the corner, above the arcade button, and retires itself.
         *
         * `role="status"` with a polite live region is the honest role for
         * that. It is announced once, when there is a gap, and it never
         * steals focus from whatever is being read or typed.
         */
        <motion.div
          className="run-toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          {/* The perspective lives on a wrapper so the card's own transform
              stack is free for the entrance and the idle sway. */}
          <div className="run-toast__stage">
            <motion.article
              className="run-toast__card"
              onPointerEnter={hold}
              onPointerLeave={release}
              onFocusCapture={hold}
              onBlurCapture={release}
              /* It arrives as an object: face-down and behind the screen,
                 then swinging up onto its edge. Reduced motion gets the same
                 card with none of the travel. */
              initial={reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 34, rotateX: -26, scale: 0.94 }}
              animate={reduced
                ? { opacity: 1 }
                : { opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              exit={reduced
                ? { opacity: 0 }
                : { opacity: 0, y: 18, rotateX: -14, scale: 0.96 }}
              transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Depth layers, back to front: the glow it throws on the page,
                  the lit rim, and the specular sweep across the glass. */}
              <span className="run-toast__aura" aria-hidden="true" />
              <span className="run-toast__rim" aria-hidden="true" />
              <span className="run-toast__sheen" aria-hidden="true" />

              <header className="run-toast__head">
                <span className="run-toast__seal" aria-hidden="true">
                  <span className="run-toast__seal-ring" />
                  <span className="run-toast__seal-core" />
                </span>
                <span className="run-toast__heading">
                  <span className="run-toast__title">RUN COMPLETE</span>
                  <span className="run-toast__sub">
                    {stats.isNewPB ? 'NEW PERSONAL BEST' : 'WELL PLAYED'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={dismiss}
                  className="run-toast__close"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </header>

              <dl className="run-toast__stats">
                <div className="run-toast__stat">
                  <dt>Time</dt>
                  <dd>{stats.time}</dd>
                </div>
                <div className="run-toast__stat">
                  <dt>Sparks</dt>
                  <dd>{stats.sparks}/5</dd>
                </div>
                <div className="run-toast__stat">
                  <dt>Levels</dt>
                  <dd>{stats.levels}</dd>
                </div>
                <div className="run-toast__stat">
                  <dt>XP</dt>
                  <dd>{stats.xp}</dd>
                </div>
              </dl>

              <div className="run-toast__actions">
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault()
                    dismiss()
                    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="run-toast__cta"
                >
                  Email me
                </a>
                {/* Playing again has to be offered here, because this is the
                    only place that says the hunt is over. Without it the five
                    sparks are spent for good — on this visit and every future
                    one, since they live in the store. */}
                <button
                  type="button"
                  onClick={() => {
                    resetSparks()
                    dismiss()
                    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="run-toast__again"
                >
                  Hunt again
                </button>
              </div>

              {/* The hold, drawn. Nothing vanishing on a timer should do it
                  without saying so first. */}
              <span
                key={cycle}
                className="run-toast__rail"
                style={{ '--hold': `${HOLD_MS}ms` }}
                aria-hidden="true"
              />
            </motion.article>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
