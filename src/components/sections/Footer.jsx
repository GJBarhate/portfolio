import { motion } from 'framer-motion'

export default function Footer() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <footer className="relative border-t border-white/8 py-12 container-px">
      <div className="overflow-hidden mb-10 marquee-mask">
        <div className="flex whitespace-nowrap animate-[outroMarquee_20s_linear_infinite] gap-10 font-display text-3xl md:text-5xl text-[var(--ink-faint)]">
          {Array(6)
            .fill(null)
            .map((_, i) => (
              <span key={i}>LET&apos;S WORK TOGETHER <span className="text-[var(--plasma)]">&#10038;</span></span>
            ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="font-mono text-xs text-[var(--ink-faint)]">
          &copy; {new Date().getFullYear()} Gaurav Barhate. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <span className="font-mono text-[10px] text-[var(--ink-faint)]">
            press <kbd className="px-1.5 py-0.5 rounded border border-white/15 text-[var(--ink-dim)]">&#8984;K</kbd> for commands
          </span>
          <motion.button
            onClick={scrollTop}
            data-cursor="view"
            whileHover={{ y: -3 }}
            className="font-mono text-xs tracking-widest text-[var(--ink-dim)] hover:text-[var(--plasma-bright)] flex items-center gap-2 transition-colors duration-300"
          >
            BACK TO TOP &#8593;
          </motion.button>
        </div>
      </div>
    </footer>
  )
}
