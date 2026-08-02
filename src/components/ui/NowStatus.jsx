import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

function getIST() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function NowStatus() {
  const [time, setTime] = useState(getIST)

  useEffect(() => {
    const id = setInterval(() => setTime(getIST()), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5, duration: 0.6 }}
      className="fixed bottom-6 left-6 z-50 hidden lg:flex items-center gap-3 px-4 py-2.5 rounded-full glass font-mono text-[10px] tracking-wider text-[var(--ink-low)]"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-[var(--ink-mid)]">{time} IST</span>
      <span className="w-px h-3 bg-[var(--glass-border)]" />
      <span>OPEN TO WORK</span>
    </motion.div>
  )
}
