import { useEffect, useState } from 'react'
import { NOW } from '../../lib/content.js'

function getIST() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * W4 — the `now` line. "Open to work" on its own is a claim; an editor, a
 * current focus and an availability date are checkable facts, which is what
 * makes recency read as real rather than as a template default.
 *
 * Facts live in content.js so there is one place to keep them honest.
 */
export default function NowStatus() {
  const [time, setTime] = useState(getIST)
  const [detail, setDetail] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTime(getIST()), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="now-status hero-rise fixed bottom-6 left-6 z-50 hidden lg:flex flex-col gap-1.5 px-4 py-2.5 rounded-full glass font-mono text-[10px] tracking-wider text-[var(--ink-low)]"
      style={{ '--rise-delay': '1.5s' }}
      data-open={detail}
      onMouseEnter={() => setDetail(true)}
      onMouseLeave={() => setDetail(false)}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-2 w-2">
          <span className="now-status__ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" data-loop="now-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-[var(--ink-mid)]">{time} IST</span>
        <span className="w-px h-3 bg-[var(--glass-border)]" />
        <span>{NOW.availability}</span>
      </div>
      {detail && (
        <div className="now-status__detail flex flex-col gap-0.5 pl-5 pb-1">
          <span>NOW · {NOW.focus}</span>
          <span>USES · {NOW.editor}</span>
        </div>
      )}
    </div>
  )
}
