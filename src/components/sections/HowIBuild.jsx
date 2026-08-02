import Reveal from '../ui/Reveal.jsx'
import SplitText from '../ui/SplitText.jsx'

const CHAPTERS = [
  {
    num: '01',
    title: 'Design & Plan',
    subtitle: 'Architecture first, code second',
    body: 'Every project starts with a system diagram — data flow, component tree, API contracts. I map the full state lifecycle before writing a single line of implementation code, which catches edge cases before they become bugs.',
    accent: 'var(--accent)',
    stat: '5+ production systems shipped',
    icon: '✧',
  },
  {
    num: '02',
    title: 'Build & Integrate',
    subtitle: 'Real-time, real-world',
    body: 'I layer in real-time features using WebSockets, WebRTC, and CRDTs for live collaboration. Each integration is tested end-to-end: auth flows, payment rails, AI pipelines, and database operations.',
    accent: 'var(--violet)',
    stat: 'MERN + Socket.IO + Redis stack',
    icon: '⚡',
  },
  {
    num: '03',
    title: 'Ship & Iterate',
    subtitle: 'Production is the laboratory',
    body: 'Deployed apps gather real usage data. I monitor performance, collect feedback, and ship iterative improvements. The cycle is tight: measure, adjust, deploy — repeat.',
    accent: 'var(--warm)',
    stat: 'Continuous deployment pipeline',
    icon: '🚀',
  },
]

export default function HowIBuild() {
  return (
    <section id="how-i-build" className="relative section-rhythm container-px overflow-hidden">
      <span className="ghost-numeral" aria-hidden="true">06</span>

      <div className="relative z-[1] section-shell">
        <Reveal>
          <span className="level-badge mb-4">06 — HOW I BUILD</span>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="section-h2 font-display mb-12 max-w-3xl">
            <SplitText>Three beats that define </SplitText>
            <SplitText className="text-gradient" delay={0.16}>my build process.</SplitText>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {CHAPTERS.map((ch, i) => (
            <Reveal key={ch.num} delay={i * 0.1}>
              <div
                className="group relative rounded-2xl glass spotlight sheen sheen--auto overflow-hidden p-6 h-full flex flex-col transition-transform duration-base [transition-timing-function:var(--ease-forge)] hover:-translate-y-1.5"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${ch.accent.replace('var(', '').replace(')', '')}, transparent)`.replace(/--[\w-]+/g, (m) => `var(${m})`) }}
                />
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, transparent, ${ch.accent}, transparent)`, opacity: 0.85 }}
                />

                <span className="text-3xl mb-4">{ch.icon}</span>

                <p className="font-mono text-[11px] tracking-[0.25em] mb-2" style={{ color: ch.accent }}>
                  {ch.num} · {ch.title.toUpperCase()}
                </p>
                <p className="font-display text-xl mb-3">{ch.subtitle}</p>
                <p className="text-sm text-[var(--ink-mid)] leading-relaxed flex-1">
                  {ch.body}
                </p>
                <p className="font-mono text-[10px] mt-4 pt-4 border-t border-[var(--glass-border)]" style={{ color: ch.accent }}>
                  {ch.stat}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
