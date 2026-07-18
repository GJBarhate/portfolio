import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const LEVEL_NAMES = {
  about: { num: '01', label: 'ORIGIN' },
  stats: { num: '02', label: 'STATS' },
  skills: { num: '03', label: 'SKILLS' },
  projects: { num: '04', label: 'WORK' },
  timeline: { num: '05', label: 'PATH' },
  'how-i-build': { num: '06', label: 'PROCESS' },
  contact: { num: '07', label: 'LINK' },
}

export default function LevelRibbon() {
  const [ribbon, setRibbon] = useState(null)
  const shown = new Set()

  useEffect(() => {
    const handler = (e) => {
      const id = e.detail
      const level = LEVEL_NAMES[id]
      if (!level || shown.has(id)) return
      shown.add(id)
      setRibbon({ ...level, key: id + Date.now() })
      setTimeout(() => setRibbon(null), 2000)
    }
    window.addEventListener('forge:unlock', handler)
    return () => window.removeEventListener('forge:unlock', handler)
  }, [])

  return (
    <AnimatePresence>
      {ribbon && (
        <motion.div
          key={ribbon.key}
          className="level-ribbon"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="level-ribbon__inner">
            <span className="level-ribbon__num">LEVEL {ribbon.num}</span>
            <span className="level-ribbon__label">{ribbon.label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
