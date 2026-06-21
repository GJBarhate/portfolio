import { motion } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import { SKILLS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'

export default function Skills() {
  return (
    <section id="skills" className="relative py-32 container-px mesh-gradient-a overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">03</span>

      <div className="relative z-[1]">
        <Reveal>
          <span className="level-badge mb-4">03 — SKILLS</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-16 max-w-3xl">
            Technologies I use <span className="text-gradient">across the stack.</span>
          </h2>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SKILLS.map((group, i) => (
            <Reveal key={group.category} delay={i * 0.06}>
              <SkillCard group={group} index={i} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function SkillCard({ group, index }) {
  const spotlight = useSpotlight()

  return (
    <div
      data-cursor="explore"
      className="relative h-full p-7 rounded-2xl glass glass-glow spotlight sheen overflow-hidden transition-transform duration-500 [transition-timing-function:var(--ease-forge)] hover:-translate-y-2 group"
      {...spotlight}
    >
      <div
        className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-600 blur-2xl"
        style={{ background: group.color === 'plasma' ? 'var(--plasma-dim)' : 'var(--cyan-dim)', opacity: 0 }}
      />
      <div
        className="absolute -inset-1 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500 blur-xl"
        style={{ background: group.color === 'plasma' ? 'var(--plasma)' : 'var(--cyan)' }}
      />

      <div className="relative z-10">
        <div
          className="w-11 h-11 rounded-full mb-5 flex items-center justify-center font-mono text-xs font-bold transition-all duration-500 group-hover:shadow-[0_0_16px]"
          style={{
            border: `1.5px solid ${group.color === 'plasma' ? 'var(--plasma)' : 'var(--cyan)'}`,
            color: group.color === 'plasma' ? 'var(--plasma-bright)' : 'var(--cyan)',
            '--tw-shadow-color': group.color === 'plasma' ? 'var(--plasma-dim)' : 'var(--cyan-dim)',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
        <h3 className="font-display text-xl mb-4">{group.category}</h3>
        <div className="flex flex-wrap gap-2">
          {group.items.map((item, ii) => (
            <motion.span
              key={item}
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: ii * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="text-xs font-mono px-3 py-1.5 rounded-full border border-white/10 text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-[var(--plasma-dim)] hover:shadow-[0_0_10px_color-mix(in_oklch,var(--plasma)_20%,transparent)] transition-all duration-300 cursor-default"
            >
              {item}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  )
}
