import Reveal from '../ui/Reveal.jsx'
import Avatar3D from '../ui/Avatar3D.jsx'

const KEYWORDS = ['REAL-TIME SYSTEMS', '·', 'COMPETITIVE PROGRAMMING', '·', 'AI PIPELINES', '·', 'WEBRTC', '·', 'CRDT', '·', 'MERN STACK', '·', 'SYSTEM DESIGN', '·']

export default function About() {
  return (
    <section id="about" className="relative py-32 container-px mesh-gradient-a overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">01</span>

      <div className="relative z-[1] grid md:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
        <Reveal>
          <Avatar3D />
        </Reveal>

        <div>
          <Reveal>
            <span className="level-badge mb-4">01 — ABOUT</span>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-tight mb-6">
              A full-stack developer who builds <span className="text-gradient">real-time, production-ready applications.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-[var(--ink-dim)] text-base md:text-lg leading-relaxed max-w-xl">
              I completed my B.Tech in Computer Science Engineering in 2026. Alongside my
              degree, I built a strong foundation in data structures and algorithms through
              consistent competitive programming, and used that problem-solving practice
              to build full-stack web applications with real-time features like live video,
              synced editors, and AI integrations.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-4 text-[var(--ink-dim)] text-base md:text-lg leading-relaxed max-w-xl">
              I am rated 1909 on LeetCode (Knight tier) with 600+ problems solved across
              LeetCode, CodeChef, and GeeksforGeeks. I have built and deployed two full-stack
              projects, PeerCode and FlowShield, both live in production.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="relative z-[1] mt-24 overflow-hidden border-t border-b border-white/5 py-6 marquee-mask">
        <div className="flex whitespace-nowrap animate-[marquee_24s_linear_infinite] gap-8 font-display text-2xl md:text-4xl text-[var(--ink-faint)]">
          {[...KEYWORDS, ...KEYWORDS].map((k, i) => (
            <span key={i} className={k === '·' ? 'text-[var(--plasma)]' : ''}>
              {k}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
