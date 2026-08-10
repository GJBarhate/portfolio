import { useEffect, useRef, useState } from 'react'
import { Spark } from '../ui/SparkHunt.jsx'
import { SOCIALS } from '../../lib/content.js'
import { PALETTE_HINT } from '../../lib/platform.js'

const NAME_LETTERS = [...'GAURAV BARHATE']

function Signature() {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect() }
    }, { rootMargin: '-10%' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

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

  // The id is what the background engine observes to know it has reached the
  // end of the page and can switch to the rings motif.
  return (
    <footer id="footer" data-field="8" data-loop className="relative border-t border-[var(--glass-border)] py-12 container-px">
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

      {/* W6 — an easter egg nobody finds is effort spent on nothing. One mono
          line turns hidden work into visible playfulness. */}
      <div className="flex justify-center mb-8">
        <button
          type="button"
          className="secret-hint"
          data-cursor="crosshair"
          onClick={() => window.dispatchEvent(new CustomEvent('forge:open-arcade'))}
          title="Open the arcade"
        >
          <span aria-hidden="true">🎮</span>
          {/* D-34 — the hint has to name the key this visitor actually has.
              `⌘K` on Windows reads as Win+K, which is an OS shortcut the page
              never receives. */}
          PRESS {PALETTE_HINT} &middot; ↑↑↓↓ FOR SECRETS
        </button>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col items-center md:items-start gap-1">
          <p className="font-mono text-xs text-[var(--ink-low)]">
            &copy; {new Date().getFullYear()} Gaurav Barhate. All rights reserved.
          </p>
          {/* §10 trust signals — "built from scratch" and a freshness date are
              both explicit recruiter screening heuristics. */}
          <p className="font-mono text-[12px] text-[var(--ink-low)]">
            Built from scratch — React 18, no template ·{' '}
            <a
              href={SOCIALS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--accent-bright)]"
            >
              view source
            </a>
            {typeof __BUILD_DATE__ !== 'undefined' && <> · deployed {__BUILD_DATE__}</>}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-mono text-[12px] text-[var(--ink-low)]">
            {/* D-34.2 — this one was a missed migration: the file imports
                PALETTE_HINT and uses it correctly 26 lines above, while this
                span kept a hardcoded `&#8984;K`. It therefore printed the Mac
                command glyph on Windows and on every phone. */}
            press <kbd className="px-1.5 py-0.5 rounded border border-[var(--glass-border)] text-[var(--ink-mid)]">{PALETTE_HINT}</kbd> for commands
          </span>
          <button
            onClick={scrollTop}
            data-cursor="view"
            className="footer-top font-mono text-xs tracking-widest text-[var(--ink-mid)] hover:text-[var(--accent-bright)] flex items-center gap-2 transition-colors duration-fast"
          >
            BACK TO TOP &#8593;
          </button>
        </div>
      </div>
    </footer>
  )
}
