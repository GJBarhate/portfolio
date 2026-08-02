import { useMemo, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { RATING_HISTORY } from '../../lib/content.js'

export default function RatingGraph() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-15%' })

  const { points, path, max, min } = useMemo(() => {
    const w = 600
    const h = 200
    const max = Math.max(...RATING_HISTORY)
    const min = Math.min(...RATING_HISTORY)
    const pts = RATING_HISTORY.map((v, i) => {
      const x = (i / (RATING_HISTORY.length - 1)) * w
      const y = h - ((v - min) / (max - min)) * h
      return [x, y]
    })
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    return { points: pts, path: d, max, min }
  }, [])

  return (
    <div ref={ref} className="w-full">
      <svg viewBox="0 0 600 220" className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="0" x2="600" y1={i * 60} y2={i * 60} stroke="var(--surface-3)" strokeWidth="1" />
        ))}

        <motion.path
          d={`${path} L600,220 L0,220 Z`}
          fill="url(#ratingFill)"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 1, duration: 0.6 }}
        />

        <motion.path
          d={path}
          fill="none"
          stroke="var(--accent-bright)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        />

        {points.map(([x, y], i) =>
          i === points.length - 1 ? (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r="6"
              fill="var(--violet)"
              initial={{ scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : {}}
              transition={{ delay: 1.9, duration: 0.5, ease: 'backOut' }}
              style={{ filter: 'drop-shadow(0 0 10px var(--violet))' }}
            />
          ) : null
        )}
      </svg>
      <div className="flex justify-between font-mono text-xs text-[var(--ink-low)] mt-2">
        <span>{min}</span>
        <span>peak {max}</span>
      </div>
    </div>
  )
}
