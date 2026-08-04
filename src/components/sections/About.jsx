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

// Fixed offsets and staggered starts rather than Math.random(): the arrangement
// has to be identical on the server-rendered markup and the client, and a mote
// that jumps on hydration is worse than one that is predictable.
// The eight planets, in order, with the colours they actually are — Mercury's
// grey basalt, Venus under its sulphuric cloud deck, Earth's ocean, Mars's
// iron oxide, Jupiter's ammonia bands, Saturn's paler gold, and the two ice
// giants' methane blues.
//
// `period` is compressed: Neptune takes 165 years to Mercury's 88 days and no
// honest scaling puts both on one screen. What is preserved is the ordering —
// every planet is slower than the one inside it — and the relative radii,
// which is the part anyone can check by looking.
const PLANETS = [
  { name: 'Mercury', r: 1.7, d: '5px', lit: '#b9b2a8', dark: '#5f584f', period: '5.5s', phase: '20deg' },
  { name: 'Venus', r: 2.35, d: '8px', lit: '#f0d9a8', dark: '#9c7b3f', period: '8.5s', phase: '145deg' },
  { name: 'Earth', r: 3.05, d: '8.5px', lit: '#6aa9e0', dark: '#17365f', period: '12s', phase: '260deg' },
  { name: 'Mars', r: 3.8, d: '6.5px', lit: '#d4693a', dark: '#6d2a0c', period: '16.5s', phase: '55deg' },
  { name: 'Jupiter', r: 5.2, d: '17px', lit: '#e6d3ae', dark: '#a9793f', period: '24s', phase: '200deg' },
  { name: 'Saturn', r: 6.5, d: '14px', lit: '#eadfb4', dark: '#a8894a', period: '32s', phase: '310deg', ringed: true },
  { name: 'Uranus', r: 7.7, d: '10px', lit: '#bfe6f0', dark: '#4f8ea0', period: '42s', phase: '95deg' },
  { name: 'Neptune', r: 8.8, d: '9.5px', lit: '#6d84e8', dark: '#22307e', period: '54s', phase: '235deg' },
]

// Star motes drifting toward the camera behind the system.
const MOTES = [
  { '--mote-x': '-120px', '--mote-y': '-40px', '--mote-delay': '0s' },
  { '--mote-x': '90px', '--mote-y': '-70px', '--mote-delay': '1.15s' },
  { '--mote-x': '-60px', '--mote-y': '80px', '--mote-delay': '2.3s' },
  { '--mote-x': '140px', '--mote-y': '50px', '--mote-delay': '3.5s' },
  { '--mote-x': '-150px', '--mote-y': '20px', '--mote-delay': '4.6s' },
  { '--mote-x': '30px', '--mote-y': '-110px', '--mote-delay': '5.8s' },
]

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
    <section id="about" aria-labelledby="about-heading" className="relative section-rhythm container-px mesh-gradient-a overflow-hidden melt-enter">
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
            <h2 id="about-heading" className="section-h2 font-display mb-6">
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
                  radial-gradient(ellipse 70% 60% at 25% 25%, color-mix(in oklch, var(--accent) 28%, transparent), transparent 62%),
                  radial-gradient(ellipse 60% 70% at 80% 75%, color-mix(in oklch, var(--violet) 26%, transparent), transparent 62%),
                  linear-gradient(140deg, var(--surface-2), var(--surface-0))
                `,
              }}
            />

            {/*
              The lattice chamber. This panel was the largest dead rectangle on
              the page — two static gradients and a fixed grid, sitting next to
              the only card that moved. It is now a 3-D volume: a grid floor and
              ceiling receding into perspective, three wireframe rings turning on
              the Sun and all eight planets in their real colours and real
              order, and star motes travelling toward the camera.

              Deliberately CSS rather than another three.js scene. A canvas here
              would be a fifth WebGL context competing for the same GPU, gated by
              the same tier, droppable by the same frame budget — all the ways
              the other two scenes have already been seen to stop. Compositor
              transforms cannot be tier-gated off, cannot lose a context, and
              cannot be starved. This runs forever.
            */}
            <div className="chamber" aria-hidden="true">
              <span className="chamber__roof" />
              <span className="chamber__floor" />
              <span className="orrery">
                <span className="orrery__sun" />
                {PLANETS.map((p) => (
                  <span
                    key={p.name}
                    className="orrery__orbit"
                    style={{ '--r': p.r, '--period': p.period, '--phase': p.phase }}
                  >
                    <span
                      className="orrery__sat"
                      style={{ '--period': p.period, '--phase': p.phase }}
                    >
                      <span
                        className={'orrery__body' + (p.ringed ? ' orrery__body--ringed' : '')}
                        style={{ '--d': p.d, '--lit': p.lit, '--dark': p.dark }}
                      />
                    </span>
                  </span>
                ))}
              </span>
              {MOTES.map((mote, i) => (
                <span key={i} className="chamber__mote" style={mote} />
              ))}
            </div>

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
          <div className="philosophy-card p-6 md:p-8 flex flex-col justify-center">
            {/*
              A rotating 3-D lattice behind the copy. Three nested rings on one
              shared `transform-style: preserve-3d` stage — compositor-only
              transforms, no canvas, no context, no JS. It costs one paint of a
              few hundred bytes of CSS and it is the only thing in this card
              that moves, so it reads as depth rather than noise.
            */}
            <span className="philosophy-orbit" aria-hidden="true">
              <span className="philosophy-orbit__ring" />
              <span className="philosophy-orbit__ring" />
              <span className="philosophy-orbit__ring" />
              <span className="philosophy-orbit__core" />
            </span>
            <p className="font-mono text-[12px] tracking-[0.2em] text-[var(--ink-low)] mb-2 relative">BUILD PHILOSOPHY</p>
            <p className="text-sm text-[var(--ink-mid)] leading-relaxed relative">
              I treat every project as a system — not a collection of pages. Data flows, state machines, edge cases, and failure modes are designed before the first component is written.
            </p>
            <div className="flex gap-2 mt-4 relative">
              <span className="text-[12px] font-mono px-2 py-1 rounded-full border border-[var(--accent-dim)] text-[var(--accent-bright)]">SYSTEMS</span>
              <span className="text-[12px] font-mono px-2 py-1 rounded-full border border-[var(--violet-dim)] text-[var(--violet)]">REALTIME</span>
            </div>
          </div>
        </div>
      </div>

        {/* The desk scene is the one place three.js is still worth loading in
            this section, so it is a deliberate opt-in: nothing is fetched
            until the chip is pressed. */}
        <div className="about-scene rounded-3xl glass overflow-hidden relative min-h-[340px] flex items-center justify-center p-6">
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
