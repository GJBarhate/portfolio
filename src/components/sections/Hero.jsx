import { useRef, useState, useEffect, lazy, Suspense } from 'react'
import MagneticButton from '../ui/MagneticButton.jsx'
import MagneticTilt from '../ui/MagneticTilt.jsx'
import { Spark } from '../ui/SparkHunt.jsx'
import HeroAurora from '../ui/HeroAurora.jsx'
import WordRotator from '../ui/WordRotator.jsx'
import { SOCIALS } from '../../lib/content.js'
import { useScrollVelocity } from '../../lib/useScrollVelocity.js'
import { useIsMobile } from '../../lib/useIsMobile.js'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { onFrame, getTier, onTierChange } from '../../lib/raf.js'
import { onScrollFrame } from '../../lib/scrollState.js'
import { useSound } from '../../contexts/SoundContext.jsx'

const HeroForgeObject = lazy(() => import('../ui/HeroForgeObject.jsx'))
const TextParticleExplosion = lazy(() => import('../ui/TextParticleExplosion.jsx'))

const NAME_CHARS = [...'Gaurav Barhate'].map(c => c === ' ' ? '\u00A0' : c)

export default function Hero({ introDone = true }) {
  const nameRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const sound = useSound()

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
      if (!active) { active = true; stop = onFrame(tick) }
    }
    const onLeave = () => { pointer = null }
    const invalidate = () => { rectDirty = true }

    measure()
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    window.addEventListener('scroll', invalidate, { passive: true })
    document.fonts?.ready.then(measure).catch(() => {})

    return () => {
      stop?.()
      clearAll()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', invalidate)
    }
  }, [reducedMotion])

  // Both elements were re-queried on every scroll tick; they are resolved once
  // and cached instead.
  const grainRef = useRef(null)
  const heroNameElRef = useRef(null)
  useEffect(() => {
    grainRef.current = document.querySelector('.film-grain')
    heroNameElRef.current = nameRef.current
  }, [])

  useScrollVelocity((vel) => {
    const absVel = Math.min(1, Math.abs(vel * 30))
    const grain = grainRef.current
    if (grain) grain.style.opacity = String(0.02 + absVel * 0.06)
    const heroName = heroNameElRef.current
    if (heroName) heroName.style.transform = `skewX(${Math.min(1, absVel * 2) * 0.2}deg)`
    // --grade-hue is written by SmoothScrollContext alone. This used to write
    // it too, with a different formula (p * 8deg vs p * 40deg) on a different
    // schedule, and the two fought each other.
  }, { throttleMs: 80 })
  const sectionRef = useRef(null)
  const isMobile = useIsMobile()

  // The forge gem is the site's ONE heavy 3-D moment, and it is the only thing
  // left that puts `three` on the first-visit graph. Gating it on tier means a
  // phone or a weak laptop downloads zero three bytes.
  const [forgeAllowed, setForgeAllowed] = useState(false)
  useEffect(() => {
    if (isMobile || reducedMotion) { setForgeAllowed(false); return }
    const evaluate = () =>
      setForgeAllowed(
        getTier() >= 2 && window.matchMedia('(min-width: 768px)').matches
      )
    evaluate()
    return onTierChange(evaluate)
  }, [isMobile, reducedMotion])

  /*
   * Cinematic exit — the hero recedes into depth as the visitor scrolls: copy
   * drifts up and fades, backdrop parallaxes slower.
   *
   * This was six framer-motion `useTransform` chains, which is the reason the
   * 42 KB motion chunk sat in the critical path (§8.3). It is now ONE number,
   * `--hero-p`, written on the section from the shared scroll frame; every
   * layer derives its own transform from it in CSS, on the compositor. The
   * progress is quantised before it reaches React so the particle overlay is
   * not re-rendered 120 times a second.
   */
  const [scrollPct, setScrollPct] = useState(0)
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    let lastQuantised = -1
    return onScrollFrame(({ y, vh }) => {
      // Equivalent to offset: ['start start', 'end start'] on a 100vh hero.
      const height = el.offsetHeight || vh
      const p = Math.min(1, Math.max(0, y / Math.max(height, 1)))
      el.style.setProperty('--hero-p', p.toFixed(4))
      const q = Math.round(p * 50) / 50
      if (q !== lastQuantised) {
        lastQuantised = q
        setScrollPct(q)
      }
    })
  }, [])

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative h-screen w-full overflow-hidden flex items-center"
      style={{ '--hero-p': 0 }}
    >
      {/* The constellation canvas that used to live here is gone: the §14
          background engine covers the hero as its own region, so a second
          full-hero canvas was drawing the same idea twice. The click gesture
          it carried (and the achievement behind it) stays. */}
      <div
        className="hero-back absolute inset-0 hero-poster cursor-pointer"
        data-cursor="explore"
        onClick={() => {
          sound?.play('click')
          window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'compiler' }))
        }}
      >
        <HeroAurora />
      </div>

      {forgeAllowed && (
        <div className="hero-forge-slot absolute right-[4%] top-1/2 -translate-y-1/2 z-[5] w-[340px] h-[340px] lg:w-[420px] lg:h-[420px] pointer-events-auto hidden md:block">
          <Suspense fallback={null}>
            <HeroForgeObject />
          </Suspense>
        </div>
      )}

      <div className="hero-copy relative z-10 container-px w-full">
        <div className="hero-rise hero-badge mb-6" style={{ '--rise-delay': '0.1s' }}>
          <span className="hero-badge__dot" />
          <span className="font-mono text-[11px] tracking-wide text-[var(--ink-mid)]">
            Open to opportunities
          </span>
        </div>

        <div className="relative">
          <Suspense fallback={null}>
            <TextParticleExplosion scrollProgress={scrollPct} className="z-[15]" />
          </Suspense>
          <h1
            aria-hidden="true"
            className="font-display fs-hero hero-name-ghost"
          >
            Gaurav Barhate
          </h1>
          {/* The staggered entrance is `animation-delay: calc(var(--i) * 40ms)`
              — a CSS stagger does exactly what staggerChildren did, without a
              variants tree resolving on the main thread during first paint. */}
          <h1
            ref={nameRef}
            className="font-display fs-hero hero-name-iridescent hero-name-spark overflow-hidden hero-name"
            data-intro={introDone ? 'done' : 'pending'}
          >
            {NAME_CHARS.map((char, i) => (
              // Two spans on purpose: the outer one owns the entrance, the
              // inner one owns the pointer ripple. One element cannot carry
              // both, because a filling animation would clobber the transform
              // the rAF loop writes.
              <span key={i} className="char-in" style={{ '--i': i }}>
                <span className="kinetic-char">{char}</span>
              </span>
            ))}
          </h1>
        </div>

        <div className="overflow-hidden mt-3 h-[1.4em]">
          <p className="font-mono text-sm md:text-lg tracking-wide text-[var(--ink-mid)]">
            <WordRotator words={['Full-Stack Developer', 'Competitive Programmer', 'MERN Stack Developer', 'B.Tech CSE Graduate']} />
          </p>
        </div>

        <p
          className="hero-rise mt-6 max-w-md text-[var(--ink-mid)] text-sm md:text-base"
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

        <div
          className="hero-rise mt-10 flex flex-wrap items-center gap-3 md:gap-5"
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
              <span>Play 5 Games</span>
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
        </div>
      </div>

      <div className="absolute bottom-32 right-[12%] hidden md:flex flex-col items-center gap-3">
        <Spark id="spark-hero" />
        <div
          className="arcade-hero-hint group cursor-pointer"
          onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
        >
          <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--accent-dim)]/20 hover:border-[var(--accent-dim)]/60 transition-all duration-fast"
            style={{ background: 'color-mix(in oklch, var(--accent) 4%, var(--surface-1))' }}
          >
            <div className="flex gap-1">
              <span className="text-[9px]">🏃</span>
              <span className="text-[9px]">🎲</span>
              <span className="text-[9px]">🪜</span>
              <span className="text-[9px]">🧠</span>
              <span className="text-[9px]">🐍</span>
            </div>
            <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--ink-low)]">ARCADE · 5 GAMES</span>
          </div>
        </div>
      </div>

      <div className="hero-scroll-hint absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <span className="font-mono text-[10px] tracking-widest text-[var(--ink-low)]">SCROLL</span>
        <div className="w-px h-10 overflow-hidden">
          <div className="w-px h-10 bg-gradient-to-b from-[var(--accent)] to-transparent animate-[scrollHint_1.8s_ease-in-out_infinite]" />
        </div>
      </div>
    </section>
  )
}
