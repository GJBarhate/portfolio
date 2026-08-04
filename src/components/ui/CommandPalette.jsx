import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import { SOCIALS } from '../../lib/content.js'
import { navigateToSection, withViewTransition } from '../../lib/viewTransition.js'
import { COMMANDS, completions, runLine } from '../../lib/forgeCli.js'
import { getStore, setStore } from '../../lib/store.js'
import { RESUME_PATH } from '../../lib/siteConfig.js'

/**
 * The command palette — T-002 and T-003.
 *
 * Two defects met in this component. **D-01**: it could only ever be opened by
 * `Ctrl/Cmd+K`, so on a phone it was 1.9 KB of gzip that no visitor could
 * reach — this is the "I can't see the CLI" report. **D-02**: the `window.forge`
 * command set lived in a devtools console that phones do not have.
 *
 * Both are answered here. Opening now goes through one canonical channel,
 * `forge:open-palette`, which the header button, the drawer row, the keyboard
 * shortcut and any future entry point all dispatch — one door, so a new
 * affordance can never be wired to a private setter again. And typing `>`
 * turns the palette into a real terminal over the `forgeCli` registry, so
 * every console command is reachable by touch.
 *
 * The element is a native `<dialog>` opened with `showModal()`: focus trap,
 * Escape handling, top-layer stacking and `::backdrop` come from the platform
 * rather than from three hooks that each have an edge case.
 */

const ACTIONS = [
  { id: 'about', label: 'Go to About', icon: '01', section: 'about' },
  { id: 'stats', label: 'Go to Player Stats', icon: '02', section: 'stats' },
  { id: 'skills', label: 'Go to Skills', icon: '03', section: 'skills' },
  { id: 'projects', label: 'Go to Projects', icon: '04', section: 'projects' },
  { id: 'timeline', label: 'Go to Journey', icon: '05', section: 'timeline' },
  { id: 'contact', label: 'Go to Contact', icon: '06', section: 'contact' },
  { id: 'terminal', label: 'Open terminal (type >)', icon: '>_', terminal: true },
  { id: 'arcade', label: 'Open Arcade', icon: 'AC', openArcade: true },
  { id: 'resume', label: 'Download Resume', icon: 'DL', href: RESUME_PATH },
  { id: 'github', label: 'Open GitHub', icon: 'GH', href: SOCIALS.github },
  { id: 'leetcode', label: 'Open LeetCode', icon: 'LC', href: SOCIALS.leetcode },
  { id: 'linkedin', label: 'Open LinkedIn', icon: 'LI', href: SOCIALS.linkedin },
  { id: 'theme-eclipse', label: 'Theme: Eclipse', icon: 'TH', theme: 'eclipse' },
  { id: 'theme-ember', label: 'Theme: Ember', icon: 'TH', theme: 'ember' },
  { id: 'theme-paper', label: 'Theme: Paper', icon: 'TH', theme: 'paper' },
  { id: 'theme-system', label: 'Theme: Follow system', icon: 'TH', theme: 'system' },
  // T-025 — respecting the OS motion preference is the floor; letting the
  // visitor override it here, on the spot, is the part they can see.
  { id: 'motion-full', label: 'Motion: Full', icon: 'MO', motion: 'full' },
  { id: 'motion-reduced', label: 'Motion: Reduced', icon: 'MO', motion: 'reduced' },
  { id: 'motion-off', label: 'Motion: Off', icon: 'MO', motion: 'off' },
  { id: 'motion-system', label: 'Motion: Follow system', icon: 'MO', motion: 'system' },
  { id: 'sound', label: 'Toggle Sound', icon: 'SN', toggleSound: true },
  { id: 'game', label: 'Play Hidden Protocol', icon: 'GM', playGame: true },
  { id: 'reset', label: 'Reset progress and preferences', icon: 'RS', command: 'reset' },
  { id: 'top', label: 'Back to Top', icon: '^^', scrollTop: true },
]

/** Subsequence match, so "gtp" finds "Go to Projects" the way a fuzzy finder does. */
function matches(label, query) {
  const l = label.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return true
  if (l.includes(q)) return true
  let i = 0
  for (const ch of q) {
    i = l.indexOf(ch, i)
    if (i === -1) return false
    i += 1
  }
  return true
}

