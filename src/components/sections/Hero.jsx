import { useRef, useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import MagneticButton from '../ui/MagneticButton.jsx'
import MagneticTilt from '../ui/MagneticTilt.jsx'
import AmbientField from '../ui/AmbientField.jsx'
import { Spark } from '../ui/SparkHunt.jsx'
import HeroAurora from '../ui/HeroAurora.jsx'
import WordRotator from '../ui/WordRotator.jsx'
import { SOCIALS } from '../../lib/content.js'
import { EASE_FORGE } from '../../lib/motion.js'
import { useScrollVelocity } from '../../lib/useScrollVelocity.js'
import { useIsMobile } from '../../lib/useIsMobile.js'

const HeroForgeObject = lazy(() => import('../ui/HeroForgeObject.jsx'))
const TextParticleExplosion = lazy(() => import('../ui/TextParticleExplosion.jsx'))

const NAME_CHARS = [...'Gaurav Barhate'].map(c => c === ' ' ? '\u00A0' : c)
const charVariants = {
  hidden: { scaleX: 0, x: -6, opacity: 0 },
  visible: { scaleX: 1, x: 0, opacity: 1 },
}

export default function Hero({ introDone = true }) {
  const [hoveredChar, setHoveredChar] = useState(-1)
  const [charOffsets, setCharOffsets] = useState({})
  const nameRef = useRef(null)
  const clearTimer = useRef(null)
  const onCharEnter = useCallback((i) => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setHoveredChar(i)
  }, [])
  const onCharLeave = useCallback(() => {
    clearTimer.current = setTimeout(() => setHoveredChar(-1), 80)
  }, [])

  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    const handler = (e) => {
      const chars = el.querySelectorAll('.kinetic-char')
      const offsets = {}
      chars.forEach((ch, i) => {
        const rect = ch.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          const force = Math.max(0, (120 - dist) / 120) * 6
          const angle = Math.atan2(dy, dx)
          offsets[i] = { x: Math.cos(angle) * force, y: Math.sin(angle) * force }
        }
      })
      setCharOffsets(offsets)
    }
    const reset = () => setCharOffsets({})
    el.addEventListener('mousemove', handler)
    el.addEventListener('mouseleave', reset)
    return () => {
      el.removeEventListener('mousemove', handler)
      el.removeEventListener('mouseleave', reset)
    }
  }, [])

  useScrollVelocity((vel) => {
    const absVel = Math.min(1, Math.abs(vel * 30))
    const grain = document.querySelector('.film-grain')
    if (grain) grain.style.opacity = String(0.02 + absVel * 0.06)
    const heroName = document.querySelector('.hero-name-iridescent')
    if (heroName) heroName.style.transform = `skewX(${Math.min(1, absVel * 2) * 0.2}deg)`
    // E19: Scroll-linked hue drift — page hue shifts 8° across the run
    const scrollPct = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    document.documentElement.style.setProperty('--grade-hue', `${scrollPct * 8}deg`)
  }, { throttleMs: 80 })
  const sectionRef = useRef(null)
  const isMobile = useIsMobile()

  // Cinematic exit â€” as the visitor scrolls, the hero recedes into depth:
  // copy drifts up and fades, backdrop parallaxes slower, everything eases
  // on GPU-composited motion values (no re-renders).
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const copyScale = useTransform(scrollYProgress, [0, 1], [1, 0.94])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])
  const backY = useTransform(scrollYProgress, [0, 1], [0, 90])
  const backOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.25])
  const scrollHintOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])
  const [scrollPct, setScrollPct] = useState(0)
  useEffect(() => {
    const unsub = scrollYProgress.on('change', setScrollPct)
    return () => unsub()
  }, [scrollYProgress])

  return (
    <section ref={sectionRef} id="hero" className="relative h-screen w-full overflow-hidden flex items-center">
      <motion.div className="absolute inset-0" style={{ y: backY, opacity: backOpacity }}>
        <AmbientField />
        <HeroAurora />
      </motion.div>

      {!isMobile && (
        <motion.div
          className="absolute right-[4%] top-1/2 -translate-y-1/2 z-[5] w-[340px] h-[340px] lg:w-[420px] lg:h-[420px] pointer-events-auto hidden md:block"
          style={{ opacity: backOpacity }}
        >
          <Suspense fallback={null}>
            <HeroForgeObject />
          </Suspense>
        </motion.div>
      )}

      <motion.div
        className="relative z-10 container-px w-full"
        style={{ y: copyY, scale: copyScale, opacity: copyOpacity }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_FORGE, delay: 0.1 }}
          className="hero-badge mb-6"
        >
          <span className="hero-badge__dot" />
          <span className="font-mono text-[11px] tracking-wide text-[var(--ink-dim)]">
            Open to opportunities
          </span>
        </motion.div>

        <div className="relative">
          <Suspense fallback={null}>
            <TextParticleExplosion scrollProgress={scrollPct} className="z-[15]" />
          </Suspense>
          <h1
            aria-hidden="true"
            className="font-display text-[clamp(3rem,12vw,10rem)] leading-[0.92] hero-name-ghost"
          >
            Gaurav Barhate
          </h1>
          <motion.h1
            ref={nameRef}
            className="font-display text-[clamp(3rem,12vw,10rem)] leading-[0.92] hero-name-iridescent hero-name-spark overflow-hidden"
            initial={introDone ? false : 'hidden'}
            animate={introDone ? 'visible' : 'hidden'}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04, delayChildren: 0.2 } },
            }}
          >
            {NAME_CHARS.map((char, i) => {
              const dist = hoveredChar === -1 ? undefined : Math.abs(i - hoveredChar)
              const proximity = dist === undefined ? undefined : dist <= 2 ? String(dist) : undefined
              const offset = charOffsets[i]
              return (
                <motion.span
                  key={i}
                  variants={charVariants}
                  transition={{ duration: 0.6, ease: EASE_FORGE }}
                  className="kinetic-char"
                  data-proximity={proximity}
                  onMouseEnter={() => onCharEnter(i)}
                  onMouseLeave={onCharLeave}
                  style={offset ? {
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  } : {
                    transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {char}
                </motion.span>
              )
            })}
          </motion.h1>
        </div>

        <div className="overflow-hidden mt-3 h-[1.4em]">
          <p className="font-mono text-sm md:text-lg tracking-wide text-[var(--ink-dim)]">
            <WordRotator words={['Full-Stack Developer', 'Competitive Programmer', 'MERN Stack Developer', 'B.Tech CSE Graduate']} />
          </p>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_FORGE, delay: 0.5 }}
          className="mt-6 max-w-md text-[var(--ink-dim)] text-sm md:text-base"
        >
          <span className="hero-stat-strong">LeetCode Knight</span>, max rating{' '}
          <span className="hero-stat-strong">1972</span>
          <span className="hero-stat-sep" />
          <span className="hero-stat-strong">800+</span> problems solved
          <span className="hero-stat-sep" />
          <span className="hero-stat-strong">5+</span> apps in production
          <span className="hero-stat-sep" />
          I build full-stack web applications with real-time features and AI
          integrations.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_FORGE, delay: 0.7 }}
          className="mt-10 flex flex-wrap items-center gap-3 md:gap-5"
        >
          <MagneticTilt>
            <MagneticButton
              as="a"
              href="#projects"
              data-cursor="view"
              className="hero-cta hero-cta--primary px-7 py-3.5 rounded-full font-medium text-sm shadow-[0_0_40px_var(--plasma-dim)] hover:shadow-[0_0_60px_var(--plasma)] transition-shadow duration-500"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              View the Work
            </MagneticButton>
          </MagneticTilt>
          <MagneticTilt>
            <MagneticButton
              as="button"
              onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
              data-cursor="crosshair"
              className="hero-cta hero-cta--arcade px-5 md:px-7 py-3.5 rounded-full text-sm font-mono tracking-wider flex items-center gap-2 transition-all duration-300"
            >
              <span className="text-[15px] md:text-[17px]">🎮</span>
              <span>Play 5 Games</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153)] animate-pulse" />
            </MagneticButton>
          </MagneticTilt>
          <MagneticTilt>
            <MagneticButton
              as="a"
              href={SOCIALS.github}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="view"
              className="hero-cta hero-cta--ghost px-5 md:px-7 py-3.5 rounded-full text-sm font-mono text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors duration-300"
            >
              GitHub ↗
            </MagneticButton>
          </MagneticTilt>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-32 right-[12%] hidden md:flex flex-col items-center gap-3">
        <Spark id="spark-hero" />
        <div
          className="arcade-hero-hint group cursor-pointer"
          onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
        >
          <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--plasma-dim)]/20 hover:border-[var(--plasma-dim)]/60 transition-all duration-300"
            style={{ background: 'color-mix(in oklch, var(--plasma) 4%, var(--void-1))' }}
          >
            <div className="flex gap-1">
              <span className="text-[9px]">🏃</span>
              <span className="text-[9px]">🎲</span>
              <span className="text-[9px]">🪜</span>
              <span className="text-[9px]">🧠</span>
              <span className="text-[9px]">🐍</span>
            </div>
            <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--ink-faint)]">ARCADE · 5 GAMES</span>
          </div>
        </div>
      </div>

      <motion.div
        style={{ opacity: scrollHintOpacity }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] tracking-widest text-[var(--ink-faint)]">SCROLL</span>
        <div className="w-px h-10 overflow-hidden">
          <div className="w-px h-10 bg-gradient-to-b from-[var(--plasma)] to-transparent animate-[scrollHint_1.8s_ease-in-out_infinite]" />
        </div>
      </motion.div>
    </section>
  )
}
