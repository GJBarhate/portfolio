import { useState } from 'react'
import Reveal from '../ui/Reveal.jsx'
import SplitText from '../ui/SplitText.jsx'
import ScrollInkFill from '../ui/ScrollInkFill.jsx'
import AvatarShowcase from '../ui/AvatarShowcase.jsx'
import ThreeDScene from '../ui/ThreeDScene.jsx'

const KEYWORDS = ['REAL-TIME SYSTEMS', '·', 'COMPETITIVE PROGRAMMING', '·', 'AI PIPELINES', '·', 'WEBRTC', '·', 'CRDT', '·', 'MERN STACK', '·', 'SYSTEM DESIGN', '·']

const MANIFESTO_1 =
  'I completed my B.Tech in Computer Science Engineering in 2026. Alongside my degree, I built a strong foundation in data structures and algorithms through consistent competitive programming, and used that problem-solving practice to build full-stack web applications with real-time features like live video, synced editors, and AI integrations.'
const MANIFESTO_2 =
  'I reached a max rating of 1972 on LeetCode (Knight tier) with 800+ problems solved across LeetCode, CodeChef, and GeeksforGeeks, and I\'m a 4-star coder on both CodeChef and GeeksforGeeks. I have built and deployed 5+ full-stack projects — PeerCode, FlowShield, VoiceAns, OneCart, and a learning management system — all live in production.'

export default function About() {
  const [marqueePaused, setMarqueePaused] = useState(false)

  return (
    <section id="about" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
      <span className="ghost-numeral" aria-hidden="true">01</span>

      {/* The avatar column had a full 35% of the row (0.7fr of 2fr); with the
          ornament rings extending its visual footprint to ~360px it dominated
          the section. minmax(0, …) also stops the column from being forced
          wider by its own content. */}
      <div className="relative z-[1] section-shell grid md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center">
        <Reveal>
          <AvatarShowcase sectionId="about" />
        </Reveal>

        <div>
          <Reveal>
            <span className="level-badge mb-4">01 — ABOUT</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-6">
              <SplitText>A full-stack developer who builds </SplitText>
              <SplitText className="text-gradient--sweep" delay={0.3}>real-time, production-ready applications.</SplitText>
            </h2>
          </Reveal>
          <ScrollInkFill className="text-[var(--ink)] text-base md:text-lg leading-relaxed max-w-xl">
            {MANIFESTO_1}
          </ScrollInkFill>
          <ScrollInkFill className="mt-4 text-[var(--ink)] text-base md:text-lg leading-relaxed max-w-xl">
            {MANIFESTO_2}
          </ScrollInkFill>
        </div>
      </div>

      {/* Mixed-media moment (4.25): photo + drawn doodle overlay */}
      <div className="relative z-[1] mt-16 mx-auto max-w-4xl rounded-3xl glass overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-[4/3] md:aspect-auto overflow-hidden">
            {/* This used to load /og-image.png — a 78 KB social-card PNG — as a
                purely decorative panel. The same look costs nothing as
                gradients, and the PNG stays reserved for social scrapers. */}
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                background: `
                  radial-gradient(ellipse 70% 60% at 25% 25%, color-mix(in oklch, var(--accent) 40%, transparent), transparent 60%),
                  radial-gradient(ellipse 60% 70% at 80% 75%, color-mix(in oklch, var(--violet) 34%, transparent), transparent 60%),
                  linear-gradient(140deg, var(--surface-2), var(--surface-0))
                `,
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.14]"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'linear-gradient(var(--glass-border) 1px, transparent 1px), linear-gradient(90deg, var(--glass-border) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />
            {/* Doodle accent — hand-drawn style SVG */}
            <svg className="absolute top-3 right-3 w-16 h-16 opacity-40" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M20 50 Q40 20 60 50 T90 50" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4">
                <animate attributeName="stroke-dashoffset" from="0" to="100" dur="3s" repeatCount="indefinite" />
              </path>
              <circle cx="30" cy="70" r="8" fill="none" stroke="var(--violet)" strokeWidth="1.5" strokeDasharray="3 3">
                <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <div className="p-6 md:p-8 flex flex-col justify-center">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-low)] mb-2">BUILD PHILOSOPHY</p>
            <p className="text-sm text-[var(--ink-mid)] leading-relaxed">
              I treat every project as a system — not a collection of pages. Data flows, state machines, edge cases, and failure modes are designed before the first component is written.
            </p>
            <div className="flex gap-2 mt-4">
              <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-[var(--accent-dim)] text-[var(--accent-bright)]">SYSTEMS</span>
              <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-[var(--violet-dim)] text-[var(--violet)]">REALTIME</span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-[1] mt-16 max-w-4xl mx-auto">
        <ThreeDScene />
      </div>

      {/* Marquee with hover slow-down (4.10) */}
      <div
        className="relative z-[1] mt-16 overflow-hidden border-t border-b border-[var(--glass-border)] py-6 marquee-mask"
        onMouseEnter={() => setMarqueePaused(true)}
        onMouseLeave={() => setMarqueePaused(false)}
      >
        <div
          className="flex whitespace-nowrap gap-8 font-display text-2xl md:text-4xl text-[var(--ink-low)]"
          style={{
            animation: `marquee ${marqueePaused ? '60s' : '24s'} linear infinite`,
            animationPlayState: marqueePaused ? 'paused' : 'running',
          }}
        >
          {[...KEYWORDS, ...KEYWORDS].map((k, i) => (
            <span key={i} className={k === '·' ? 'text-[var(--accent)]' : ''}>
              {k}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
