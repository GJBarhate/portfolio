import { useEffect, useRef, useState } from 'react'
import { useScroll, useTransform } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'
import sprite from '../../assets/avatar/turntable-sprite.webp'

// The five turntable frames are baked into one vertical sprite sheet. Five
// stacked <img> elements meant five decodes, five composited layers and a
// cross-fade every frame change; this is one decode, one layer, and the scrub
// is a single background-position change that never touches layout.
const N = 5

export default function AvatarScrub({ sectionId = 'about', className = '' }) {
  const reduced = useReducedMotion()
  const sectionRef = useRef(null)
  const frameRef = useRef(null)
  const scrollYProgress = useScroll({
    target: sectionRef,
    offset: ['start center', 'end center'],
  }).scrollYProgress
  const frameIndex = useTransform(scrollYProgress, [0, 1], [0, N - 1])

  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (reduced) return
    const unsub = frameIndex.on('change', (v) => {
      const idx = Math.max(0, Math.min(N - 1, Math.round(v)))
      setCurrent((prev) => (prev === idx ? prev : idx))
    })
    return unsub
  }, [reduced, frameIndex])

  const shown = reduced ? 0 : current

  return (
    <div
      ref={sectionRef}
      className={`relative ${className}`}
      style={{ aspectRatio: '3/4', overflow: 'hidden', borderRadius: '12px' }}
    >
      <div
        ref={frameRef}
        className="absolute inset-0 w-full h-full avatar-stylized"
        role="img"
        aria-label="Gaurav Barhate"
        style={{
          backgroundImage: `url(${sprite})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `100% ${N * 100}%`,
          backgroundPosition: `0% ${(shown / (N - 1)) * 100}%`,
        }}
      />
    </div>
  )
}
