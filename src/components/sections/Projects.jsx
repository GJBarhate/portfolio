import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useInView } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import SplitText from '../ui/SplitText.jsx'
import HorizontalScroll from '../ui/HorizontalScroll.jsx'
import Picture from '../ui/Picture.jsx'
import { PROJECTS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { getTier, onFrame } from '../../lib/raf.js'
import { scrollTo } from '../../lib/scroller.js'
import { onTilt } from '../../lib/tilt.js'

// `import.meta.glob` matches the pattern against real filenames, so an inline
// `?…` query inside the pattern matches nothing at all — that silently emptied
// this map and every card fell back to a bare text title. The query belongs in
// the options object.
const images = import.meta.glob('../../assets/projects/*.webp', {
  eager: true,
  import: 'default',
  query: '?w=640;1280&format=avif;webp&as=picture',
})
const imageEntries = Object.entries(images)

if (import.meta.env.DEV && imageEntries.length === 0) {
  throw new Error('Projects: image glob matched nothing — check pattern/query')
}

function resolveImage(name) {
  // Glob keys may carry the imagetools query string, so match on the path part.
  const entry = imageEntries.find(([path]) => path.split('?')[0].endsWith(name))
  return entry ? entry[1] : null
}

// The hover-distortion shader is an island: it is only fetched on a device
// that can hover, on a machine that can afford it, and only in deck view.
// Grid cards never load it at all (§3.5).
const Distortion = lazy(() => import('../ui/WebGLDistortion.jsx'))

const AUTO_CYCLE_MS = 4200

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'localhost' }
}

/**
 * §10 alt-text spec — describe what is ON the screenshot, not what the project
 * is called. "PeerCode" tells a screen-reader user nothing they cannot already
 * read from the heading two lines below.
 */
function altFor(project, file, index) {
  return (
    project.imageAlts?.[file] ||
    `${project.title} — ${project.tagline}, screenshot ${index + 1}`
  )
}

/** A CSS-only browser chrome around a screenshot — reads as "shipped product"
 *  to a recruiter, and costs zero JS (Research #6). */
function DeviceFrame({ project, children, live }) {
  return (
    <div className="device-frame" style={{ '--card-accent': project.accent }}>
      <div className="device-frame__bar" aria-hidden="true">
        <span className="device-frame__dot device-frame__dot--r" />
        <span className="device-frame__dot device-frame__dot--y" />
        <span className="device-frame__dot device-frame__dot--g" />
        <span className="device-frame__url">{hostOf(live || project.repo)}</span>
      </div>
      <div className="device-frame__screen">{children}</div>
    </div>
  )
}

function LivePing({ project }) {
  if (!project.live) return null
  const degraded = project.status === 'degraded'
  return (
    <span className="live-ping" data-degraded={degraded ? 'true' : 'false'}>
      <span className="live-ping__dot" data-loop="live-ping" />
      {degraded ? 'SLOW' : 'LIVE'}
    </span>
  )
}

/*
 * Deck card — every project is a full-width panel that pins below the navbar
 * while the next one slides over it (sticky-stack). As a card is covered it
 * recedes: scales down slightly and dims, giving the deck physical depth.
 */
