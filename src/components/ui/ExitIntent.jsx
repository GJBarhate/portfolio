import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getStore } from '../../lib/store.js'

export default function ExitIntent() {
  const [show, setShow] = useState(false)
  const [sparksLeft, setSparksLeft] = useState(0)

  useEffect(() => {
    let shown = false
    const handler = (e) => {
      if (shown || e.clientY > 5) return
      const collected = getStore().sparks.length
      if (collected >= 5 || collected === 0) return
      shown = true
      setSparksLeft(5 - collected)
      setShow(true)
      setTimeout(() => setShow(false), 4000)
    }
    document.addEventListener('mouseleave', handler)
    return () => document.removeEventListener('mouseleave', handler)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="exit-intent__tooltip" style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none' }}>
            <span className="exit-intent" style={{ display: 'inline-block', marginRight: 6 }}>👋</span>
            {sparksLeft} spark{sparksLeft !== 1 ? 's' : ''} left to find
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
