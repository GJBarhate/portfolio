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
import { getTier } from '../../lib/raf.js'

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
            className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full font-mono text-[9px] tracking-[0.2em]"
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

          <span className="absolute top-3 left-3 font-mono text-[11px] px-2 py-0.5 rounded-full z-10" style={{ background: 'rgba(0,0,0,0.4)', color: project.accent, border: `1px solid ${project.accent}40` }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <div className="relative p-4 md:p-5 flex flex-col flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="font-mono text-[11px] tracking-[0.25em]" style={{ color: project.accent }}>
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
                className="text-[11px] font-mono px-1.5 py-0.5 rounded-full border border-[var(--glass-border)] text-[var(--ink-low)]"
              >
                {t}
              </span>
            ))}
            {project.tech.length > 5 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 text-[var(--ink-low)]">+{project.tech.length - 5}</span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpen?.(project)}
              data-cursor="view"
              className="project-btn project-btn--ghost px-3 py-1.5 rounded-full text-[10px] font-mono"
            >
              CASE STUDY
            </button>
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="view"
                className="project-btn project-btn--live flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono"
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
              className="project-btn project-btn--ghost px-3 py-1.5 rounded-full text-[10px] font-mono"
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

  const switchView = useCallback((mode) => {
    setViewMode((current) => {
      if (current === mode) return current
      if (!reducedMotion && typeof document.startViewTransition === 'function') {
        // flushSync is required: startViewTransition snapshots the DOM when
        // the callback returns, so the update must be synchronous.
        document.startViewTransition(() => flushSync(() => setViewMode(mode)))
        return current
      }
      return mode
    })
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

  const goTo = (id) => {
    document.getElementById(`project-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const liveCount = useMemo(() => PROJECTS.filter((p) => p.live).length, [])

  return (
    <section
      id="projects"
      ref={sectionRef}
      data-view-mode={viewMode}
      className="projects-section relative section-rhythm container-px mesh-gradient-b overflow-x-clip"
    >
      <span className="ghost-numeral" aria-hidden="true">04</span>
      {/* One composited layer, tinted by whichever card is hovered (§3.6). */}
      <span className="projects-wash" aria-hidden="true" />

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">04 — SELECTED WORK</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="section-h2 font-display mb-8 max-w-3xl">
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
                  className="deck-index-chip font-mono text-[10px] tracking-[0.18em] px-3.5 py-2 rounded-full"
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
          <HorizontalScroll>
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
          <div className="projects-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
