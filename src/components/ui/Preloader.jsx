import { useReducedMotion } from '../../lib/useReducedMotion.js'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const COUNT_DURATION = 1.6
const LIFT_DURATION = 0.7

export default function Preloader({ onReveal }) {
  const reduced = useReducedMotion()
  const [lift, setLift] = useState(false)
  const [gone, setGone] = useState(false)
  const revealedRef = useRef(false)
  const count = useMotionValue(0)
  const displayCount = useTransform(count, Math.round)
  const barScale = useTransform(count, [0, 100], [0, 1])
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    const reveal = () => {
      if (revealedRef.current) return
      revealedRef.current = true
      sessionStorage.setItem('forge-intro', '1')
      onRevealRef.current()
    }

    if (reduced) {
      reveal()
      setGone(true)
      return
    }

    const controls = animate(count, 100, {
      duration: COUNT_DURATION,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        setLift(true)
        reveal()
        setTimeout(() => setGone(true), LIFT_DURATION * 1000 + 50)
      },
    })

    const failsafe = setTimeout(reveal, (COUNT_DURATION + LIFT_DURATION + 0.5) * 1000)
    return () => {
      controls.stop()
      clearTimeout(failsafe)
    }
  }, [reduced, count])

  if (gone) return null

  return (
    <motion.div
      className="preloader"
      aria-hidden="true"
      initial={false}
      animate={
        lift
          ? { clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }
          : { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }
      }
      transition={{ duration: LIFT_DURATION, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="preloader__inner"
        animate={lift ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="preloader__monogram" style={{ border: 'none', boxShadow: 'none' }}>
          <svg width="44" height="44" viewBox="0 0 60 48" aria-hidden="true">
            <motion.path
              d="M18 8c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 16c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.6 6-6 6zM42 8l14 20-14 20"
              fill="none"
              stroke="var(--accent-bright)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: COUNT_DURATION, ease: [0.16, 1, 0.3, 1] }}
            />
            <circle
              cx="18"
              cy="18"
              r="10"
              fill="none"
              stroke="var(--accent-dim)"
              strokeWidth="1"
              opacity="0.3"
            />
          </svg>
        </div>
        <div className="preloader__bar">
          <motion.div
            className="preloader__bar-fill"
            style={{ scaleX: barScale, transformOrigin: 'left' }}
          />
        </div>
        <p className="font-mono text-[9px] tracking-[0.35em] text-[var(--ink-low)]">
          FORGING INTERFACE
        </p>
        <motion.p
          className="font-mono text-[10px] tracking-[0.2em] mt-4"
          style={{ color: 'var(--accent-bright)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          PRESS START
        </motion.p>
      </motion.div>
      <motion.div className="preloader__count">{displayCount}</motion.div>
    </motion.div>
  )
}
