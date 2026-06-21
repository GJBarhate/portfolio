import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { useSmoothScroll } from '../../contexts/SmoothScrollContext.jsx'

// 5 real, crisp angle photos — no pixel-blended in-betweens. Blending two
// flat illustrations smears detail into a ghosted blur, which is worse than
// just cutting cleanly between sharp frames. The "smooth 3D" feel instead
// comes from a quick rotateY flip-pulse on every frame change (see below).
const frameModules = import.meta.glob('../../assets/avatar/turntable/*.webp', {
  eager: true,
  import: 'default',
})
const FRAMES = Object.entries(frameModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, src]) => src)

const N = FRAMES.length
const LABELS = ['FRONT', 'RIGHT', 'BACK', 'BACK-L', 'LEFT']
const DRAG_STEP = 60 // px of drag per frame step
const SCROLL_STEP = 130 // px scrolled per frame step
const FLIP_DEG = 14 // how far the card flicks on a frame change

export default function Avatar3D() {
  const reduced = useReducedMotion()
  const scrollCtx = useSmoothScroll()

  const [frame, setFrame] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [flip, setFlip] = useState(0) // transient rotateY kick, direction-signed

  const dragRef = useRef({ active: false, startX: 0, startFrame: 0 })
  const scrollRef = useRef({ last: null, accum: 0 })
  const flipTimeout = useRef(null)

  const mod = (n) => ((n % N) + N) % N

  const step = useCallback((dir) => {
    setFrame((f) => mod(f + dir))
    setFlip(dir * FLIP_DEG)
    clearTimeout(flipTimeout.current)
    flipTimeout.current = setTimeout(() => setFlip(0), 90)
  }, [])

  // Scroll-direction-driven rotation: scrolling down spins forward, scrolling
  // up un-spins it back — it never rotates on its own while the page is still.
  useEffect(() => {
    const lenis = scrollCtx?.lenis?.current
    if (reduced || !lenis) return

    const onScroll = ({ scroll }) => {
      if (dragRef.current.active) return
      if (scrollRef.current.last === null) {
        scrollRef.current.last = scroll
        return
      }
      const delta = scroll - scrollRef.current.last
      scrollRef.current.last = scroll
      scrollRef.current.accum += delta
      while (Math.abs(scrollRef.current.accum) >= SCROLL_STEP) {
        const dir = scrollRef.current.accum > 0 ? 1 : -1
        step(dir)
        scrollRef.current.accum -= dir * SCROLL_STEP
      }
    }

    lenis.on('scroll', onScroll)
    return () => lenis.off?.('scroll', onScroll)
  }, [reduced, scrollCtx, step])

  const onPointerDown = useCallback((e) => {
    dragRef.current = { active: true, startX: e.clientX, startFrame: frame, lastSteps: 0 }
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [frame])

  const onPointerMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -8, y: px * 10 })

    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const steps = Math.round(dx / DRAG_STEP)
    if (steps !== d.lastSteps) {
      const dir = steps > d.lastSteps ? 1 : -1
      d.lastSteps = steps
      setFrame(mod(d.startFrame + steps))
      setFlip(dir * FLIP_DEG)
      clearTimeout(flipTimeout.current)
      flipTimeout.current = setTimeout(() => setFlip(0), 90)
    }
  }, [])

  const endDrag = useCallback(() => {
    dragRef.current.active = false
    setDragging(false)
  }, [])

  const onLeave = useCallback(() => {
    setHovering(false)
    setTilt({ x: 0, y: 0 })
    endDrag()
  }, [endDrag])

  const jumpTo = (target) => {
    const diff = mod(target - frame)
    const dir = diff <= N / 2 ? 1 : -1
    setFrame(target)
    setFlip(dir * FLIP_DEG)
    clearTimeout(flipTimeout.current)
    flipTimeout.current = setTimeout(() => setFlip(0), 90)
  }

  return (
    <div
      className="relative mx-auto md:mx-0 w-[clamp(230px,80vw,310px)] select-none"
      style={{ perspective: '1100px' }}
    >
      {/* Orbiting tick rings behind the model */}
      <div
        className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[135%] aspect-square rounded-full pointer-events-none"
        style={{ animation: reduced ? 'none' : 'dataRingReverse 34s linear infinite' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * 96} y1={100 + Math.sin(a) * 96}
                x2={100 + Math.cos(a) * 99} y2={100 + Math.sin(a) * 99}
                stroke="var(--cyan)" strokeWidth="1.5" opacity="0.35"
              />
            )
          })}
        </svg>
      </div>
      <div
        className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[112%] aspect-square rounded-full pointer-events-none"
        style={{ animation: reduced ? 'none' : 'dataRing 18s linear infinite' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i / 36) * Math.PI * 2
            const len = i % 3 === 0 ? 7 : 3.5
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * 90} y1={100 + Math.sin(a) * 90}
                x2={100 + Math.cos(a) * (90 + len)} y2={100 + Math.sin(a) * (90 + len)}
                stroke="var(--plasma)" strokeWidth={i % 3 === 0 ? 2 : 1}
                opacity={i % 3 === 0 ? 0.7 : 0.28}
              />
            )
          })}
          <circle cx="100" cy="100" r="93" fill="none" stroke="var(--plasma-dim)" strokeWidth="0.5" strokeDasharray="3 7" />
        </svg>
      </div>

      {/* Conic glow halo */}
      <div
        className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[88%] aspect-square rounded-full opacity-50 blur-2xl pointer-events-none bg-[conic-gradient(from_0deg,var(--plasma),var(--cyan),var(--ember),var(--plasma))]"
        style={{ animation: reduced ? 'none' : 'spin 9s linear infinite' }}
        aria-hidden="true"
      />

      {/* The turntable card */}
      <motion.div
        className="relative z-[2] rounded-[26px] overflow-hidden border border-white/12 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        style={{ aspectRatio: '4 / 5', transformStyle: 'preserve-3d', cursor: dragging ? 'grabbing' : 'grab' }}
        animate={{ rotateX: tilt.x, rotateY: tilt.y + flip }}
        transition={
          flip !== 0
            ? { type: 'tween', duration: 0.09, ease: 'easeOut' }
            : { type: 'spring', stiffness: 150, damping: 15, mass: 0.5 }
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={onLeave}
        onPointerEnter={() => setHovering(true)}
        data-cursor="explore"
      >
        {/* Studio backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#efe9df] to-[#d8d0c2]" aria-hidden="true" />

        {/* Stacked angle frames — crisp hard-cut crossfade, no pixel blending */}
        {FRAMES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={i === 0 ? 'Gaurav Barhate — rotatable avatar' : ''}
            aria-hidden={i !== 0}
            draggable={false}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover object-top"
            style={{
              opacity: i === frame ? 1 : 0,
              transition: 'opacity 0.12s linear',
              willChange: 'opacity',
            }}
          />
        ))}

        {/* Theme tint over the cream backdrop so it harmonizes with the palette */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-soft-light opacity-60"
          style={{ background: 'linear-gradient(150deg, var(--plasma) 0%, transparent 45%, var(--cyan) 100%)' }}
          aria-hidden="true"
        />
        {/* Bottom vignette to ground the figure */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--void-0)]/70 to-transparent pointer-events-none" aria-hidden="true" />
        {/* Specular sweep */}
        <div
          className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-500"
          style={{ opacity: hovering ? 0.5 : 0, background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)' }}
          aria-hidden="true"
        />

        {/* Angle label HUD */}
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/15">
          <span className="font-mono text-[9px] tracking-[0.25em] text-[var(--plasma-bright)]">{LABELS[frame]}</span>
        </div>
      </motion.div>

      {/* Mirror reflection */}
      <div className="relative z-[1] mt-1 h-16 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="relative w-full h-full rounded-[26px] overflow-hidden opacity-25" style={{ transform: 'scaleY(-1)', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
          {FRAMES.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="absolute inset-x-0 top-[-330%] w-full object-cover object-top blur-[1px]"
              style={{ opacity: i === frame ? 1 : 0, transition: 'opacity 0.12s linear' }}
            />
          ))}
        </div>
      </div>

      {/* Monogram badge */}
      <div className="avatar-monogram z-[3]" style={{ bottom: '70px' }}>GB</div>

      {/* Cardinal ticks + hint */}
      <div className="relative z-[3] mt-3 flex flex-col items-center gap-2">
        <div className="relative flex items-center gap-3 w-full max-w-[200px]">
          {LABELS.map((l, i) => (
            <button
              key={l}
              onClick={() => jumpTo(i)}
              aria-label={`Show ${l}`}
              className="relative flex-1 h-1.5 rounded-full overflow-hidden transition-colors duration-300"
              style={{ background: 'var(--void-3)' }}
            >
              <span
                className="absolute inset-0 rounded-full origin-left transition-transform duration-200"
                style={{
                  background: 'var(--plasma)',
                  boxShadow: '0 0 8px var(--plasma)',
                  transform: `scaleX(${frame === i ? 1 : 0})`,
                }}
              />
            </button>
          ))}
        </div>
        <p className="font-mono text-[9px] tracking-[0.25em] text-[var(--ink-faint)]">
          {reduced ? 'TAP A MARK TO ROTATE' : 'SCROLL OR DRAG TO ROTATE · 360°'}
        </p>
      </div>
    </div>
  )
}
