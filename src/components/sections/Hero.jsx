import { useRef, useState, useEffect, lazy, Suspense } from 'react'
import MagneticButton from '../ui/MagneticButton.jsx'
import MagneticTilt from '../ui/MagneticTilt.jsx'
import { Spark } from '../ui/SparkHunt.jsx'
import HeroAurora from '../ui/HeroAurora.jsx'
import WordRotator from '../ui/WordRotator.jsx'
import { RESUME_PATH } from '../../lib/siteConfig.js'
import { SOCIALS } from '../../lib/content.js'
import { useScrollVelocity } from '../../lib/useScrollVelocity.js'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame, getTier, onTierChange } from '../../lib/raf.js'
import { onScrollFrame } from '../../lib/scrollState.js'
import { bindTilt, needsTiltPermission, requestTiltPermission, onGyroState } from '../../lib/tilt.js'
import { useSound } from '../../contexts/SoundContext.jsx'

const HeroForgeObject = lazy(() => import('../ui/HeroForgeObject.jsx'))
/*
 * The corner watch that used to hang here is gone, and it is worth recording
 * why rather than letting it look like a taste change.
 *
 * It re-drew a 1024x1024 canvas landscape every 90 ms and re-uploaded it as a
 * `CanvasTexture` — ~4 MB per upload at ~11 Hz. A CDP profile of the idle hero
 * put `texSubImage2D` at 11.7 % of ALL samples, and the page was spending
 * 2,206 ms of every 3 s in long tasks; with the three canvases removed that
 * figure was 0. A main thread that busy does not answer a trackpad flick,
 * which is what "two-finger scroll does nothing, I have to drag the scrollbar"
 * actually was — the Lenis hijack removed in D-30 was only half of it.
 *
 * It also subscribed with `critical: true`, which exempted the single most
 * expensive callback on the page from all three of raf.js's protections.
 *
 * `MoonForestClock` (mounted from App, not from a section, so it is genuinely
 * scroll-persistent) replaces it, on a 512 texture redrawn only when the
 * time-of-day bucket changes, in the ordinary ambient band.
 */
const NAME_CHARS = [...'Gaurav Barhate'].map(c => c === ' ' ? '\u00A0' : c)

const INTRO_MS = 200 + NAME_CHARS.length * 40 + 620

