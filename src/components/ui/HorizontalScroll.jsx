import { useCallback, useEffect, useRef, useState, Children } from 'react'
import { motion, useMotionValue, useScroll, useTransform } from 'framer-motion'
import { onFrame } from '../../lib/raf.js'

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
  // Cards are roughly 88vw on phones and 46vw on desktop, matching the deck.
  const cardWidth = vw < 768 ? vw * 0.88 : vw * 0.46
  return Math.max(0, count * cardWidth - vw)
}

/**
 * Horizontal deck, dual-mode (§15.3).
 *
 * Desktop `(hover: hover)` keeps the sticky-translate design, because that is
 * where a wheel needs translating into horizontal motion at all. Touch gets
 * native `overflow-x` + scroll-snap instead: browser-composited momentum, zero
 * JS on the scroll path, and — crucially — no second scroll system fighting
 * Lenis on the same axis (Research #20/#21).
 */
export default function HorizontalScroll({ children, className = '' }) {
  const [pinned, setPinned] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onChange = (e) => setPinned(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return pinned
    ? <PinnedDeck className={className}>{children}</PinnedDeck>
    : <SnapDeck className={className}>{children}</SnapDeck>
}

function EdgeFades() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
        style={{ background: 'linear-gradient(to right, var(--surface-0), transparent)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
        style={{ background: 'linear-gradient(to left, var(--surface-0), transparent)' }}
        aria-hidden="true"
      />
    </>
  )
}

function PinnedDeck({ children, className }) {
  const childCount = Children.count(children)
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const [overshoot, setOvershoot] = useState(() => estimateOvershoot(childCount))
  const [inView, setInView] = useState(false)
  const [current, setCurrent] = useState(0)

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
    // T-011 — the track's own width and the root box are the two things this
    // measurement depends on; neither is a `resize` event.
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
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

  const xTarget = useTransform(scrollYProgress, [0, 1], [0, -overshoot])
  const x = useMotionValue(0)

  // Exponential damping (Research #19), k = 9: framerate-independent, so a
  // dropped frame glides instead of stepping. A wheel notch is a discrete jump
  // in scroll position; this is what turns it back into motion.
  useEffect(() => {
    if (!inView) { x.set(xTarget.get()); return }
    return onFrame((_t, dt) => {
      const target = xTarget.get()
      const cur = x.get()
      const next = cur + (target - cur) * (1 - Math.exp(-(dt / 1000) * 9))
      x.set(Math.abs(target - next) < 0.05 ? target : next)
    })
  }, [inView, x, xTarget])

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) =>
      setCurrent(Math.min(childCount - 1, Math.max(0, Math.round(v * (childCount - 1)))))
    )
    return unsub
  }, [scrollYProgress, childCount])

  return (
    <section
      ref={containerRef}
      className={`relative ${className}`}
      style={{ height: `calc(${overshoot}px + 100vh)` }}
    >
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center justify-center">
        <div className="relative w-full flex items-center" style={{ height: `${PANEL_VH}vh` }}>
          <EdgeFades />

          {/* No snap-* classes: the track is moved by transform, not scrolled,
              so scroll snapping had nothing to act on. */}
          <motion.div
            ref={trackRef}
            className="flex h-full"
            style={{ x, willChange: inView ? 'transform' : 'auto' }}
          >
            {children}
          </motion.div>

          {childCount > 1 && <ProgressRail count={childCount} current={current} />}
        </div>
      </div>
    </section>
  )
}

/**
 * Touch mode. Everything here is the browser's own scroller — momentum, snap
 * and rubber-band containment included — so there is literally no JS on the
 * scroll path. `scrollend` (with a debounced `scroll` fallback for Safari)
 * only updates the dot indicator.
 */
function SnapDeck({ children, className }) {
  const childCount = Children.count(children)
  const scrollerRef = useRef(null)
  const [current, setCurrent] = useState(0)

  const sync = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const p = max > 0 ? el.scrollLeft / max : 0
    setCurrent(Math.min(childCount - 1, Math.max(0, Math.round(p * (childCount - 1)))))
  }, [childCount])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const hasScrollEnd = 'onscrollend' in window
    let timer = null
    const onScroll = () => {
      if (hasScrollEnd) return
      clearTimeout(timer)
      timer = setTimeout(sync, 90)
    }
    el.addEventListener('scrollend', sync, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      el.removeEventListener('scrollend', sync)
      el.removeEventListener('scroll', onScroll)
    }
  }, [sync])

  return (
    <section className={`relative ${className}`}>
      <div className="relative" style={{ height: `${PANEL_VH}vh` }}>
        <EdgeFades />
        <div ref={scrollerRef} className="deck-snap-scroller flex h-full">
          {children}
        </div>
        {childCount > 1 && <ProgressRail count={childCount} current={current} />}
      </div>
    </section>
  )
}

function ProgressRail({ count, current }) {
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="deck-rail__dot"
          data-active={i === current ? 'true' : 'false'}
        />
      ))}
      <span className="ml-2 font-mono text-[12px] tracking-wider text-[var(--ink-low)]">
        {String(current + 1).padStart(2, '0')}/{String(count).padStart(2, '0')}
      </span>
    </div>
  )
}
