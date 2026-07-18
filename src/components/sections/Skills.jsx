import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Reveal from '../ui/Reveal.jsx'
import { SKILLS } from '../../lib/content.js'
import { useSpotlight } from '../../hooks/useSpotlight.js'
import { Spark } from '../ui/SparkHunt.jsx'

const ISO_OFFSETS = [
  { tx: -8, ty: -4, rz: -2 }, { tx: 0, ty: -6, rz: 0 }, { tx: 8, ty: -4, rz: 2 },
  { tx: -6, ty: 0, rz: -1 }, { tx: 0, ty: 0, rz: 0 }, { tx: 6, ty: 0, rz: 1 },
]

export default function Skills() {
  return (
    <section id="skills" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
      <span className="ghost-numeral" aria-hidden="true">03</span>
      <div className="absolute bottom-[15%] left-[5%]"><Spark id="spark-skills" /></div>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">03 — SKILLS</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-12 max-w-3xl">
            Technologies I use <span className="text-gradient">across the stack.</span>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Faux-3D isometric illustration (4.23) */}
          <Reveal className="hidden md:block">
            <div className="relative w-full max-w-[400px] mx-auto" style={{ perspective: '1000px' }}>
              <div className="relative w-full aspect-square" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(20deg) rotateZ(20deg)' }}>
                {SKILLS.slice(0, 6).map((group, i) => {
                  const o = ISO_OFFSETS[i % ISO_OFFSETS.length]
                  return (
                    <motion.div
                      key={group.category}
                      className="absolute inset-0 rounded-2xl glass flex items-center justify-center transition-all duration-500"
                      style={{
                        transform: `translate3d(${o.tx * 8}px, ${o.ty * 8}px, ${i * -20}px) rotateZ(${o.rz}deg)`,
                        background: group.color === 'plasma'
                          ? 'color-mix(in oklch, var(--plasma-dim) 12%, var(--void-1))'
                          : 'color-mix(in oklch, var(--cyan-dim) 10%, var(--void-1))',
                        borderColor: group.color === 'plasma' ? 'var(--plasma-dim)' : 'var(--cyan-dim)',
                      }}
                      whileHover={{ translateZ: 40, scale: 1.03 }}
                    >
                      <span className="font-mono text-xs tracking-wider" style={{ color: group.color === 'plasma' ? 'var(--plasma-bright)' : 'var(--cyan)' }}>
                        {group.category}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
              <p className="text-center font-mono text-[9px] tracking-wider text-[var(--ink-faint)] mt-6">HOVER TO EXPLORE DEPTH</p>
            </div>
          </Reveal>

          {/* Skill cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {SKILLS.map((group, i) => (
              <Reveal key={group.category} delay={i * 0.04}>
                <SkillCard group={group} index={i} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function SkillCard({ group, index }) {
  const spotlight = useSpotlight()
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const ref = useRef(null)

  const onMove = (e) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -6, y: px * 8 })
    spotlight.onMouseMove(e)
  }

  return (
    <motion.div
      ref={ref}
      data-cursor="explore"
      className="relative h-full p-5 rounded-2xl glass glass-glow spotlight sheen sheen--auto overflow-hidden group"
      style={{ transformStyle: 'preserve-3d' }}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: 'spring', stiffness: 120, damping: 14, mass: 0.4 }}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div
        className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: group.color === 'plasma' ? 'var(--plasma-dim)' : 'var(--cyan-dim)' }}
      />
      <div className="relative z-10">
        <div
          className="w-9 h-9 rounded-full mb-3 flex items-center justify-center font-mono text-[10px] font-bold"
          style={{
            border: `1.5px solid ${group.color === 'plasma' ? 'var(--plasma)' : 'var(--cyan)'}`,
            color: group.color === 'plasma' ? 'var(--plasma-bright)' : 'var(--cyan)',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
        <h3 className="font-display text-lg mb-3">{group.category}</h3>
        <div className="flex flex-wrap gap-1.5">
          {group.items.map((item, ii) => (
            <motion.span
              key={item}
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: ii * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-[var(--glass-border)] text-[var(--ink-dim)] hover:text-[var(--ink)] hover:border-[var(--plasma-dim)] transition-all duration-300 cursor-default"
            >
              {item}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