function DeckCard({ project, index, distortionAllowed, onOpen }) {
  const outerRef = useRef(null)
  const [activeImg, setActiveImg] = useState(0)
  const [paused, setPaused] = useState(false)
  const spotlight = useSpotlight()
  const reducedMotion = useReducedMotion()
  const inView = useInView(outerRef, { margin: '-10%' })

  useEffect(() => {
    if (reducedMotion || paused || !inView || project.images.length < 2) return
    const id = setInterval(() => {
      setActiveImg((v) => (v + 1) % project.images.length)
    }, AUTO_CYCLE_MS)
    return () => clearInterval(id)
  }, [reducedMotion, paused, inView, project.images.length])

  const cover = project.images[activeImg] ? resolveImage(project.images[activeImg]) : null
  const alt = altFor(project, project.images[activeImg], activeImg)

  // ←/→ step through this card's shots when it holds focus (§3.4 a11y).
  const onKeyDown = (e) => {
    if (project.images.length < 2) return
    if (e.key === 'ArrowRight') {
      e.preventDefault(); setPaused(true)
      setActiveImg((v) => (v + 1) % project.images.length)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); setPaused(true)
      setActiveImg((v) => (v - 1 + project.images.length) % project.images.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); onOpen?.(project)
    }
  }

  return (
    <div
      ref={outerRef}
      id={`project-${project.id}`}
      className="h-full"
      // Paired with the grid card's name, this lets the browser morph each
      // card between the two layouts instead of cross-fading the whole block.
      style={{ viewTransitionName: `project-${project.id}` }}
    >
      <article
        style={{ '--card-accent': project.accent }}
        className="deck-card satin group relative rounded-2xl glass spotlight sheen sheen--auto overflow-hidden h-full flex flex-col"
        tabIndex={0}
        role="group"
        aria-roledescription="project card"
        aria-label={`${project.title} — ${project.tagline}`}
        onKeyDown={onKeyDown}
        onMouseMove={spotlight.onMouseMove}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-[2px] z-20"
          style={{ background: `linear-gradient(90deg, transparent, ${project.accent}, transparent)`, opacity: 0.85 }}
        />

        <div className="relative aspect-[16/10] overflow-hidden flex-shrink-0">
          {/* Boss plate — game layer set piece */}
          <span
            className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full font-mono text-[12px] tracking-[0.2em]"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: 'var(--accent-reward)',
              border: '1px solid color-mix(in oklch, var(--accent-reward) 40%, transparent)',
            }}
          >
            BOSS {String(index + 1).padStart(2, '0')}
            <span className="inline-flex gap-0.5 ml-1.5">
              {Array.from({ length: Math.min(5, index + 2) }, (_, j) => (
                <span key={j} className="w-1 h-1 rounded-full" style={{ background: 'var(--accent-reward)' }} />
              ))}
            </span>
          </span>
          {cover ? (
            distortionAllowed ? (
              <Suspense fallback={
                <Picture picture={cover} alt={alt} sizes="(max-width: 768px) 88vw, 560px"
                  className="absolute inset-0 w-full h-full object-cover object-top" />
              }>
                <Distortion
                  picture={cover}
                  alt={alt}
                  sizes="(max-width: 768px) 88vw, 560px"
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              </Suspense>
            ) : (
              <Picture
                picture={cover}
                alt={alt}
                sizes="(max-width: 768px) 88vw, 560px"
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            )
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center font-display text-2xl"
              style={{ background: `linear-gradient(140deg, var(--surface-2), color-mix(in oklch, ${project.accent} 25%, var(--surface-1)))` }}
            >
              {project.title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)]/45 to-transparent pointer-events-none" />

          {project.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {project.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveImg(i); setPaused(true) }}
                  className="deck-shot-dot"
                  data-active={i === activeImg ? 'true' : 'false'}
                  style={{ '--card-accent': project.accent }}
                  aria-label={`View image ${i + 1} of ${project.images.length}`}
                />
              ))}
            </div>
          )}

          <span className="absolute top-3 left-3 font-mono text-[12px] px-2 py-0.5 rounded-full z-10" style={{ background: 'rgba(0,0,0,0.4)', color: project.accent, border: `1px solid ${project.accent}40` }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <div className="relative p-4 md:p-5 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-mono text-[12px] tracking-[0.25em]" style={{ color: project.accent }}>
              {project.tagline.toUpperCase()}
            </p>
            <LivePing project={project} />
          </div>
          <h3 className="font-display text-lg md:text-xl mb-2">{project.title}</h3>

          <p className="text-[var(--ink-mid)] text-sm leading-relaxed mb-3 line-clamp-3">
            {project.description}
          </p>

          {/* Recruiters read outcomes, not feature lists. */}
          {project.outcome && (
            <p className="deck-card__outcome text-[13px] leading-snug mb-3 pl-3 border-l-2 text-[var(--ink)]"
               style={{ borderColor: project.accent }}>
              {project.outcome}
            </p>
          )}

          <div className="flex flex-wrap gap-1 mb-4">
            {project.tech.slice(0, 5).map((t) => (
              <span
                key={t}
                className="text-[12px] font-mono px-1.5 py-0.5 rounded-full border border-[var(--glass-border)] text-[var(--ink-low)]"
              >
                {t}
              </span>
            ))}
            {project.tech.length > 5 && (
              <span className="text-[12px] font-mono px-1.5 py-0.5 text-[var(--ink-low)]">+{project.tech.length - 5}</span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpen?.(project)}
              data-cursor="view"
              className="project-btn project-btn--ghost px-3 py-1.5 rounded-full text-[12px] font-mono"
            >
              CASE STUDY
            </button>
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="view"
                className="project-btn project-btn--live flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-mono"
                style={{ '--btn-accent': project.accent }}
              >
                <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgb(52,211,153)]" />
                LIVE DEMO
              </a>
            )}
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="view"
              className="project-btn project-btn--ghost px-3 py-1.5 rounded-full text-[12px] font-mono"
            >
              SOURCE ↗
            </a>
          </div>
        </div>
      </article>
    </div>
  )
}

