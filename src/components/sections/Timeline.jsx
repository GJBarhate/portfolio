import Reveal from '../ui/Reveal.jsx'
import { TIMELINE } from '../../lib/content.js'
import { Spark } from '../ui/SparkHunt.jsx'
import SplitText from '../ui/SplitText.jsx'

/**
 * §4 — the timeline line draws itself via `stroke-dashoffset` on in-view, and
 * the nodes light up on a `view()` scroll timeline where the browser supports
 * one. Both used to be framer-motion `useScroll`/`useTransform` chains, i.e.
 * scroll-linked React work for an effect the compositor can own outright.
 */
export default function Timeline() {
  return (
    <section id="timeline" aria-labelledby="timeline-heading" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
      <span className="ghost-numeral" aria-hidden="true">05</span>
      <div className="absolute top-[30%] right-[6%]"><Spark id="spark-timeline" /></div>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">05 — EXPERIENCE</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 id="timeline-heading" className="section-h2 font-display mb-20 max-w-3xl">
            <SplitText>My path from </SplitText>
            <SplitText className="text-gradient" delay={0.12}>learning to code to shipping software.</SplitText>
          </h2>
        </Reveal>

        <div className="timeline-track relative max-w-3xl ml-4 md:ml-10">
          {/* Track background */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--surface-3)]" />
          {/* Gradient fill line — scrubbed by a scroll timeline where one
              exists, and drawn once on entry where one does not. */}
          <div className="timeline-track__fill" aria-hidden="true" />
          {/* Self-drawing SVG stroke */}
          <svg className="timeline-track__svg absolute left-0 top-0 w-full h-full pointer-events-none" aria-hidden="true">
            <line
              className="timeline-track__line"
              x1="0" y1="0" x2="0" y2="100%"
              stroke="var(--accent-bright)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="800 20"
              opacity="0.3"
            />
          </svg>

          <div className="flex flex-col gap-16">
            {TIMELINE.map((item, i) => (
              <Reveal key={item.year} delay={i * 0.05} className="relative pl-10">
                <span
                  className="timeline-node"
                  style={{ '--node-accent': i % 2 === 0 ? 'var(--accent)' : 'var(--violet)' }}
                  aria-hidden="true"
                >
                  <span className="timeline-node__ping" data-loop="timeline-node" />
                </span>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[12px] tracking-[0.25em] px-2.5 py-1 rounded-full border border-[var(--accent-dim)] text-[var(--accent-bright)] bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]">
                    {item.year}
                  </span>
                </div>
                <h3 className="font-display text-xl md:text-2xl mb-2">{item.title}</h3>
                <p className="text-[var(--ink-mid)] text-sm md:text-base max-w-lg">{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
