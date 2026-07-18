import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import { TIMELINE } from '../../lib/content.js'
import { Spark } from '../ui/SparkHunt.jsx'

export default function Timeline() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 60%'] })
  const lineHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  const dashOffset = useTransform(scrollYProgress, [0, 1], [800, 0])

  return (
    <section id="timeline" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
      <span className="ghost-numeral" aria-hidden="true">05</span>
      <div className="absolute top-[30%] right-[6%]"><Spark id="spark-timeline" /></div>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">05 — EXPERIENCE</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-20 max-w-3xl">
            My path from <span className="text-gradient">learning to code to shipping software.</span>
          </h2>
        </Reveal>

        <div ref={ref} className="relative max-w-3xl ml-4 md:ml-10">
          {/* Track background */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--void-3)]" />
          {/* Gradient fill line */}
          <motion.div
            className="absolute left-0 top-0 w-px bg-gradient-to-b from-[var(--plasma)] via-[var(--cyan)] to-[var(--plasma)]"
            style={{ height: lineHeight, boxShadow: '0 0 12px var(--plasma), 0 0 4px var(--cyan)' }}
          />
          {/* Self-drawing SVG path — scroll-scrubbed stroke dash offset */}
          <svg className="absolute left-0 top-0 w-full h-full pointer-events-none" aria-hidden="true">
            <motion.line
              x1="0" y1="0" x2="0"
              y2="100%"
              stroke="var(--plasma-bright)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="800 20"
              opacity="0.3"
              style={{ strokeDashoffset: dashOffset }}
            />
          </svg>

          <div className="flex flex-col gap-16">
            {TIMELINE.map((item, i) => (
              <Reveal key={item.year} delay={i * 0.05} className="relative pl-10">
                <NodeDot index={i} />
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[10px] tracking-[0.25em] px-2.5 py-1 rounded-full border border-[var(--plasma-dim)] text-[var(--plasma-bright)] bg-[color-mix(in_oklch,var(--plasma)_6%,transparent)]">
                    {item.year}
                  </span>
                </div>
                <h3 className="font-display text-xl md:text-2xl mb-2">{item.title}</h3>
                <p className="text-[var(--ink-dim)] text-sm md:text-base max-w-lg">{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function NodeDot({ index }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: '-20%' }}
      transition={{ duration: 0.5, delay: 0.1, ease: 'backOut' }}
      className="absolute -left-[6px] top-1.5 w-3 h-3 rounded-full"
      style={{
        background: index % 2 === 0 ? 'var(--plasma)' : 'var(--cyan)',
        boxShadow: `0 0 12px ${index % 2 === 0 ? 'var(--plasma)' : 'var(--cyan)'}, 0 0 4px ${index % 2 === 0 ? 'var(--plasma)' : 'var(--cyan)'}`,
      }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: index % 2 === 0 ? 'var(--plasma)' : 'var(--cyan)' }}
        animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />
    </motion.div>
  )
}
