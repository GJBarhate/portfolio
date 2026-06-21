import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import { PROJECTS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'

const images = import.meta.glob('../../assets/projects/*.webp', { eager: true, import: 'default' })
function resolveImage(name) {
  const entry = Object.entries(images).find(([path]) => path.endsWith(name))
  return entry ? entry[1] : null
}

function ProjectCard({ project, index }) {
  const ref = useRef(null)
  const [activeImg, setActiveImg] = useState(0)
  const spotlight = useSpotlight()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const imgY = useTransform(scrollYProgress, [0, 1], ['-4%', '4%'])

  const cover = project.images[activeImg] ? resolveImage(project.images[activeImg]) : null

  return (
    <Reveal delay={index * 0.1} className="w-full">
      <div
        ref={ref}
        style={{ '--accent': project.accent }}
        className="group relative rounded-3xl glass glass-glow spotlight sheen overflow-hidden"
        {...spotlight}
      >
        {/* Ghost project number */}
        <div className="absolute top-3 right-5 font-display text-[3.5rem] md:text-[4.5rem] font-bold leading-none text-transparent [-webkit-text-stroke:1px_color-mix(in_oklch,var(--ink-faint)_12%,transparent)] pointer-events-none select-none z-0">
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Image area */}
        <div className="relative aspect-[16/10] overflow-hidden">
          {cover ? (
            <motion.img
              key={activeImg}
              src={cover}
              alt={`${project.title} — view ${activeImg + 1}`}
              loading="lazy"
              decoding="async"
              style={{ y: imgY }}
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1.02 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-display text-3xl"
              style={{ background: `linear-gradient(140deg, var(--void-2), color-mix(in oklch, ${project.accent} 25%, var(--void-1)))` }}
            >
              {project.title}
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--void-0)] via-[var(--void-0)]/40 to-transparent opacity-90" />
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay"
            style={{ background: `linear-gradient(135deg, ${project.accent}40, transparent 60%)` }}
          />

          {/* Image gallery dots */}
          {project.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {project.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className="w-2 h-2 rounded-full transition-all duration-300"
                  style={{
                    background: i === activeImg ? project.accent : 'rgba(255,255,255,0.3)',
                    boxShadow: i === activeImg ? `0 0 8px ${project.accent}` : 'none',
                    transform: i === activeImg ? 'scale(1.3)' : 'scale(1)',
                  }}
                  aria-label={`View image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative z-10 p-6 md:p-7">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="font-mono text-[9px] tracking-[0.25em] mb-1.5" style={{ color: project.accent }}>
                {project.tagline.toUpperCase()}
              </p>
              <h3 className="font-display text-2xl md:text-3xl">{project.title}</h3>
            </div>
          </div>

          <div className="flex gap-2.5 mb-4">
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="view"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-mono border transition-all duration-300"
                style={{ borderColor: `${project.accent}60` }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = project.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = `${project.accent}60`)}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" />
                LIVE
              </a>
            )}
            <a
              href={project.repo}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="view"
              className="px-4 py-2 rounded-full text-[11px] font-mono border border-white/15 hover:border-white/40 transition-all duration-300"
            >
              SOURCE ↗
            </a>
          </div>

          <p className="text-[var(--ink-dim)] text-sm leading-relaxed mb-5">
            {project.description}
          </p>

          {/* Tech stack pills — stagger animate */}
          <div className="flex flex-wrap gap-1.5">
            {project.tech.map((t, ti) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: ti * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/10 text-[var(--ink-faint)] hover:text-[var(--ink)] hover:border-[var(--plasma-dim)] transition-all duration-300 cursor-default"
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  )
}

export default function Projects() {
  return (
    <section id="projects" className="relative py-32 container-px mesh-gradient-b overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">04</span>

      <div className="relative z-[1]">
        <Reveal>
          <span className="level-badge mb-4">04 — SELECTED WORK</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-16 max-w-3xl">
            Two projects I built <span className="text-gradient">and deployed to production.</span>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-8">
          {PROJECTS.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
