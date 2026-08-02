import { useMemo, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const WEEKS = 32
const DAYS = 7
const CELL = 11
const GAP = 3
const W = WEEKS * (CELL + GAP)
const H = DAYS * (CELL + GAP)

function seeded(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export default function ContributionHeatmap() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })

  const cells = useMemo(() => {
    const arr = []
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < DAYS; d++) {
        const r = seeded(w * 7 + d + 1)
        const level = r > 0.85 ? 3 : r > 0.7 ? 2 : r > 0.55 ? 1 : 0
        arr.push({ x: w * (CELL + GAP), y: d * (CELL + GAP), level })
      }
    }
    return arr
  }, [])

  const fills = ['var(--surface-3)', 'var(--accent-dim)', 'var(--accent)', 'var(--accent-bright)']

  return (
    <div ref={ref} className="overflow-x-auto no-scrollbar">
      <motion.svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        {cells.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={CELL}
            height={CELL}
            rx={2}
            fill={fills[c.level]}
            style={c.level === 3 ? { filter: 'drop-shadow(0 0 4px var(--accent))' } : undefined}
          />
        ))}
      </motion.svg>
    </div>
  )
}
