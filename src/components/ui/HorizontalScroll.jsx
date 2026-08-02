import { useEffect, useRef, useState, Children } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

// How tall the visible deck is. The STICKY WRAPPER is always a full 100vh —
// that part is not a style choice, it is the arithmetic that removes the gap.
//
// For a `position: sticky; top: T` element of height P inside a container of
// height H, the element stays pinned for `H - P - T` pixels, while
// useScroll(['start start','end end']) reaches progress 1 after `H - 100vh`.
// Those two are only equal when **P + T === 100vh**.
//
// Originally P was 70vh and T was 0, so the deck stayed pinned for an extra
// 30vh after the last card had finished sliding — the "huge empty space".
// Centring a 78vh panel would still leave 11vh. So the wrapper is 100vh with
// top: 0 (P + T = 100vh exactly, zero dead scroll) and the deck is centred
// *inside* it at PANEL_VH.
const PANEL_VH = 78

/** Rough pre-measurement estimate so the first painted height is close to
 *  correct — starting at 0 caused a layout shift and a scroll jump one frame
 *  later when the ResizeObserver corrected it. */
function estimateOvershoot(count) {
  if (typeof window === 'undefined' || count < 1) return 0
  const vw = window.innerWidth
  // Cards are roughly 80vw on phones and 46vw on desktop, matching the deck.
  const cardWidth = vw < 768 ? vw * 0.84 : vw * 0.46
  return Math.max(0, count * cardWidth - vw)
}

export default function HorizontalScroll({ children, className = '' }) {
  const childCount = Children.count(children)
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const [overshoot, setOvershoot] = useState(() => estimateOvershoot(childCount))
  const [inView, setInView] = useState(false)

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

  // `will-change: transform` forces a permanent compositor layer if it is left
  // on, so it is applied only while the deck is actually on screen.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '20% 0px' })
    io.observe(el)
    return () => io.disconnect()
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
      style={{ height: `calc(${overshoot}px + 100vh)` }}
    >
      <div
        className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center"
      >
        <div className="relative w-full flex items-center" style={{ height: `${PANEL_VH}vh` }}>
        {/* Edge fade masks */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
          style={{
            background: 'linear-gradient(to right, var(--surface-0), transparent)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
          style={{
            background: 'linear-gradient(to left, var(--surface-0), transparent)',
          }}
          aria-hidden="true"
        />

        {/* No snap-* classes: the track is moved by transform, not scrolled,
            so scroll snapping had nothing to act on. */}
        <motion.div
          ref={trackRef}
          className="flex h-full"
          style={{ x, willChange: inView ? 'transform' : 'auto' }}
        >
          {children}
        </motion.div>

        {/* Progress rail */}
        {childCount > 1 && (
          <ProgressRail count={childCount} activeIdx={activeIdx} />
        )}
        </div>
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
              background: i === current ? 'var(--accent)' : 'var(--surface-3)',
              boxShadow: i === current ? '0 0 8px var(--accent)' : 'none',
            }}
          />
        </div>
      ))}
      <span className="ml-2 font-mono text-[9px] tracking-wider text-[var(--ink-low)]">
        {String(current + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
      </span>
    </div>
  )
}
