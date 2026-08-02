import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Spark } from '../ui/SparkHunt.jsx'

const NAME_LETTERS = [...'GAURAV BARHATE']

function Signature() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 60"
      className="w-40 md:w-52 h-auto mx-auto mb-8 overflow-visible"
      aria-label="Gaurav signature"
    >
      <path
        d="M10 45 C15 10, 30 8, 28 30 C26 45, 15 50, 20 35 M30 25 C35 15, 50 15, 45 30 C42 40, 35 42, 38 30 M50 22 C55 18, 60 20, 55 30 C52 38, 48 40, 50 22 M60 25 C65 15, 75 15, 72 28 C70 35, 62 38, 65 25 L75 25 M80 22 C85 12, 95 15, 90 28 C87 38, 78 40, 82 25 M95 22 C100 15, 110 15, 108 28 C105 40, 95 45, 100 30"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
        strokeDasharray="400"
        strokeDashoffset={inView ? 0 : 400}
        style={{ transition: 'stroke-dashoffset 2.5s var(--ease-forge)' }}
      />
    </svg>
  )
}

export default function Footer() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <footer className="relative border-t border-[var(--glass-border)] py-12 container-px">
      <Signature />

      {/* Outlined wordmark — letters fill with gold on hover, spark #5 hides inside */}
      <div className="relative flex justify-center items-center mb-10">
        <h2 className="font-display text-[clamp(2rem,6vw,5rem)] leading-none tracking-tight flex" aria-label="Gaurav Barhate">
          {NAME_LETTERS.map((char, i) => (
            <span
              key={i}
              className={char === ' ' ? 'inline-block w-[0.3em]' : 'footer-wordmark inline-block'}
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </h2>
        <div className="absolute bottom-0 right-[15%]">
          <Spark id="spark-footer" />
        </div>
      </div>

      <div className="overflow-hidden mb-10 marquee-mask">
        <div className="flex whitespace-nowrap animate-[outroMarquee_20s_linear_infinite] gap-10 font-display text-3xl md:text-5xl text-[var(--ink-low)]">
          {Array(6)
            .fill(null)
            .map((_, i) => (
              <span key={i}>LET&apos;S WORK TOGETHER <span className="text-[var(--accent)]">&#10038;</span></span>
            ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-mono text-xs text-[var(--ink-low)]">
          &copy; {new Date().getFullYear()} Gaurav Barhate. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <span className="font-mono text-[10px] text-[var(--ink-low)]">
            press <kbd className="px-1.5 py-0.5 rounded border border-[var(--glass-border)] text-[var(--ink-mid)]">&#8984;K</kbd> for commands
          </span>
          <motion.button
            onClick={scrollTop}
            data-cursor="view"
            whileHover={{ y: -3 }}
            className="font-mono text-xs tracking-widest text-[var(--ink-mid)] hover:text-[var(--accent-bright)] flex items-center gap-2 transition-colors duration-300"
          >
            BACK TO TOP &#8593;
          </motion.button>
        </div>
      </div>
    </footer>
  )
}
