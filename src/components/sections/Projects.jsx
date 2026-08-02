import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useInView } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import HorizontalScroll from '../ui/HorizontalScroll.jsx'
import { PROJECTS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'
import WebGLDistortion from '../ui/WebGLDistortion.jsx'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

// Two widths and AVIF-first delivery. The sources are 1280–1600px wide but the
// cards never render above ~520px, so full-size delivery was pure waste.
const images = import.meta.glob(
  '../../assets/projects/*.webp?w=640;1280&format=avif;webp&as=picture',
  { eager: true, import: 'default' }
)
const imageEntries = Object.entries(images)
function resolveImage(name) {
  // Glob keys now carry the imagetools query string, so match on the path part.
  const entry = imageEntries.find(([path]) => path.split('?')[0].endsWith(name))
  return entry ? entry[1] : null
}

const AUTO_CYCLE_MS = 4200

/*
 * Deck card — every project is a full-width panel that pins below the navbar
 * while the next one slides over it (sticky-stack). As a card is covered it
 * recedes: scales down slightly and dims, giving the deck physical depth.
 */
function DeckCard({ project, index }) {
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
        onMouseMove={spotlight.onMouseMove}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-[2px] z-20"
          style={{ background: `linear-gradient(90deg, transparent, ${project.accent}, transparent)`, opacity: 0.85 }}
        />

        <div className="relative aspect-[16/9] overflow-hidden flex-shrink-0 chromatic-hover">
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
            <WebGLDistortion
              picture={cover}
              alt={`${project.title} — view ${activeImg + 1}`}
              sizes="(max-width: 768px) 84vw, 520px"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center font-display text-2xl"
              style={{ background: `linear-gradient(140deg, var(--surface-2), color-mix(in oklch, ${project.accent} 25%, var(--surface-1)))` }}
            >
              {project.title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)]/60 to-transparent pointer-events-none" />
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${project.accent}40, transparent 60%)` }}
          />

          {project.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {project.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setActiveImg(i); setPaused(true) }}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === activeImg ? 16 : 6,
                    background: i === activeImg ? project.accent : 'rgba(255,255,255,0.35)',
                    boxShadow: i === activeImg ? `0 0 6px ${project.accent}` : 'none',
                  }}
                  aria-label={`View image ${i + 1}`}
                />
              ))}
            </div>
          )}

          <span className="absolute top-3 left-3 font-mono text-[11px] px-2 py-0.5 rounded-full z-10" style={{ background: 'rgba(0,0,0,0.4)', color: project.accent, border: `1px solid ${project.accent}40` }}>
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>

        <div className="relative p-4 md:p-5 flex flex-col flex-1">
          <p className="font-mono text-[11px] tracking-[0.25em] mb-1" style={{ color: project.accent }}>
            {project.tagline.toUpperCase()}
          </p>
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

          <div className="mt-auto flex gap-2">
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

export default function Projects() {
  // Grid is the default. Cinema is scroll-jacking on the section recruiters
  // care most about, which is a real conversion risk — it stays as an opt-in
  // toggle rather than the thing everyone is forced through.
  const [viewMode, setViewMode] = useState('grid')
  const reducedMotion = useReducedMotion()

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

  const goTo = (id) => {
    document.getElementById(`project-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="projects" className="relative section-rhythm container-px mesh-gradient-b overflow-x-clip">
      <span className="ghost-numeral" aria-hidden="true">04</span>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">04 — SELECTED WORK</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-8 max-w-3xl">
            Five projects I built <span className="text-gradient">and deployed to production.</span>
          </h2>
        </Reveal>

        {/* View mode toggle + deck index */}
        <Reveal delay={0.15}>
          <div className="flex flex-wrap items-center gap-3 mb-14">
            <div className="flex items-center gap-1.5 p-1 rounded-full border border-[var(--glass-border)] bg-[var(--surface-1)]">
              <button
                onClick={() => switchView('grid')}
                data-cursor="view"
                aria-pressed={viewMode === 'grid'}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono tracking-[0.15em] transition-all duration-300 ${
                  viewMode === 'grid' ? 'bg-[var(--accent)] text-[var(--surface-0)]' : 'text-[var(--ink-mid)] hover:text-[var(--ink)]'
                }`}
                aria-label="Compact grid view"
              >
                GRID
              </button>
              <button
                onClick={() => switchView('deck')}
                data-cursor="view"
                aria-pressed={viewMode === 'deck'}
                className={`px-3 py-1.5 rounded-full text-[11px] font-mono tracking-[0.15em] transition-all duration-300 ${
                  viewMode === 'deck' ? 'bg-[var(--accent)] text-[var(--surface-0)]' : 'text-[var(--ink-mid)] hover:text-[var(--ink)]'
                }`}
                aria-label="Cinema deck view"
              >
                CINEMA
              </button>
            </div>
            {PROJECTS.map((p, i) => (
              <button
                key={p.id}
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
        </Reveal>

        {/* View mode */}
        {viewMode === 'deck' ? (
          <HorizontalScroll>
            {PROJECTS.map((p, i) => (
              <div key={p.id} className="w-[min(420px,82vw)] md:min-w-[480px] md:max-w-[520px] flex-shrink-0 px-2 h-full">
                <DeckCard project={p} index={i} />
              </div>
            ))}
          </HorizontalScroll>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROJECTS.map((p, i) => (
              <GridCard key={p.id} project={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function GridCard({ project, index }) {
  const cover = project.images[0] ? resolveImage(project.images[0]) : null
  return (
    <a
      href={project.live || project.repo}
      target="_blank"
      rel="noopener noreferrer"
      data-cursor="view"
      className="group relative rounded-2xl glass overflow-hidden satin sheen sheen--auto spotlight transition-all duration-500 hover:-translate-y-1"
      style={{ aspectRatio: '4/3', viewTransitionName: `project-${project.id}` }}
    >
      {cover && (
        <div className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105">
          <WebGLDistortion
            picture={cover}
            alt={project.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-[var(--surface-0)]/40 to-transparent" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${project.accent}25, transparent 60%)` }} />
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
        <p className="font-mono text-[11px] tracking-[0.2em] mb-1" style={{ color: project.accent }}>{project.tagline.toUpperCase()}</p>
        <h3 className="font-display text-lg">{project.title}</h3>
        {project.outcome && (
          <p className="text-[12px] leading-snug mt-1.5 text-[var(--ink-mid)] line-clamp-2">{project.outcome}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {project.tech.slice(0, 3).map((t) => (
            <span key={t} className="text-[11px] font-mono px-1.5 py-0.5 rounded-full border border-[var(--glass-border)] text-[var(--ink-low)]">
              {t}
            </span>
          ))}
          {project.tech.length > 3 && (
            <span className="text-[11px] font-mono px-1.5 py-0.5 text-[var(--ink-low)]">+{project.tech.length - 3}</span>
          )}
        </div>
      </div>
      <span className="absolute top-3 left-3 font-mono text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.4)', color: project.accent, border: `1px solid ${project.accent}40` }}>
        {String(index + 1).padStart(2, '0')}
      </span>
    </a>
  )
}