const ProjectLightbox = lazy(() => import('../ui/ProjectLightbox.jsx'))

/**
 * Pointer-tracked 3-D tilt across the whole grid.
 *
 * ONE delegated listener and ONE rAF subscription for all five cards, not five
 * of each: the hovered card is found by `closest()`, and its angles are
 * written as CSS custom properties so the transform stays on the compositor.
 * Damped (k = 14) so the card leans into the cursor instead of snapping to it.
 */
function useCardTilt(enabled) {
  const ref = useRef(null)

  useEffect(() => {
    const root = ref.current
    if (!root || !enabled) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const MAX = 6
    let card = null
    let rect = null
    const target = { x: 0, y: 0 }
    const value = { x: 0, y: 0 }
    let stop = null

    const tick = (_t, dt) => {
      const k = 1 - Math.exp(-(dt / 1000) * 14)
      value.x += (target.x - value.x) * k
      value.y += (target.y - value.y) * k
      if (card) {
        card.style.setProperty('--tilt-x', `${value.x.toFixed(2)}deg`)
        card.style.setProperty('--tilt-y', `${value.y.toFixed(2)}deg`)
      }
      if (!card && Math.abs(value.x) < 0.02 && Math.abs(value.y) < 0.02) {
        stop?.(); stop = null
      }
    }
    const start = () => { if (!stop) stop = onFrame(tick, { band: 'input' }) }

    const onMove = (e) => {
      const next = e.target.closest?.('.grid-card')
      if (next !== card) {
        card?.style.removeProperty('--tilt-x')
        card?.style.removeProperty('--tilt-y')
        card = next
        rect = card?.getBoundingClientRect() || null
      }
      if (!card) { target.x = 0; target.y = 0; start(); return }
      if (!rect) rect = card.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      target.y = px * MAX * 2
      target.x = -py * MAX * 2
      card.style.setProperty('--glare-x', `${((px + 0.5) * 100).toFixed(1)}%`)
      card.style.setProperty('--glare-y', `${((py + 0.5) * 100).toFixed(1)}%`)
      start()
    }
    const onLeave = () => {
      target.x = 0
      target.y = 0
      const leaving = card
      card = null
      // Let the damping run the card back to flat before releasing it.
      setTimeout(() => {
        leaving?.style.removeProperty('--tilt-x')
        leaving?.style.removeProperty('--tilt-y')
      }, 260)
      start()
    }
    const invalidate = () => { rect = card?.getBoundingClientRect() || null }

    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave, { passive: true })
    window.addEventListener('scroll', invalidate, { passive: true })
    // T-011 — the grid's own box, observed, instead of every window resize.
    const ro = new ResizeObserver(invalidate)
    ro.observe(root)
    return () => {
      stop?.()
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', invalidate)
      ro.disconnect()
    }
  }, [enabled])

  return ref
}

