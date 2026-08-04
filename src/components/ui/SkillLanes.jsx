import { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { SKILLS } from '../../lib/content.js'
import { useBelow } from '../../lib/useMedia.js'

const LANE_CONFIG = [
  { label: 'FRONTEND', categories: ['Frontend', 'Realtime'], color: 'var(--accent)' },
  { label: 'BACKEND', categories: ['Backend', 'Data'], color: 'var(--violet)' },
  { label: 'TOOLS', categories: ['AI', 'Competitive Programming'], color: 'var(--accent-reward)' },
]

function getSkillsForLane(categories) {
  return SKILLS.filter(s => categories.includes(s.category)).flatMap(s => s.items)
}

function SkillPill({ skill, delay, color }) {
  return (
    <motion.span
      initial={{ opacity: 0, z: -60, scale: 0.8 }}
      whileInView={{ opacity: 1, z: 0, scale: 1 }}
      viewport={{ once: true, margin: '-5%' }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ z: 30, scale: 1.1, transition: { duration: 0.2 } }}
      className="skill-lane-pill"
      style={{ '--lane-color': color }}
    >
      {skill}
    </motion.span>
  )
}

function Lane({ config, index }) {
  const skills = getSkillsForLane(config.categories)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      className="skill-lane"
      style={{
        '--lane-color': config.color,
        perspective: '600px',
      }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.6 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="skill-lane__header">
        <span
          className="font-mono text-[12px] tracking-[0.3em] px-3 py-1.5 rounded-full"
          style={{
            border: `1px solid ${config.color}`,
            color: config.color,
          }}
        >
          {config.label}
        </span>
        <span className="font-mono text-[12px] text-[var(--ink-low)] ml-2">
          {skills.length} skills
        </span>
      </div>

      <div
        className="skill-lane__track"
        style={{
          transformStyle: 'preserve-3d',
          transform: isHovered ? 'rotateX(2deg) translateZ(10px)' : 'rotateX(8deg)',
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex flex-wrap gap-2 p-4">
          {skills.map((skill, i) => (
            <SkillPill key={skill} skill={skill} delay={i * 0.03} color={config.color} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function MobileLanes() {
  const [activeLane, setActiveLane] = useState(0)

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {LANE_CONFIG.map((lane, i) => (
          <button
            key={lane.label}
            onClick={() => setActiveLane(i)}
            className="flex-1 py-2 rounded-full font-mono text-[12px] tracking-[0.2em] transition-all duration-fast"
            style={{
              border: `1px solid ${i === activeLane ? lane.color : 'var(--glass-border)'}`,
              color: i === activeLane ? lane.color : 'var(--ink-low)',
              background: i === activeLane ? `color-mix(in oklch, ${lane.color} 10%, transparent)` : 'transparent',
            }}
          >
            {lane.label}
          </button>
        ))}
      </div>
      <motion.div
        key={activeLane}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap gap-2"
      >
        {getSkillsForLane(LANE_CONFIG[activeLane].categories).map((skill, i) => (
          <motion.span
            key={skill}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="skill-lane-pill"
            style={{ '--lane-color': LANE_CONFIG[activeLane].color }}
          >
            {skill}
          </motion.span>
        ))}
      </motion.div>
    </div>
  )
}

export default function SkillLanes() {
  // Three 3-D lanes side by side is a width decision (T-011).
  const isNarrow = useBelow('md')
  const ref = useRef(null)
  const _inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <div ref={ref} className="skill-lanes-container">
      {isNarrow ? (
        <MobileLanes />
      ) : (
        <div className="grid grid-cols-3 gap-6" style={{ perspective: '1200px' }}>
          {LANE_CONFIG.map((lane, i) => (
            <Lane key={lane.label} config={lane} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
