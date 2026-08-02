import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import { SOCIALS } from '../../lib/content.js'
import { EASE_FORGE } from '../../lib/motion.js'
import { navigateToSection, withViewTransition } from '../../lib/viewTransition.js'

const ACTIONS = [
  { id: 'about', label: 'Go to About', icon: '01', section: 'about' },
  { id: 'stats', label: 'Go to Player Stats', icon: '02', section: 'stats' },
  { id: 'skills', label: 'Go to Skills', icon: '03', section: 'skills' },
  { id: 'projects', label: 'Go to Projects', icon: '04', section: 'projects' },
  { id: 'timeline', label: 'Go to Journey', icon: '05', section: 'timeline' },
  { id: 'contact', label: 'Go to Contact', icon: '06', section: 'contact' },
  { id: 'arcade', label: 'Open Arcade', icon: 'AC', openArcade: true },
  { id: 'resume', label: 'Download Resume', icon: 'DL', href: '/Gaurav_Resume.pdf' },
  { id: 'github', label: 'Open GitHub', icon: 'GH', href: SOCIALS.github },
  { id: 'leetcode', label: 'Open LeetCode', icon: 'LC', href: SOCIALS.leetcode },
  { id: 'linkedin', label: 'Open LinkedIn', icon: 'LI', href: SOCIALS.linkedin },
  { id: 'theme-eclipse', label: 'Theme: Eclipse', icon: 'TH', theme: 'eclipse' },
  { id: 'theme-ember', label: 'Theme: Ember', icon: 'TH', theme: 'ember' },
  { id: 'theme-paper', label: 'Theme: Paper', icon: 'TH', theme: 'paper' },
  { id: 'sound', label: 'Toggle Sound', icon: 'SN', toggleSound: true },
  { id: 'game', label: 'Play Hidden Protocol', icon: 'GM', playGame: true },
  { id: 'top', label: 'Back to Top', icon: '^^', scrollTop: true },
]

export default function CommandPalette({ onPlayGame, onOpenArcade, defaultOpen = false }) {
  // `defaultOpen` exists because App loads this chunk lazily on the first ⌘K —
  // by the time the component mounts, the keystroke that summoned it is gone.
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const { setTheme } = useTheme()
  const sound = useSound()

  const filtered = query
    ? ACTIONS.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()))
    : ACTIONS

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'commander' }))
    }
  }, [open])

  const execute = (action) => {
    setOpen(false)
    sound?.play('click')
    if (action.section) {
      navigateToSection(action.section)
    } else if (action.href) {
      window.open(action.href, '_blank', 'noopener,noreferrer')
    } else if (action.theme) {
      withViewTransition(() => setTheme(action.theme), { mode: 'nav' })
    } else if (action.toggleSound) {
      sound?.setMuted((v) => !v)
    } else if (action.scrollTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (action.playGame) {
      onPlayGame?.()
    } else if (action.openArcade) {
      onOpenArcade?.()
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((v) => Math.min(v + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((v) => Math.max(v - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      execute(filtered[selected])
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 'var(--z-cmdpal)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="fixed top-[15vh] left-1/2 w-[min(92vw,540px)] -translate-x-1/2 rounded-2xl glass overflow-hidden shadow-2xl"
            style={{ zIndex: 'calc(var(--z-cmdpal) + 1)' }}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: EASE_FORGE }}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--glass-border)]">
              <span className="text-[var(--ink-low)] text-sm">&#9906;</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
                onKeyDown={onKeyDown}
                placeholder="Type a command…"
                className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-low)]"
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--glass-border)] text-[var(--ink-low)]">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {filtered.length === 0 && (
                <p className="px-5 py-6 text-sm text-[var(--ink-low)] text-center">No results found.</p>
              )}
              {filtered.map((action, i) => (
                <button
                  key={action.id}
                  onClick={() => execute(action)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors duration-150 ${
                    i === selected ? 'bg-[var(--surface-2)] text-[var(--ink)]' : 'text-[var(--ink-mid)]'
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-[var(--surface-3)] flex items-center justify-center font-mono text-[10px] text-[var(--ink-low)] flex-shrink-0">
                    {action.icon}
                  </span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
