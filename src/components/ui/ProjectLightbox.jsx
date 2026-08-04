import { useCallback, useEffect, useRef, useState } from 'react'
import Picture from './Picture.jsx'

/**
 * Case-study lightbox (W3).
 *
 * Recruiters probe "how is it built" in interviews; this is the answer, on the
 * page. Screenshot carousel + an SVG architecture line-diagram + three metric
 * chips. Lazy, focus-trapped, `aria-modal`, restores focus on close (§10).
 */
export default function ProjectLightbox({ project, resolveImage, onClose }) {
  const [shot, setShot] = useState(0)
  const dialogRef = useRef(null)
  const returnFocusRef = useRef(null)

  const next = useCallback(
    () => setShot((v) => (v + 1) % project.images.length),
    [project.images.length]
  )
  const prev = useCallback(
    () => setShot((v) => (v - 1 + project.images.length) % project.images.length),
    [project.images.length]
  )

  useEffect(() => {
    returnFocusRef.current = document.activeElement
    const el = dialogRef.current
    el?.focus()

    // Modals that let Tab escape into the page behind them are the single most
    // common a11y regression in a lightbox.
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key === 'ArrowRight') { next(); return }
      if (e.key === 'ArrowLeft') { prev(); return }
      if (e.key !== 'Tab' || !el) return
      const focusable = el.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      returnFocusRef.current?.focus?.()
    }
  }, [onClose, next, prev])

  const picture = project.images[shot] ? resolveImage(project.images[shot]) : null
  const nodes = project.architecture || []
  const metrics = project.metrics || []

  return (
    <div
      className="lightbox"
      style={{ '--card-accent': project.accent }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="lightbox__panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${project.title} case study`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lightbox__head">
          <div>
            <p className="lightbox__tagline font-mono">{project.tagline.toUpperCase()}</p>
            <h3 className="lightbox__title font-display">{project.title}</h3>
          </div>
          <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close case study">
            ESC ✕
          </button>
        </header>

        <div className="lightbox__stage">
          {picture ? (
            <Picture
              picture={picture}
              alt={
                project.imageAlts?.[project.images[shot]] ||
                `${project.title} — screenshot ${shot + 1} of ${project.images.length}`
              }
              sizes="(max-width: 900px) 92vw, 820px"
              className="lightbox__img"
            />
          ) : (
            <div className="lightbox__fallback">{project.title}</div>
          )}
          {project.images.length > 1 && (
            <>
              <button type="button" className="lightbox__nav lightbox__nav--prev" onClick={prev} aria-label="Previous screenshot">‹</button>
              <button type="button" className="lightbox__nav lightbox__nav--next" onClick={next} aria-label="Next screenshot">›</button>
            </>
          )}
        </div>

        <div className="lightbox__dots" role="tablist" aria-label="Screenshots">
          {project.images.map((img, i) => (
            <button
              key={img}
              role="tab"
              aria-selected={i === shot}
              className="lightbox__dot"
              data-active={i === shot ? 'true' : 'false'}
              onClick={() => setShot(i)}
              aria-label={`Screenshot ${i + 1}`}
            />
          ))}
        </div>

        {metrics.length > 0 && (
          <ul className="lightbox__metrics">
            {metrics.map((m) => (
              <li key={m.label} className="lightbox__metric">
                <span className="lightbox__metric-value font-display">{m.value}</span>
                <span className="lightbox__metric-label font-mono">{m.label}</span>
              </li>
            ))}
          </ul>
        )}

        {nodes.length > 0 && (
          <figure className="lightbox__arch">
            <figcaption className="lightbox__arch-cap font-mono">ARCHITECTURE</figcaption>
            {/* A line diagram, not a picture of one — scales, themes, and adds
                no bytes beyond this component's own chunk. */}
            <svg viewBox={`0 0 ${nodes.length * 150} 92`} className="lightbox__arch-svg" role="img"
                 aria-label={`Data flow: ${nodes.join(' to ')}`}>
              {nodes.map((n, i) => {
                const x = i * 150 + 12
                return (
                  <g key={n}>
                    {i < nodes.length - 1 && (
                      <line
                        x1={x + 118} y1="46" x2={x + 150} y2="46"
                        stroke="var(--card-accent)" strokeWidth="1.5"
                        strokeDasharray="4 4" opacity="0.7"
                      />
                    )}
                    <rect
                      x={x} y="20" width="118" height="52" rx="10"
                      fill="color-mix(in oklch, var(--card-accent) 10%, transparent)"
                      stroke="color-mix(in oklch, var(--card-accent) 45%, transparent)"
                    />
                    <text x={x + 59} y="50" textAnchor="middle" className="lightbox__arch-text">{n}</text>
                  </g>
                )
              })}
            </svg>
          </figure>
        )}

        <p className="lightbox__desc">{project.description}</p>

        <div className="lightbox__actions">
          {project.live && (
            <a href={project.live} target="_blank" rel="noopener noreferrer" className="project-btn project-btn--live px-4 py-2 rounded-full text-[12px] font-mono">
              OPEN LIVE APP ↗
            </a>
          )}
          <a href={project.repo} target="_blank" rel="noopener noreferrer" className="project-btn project-btn--ghost px-4 py-2 rounded-full text-[12px] font-mono">
            SOURCE ↗
          </a>
        </div>
      </div>
    </div>
  )
}
