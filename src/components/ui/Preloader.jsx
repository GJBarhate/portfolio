import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame } from '../../lib/raf.js'
import { markSeen } from '../../lib/store.js'

// Curtain budget (J7 / T-031.5): the cinematic entry is self-inflicted LCP
// delay, so the whole thing is capped — 700 ms of count plus 400 ms of lift,
// with a hard 1,400 ms ceiling regardless of what any of it is doing. The
// count runs *while* hero fonts and the poster stream in, not before them,
// and since T-031.3 the hero name paints behind the curtain, so the metric
// does not wait for any of this.
/*
 * P5.10 — 700 -> 400 ms, and the hard cap 1400 -> 900.
 *
 * The curtain is a self-inflicted LCP delay by this file's own admission: it
 * is drawn OVER the thing whose paint it is delaying. §10.3 offered three
 * options — delete it, shorten it, or gate it on tier — and this takes the
 * middle one, because the brief explicitly asks for a first-visit surprise
 * (R10) and this is the frame for it. What it does not need to be is long:
 * 400 ms is still a beat, and it is under the ~500 ms at which a delay stops
 * reading as a transition and starts reading as a wait.
 */
const COUNT_DURATION = 400
const LIFT_DURATION = 400
const HARD_CAP = 900

/**
 * First-visit curtain.
 *
 * Every animation here is CSS or WAAPI. It used to be five Framer components,
 * which meant the 42 KB motion chunk had to parse and run during the single
 * most main-thread-contended moment of the whole page load — to draw a
 * progress bar over the content it was delaying.
 */
export default function Preloader({ onReveal }) {
  const reduced = useReducedMotion()
  const [gone, setGone] = useState(false)
  const rootRef = useRef(null)
  const innerRef = useRef(null)
  const barRef = useRef(null)
  const countRef = useRef(null)
  const revealedRef = useRef(false)
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    const reveal = () => {
      if (revealedRef.current) return
      revealedRef.current = true
      // T-031.1 — once per visitor per month, not once per tab. The old
      // sessionStorage flag replayed the whole curtain when a recruiter
      // opened the site in a second tab.
      markSeen('intro')
      onRevealRef.current()
    }

    if (reduced) {
      reveal()
      setGone(true)
      return
    }

    const root = rootRef.current
    const bar = barRef.current
    const countEl = countRef.current
    const easing = 'cubic-bezier(0.16, 1, 0.3, 1)'

    bar?.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: COUNT_DURATION, easing, fill: 'forwards' }
    )

    // The counter is text, so it cannot be a compositor animation — but at
    // ~42 frames total it does not need to be one either.
    let elapsed = 0
    const stopCount = onFrame((_t, dt) => {
      elapsed += dt
      const p = Math.min(1, elapsed / COUNT_DURATION)
      // out-expo, matching the bar.
      const eased = 1 - Math.pow(2, -10 * p)
      if (countEl) countEl.textContent = String(Math.round(eased * 100))
      if (p >= 1) stopCount()
    })

    // T-031.4 — any tap, key or scroll dismisses the curtain immediately.
    // A visitor who has started interacting has told you they are done
    // watching, and holding the page hostage to an animation after that is
    // the difference between "cinematic" and "in the way".
    const skip = () => {
      if (revealedRef.current) return
      root?.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 160, easing, fill: 'forwards' }
      )
      reveal()
      setTimeout(() => setGone(true), 180)
    }
    const skipEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    for (const type of skipEvents) {
      window.addEventListener(type, skip, { once: true, passive: true })
    }

    const lift = setTimeout(() => {
      innerRef.current?.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.97)' }],
        { duration: 250, easing, fill: 'forwards' }
      )
      root?.animate(
        [
          { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' },
          { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' },
        ],
        { duration: LIFT_DURATION, easing, fill: 'forwards' }
      )
      reveal()
      setTimeout(() => setGone(true), LIFT_DURATION + 50)
    }, COUNT_DURATION)

    // If anything above fails to fire, the page still gets revealed — and
    // the curtain is gone by HARD_CAP whatever happens.
    const failsafe = setTimeout(() => { reveal(); setGone(true) }, HARD_CAP)

    return () => {
      stopCount()
      clearTimeout(lift)
      clearTimeout(failsafe)
      for (const type of skipEvents) window.removeEventListener(type, skip)
    }
  }, [reduced])

  /*
   * P7.1 — `inert` on the page beneath, for as long as the curtain is up.
   *
   * The curtain covers the whole viewport, so anything behind it is visible to
   * nobody and reachable by Tab. Marking `#root` inert takes the hero, the nav
   * and every link out of the tab order and out of the accessibility tree for
   * exactly the ~1.4 s the curtain exists, which is what makes the sighted and
   * the screen-reader experience the same document again.
   *
   * This is the other half of dropping `aria-hidden="true"` from the curtain
   * itself (D-10c). Without it, removing that attribute would have exposed
   * BOTH layers at once, which is worse than either.
   */
  useEffect(() => {
    if (gone) return
    const root = document.getElementById('root')
    if (!root) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [gone])

  if (gone) return null

  return (
    /*
     * D-10c — `role="status"`, not `aria-hidden="true"`.
     *
     * This is a full-viewport element covering the whole page. Marking it
     * aria-hidden meant a screen-reader user was navigating a page that the
     * sighted user could not see — the two experiences were of different
     * documents for up to 1.4 s. `aria-live="polite"` announces "Loading" once
     * and nothing else; `inert` on the curtain keeps its own decorative
     * contents out of the tab order without hiding the fact that it is there.
     */
    <div ref={rootRef} className="preloader" role="status" aria-live="polite">
      <div ref={innerRef} className="preloader__inner">
        <div className="preloader__monogram" style={{ border: 'none', boxShadow: 'none' }}>
          <svg width="44" height="44" viewBox="0 0 60 48" aria-hidden="true">
            <path
              className="preloader__stroke"
              d="M18 8c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 16c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.6 6-6 6zM42 8l14 20-14 20"
              fill="none"
              stroke="var(--accent-bright)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="18" cy="18" r="10" fill="none" stroke="var(--accent-dim)" strokeWidth="1" opacity="0.3" />
          </svg>
        </div>
        <div className="preloader__bar">
          <div ref={barRef} className="preloader__bar-fill" style={{ transform: 'scaleX(0)' }} />
        </div>
        {/* D.1 — "FORGING INTERFACE" is the site's metaphor, not the
            visitor's, and it is the first thing they read. */}
        <p className="font-mono text-[12px] tracking-[0.35em] text-[var(--ink-low)]">
          Building the page
        </p>
        {/* D-10b — "PRESS START" was a false promise: nothing is bound to a
            start affordance. ANY pointerdown, keydown, wheel or touchstart
            dismisses the curtain, so the label now describes what the control
            actually is — a skip. */}
        <p
          className="preloader__press font-mono text-[12px] tracking-[0.2em] mt-4"
          style={{ color: 'var(--accent-bright)' }}
        >
          Tap anywhere to skip
        </p>
      </div>
      <div ref={countRef} className="preloader__count">0</div>
    </div>
  )
}