/**
 * The same idea, for a device with no cursor.
 *
 * `useCardTilt` bails immediately on `(hover: none)`, which is correct — there
 * is no pointer to lean toward — but it left touch with a flat, inert grid
 * where the desktop got the signature effect of the section. A phone does know
 * which way it is being held, so the cards lean toward that instead, and the
 * specular sheen tracks it exactly as it tracks the cursor elsewhere.
 *
 * Only cards actually on screen are written to. An IntersectionObserver keeps
 * that set tiny, so this is a handful of custom-property writes per frame
 * rather than one per card in the section.
 */
function useCardLean(enabled, ref) {
  useEffect(() => {
    const root = ref.current
    if (!root || !enabled) return
    if (!window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Deliberately gentler than the 6° cursor lean: the whole grid moves at
    // once here, and what reads as responsive on one hovered card reads as a
    // wobbling page when it is all of them.
    const MAX = 3.5
    const visible = new Set()

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target)
          else {
            visible.delete(e.target)
            e.target.style.removeProperty('--tilt-x')
            e.target.style.removeProperty('--tilt-y')
          }
        }
      },
      { rootMargin: '10% 0px' }
    )
    for (const card of root.querySelectorAll('.grid-card')) io.observe(card)

    const off = onTilt(({ x, y }) => {
      // Units matter: `.grid-card` feeds these straight into rotateX()/rotateY(),
      // so they must carry `deg`. A bare number there invalidates the whole
      // transform and the card would flatten rather than tilt.
      const rx = (-y * MAX).toFixed(2)
      const ry = (x * MAX).toFixed(2)
      const gx = (x * 50 + 50).toFixed(1)
      const gy = (y * 50 + 50).toFixed(1)
      for (const card of visible) {
        card.style.setProperty('--tilt-x', `${rx}deg`)
        card.style.setProperty('--tilt-y', `${ry}deg`)
        card.style.setProperty('--glare-x', `${gx}%`)
        card.style.setProperty('--glare-y', `${gy}%`)
      }
    })

    return () => {
      off()
      io.disconnect()
      for (const card of root.querySelectorAll('.grid-card')) {
        card.style.removeProperty('--tilt-x')
        card.style.removeProperty('--tilt-y')
      }
    }
  }, [enabled, ref])
}

