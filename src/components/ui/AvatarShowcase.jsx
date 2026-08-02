import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import AvatarScrub from './AvatarScrub.jsx'

// Three tags and six particles, down from five and twelve: the ornament has
// to scale with the smaller frame or it reads as clutter around it.
const ORBIT_TAGS = ['REACT', 'NODE', 'WEBRTC']
const PARTICLE_COUNT = 6

export default function AvatarShowcase({ sectionId = 'about' }) {
  const containerRef = useRef(null)
  const [hovering, setHovering] = useState(false)

  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [12, -12]), { stiffness: 150, damping: 20 })
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-12, 12]), { stiffness: 150, damping: 20 })

  const glowX = useTransform(mouseX, [0, 1], ['-20%', '120%'])
  const glowY = useTransform(mouseY, [0, 1], ['-20%', '120%'])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      mouseX.set((e.clientX - rect.left) / rect.width)
      mouseY.set((e.clientY - rect.top) / rect.height)
    }
    el.addEventListener('mousemove', onMove)
    return () => el.removeEventListener('mousemove', onMove)
  }, [mouseX, mouseY])

  return (
    <div
      ref={containerRef}
      className="avatar-showcase"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Outer glow pulse */}
      <div className="avatar-showcase__glow" />

      {/* Orbital rings */}
      <div className="avatar-showcase__orbit avatar-showcase__orbit--1" />
      <div className="avatar-showcase__orbit avatar-showcase__orbit--2" />
      <div className="avatar-showcase__orbit avatar-showcase__orbit--3" />

      {/* Floating orbit tags */}
      {ORBIT_TAGS.map((tag, i) => (
        <span
          key={tag}
          className="avatar-showcase__tag"
          style={{
            '--tag-i': i,
            '--tag-total': ORBIT_TAGS.length,
          }}
        >
          {tag}
        </span>
      ))}

      {/* 3D tilting card */}
      <motion.div
        className="avatar-showcase__card"
        style={{
          rotateX,
          rotateY,
          transformPerspective: 800,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Holographic scan line */}
        <div className="avatar-showcase__scan" />

        {/* Specular highlight following mouse */}
        <motion.div
          className="avatar-showcase__specular"
          style={{ left: glowX, top: glowY }}
        />

        {/* Corner accents */}
        <span className="avatar-showcase__corner avatar-showcase__corner--tl" />
        <span className="avatar-showcase__corner avatar-showcase__corner--tr" />
        <span className="avatar-showcase__corner avatar-showcase__corner--bl" />
        <span className="avatar-showcase__corner avatar-showcase__corner--br" />

        {/* The actual avatar */}
        <AvatarScrub sectionId={sectionId} />

        {/* Status indicator */}
        <div className="avatar-showcase__status">
          <span className="avatar-showcase__status-dot" />
          <span>AVAILABLE</span>
        </div>
      </motion.div>

      {/* Particle dots */}
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <span
          key={i}
          className="avatar-showcase__particle"
          style={{
            '--p-i': i,
            '--p-total': PARTICLE_COUNT,
          }}
        />
      ))}
    </div>
  )
}
