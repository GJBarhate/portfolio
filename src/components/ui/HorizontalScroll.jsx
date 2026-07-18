import { useEffect, useRef, useState, Children } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

export default function HorizontalScroll({ children, className = '' }) {
  const childCount = Children.count(children)
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const [overshoot, setOvershoot] = useState(0)

  // Measure real track width so the translate distance matches exactly what's
  // scrollable — no fixed -100% guess that overshoots or leaves dead runway.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const trackWidth = track.scrollWidth
      const viewportWidth = window.innerWidth
      setOvershoot(Math.max(0, trackWidth - viewportWidth))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  const x = useTransform(scrollYProgress, [0, 1], [0, -overshoot])
  const activeIdx = useTransform(scrollYProgress, (v) => Math.min(childCount - 1, Math.floor(v * childCount)))

  return (
    <section
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        height: `calc(${overshoot}px + 100vh)`,
        willChange: 'transform',
      }}
    >
      <div className="sticky top-0 left-0 w-full h-[70vh] overflow-hidden flex items-center">
        {/* Edge fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
          style={{
            background: 'linear-gradient(to right, var(--void-0), transparent)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
          style={{
            background: 'linear-gradient(to left, var(--void-0), transparent)',
          }}
          aria-hidden="true"
        />

        <motion.div
          ref={trackRef}
          className="flex h-full snap-x snap-mandatory"
          style={{ x }}
        >
          {children}
        </motion.div>

        {/* Progress rail */}
        {childCount > 1 && (
          <ProgressRail count={childCount} activeIdx={activeIdx} />
        )}
      </div>
    </section>
  )
}

function ProgressRail({ count, activeIdx }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const unsub = activeIdx.on('change', (v) => setCurrent(Math.round(v)))
    return unsub
  }, [activeIdx])

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
        >
          <div
            className="transition-all duration-300"
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i === current ? 'var(--plasma)' : 'var(--void-3)',
              boxShadow: i === current ? '0 0 8px var(--plasma)' : 'none',
            }}
          />
        </div>
      ))}
      <span className="ml-2 font-mono text-[9px] tracking-wider text-[var(--ink-faint)]">
        {String(current + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
      </span>
    </div>
  )
}