export default function Projects() {
  // Grid is the default. Cinema is scroll-jacking on the section recruiters
  // care most about, which is a real conversion risk — it stays as an opt-in
  // toggle rather than the thing everyone is forced through.
  const [viewMode, setViewMode] = useState('grid')
  const [openProject, setOpenProject] = useState(null)
  const reducedMotion = useReducedMotion()
  const toggleRef = useRef(null)
  const sectionRef = useRef(null)
  const [distortionAllowed, setDistortionAllowed] = useState(false)

  /*
   * D-32 — GRID/CINEMA.
   *
   * This used to start the view transition from *inside* a `setViewMode`
   * updater. An updater runs during render and must be pure: React is free to
   * call it twice (it does, in StrictMode) and to discard the result, so a
   * `document.startViewTransition` + `flushSync` living in there fired twice,
   * warned, and could snapshot the DOM before the state it was meant to
   * animate had been applied. The toggle worked or did not depending on
   * render timing, which is the worst kind of "sometimes".
   *
   * The transition is a side effect of a click, so it belongs in the handler,
   * reading the current mode from a ref rather than from a stale closure.
   */
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  const switchView = useCallback((mode) => {
    if (viewModeRef.current === mode) return
    if (!reducedMotion && typeof document.startViewTransition === 'function') {
      // flushSync is required here and legal here: startViewTransition
      // snapshots the DOM when the callback returns, so the update must have
      // been committed by then.
      document.startViewTransition(() => flushSync(() => setViewMode(mode)))
      return
    }
    setViewMode(mode)
  }, [reducedMotion])

  // Viewport-entry speculative warming (Research #17): the shader chunk is
  // fetched once the toggle has been on screen, and only where it can run.
  useEffect(() => {
    const el = toggleRef.current
    if (!el || reducedMotion) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (getTier() < 2) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      setDistortionAllowed(true)
      import('../ui/WebGLDistortion.jsx')
    }, { rootMargin: '50% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [reducedMotion])

  // Escape returns from the deck to the grid (§10 keyboard path).
  useEffect(() => {
    if (viewMode !== 'deck') return
    const onKey = (e) => {
      if (e.key === 'Escape' && !openProject) switchView('grid')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewMode, openProject, switchView])

  /*
   * D-31 — the five index chips did nothing in the default view.
   *
   * `project-${id}` is written by `DeckCard`, which only renders in CINEMA
   * mode. GRID is the default, so on a first visit every chip resolved to
   * `null` and the click was silently swallowed — five buttons that looked
   * live and were not. Both layouts now carry the id (the grid card already
   * had a matching `viewTransitionName`, so this is the id that was missing
   * rather than a new concept), and the chip highlights the card it lands on
   * so the jump is legible when the target is already on screen.
   */
  const goTo = (id) => {
    const el = document.getElementById(`project-${id}`)
    if (!el) return
    scrollTo(el, { offset: -24 })
    el.classList.remove('is-chip-target')
    // Reading offsetWidth restarts the highlight animation when the same chip
    // is pressed twice; without it the second press is invisible.
    void el.offsetWidth
    el.classList.add('is-chip-target')
    setTimeout(() => el.classList.remove('is-chip-target'), 1400)
  }

  const liveCount = useMemo(() => PROJECTS.filter((p) => p.live).length, [])
  const gridRef = useCardTilt(viewMode === 'grid')
  // Cursor and device lean are mutually exclusive by media query, so both can
  // share the one grid ref without ever writing to it at the same time.
  useCardLean(viewMode === 'grid', gridRef)

  return (
    <section
      id="projects"
      aria-labelledby="projects-heading"
      ref={sectionRef}
      data-view-mode={viewMode}
      data-field="4"
      data-loop
      className="projects-section relative section-rhythm container-px overflow-x-clip"
    >
      <span className="ghost-numeral" aria-hidden="true">04</span>
      {/* One composited layer, tinted by whichever card is hovered (§3.6). */}
      <span className="projects-wash" aria-hidden="true" />

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">04 — SELECTED WORK</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 id="projects-heading" className="section-h2 font-display mb-8 max-w-3xl">
            <SplitText>Five projects I built </SplitText>
            <SplitText className="text-gradient" delay={0.14}>and deployed to production.</SplitText>
          </h2>
        </Reveal>

        {/* R2 — two deliberate rows. The old single flex row wrapped the
            GRID/CINEMA pill and five index chips into a ragged 2-line cluster
            below 900px, with a 56px void under it. */}
        <Reveal delay={0.15}>
          <div className="projects-controls mb-10">
            <div className="projects-controls__row" ref={toggleRef}>
              <div className="view-toggle" role="tablist" aria-label="Project layout">
                <button
                  role="tab"
                  onClick={() => switchView('grid')}
                  data-cursor="view"
                  aria-selected={viewMode === 'grid'}
                  data-active={viewMode === 'grid'}
                  className="view-toggle__btn"
                >
                  GRID
                </button>
                <button
                  role="tab"
                  onClick={() => switchView('deck')}
                  data-cursor="view"
                  aria-selected={viewMode === 'deck'}
                  data-active={viewMode === 'deck'}
                  className="view-toggle__btn"
                >
                  CINEMA
                </button>
              </div>
              <p className="projects-controls__caption font-mono">
                {String(PROJECTS.length).padStart(2, '0')} PROJECTS · {liveCount} LIVE
              </p>
            </div>
            <div className="projects-controls__chips" role="list">
              {PROJECTS.map((p, i) => (
                <button
                  key={p.id}
                  role="listitem"
                  onClick={() => goTo(p.id)}
                  data-cursor="view"
                  className="deck-index-chip font-mono text-[12px] tracking-[0.18em] px-3.5 py-2 rounded-full"
                  style={{ '--chip-accent': p.accent }}
                >
                  <span style={{ color: p.accent }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="ml-2">{p.title.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* View mode */}
        {viewMode === 'deck' ? (
          <HorizontalScroll onExit={() => switchView('grid')} exitLabel="EXIT CINEMA">
            {PROJECTS.map((p, i) => (
              <div key={p.id} className="deck-slot flex-shrink-0 px-3 h-full">
                <DeckCard
                  project={p}
                  index={i}
                  distortionAllowed={distortionAllowed}
                  onOpen={setOpenProject}
                />
              </div>
            ))}
          </HorizontalScroll>
        ) : (
          <div ref={gridRef} className="projects-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROJECTS.map((p, i) => (
              <GridCard key={p.id} project={p} index={i} onOpen={setOpenProject} />
            ))}
          </div>
        )}
      </div>

      {openProject && (
        <Suspense fallback={null}>
          <ProjectLightbox
            project={openProject}
            resolveImage={resolveImage}
            onClose={() => setOpenProject(null)}
          />
        </Suspense>
      )}
    </section>
  )
}

function GridCard({ project, index, onOpen }) {
  const cover = project.images[0] ? resolveImage(project.images[0]) : null
  const alt = altFor(project, project.images[0], 0)

  return (
    <article
      className="grid-card group"
      id={`project-${project.id}`}
      style={{ '--card-accent': project.accent, viewTransitionName: `project-${project.id}` }}
      onMouseEnter={(e) => {
        e.currentTarget.closest('.projects-section')?.style.setProperty('--wash-accent', project.accent)
      }}
    >
      <button
        type="button"
        className="grid-card__hit"
        data-cursor="view"
        onClick={() => onOpen?.(project)}
        aria-label={`Open the ${project.title} case study`}
      />

      <span className="grid-card__glare" aria-hidden="true" />

      <DeviceFrame project={project} live={project.live}>
        {cover ? (
          <Picture
            picture={cover}
            alt={alt}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="grid-card__img"
          />
        ) : (
          <div className="grid-card__fallback">{project.title}</div>
        )}
      </DeviceFrame>

      {/* Content sits BELOW the shot. The old overlay gradient covered the
          bottom 45% of every screenshot — the exact part that shows the UI. */}
      <div className="grid-card__body">
        <div className="grid-card__meta">
          <span className="grid-card__index font-mono">{String(index + 1).padStart(2, '0')}</span>
          <span className="grid-card__tagline font-mono">{project.tagline.toUpperCase()}</span>
          <LivePing project={project} />
        </div>
        <h3 className="grid-card__title font-display">{project.title}</h3>
        {project.outcome && <p className="grid-card__outcome">{project.outcome}</p>}
        <div className="grid-card__chips">
          {project.tech.slice(0, 3).map((t) => (
            <span key={t} className="grid-card__chip font-mono">{t}</span>
          ))}
          {project.tech.length > 3 && (
            <span className="grid-card__chip grid-card__chip--more font-mono">+{project.tech.length - 3}</span>
          )}
        </div>
        <div className="grid-card__links">
          {project.live && (
            <a href={project.live} target="_blank" rel="noopener noreferrer" className="grid-card__link" data-cursor="view">
              LIVE ↗
            </a>
          )}
          <a href={project.repo} target="_blank" rel="noopener noreferrer" className="grid-card__link" data-cursor="view">
            SOURCE ↗
          </a>
        </div>
      </div>
    </article>
  )
}