export default function CommandPalette({ onPlayGame, onOpenArcade, defaultOpen = false }) {
  // `defaultOpen` exists because App loads this chunk lazily on the first
  // open request — by the time the component mounts, the event that summoned
  // it is long gone.
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [transcript, setTranscript] = useState([
    { kind: 'out', text: 'FORGE terminal — type `help` for commands, or delete the `>` to search.' },
  ])
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const transcriptRef = useRef(null)
  const historyRef = useRef({ lines: [], index: -1 })
  const { setTheme } = useTheme()
  const sound = useSound()

  const isTerminal = query.startsWith('>')
  const filtered = isTerminal ? [] : ACTIONS.filter((a) => matches(a.label, query))

  const log = useCallback((text, kind = 'out') => {
    if (kind === 'clear') { setTranscript([]); return }
    setTranscript((lines) => [...lines, { kind, text }].slice(-200))
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // ── the one opening channel (T-002) ──────────────────────────────────────
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('forge:open-palette', onOpen)
    return () => window.removeEventListener('forge:open-palette', onOpen)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // `showModal()` is what makes this a real dialog: the focus trap, the
  // inertness of everything behind it and the Escape handler are the
  // platform's, not ours. `onClose` catches Escape so React state and the
  // element's own state cannot disagree about whether it is open.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      try { dialog.showModal() } catch { /* already open in another pass */ }
      window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'commander' }))
      // `showModal()` focuses the first focusable descendant itself, but
      // only after the element enters the top layer — and iOS Safari scrolls
      // the page to an input focused before that happens. One macrotask of
      // delay is the difference between a focused field and a jumped page.
      setTimeout(() => inputRef.current?.focus(), 0)
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  const execute = (action) => {
    sound?.play('click')
    if (action.terminal) {
      setQuery('> ')
      setSelected(0)
      inputRef.current?.focus()
      return
    }
    if (action.section) {
      setOpen(false)
      navigateToSection(action.section)
    } else if (action.href) {
      setOpen(false)
      window.open(action.href, '_blank', 'noopener,noreferrer')
    } else if (action.theme) {
      setOpen(false)
      withViewTransition(() => setTheme(action.theme), { mode: 'nav' })
    } else if (action.motion) {
      setStore({ motion: action.motion })
      window.dispatchEvent(new CustomEvent('forge:set-motion', { detail: action.motion }))
      setOpen(false)
    } else if (action.toggleSound) {
      sound?.setMuted((v) => !v)
      setOpen(false)
    } else if (action.scrollTop) {
      setOpen(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (action.playGame) {
      setOpen(false)
      onPlayGame?.()
    } else if (action.openArcade) {
      setOpen(false)
      onOpenArcade?.()
    } else if (action.command) {
      // Registry commands with no navigation of their own stay open so the
      // visitor sees what happened.
      setQuery('> ')
      runLine(action.command, cliContext())
    }
  }

  const cliContext = () => ({
    log,
    setTheme: (id) => withViewTransition(() => setTheme(id), { mode: 'nav' }),
    openArcade: () => onOpenArcade?.(),
    scrollTo: (id) => navigateToSection(id),
    close,
  })

  const submitLine = (line) => {
    log(`> ${line.replace(/^>\s*/, '')}`, 'cmd')
    const history = historyRef.current
    history.lines.push(line)
    history.index = history.lines.length
    runLine(line, cliContext())
    setQuery('> ')
  }

  const onKeyDown = (e) => {
    if (isTerminal) {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitLine(query)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const options = completions(query)
        if (options.length === 1) {
          const parts = query.replace(/^>\s*/, '').split(/\s+/)
          parts[parts.length - 1] = options[0]
          setQuery(`> ${parts.join(' ')} `)
        } else if (options.length > 1) {
          log(options.join('   '), 'out')
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const history = historyRef.current
        if (!history.lines.length) return
        history.index = e.key === 'ArrowUp'
          ? Math.max(0, history.index - 1)
          : Math.min(history.lines.length, history.index + 1)
        setQuery(history.lines[history.index] ?? '> ')
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((v) => Math.min(v + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((v) => Math.max(v - 1, 0))
    } else if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault()
      execute(filtered[selected])
    }
  }

  /**
   * A click that lands on the dialog element itself — not on the panel inside
   * it — is a backdrop tap. Comparing against the panel's rectangle is what
   * makes this work on touch, where a tap can be reported on the dialog with
   * coordinates inside the panel during a scroll-momentum frame.
   */
  const onDialogPointerDown = (e) => {
    if (e.target !== dialogRef.current) return
    const panel = dialogRef.current.firstElementChild
    const r = panel?.getBoundingClientRect()
    if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      setOpen(false)
    }
  }

  const motionMode = getStore().motion

  return (
    <dialog
      ref={dialogRef}
      className="cmdpal"
      aria-label="Command palette"
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onPointerDown={onDialogPointerDown}
      /*
       * The key handler lives on the dialog, not on the input. `showModal()`
       * moves focus asynchronously, so a keystroke arriving in the same tick
       * as the open — which is exactly what happens when a visitor presses
       * ⌘K and immediately starts arrowing — would otherwise be delivered to
       * the dialog and dropped. Events bubble, so the input is still covered.
       */
      onKeyDown={onKeyDown}
    >
      <div className="cmdpal__panel">
        {isTerminal && (
          <ol className="cmdpal__transcript" ref={transcriptRef} aria-live="polite" aria-label="Terminal output">
            {transcript.map((line, i) => (
              <li key={i} className={`cmdpal__line cmdpal__line--${line.kind}`}>{line.text || ' '}</li>
            ))}
          </ol>
        )}

        <div className="cmdpal__inputrow">
          <span className="cmdpal__glyph" aria-hidden="true">{isTerminal ? '>_' : '⌕'}</span>
          <input
            ref={inputRef}
            type="text"
            className="cmdpal__input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            placeholder={isTerminal ? 'help, theme ember, scrollTo projects…' : 'Search, or type > for the terminal'}
            aria-label={isTerminal ? 'Terminal command' : 'Search commands'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            enterKeyHint={isTerminal ? 'send' : 'go'}
          />
          <kbd className="cmdpal__kbd">ESC</kbd>
        </div>

        {!isTerminal && (
          <ul className="cmdpal__results" role="listbox" aria-label="Commands">
            {filtered.length === 0 && (
              <li className="cmdpal__empty">No results. Type <code>&gt;</code> for the terminal.</li>
            )}
            {filtered.map((action, i) => (
              <li key={action.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  onClick={() => execute(action)}
                  onPointerEnter={() => setSelected(i)}
                  className={`cmdpal__item${i === selected ? ' is-selected' : ''}`}
                >
                  <span className="cmdpal__icon" aria-hidden="true">{action.icon}</span>
                  <span className="cmdpal__label">{action.label}</span>
                  {action.motion && action.motion === motionMode && (
                    <span className="cmdpal__badge" aria-label="current">●</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="cmdpal__hint">
          {isTerminal
            ? `${COMMANDS.length} commands · Tab completes · ↑↓ history`
            : '↑↓ to move · Enter to run · > for the terminal'}
        </p>
      </div>
    </dialog>
  )
}
