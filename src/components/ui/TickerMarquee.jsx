import { useRef } from 'react'
import { useScrollVelocity } from '../../lib/useScrollVelocity.js'

const TICKER = [
  'FULL-STACK DEVELOPER', '·', 'LEETCODE KNIGHT', '·', '1972 MAX RATING',
  '·', '800+ PROBLEMS SOLVED', '·', '5 APPS IN PRODUCTION', '·',
  'REAL-TIME SYSTEMS', '·', 'WEBRTC', '·', 'AI PIPELINES', '·',
  'MERN STACK', '·', 'SYSTEM DESIGN', '·', 'COMPETITIVE PROGRAMMING', '·',
]

export default function TickerMarquee({ className = '' }) {
  const trackRef = useRef(null)

  useScrollVelocity((vel) => {
    const el = trackRef.current
    if (!el) return
    const absVel = Math.min(1, Math.abs(vel * 20))
    el.style.setProperty('--speed', String(1 + absVel * 2))
    el.style.setProperty('--skew', `${absVel * 0.3}deg`)
  }, { throttleMs: 80 })

  return (
    <div className={'relative overflow-hidden py-6 marquee-mask ' + className}>
      <div className="flex whitespace-nowrap gap-8 font-mono text-xs md:text-sm tracking-[0.25em] text-[var(--ink-low)]">
        <div
          ref={trackRef}
          className="flex gap-8 marquee-speed"
          style={{ animation: `marquee 36s linear infinite`, willChange: 'transform' }}
        >
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className={t === '·' ? 'text-[var(--accent)]' : ''}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <style>{`
        .marquee-speed { animation-duration: calc(36s / var(--speed, 1)); transform: skewX(var(--skew, 0deg)); }
      `}</style>
    </div>
  )
}
