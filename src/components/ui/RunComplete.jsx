import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../contexts/GameContext.jsx'
import { getStore, setStore, markSeen } from '../../lib/store.js'
import { useSparks } from './SparkHunt.jsx'

// T-030 — `scores.run` in the unified store, not a private key.

function formatTime(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function RunComplete() {
  const [show, setShow] = useState(false)
  const [stats, setStats] = useState(null)
  const game = useGame()
  const { reset: resetSparks } = useSparks()

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

  const dismiss = useCallback(() => {
    spent.current = true
    markSeen('run-complete')
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
   * Observing `#contact` at 50 % meant this full-screen modal appeared the
   * moment someone scrolled to the form: the single most important action on
   * the site, covered by a congratulations card, with the send button
   * unclickable behind it. A celebration that blocks the thing being
   * celebrated is not a reward, it is an obstacle.
   *
   * The footer is past the form, so reaching it genuinely means "finished the
   * page". The two guards below cover the rest: a focused field means they
   * are mid-sentence, and a field with content means they intend to send
   * something even if focus has wandered.
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

  if (!show || !stats) return null

  return (
    <AnimatePresence>
      {/*
        T-041 — this is a modal: it covers the viewport and swallows clicks
        aimed at the header. It was missing everything that makes a modal
        survivable — no Escape, no role, no accessible name — so a visitor who
        reached the bottom of the page had the navigation taken away with only
        a backdrop click to get it back, and a keyboard user had no way out at
        all. Found by `check-overflow.mjs`, which scrolled to 100 % and then
        could not open the palette.
      */}
      <motion.div
        className="run-complete"
        role="dialog"
        aria-modal="true"
        aria-label="Run complete"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
      >
        <motion.div
          className="run-complete__card crt-flicker"
          initial={{ scale: 0.85, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="run-complete__title">RUN COMPLETE</h2>
          <p className="run-complete__subtitle">
            {stats.isNewPB ? 'NEW PERSONAL BEST' : 'WELL PLAYED'}
          </p>

          <div className="run-complete__stats">
            <div>
              <div className="run-complete__stat-value">{stats.time}</div>
              <div className="run-complete__stat-label">Time</div>
            </div>
            <div>
              <div className="run-complete__stat-value">{stats.sparks}/5</div>
              <div className="run-complete__stat-label">Sparks</div>
            </div>
            <div>
              <div className="run-complete__stat-value">{stats.levels}</div>
              <div className="run-complete__stat-label">Levels</div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-6">
            <div className="text-center">
              <span className="font-mono text-[12px] text-[var(--ink-low)] tracking-wider">XP EARNED</span>
              <p className="font-display text-lg" style={{ color: 'var(--accent-bright)' }}>{stats.xp}</p>
            </div>
            <div className="text-center">
              <span className="font-mono text-[12px] text-[var(--ink-low)] tracking-wider">BEST TIME</span>
              <p className="font-display text-lg" style={{ color: 'var(--accent-reward)' }}>{stats.pb}</p>
            </div>
          </div>

          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault()
              dismiss()
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium text-sm"
            style={{
              background: 'var(--accent-reward)',
              color: 'var(--surface-0)',
              boxShadow: '0 0 32px color-mix(in oklch, var(--accent-reward) 40%, transparent)',
            }}
          >
            Now let&rsquo;s build something — email me
          </a>

          {/* Playing again has to be offered here, because this is the only
              screen that tells you the hunt is over. Without it the five
              sparks are spent for good — on this visit and every future one,
              since they live in the store. */}
          <div className="run-complete__actions">
            <button
              onClick={() => {
                resetSparks()
                dismiss()
                document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="run-complete__again"
            >
              HUNT THE 5 SPARKS AGAIN
            </button>
            <button
              onClick={dismiss}
              className="block mx-auto font-mono text-[12px] text-[var(--ink-low)] hover:text-[var(--ink)] tracking-wider"
            >
              DISMISS
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
