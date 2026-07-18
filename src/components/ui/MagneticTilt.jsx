import { useCallback, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useReducedMotion } from '../../lib/useReducedMotion.js'

export default function MagneticTilt({
  className = '',
  children,
  magneticStrength = 0.3,
  tiltMax = 8,
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const [hovering, setHovering] = useState(false)

  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const translateX = useMotionValue(0)
  const translateY = useMotionValue(0)
  const sheenX = useMotionValue(50)
  const sheenY = useMotionValue(50)

  const springRotate = useSpring(rotateX, { stiffness: 200, damping: 20, mass: 0.5 })
  const springTranslate = useSpring(translateX, { stiffness: 300, damping: 25, mass: 0.4 })

  const isTouch = useRef(false)

  const onPointerMove = useCallback(
    (e) => {
      if (isTouch.current) return
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy

      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height

      rotateY.set((px - 0.5) * tiltMax * 2)
      rotateX.set((0.5 - py) * tiltMax * 2)

      translateX.set(dx * magneticStrength)
      translateY.set(dy * magneticStrength)

      sheenX.set(px * 100)
      sheenY.set(py * 100)
    },
    [magneticStrength, tiltMax, rotateX, rotateY, translateX, translateY, sheenX, sheenY]
  )

  const onPointerLeave = useCallback(() => {
    setHovering(false)
    rotateX.set(0)
    rotateY.set(0)
    translateX.set(0)
    translateY.set(0)
  }, [rotateX, rotateY, translateX, translateY])

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={`relative inline-block ${className}`}
      style={{
        rotateX: springRotate,
        rotateY,
        translateX: springTranslate,
        translateY,
        transformStyle: 'preserve-3d',
        perspective: '800px',
        willChange: 'transform',
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerEnter={() => setHovering(true)}
      onTouchStart={() => { isTouch.current = true }}
    >
      {children}

      {/* Specular sheen overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-10 rounded-[inherit]"
        style={{
          background: `radial-gradient(circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.15) 0%, transparent 60%)`,
          opacity: hovering ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        aria-hidden="true"
      />
    </motion.div>
  )
}
