import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '../../lib/useIsMobile.js'

export default function ArcadeFAB() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (dismissed) return
    const check = () => {
      const scrolled = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
      setVisible(scrolled > 0.3 && scrolled < 0.9)
    }
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [dismissed])

  const open = () => {
    window.dispatchEvent(new CustomEvent('forge:open-arcade'))
    setDismissed(true)
  }

  if (isMobile) return null

  return (
    <AnimatePresence>
      {visible && !dismissed && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={open}
          data-cursor="view"
          className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full flex items-center justify-center text-lg clay-btn insert-coin"
          style={{ background: 'linear-gradient(145deg, var(--surface-2), var(--surface-1))', border: '1px solid var(--accent-dim)' }}
          aria-label="Open arcade"
          title="PRESS START — play games"
        >
          🎮
        </motion.button>
      )}
    </AnimatePresence>
  )
}