export default function Hero({ introDone = true }) {
  const nameRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const sound = useSound()

  /*
   * Name reveal phases: pending → run → done.
   *
   * The entrance animation exists only during `run`. The resting state carries
   * no animation at all, so the name is plain visible text the moment the
   * reveal is over.
   *
   * This matters more than it looks. The previous version left the animation
   * applied forever with `fill-mode: both`, which means the letters' first
   * keyframe (opacity 0) IS their resting style until the animation actually
   * runs — so anything that stopped animations from running (the off-screen
   * animation gate, recruiter mode's global pause, a paused compositor) left
   * the hero name invisible with only its outlined ghost showing. Text must
   * never depend on an animation to exist.
   */
  const [introPhase, setIntroPhase] = useState(() =>
    introDone ? (reducedMotion ? 'done' : 'run') : 'pending'
  )
  useEffect(() => {
    if (reducedMotion) { setIntroPhase('done'); return }
    if (!introDone) { setIntroPhase('pending'); return }
    setIntroPhase('run')
    const t = setTimeout(() => setIntroPhase('done'), INTRO_MS)
    return () => clearTimeout(t)
  }, [introDone, reducedMotion])

  /*
   * Kinetic name (J6). The previous version called getBoundingClientRect() on
   * all 14 characters inside every mousemove — 14 forced layouts per event, at
   * 60–120 events/second — and committed a React setState per event, so the
   * whole hero subtree re-rendered continuously while the pointer moved. In
   * the LCP region, that was the single worst INP contributor on the page.
   *
   * Now: character geometry is measured once (re-measured only on resize and
   * font load), pointer position is processed inside the shared rAF loop, and
   * the result is written straight onto each node as a CSS custom property.
   * Zero React commits, zero forced layouts on the pointer path.
   */
  useEffect(() => {
    const el = nameRef.current
    if (!el || reducedMotion) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const RADIUS = 120
    const FORCE = 6

    let chars = []
    let centers = []
    let hostRect = null
    let rectDirty = true
    let pointer = null
    let stop = null
    let active = false
    const applied = []

    const measure = () => {
      chars = Array.from(el.querySelectorAll('.kinetic-char'))
      hostRect = el.getBoundingClientRect()
      centers = chars.map((ch) => {
        const r = ch.getBoundingClientRect()
        return {
          x: r.left - hostRect.left + r.width / 2,
          y: r.top - hostRect.top + r.height / 2,
        }
      })
      applied.length = chars.length
      applied.fill(false)
      rectDirty = false
    }

    const clearAll = () => {
      for (let i = 0; i < chars.length; i++) {
        if (!applied[i]) continue
        chars[i].style.removeProperty('--kx')
        chars[i].style.removeProperty('--ky')
        chars[i].removeAttribute('data-proximity')
        applied[i] = false
      }
    }

    // Reading layout only when something actually invalidated it keeps the
    // steady-state pointer path free of layout work entirely.
    const tick = () => {
      if (!pointer) {
        clearAll()
        stop?.(); stop = null; active = false
        return
      }
      if (rectDirty || !hostRect) {
        hostRect = el.getBoundingClientRect()
        rectDirty = false
      }
      const px = pointer.x - hostRect.left
      const py = pointer.y - hostRect.top

      let nearest = -1
      let nearestDist = Infinity
      for (let i = 0; i < chars.length; i++) {
        const dx = centers[i].x - px
        const dy = centers[i].y - py
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < nearestDist) { nearestDist = dist; nearest = i }
        if (dist < RADIUS) {
          const force = ((RADIUS - dist) / RADIUS) * FORCE
          const angle = Math.atan2(dy, dx)
          const ch = chars[i]
          ch.style.setProperty('--kx', `${(Math.cos(angle) * force).toFixed(2)}px`)
          ch.style.setProperty('--ky', `${(Math.sin(angle) * force).toFixed(2)}px`)
          applied[i] = true
        } else if (applied[i]) {
          chars[i].style.removeProperty('--kx')
          chars[i].style.removeProperty('--ky')
          applied[i] = false
        }
      }

      // Variable-weight ripple, previously driven by per-character
      // onMouseEnter/onMouseLeave React state.
      for (let i = 0; i < chars.length; i++) {
        const d = nearest === -1 || nearestDist > RADIUS ? 99 : Math.abs(i - nearest)
        if (d <= 2) chars[i].setAttribute('data-proximity', String(d))
        else chars[i].removeAttribute('data-proximity')
      }
    }

    const onMove = (e) => {
      pointer = { x: e.clientX, y: e.clientY }
      if (!active) { active = true; stop = onFrame(tick, { band: 'input' }) }
    }
    const onLeave = () => { pointer = null }
    const invalidate = () => { rectDirty = true }

    measure()
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    // T-011 — observe the element, not the window. `resize` fires on every
    // URL-bar collapse during a scroll; the observer fires when this element's
    // box actually changed, which is the thing the cache depends on.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('scroll', invalidate, { passive: true })
    document.fonts?.ready.then(measure).catch(() => {})

    return () => {
      stop?.()
      clearAll()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
      window.removeEventListener('scroll', invalidate)
    }
  }, [reducedMotion])

  // Resolved once and cached rather than re-queried on every scroll tick.
  //
  // P5.5 — the velocity-linked grain opacity write is gone with the grain
  // layer itself. It was a per-scroll-frame inline style write on a
  // full-viewport composited element, which is the most expensive shape a
  // scroll effect can have, for a texture that peaked at 8 % opacity.
  const heroNameElRef = useRef(null)
  useEffect(() => {
    heroNameElRef.current = nameRef.current
  }, [])

  useScrollVelocity((vel) => {
    const absVel = Math.min(1, Math.abs(vel * 30))
    const heroName = heroNameElRef.current
    if (heroName) heroName.style.transform = `skewX(${Math.min(1, absVel * 2) * 0.2}deg)`
    // --grade-hue is written by SmoothScrollContext alone. This used to write
    // it too, with a different formula (p * 8deg vs p * 40deg) on a different
    // schedule, and the two fought each other.
  }, { throttleMs: 80 })
  const sectionRef = useRef(null)

  /*
   * The forge gem is the site's ONE heavy 3-D moment, and the only thing left
   * that puts `three` on the first-visit graph. Gating it on tier means a weak
   * device downloads zero three bytes.
   *
   * It is no longer gated on being a desktop. `isMobile` and a 768px media
   * query were both standing in for "can this thing afford WebGL", and neither
   * of them asks that. The measured tier does, on hardware evidence, and it
   * already returns 1 for the phones that genuinely cannot — while a modern
   * handset renders 80 flat-shaded faces without noticing. Excluding every
   * phone by width meant the one deliberate 3-D moment on the site was
   * invisible to most of the people who visited it.
   *
   * The gate LATCHES. It used to re-evaluate on every tier change, so a
   * momentary drop to tier 1 unmounted the gem — disposing its GPU context —
   * and the recovery a few seconds later mounted it again from scratch. That
   * is the "rotating thing comes and goes". Deciding once is also the honest
   * reading of the rule: this is a capability question, not a per-frame one.
   * If the machine later struggles, the scene's own loop stops drawing
   * (cheaper than a remount) rather than the component disappearing.
   */
  const [forgeAllowed, setForgeAllowed] = useState(false)
  useEffect(() => {
    /*
     * `if (reducedMotion) return` used to be here, and it meant the hero gem —
     * the first 3-D object on the site — did not exist AT ALL in Minimal
     * motion. Measured across the full matrix: `heroGem MISSING` in 9 of the
     * 36 states, every one of them a `motion: off` cell.
     *
     * That is the same category error as deleting the background and the
     * clock. Minimal motion is a request for STILLNESS, not for less content,
     * and the console labels it "Nothing moves. Everything is still there."
     * A visitor who chose it was getting a hole where the object should be and
     * no way to know the site had one.
     *
     * The gem now mounts in every motion mode and holds still in this one —
     * see the `frozen` branch in HeroForgeObject's frame loop.
     */
    if (forgeAllowed) return

    /*
     * Capability is necessary but not sufficient. This gem is the one thing on
     * the site that costs `three` — ~127 KB gzipped — and opening that to
     * phones means opening it to phones on metered and slow connections, where
     * a decorative download is a genuine imposition rather than a nicety. A
     * device that has asked for less data, or that is honestly reporting a 2G
     * link, keeps the CSS hero and loses nothing it can afford to want.
     */
    const conn = navigator.connection
    if (conn?.saveData) return
    if (conn?.effectiveType && /^(slow-)?2g$/.test(conn.effectiveType)) return

    const evaluate = () => {
      if (getTier() >= 2) {
        setForgeAllowed(true)
        return true
      }
      return false
    }
    if (evaluate()) return
    return onTierChange(evaluate)
  }, [forgeAllowed])

  /*
   * Cinematic exit — the hero recedes into depth as the visitor scrolls: copy
   * drifts up and fades, backdrop parallaxes slower.
   *
   * This was six framer-motion `useTransform` chains, which is the reason the
   * 42 KB motion chunk sat in the critical path (§8.3). It is now ONE number,
   * `--hero-p`, written on the section from the shared scroll frame; every
   * layer derives its own transform from it in CSS, on the compositor. The
   * The CSS transition stays on the compositor; React is not involved in the
   * per-frame scroll path.
   */
  /*
   * Depth. The backdrop and the gem are bound to the shared lean signal at
   * different depths, and the stylesheet moves them in opposite directions —
   * which is what turns two flat layers into a near one and a far one.
   *
   * They are bound individually rather than once on the section: a custom
   * property changing on #hero would invalidate style for the entire first
   * viewport every frame, headline included, where two bindings invalidate two
   * small subtrees. The headline is not bound at all, on purpose — text nudged
   * by fractions of a pixel every frame renders soft.
   */
  /*
   * iOS 13+ will not report device motion until the visitor grants it, and the
   * grant can only be requested from inside a real gesture. Every other
   * platform simply starts reporting, so this chip appears on exactly the
   * devices that need it and nowhere else.
   *
   * It is an offer rather than a prompt on load. Firing the system dialog at
   * an unsuspecting reader is the kind of thing that gets a page closed, and a
   * visitor who ignores this loses only the parallax — the gem still spins,
   * the field still moves, everything still works.
   */
  const [showTiltOffer, setShowTiltOffer] = useState(false)
  useEffect(() => {
    if (reducedMotion) return
    if (needsTiltPermission()) setShowTiltOffer(true)
    return onGyroState((state) => {
      if (state === 'granted' || state === 'denied' || state === 'unsupported') {
        setShowTiltOffer(false)
      }
    })
  }, [reducedMotion])

  const backRef = useRef(null)
  const forgeSlotRef = useRef(null)
  /*
   * `reducedMotion` belongs in the dependency list, and its absence was a
   * real bug rather than a lint technicality: the effect READS it to decide
   * whether to bind pointer-tilt handlers, but only re-ran when `forgeAllowed`
   * changed. A visitor who switched to Minimal motion from the Appearance
   * Console therefore kept the tilt bound — the hero went on leaning with the
   * pointer in the one mode that promises nothing moves — until something
   * unrelated happened to remount it.
   */
  useEffect(() => {
    if (reducedMotion) return
    const unbindBack = bindTilt(backRef.current, 1)
    const unbindForge = forgeSlotRef.current ? bindTilt(forgeSlotRef.current, 1) : null
    return () => { unbindBack(); unbindForge?.() }
  }, [forgeAllowed, reducedMotion])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    return onScrollFrame(({ y, vh }) => {
      // Equivalent to offset: ['start start', 'end start'] on a 100vh hero.
      const height = el.offsetHeight || vh
      const p = Math.min(1, Math.max(0, y / Math.max(height, 1)))
      el.style.setProperty('--hero-p', p.toFixed(4))
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      id="hero"
      aria-label="Introduction"
      className="hero-section relative w-full overflow-hidden flex items-center"
      style={{ '--hero-p': 0 }}
    >
      {/* The constellation canvas that used to live here is gone: the §14
          background engine covers the hero as its own region, so a second
          full-hero canvas was drawing the same idea twice. The click gesture
          it carried (and the achievement behind it) stays. */}
      <div
        ref={backRef}
        className="hero-back absolute inset-0 hero-poster"
        data-cursor="explore"
        onClick={() => {
          sound?.play('click')
          window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'compiler' }))
        }}
      >
        <HeroAurora />
      </div>

      {/* Geometry lives in CSS now. On a phone the gem cannot be a 420px pane
          pinned to the right margin — there is no right margin — so it becomes
          what it always should have been at that size: an object in the scene,
          set behind the copy in the upper right. Same component, same shader,
          different staging. */}
      {forgeAllowed && (
        <div className="hero-forge-slot" ref={forgeSlotRef}>
          <Suspense fallback={null}>
            <HeroForgeObject />
          </Suspense>
        </div>
      )}

      <div className="hero-copy relative z-10 container-px w-full">
        <div className="hero-rise hero-badge mb-6" style={{ '--rise-delay': '0.1s' }}>
          <span className="hero-badge__dot" />
          <span className="font-mono text-[12px] tracking-wide text-[var(--ink-mid)]">
            Open to opportunities
          </span>
        </div>

        <div className="hero-name-stage relative">
          {/* The staggered entrance is `animation-delay: calc(var(--i) * 40ms)`
              — a CSS stagger does exactly what staggerChildren did, without a
              variants tree resolving on the main thread during first paint. */}
          <h1
            ref={nameRef}
            className="font-display fs-hero hero-name name-runner"
            data-intro={introPhase}
            aria-label="Gaurav Barhate"
          >
            {NAME_CHARS.map((char, i) => (
              <span key={i} className="name-runner__glyph" style={{ '--i': i }} aria-hidden="true">
                <span className="kinetic-char">{char}</span>
              </span>
            ))}
          </h1>
          <div className="hero-run-lane" aria-hidden="true" data-loop="hero-run-lane">
            <svg className="hero-runner" viewBox="0 0 90 54" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className="hero-runner__head" cx="49" cy="10" r="5" />
              <path className="hero-runner__body" d="M45 17L38 31L48 36" />
              <path className="hero-runner__limb hero-runner__limb--arm-a" d="M43 20L28 25L18 20" />
              <path className="hero-runner__limb hero-runner__limb--arm-b" d="M42 21L54 27L65 24" />
              <path className="hero-runner__limb hero-runner__limb--leg-a" d="M47 35L34 45L21 45" />
              <path className="hero-runner__limb hero-runner__limb--leg-b" d="M47 35L58 44L71 42" />
            </svg>
          </div>
        </div>

        {/* The height reservation and the text it reserves for have to share a
            font-size, or `em` resolves against the wrong one. The size classes
            were on the <p> and the `h-[1.4em]` on this div, so the box was
            22px (1.4 × the inherited 16px) around 28px of `text-lg` line box —
            the rotator's words were cropped top and bottom at every width from
            md up. Sizing here makes the em mean what it says. */}
        <div className="hero-rotator overflow-hidden mt-3 text-sm md:text-lg h-[1.65em]">
          <p className="font-mono tracking-wide text-[var(--ink-mid)]">
            <WordRotator words={['Full-Stack Developer', 'Competitive Programmer', 'MERN Stack Developer', 'B.Tech CSE Graduate']} />
          </p>
        </div>

        <p
          className="hero-stats hero-rise mt-6 max-w-md text-[var(--ink-mid)] text-sm md:text-base"
          style={{ '--rise-delay': '0.5s' }}
        >
          <span className="hero-stat-strong">LeetCode Knight</span>, max rating{' '}
          <span className="hero-stat-strong">1972</span>
          <span className="hero-stat-sep" />
          <span className="hero-stat-strong">800+</span> problems solved
          <span className="hero-stat-sep" />
          <span className="hero-stat-strong">5+</span> apps in production
          <span className="hero-stat-sep" />
          I build full-stack web applications with real-time features and AI
          integrations.
        </p>

        {showTiltOffer && (
          <button
            type="button"
            className="hero-tilt-offer hero-rise"
            style={{ '--rise-delay': '0.85s' }}
            onClick={async () => {
              const ok = await requestTiltPermission()
              setShowTiltOffer(false)
              if (ok) {
                sound?.play('click')
                window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'compiler' }))
              }
            }}
          >
            <span className="hero-tilt-offer__icon" aria-hidden="true">◧</span>
            <span>TILT TO EXPLORE</span>
          </button>
        )}

        <div
          className="hero-ctas hero-rise mt-10 flex flex-wrap items-center gap-3 md:gap-5"
          style={{ '--rise-delay': '0.7s' }}
        >
          <MagneticTilt>
            <MagneticButton
              as="a"
              href="#projects"
              data-cursor="view"
              className="hero-cta hero-cta--primary px-7 py-3.5 rounded-full font-medium text-sm shadow-[0_0_40px_var(--accent-dim)] hover:shadow-[0_0_60px_var(--accent)] transition-shadow duration-base"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              View the Work
            </MagneticButton>
          </MagneticTilt>
          <MagneticTilt>
            <MagneticButton
              as="button"
              onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
              data-cursor="crosshair"
              className="hero-cta hero-cta--arcade px-5 md:px-7 py-3.5 rounded-full text-sm font-mono tracking-wider flex items-center gap-2 transition-all duration-fast"
            >
              <span className="text-[15px] md:text-[17px]">🎮</span>
              <span>Play something</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)] animate-pulse" />
            </MagneticButton>
          </MagneticTilt>
          <MagneticTilt>
            <MagneticButton
              as="a"
              href={SOCIALS.github}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="view"
              className="hero-cta hero-cta--ghost px-5 md:px-7 py-3.5 rounded-full text-sm font-mono text-[var(--ink-mid)] hover:text-[var(--ink)] transition-colors duration-fast"
            >
              GitHub ↗
            </MagneticButton>
          </MagneticTilt>

          {/*
            The résumé, in the first viewport, on phones.

            MEASURED BUG: the header's RESUME button is `hidden sm:inline-flex`,
            so below 640px the single most important artefact on the site was
            reachable only by opening the drawer. `tests/recruiter-path.spec.js`
            failed on `modern-phone` for exactly this — "the résumé is one click
            from the first viewport" was false on the device most recruiters
            actually use.

            `sm:hidden` because above that width the header button is visible
            and two résumé links in one screen is noise.
          */}
          <a
            href={RESUME_PATH}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="view"
            className="hero-cta hero-cta--ghost sm:hidden px-5 py-3.5 rounded-full text-sm font-mono text-[var(--ink-mid)]"
          >
            Résumé ↗
          </a>
        </div>
      </div>

      <div className="absolute bottom-32 right-[12%] hidden md:flex flex-col items-center gap-3">
        <Spark id="spark-hero" />
        {/*
          T-040.1 — this was a `<div>` with an onClick and a pointer cursor:
          it looked interactive, was unreachable by keyboard, and announced
          nothing. The `md:` gate on its parent is why only the wider
          Playwright projects caught it.
        */}
        <button
          type="button"
          className="arcade-hero-hint group"
          aria-label="Open the arcade and pick a game to play"
          onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
        >
          <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--accent-dim)]/20 hover:border-[var(--accent-dim)]/60 transition-all duration-fast"
            style={{ background: 'color-mix(in oklch, var(--accent) 4%, var(--surface-1))' }}
          >
            <div className="flex gap-1">
              <span className="text-[12px]">🏃</span>
              <span className="text-[12px]">🎲</span>
              <span className="text-[12px]">🪜</span>
              <span className="text-[12px]">🧠</span>
              <span className="text-[12px]">🐍</span>
            </div>
            <span className="font-mono text-[12px] tracking-[0.2em] text-[var(--ink-low)]" aria-hidden="true">Play something</span>
          </div>
        </button>
      </div>

      <div className="hero-scroll-hint absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="font-mono text-[12px] tracking-widest text-[var(--ink-low)]">SCROLL</span>
        <div className="w-px h-10 overflow-hidden">
          <div className="w-px h-10 bg-gradient-to-b from-[var(--accent)] to-transparent animate-[scrollHint_1.8s_ease-in-out_infinite]" />
        </div>
      </div>
    </section>
  )
}
