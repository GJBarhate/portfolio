import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import SplitType from 'split-type'
import MagneticButton from '../ui/MagneticButton.jsx'
import AmbientField from '../ui/AmbientField.jsx'
import HeroAurora from '../ui/HeroAurora.jsx'
import { SOCIALS } from '../../lib/content.js'
import { EASE_FORGE } from '../../lib/motion.js'

export default function Hero() {
  const nameRef = useRef(null)
  const roleRef = useRef(null)

  useEffect(() => {
    const split = new SplitType(nameRef.current, { types: 'chars' })
    gsap.fromTo(
      split.chars,
      { yPercent: 120, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 1.1,
        delay: 0.2,
        ease: 'expo.out',
        stagger: 0.035,
      }
    )

    const roles = ['Full-Stack Developer', 'Competitive Programmer', 'MERN Stack Developer', 'B.Tech CSE Graduate']
    let i = 0
    const el = roleRef.current
    const cycle = () => {
      i = (i + 1) % roles.length
      gsap.to(el, {
        yPercent: -110,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.in',
        onComplete: () => {
          el.textContent = roles[i]
          gsap.fromTo(el, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' })
        },
      })
    }
    el.textContent = roles[0]
    const interval = setInterval(cycle, 2600)
    return () => {
      clearInterval(interval)
      split.revert()
    }
  }, [])

  return (
    <section id="hero" className="relative h-screen w-full overflow-hidden flex items-center">
      <div className="absolute inset-0">
        <AmbientField />
        <HeroAurora />
      </div>

      <div className="relative z-10 container-px w-full">
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
          <h1
            aria-hidden="true"
            className="font-display text-[clamp(3rem,12vw,10rem)] leading-[0.92] hero-name-ghost"
          >
            Gaurav Barhate
          </h1>
          <h1
            ref={nameRef}
            className="font-display text-[clamp(3rem,12vw,10rem)] leading-[0.92] hero-name-iridescent overflow-hidden"
          >
            Gaurav Barhate
          </h1>
        </div>

        <div className="overflow-hidden mt-3 h-[1.4em]">
          <p
            ref={roleRef}
            className="font-mono text-sm md:text-lg tracking-wide text-[var(--ink-dim)]"
          />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_FORGE, delay: 0.5 }}
          className="mt-6 max-w-md text-[var(--ink-dim)] text-sm md:text-base"
        >
          <span className="hero-stat-strong">LeetCode Knight</span>, rated{' '}
          <span className="hero-stat-strong">1909</span>
          <span className="hero-stat-sep" />
          <span className="hero-stat-strong">600+</span> problems solved
          <span className="hero-stat-sep" />
          I build full-stack web applications with real-time features and AI
          integrations.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_FORGE, delay: 0.7 }}
          className="mt-10 flex flex-wrap items-center gap-5"
        >
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
          <MagneticButton
            as="a"
            href={SOCIALS.github}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="view"
            className="hero-cta hero-cta--ghost px-7 py-3.5 rounded-full text-sm font-mono text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors duration-300"
          >
            GitHub ↗
          </MagneticButton>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-mono text-[10px] tracking-widest text-[var(--ink-faint)]">SCROLL</span>
        <div className="w-px h-10 bg-gradient-to-b from-[var(--plasma)] to-transparent" />
      </motion.div>
    </section>
  )
}
