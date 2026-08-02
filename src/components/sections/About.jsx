import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import Reveal from '../ui/Reveal.jsx'
import SplitText from '../ui/SplitText.jsx'
import ScrollInkFill from '../ui/ScrollInkFill.jsx'
import AvatarShowcase from '../ui/AvatarShowcase.jsx'

// A statically-imported three scene here dragged the whole 131 KB `three`
// chunk onto every visit, including phones that never render it. It is now an
// opt-in island: nothing is fetched until someone asks for it.
const ThreeDScene = lazy(() => import('../ui/ThreeDScene.jsx'))

const KEYWORDS = ['REAL-TIME SYSTEMS', '·', 'COMPETITIVE PROGRAMMING', '·', 'AI PIPELINES', '·', 'WEBRTC', '·', 'CRDT', '·', 'MERN STACK', '·', 'SYSTEM DESIGN', '·']

const MANIFESTO_1 =
  'I completed my B.Tech in Computer Science Engineering in 2026. Alongside my degree, I built a strong foundation in data structures and algorithms through consistent competitive programming, and used that problem-solving practice to build full-stack web applications with real-time features like live video, synced editors, and AI integrations.'
const MANIFESTO_2 =
  'I reached a max rating of 1972 on LeetCode (Knight tier) with 800+ problems solved across LeetCode, CodeChef, and GeeksforGeeks, and I\'m a 4-star coder on both CodeChef and GeeksforGeeks. I have built and deployed 5+ full-stack projects — PeerCode, FlowShield, VoiceAns, OneCart, and a learning management system — all live in production.'

export default function About() {
  const marqueeRef = useRef(null)
  const [sceneOn, setSceneOn] = useState(false)

  // Interpolating `animation-duration` is impossible — swapping 24s→60s makes
  // the marquee visibly snap to a new speed. WAAPI's playback rate ramps the
  // same animation instead, which is what "slows down on hover" should mean.
  const setMarqueeRate = useCallback((rate) => {
    const el = marqueeRef.current
    if (!el?.getAnimations) return
    for (const a of el.getAnimations()) a.updatePlaybackRate?.(rate)
  }, [])

  return (
    <section id="about" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
      <span className="ghost-numeral" aria-hidden="true">01</span>

      {/* Side-by-side only from 1024px. Between 768–1024 the avatar column plus
          its orbit ornaments squeezed the manifesto to a ~380px strip, which is
          the "one line beside the photo" collapse. Below lg the avatar stacks
          above the text, centred and capped, and the copy gets the full width. */}
      <div className="relative z-[1] section-shell grid lg:grid-cols-[minmax(260px,0.38fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center">
        <Reveal className="about-avatar-col w-full max-w-[300px] mx-auto lg:max-w-none lg:mx-0">
          <AvatarShowcase sectionId="about" />
        </Reveal>

        <div>
          <Reveal>
            <span className="level-badge mb-4">01 — ABOUT</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="section-h2 font-display mb-6">
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

      {/* Mixed-media moment (4.25): gradient panel + drawn doodle overlay.
          The philosophy card and the interactive scene used to be two stacked
          full-width blocks with a 64px void between them; they are one band
          from 1024px up, which is also what gives the scene chip a home. */}
      <div className="relative z-[1] mt-12 mx-auto max-w-5xl grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)] gap-6 items-stretch">
      <div className="rounded-3xl glass overflow-hidden">
        <div className="grid md:grid-cols-2 h-full">
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

        {/* The desk scene is the one place three.js is still worth loading in
            this section, so it is a deliberate opt-in: nothing is fetched
            until the chip is pressed. */}
        <div className="about-scene rounded-3xl glass overflow-hidden relative min-h-[260px] flex items-center justify-center p-6">
          {sceneOn ? (
            <Suspense fallback={<div className="about-scene__skeleton" aria-hidden="true" />}>
              <ThreeDScene className="absolute inset-0" />
            </Suspense>
          ) : (
            <button
              type="button"
              onClick={() => setSceneOn(true)}
              data-cursor="crosshair"
              className="about-scene__chip"
            >
              <span className="about-scene__chip-icon" aria-hidden="true">✦</span>
              <span>SPIN THE DESK — 3D</span>
              <span className="about-scene__chip-hint">loads on demand</span>
            </button>
          )}
        </div>
      </div>

      {/* Marquee with hover slow-down (4.10) */}
      <div
        className="relative z-[1] mt-12 overflow-hidden border-t border-b border-[var(--glass-border)] py-6 marquee-mask"
        onMouseEnter={() => setMarqueeRate(0.4)}
        onMouseLeave={() => setMarqueeRate(1)}
      >
        <div
          ref={marqueeRef}
          className="marquee-track flex whitespace-nowrap gap-8 font-display text-2xl md:text-4xl text-[var(--ink-low)]"
          data-loop="marquee"
          aria-hidden="true"
        >
          {[...KEYWORDS, ...KEYWORDS].map((k, i) => (
            <span key={i} className={k === '·' ? 'text-[var(--accent)]' : ''}>
              {k}
            </span>
          ))}
        </div>
        {/* The duplicated visual strip is decorative; screen readers get the
            list once, as a list. */}
        <ul className="sr-only">
          {KEYWORDS.filter((k) => k !== '·').map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
