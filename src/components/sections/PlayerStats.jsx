import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import CountUp from '../ui/CountUp.jsx'
import RatingGraph from '../ui/RatingGraph.jsx'
import ContributionHeatmap from '../ui/ContributionHeatmap.jsx'
import { STATS, SOCIALS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'
import { Spark } from '../ui/SparkHunt.jsx'
import SplitText from '../ui/SplitText.jsx'

export default function PlayerStats() {
  const achievementRef = useRef(null)
  const achievementInView = useInView(achievementRef, { once: true, margin: '-20%' })
  const spotlight = useSpotlight()

  return (
    <section id="stats" aria-labelledby="stats-heading" data-field="2" data-loop className="relative section-rhythm container-px overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">02</span>
      <div className="absolute top-[20%] right-[8%]"><Spark id="spark-stats" /></div>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">02 — TRACK RECORD</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 id="stats-heading" className="section-h2 font-display mb-16 max-w-3xl">
            <SplitText>My coding activity, </SplitText>
            <SplitText className="text-gradient" delay={0.12}>summarized.</SplitText>
          </h2>
        </Reveal>

        {/* Headline stat */}
        <div
          ref={achievementRef}
          className="relative mb-16 overflow-hidden rounded-2xl glass glass-glow p-8 md:p-10 border-[var(--accent-dim)] spotlight sheen sheen--auto"
          {...spotlight}
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--accent)_0%,transparent_60%)] opacity-30"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={achievementInView ? { opacity: 0.3, scale: 1 } : {}}
            transition={{ duration: 1.2 }}
          />
          <motion.div
            className="absolute -inset-px rounded-2xl"
            initial={{ opacity: 0 }}
            animate={achievementInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.8 }}
            style={{ background: 'linear-gradient(135deg, var(--accent-dim), transparent, var(--violet-dim))', opacity: 0.4 }}
          />
          <motion.p
            className="font-mono text-xs tracking-[0.3em] text-[var(--warm)] relative z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={achievementInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            COMPETITIVE PROGRAMMING
          </motion.p>
          <motion.h3
            className="font-display text-[clamp(1.8rem,4vw,3rem)] mt-3 relative z-10"
            initial={{ opacity: 0, y: 16 }}
            animate={achievementInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            LeetCode Knight — Max Rating <CountUp value={1972} />
          </motion.h3>
          <motion.p
            className="text-[var(--ink-mid)] mt-2 relative z-10 max-w-lg"
            initial={{ opacity: 0 }}
            animate={achievementInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Earned over dozens of rated contests — best global ranks include 659 and 883 in
            LeetCode Biweekly Contests, and 132 in CodeChef Starters (Div 2).
          </motion.p>
        </div>

        {/*
          Stat cards. `lg:grid-cols-5` with a leading spacer cell, not
          `grid-cols-4` — the fixed clock (`.forge-clock`) sits in the
          viewport's bottom-left corner, up to 260px square, and on arrival
          at this section the first 4-column card used to land exactly
          there, its number and tag cut by the clock's disc. The spacer is
          `hidden` below `lg` so the 2-column mobile/tablet layout, where
          this collision doesn't happen, is untouched.
        */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
          <div className="hidden lg:block" aria-hidden="true" />
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <StatCard stat={s} />
            </Reveal>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Reveal className="p-6 md:p-8 rounded-2xl glass glass-glow sheen">
            <p className="font-mono text-xs tracking-widest text-[var(--ink-low)] mb-4">RATING TRAJECTORY</p>
            <RatingGraph />
          </Reveal>
          <Reveal delay={0.1} className="p-6 md:p-8 rounded-2xl glass glass-glow sheen">
            <p className="font-mono text-xs tracking-widest text-[var(--ink-low)] mb-4">CONTRIBUTION HEATMAP</p>
            <ContributionHeatmap />
            <div className="flex gap-6 mt-6 font-mono text-xs">
              <a href={SOCIALS.leetcode} target="_blank" rel="noopener noreferrer" data-cursor="view" className="text-[var(--accent-bright)] hover:underline">
                LeetCode ↗
              </a>
              <a href={SOCIALS.codechef} target="_blank" rel="noopener noreferrer" data-cursor="view" className="text-[var(--violet)] hover:underline">
                CodeChef ↗
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function StatCard({ stat }) {
  const spotlight = useSpotlight()
  return (
    <div
      className="relative group h-full p-6 rounded-2xl glass glass-glow spotlight sheen sheen--auto overflow-hidden transition-transform duration-base [transition-timing-function:var(--ease-forge)] hover:-translate-y-1.5"
      {...spotlight}
    >
      <div
        className="absolute -inset-1 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-base blur-xl"
        style={{ background: stat.accent === 'plasma' ? 'var(--accent)' : 'var(--violet)' }}
      />
      <p className="relative z-10 font-mono text-[12px] tracking-widest text-[var(--ink-low)] mb-3">{stat.tag}</p>
      <p className="relative z-10 font-display text-4xl md:text-5xl tabular" style={{ color: stat.accent === 'plasma' ? 'var(--accent-bright)' : 'var(--violet)' }}>
        <CountUp value={stat.value} suffix={stat.suffix} />
      </p>
      <p className="relative z-10 text-sm text-[var(--ink-mid)] mt-2">{stat.label}</p>
      <div className="relative z-10 mt-4 h-1 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: stat.accent === 'plasma'
              ? 'linear-gradient(90deg, var(--accent-dim), var(--accent))'
              : 'linear-gradient(90deg, var(--violet-dim), var(--violet))',
            boxShadow: `0 0 8px ${stat.accent === 'plasma' ? 'var(--accent-dim)' : 'var(--violet-dim)'}`,
          }}
          initial={{ width: 0 }}
          whileInView={{ width: '100%' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}
