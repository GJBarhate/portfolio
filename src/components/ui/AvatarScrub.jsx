import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

const FRAME_PATHS = Object.entries(
  import.meta.glob('../../assets/avatar/turntable/*.webp', { eager: true, import: 'default' })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, src]) => src)

const N = FRAME_PATHS.length

export default function AvatarScrub({ sectionId = 'about', className = '' }) {
  const reduced = useReducedMotion()
  const sectionRef = useRef(null)
  const scrollYProgress = useScroll({
    target: sectionRef,
    offset: ['start center', 'end center'],
  }).scrollYProgress
  const frameIndex = useTransform(scrollYProgress, [0, 1], [0, N - 1])

  const [current, setCurrent] = useState(0)
  const [loaded, setLoaded] = useState(new Set([0]))

  useEffect(() => {
    if (reduced) return
    const unsub = frameIndex.on('change', (v) => {
      const idx = Math.round(v)
      setCurrent(idx)
      setLoaded((prev) => {
        const next = new Set(prev)
        next.add(idx)
        if (idx > 0) next.add(idx - 1)
        if (idx < N - 1) next.add(idx + 1)
        return next
      })
    })
    return unsub
  }, [reduced, frameIndex])

  return (
    <div ref={sectionRef} className={`relative ${className}`} style={{ aspectRatio: '3/4', overflow: 'hidden', borderRadius: '12px' }}>
      {FRAME_PATHS.map((src, i) => (
        <img
          key={i}
          src={reduced && i !== 0 ? undefined : loaded.has(i) ? src : undefined}
          alt={i === 0 ? 'Avatar' : ''}
          aria-hidden={i !== 0}
          draggable={false}
          decoding="async"
          loading={i === 0 ? 'eager' : 'lazy'}
          className="absolute inset-0 w-full h-full object-cover avatar-stylized"
          style={{
            opacity: i === current ? 1 : 0,
            transition: 'opacity 0.15s linear',
            willChange: 'opacity',
          }}
        />
      ))}
    </div>
  )
}
