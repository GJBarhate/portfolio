import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { useSound } from '../../contexts/SoundContext.jsx'
import { SOCIALS } from '../../lib/content.js'
import { navigateToSection, withViewTransition } from '../../lib/viewTransition.js'
import { COMMANDS, completions, runLine } from '../../lib/forgeCli.js'
import { scrollToTop } from '../../lib/scroller.js'
import { PALETTE_HINT, isPaletteShortcut } from '../../lib/platform.js'
import {
  THEMES,
  SYSTEM_THEME,
  BACKDROPS,
  MOTIONS,
  getAppearance,
  setTheme as setAppearanceTheme,
  setBackdrop,
  setMotion,
  openAppearanceConsole,
} from '../../lib/appearance.js'
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

/*
 * D-35 — everything the site can do, visible without being asked.
 *
 * The previous list was one flat run of 24 rows in no order, and the features
 * a visitor would most want — launching a specific game, the other social
 * profiles, recruiter mode, the dither overlay, "email me" — existed only
 * behind the `>` terminal, which is itself only discoverable from a coach
 * mark that shows once. "It's in the CLI" is not a feature being available; it
 * is a feature being hidden behind a second feature.
 *
 * So the palette is now the site's index: grouped, labelled, and complete. The
 * terminal is still there, and it is now one row inside ADVANCED rather than
 * the only way to reach half of this.
 *
 * `keywords` exist so the fuzzy match works on intent as well as on wording —
 * "dark" finds Eclipse, "cv" finds the résumé, "quiet" finds the sound toggle.
 */
const GROUPS = ['Navigate', 'Play', 'Appearance', 'Links', 'Advanced']

const ACTIONS = [
  // ── Navigate ───────────────────────────────────────────────────────────
  { id: 'top', group: 'Navigate', label: 'Back to top', icon: '↑', keywords: 'hero home start', scrollTop: true },
  { id: 'about', group: 'Navigate', label: 'About', icon: '01', keywords: 'bio who story', section: 'about' },
  { id: 'stats', group: 'Navigate', label: 'Player stats', icon: '02', keywords: 'leetcode rating numbers', section: 'stats' },
  { id: 'skills', group: 'Navigate', label: 'Skills', icon: '03', keywords: 'stack tech tools', section: 'skills' },
  { id: 'projects', group: 'Navigate', label: 'Projects', icon: '04', keywords: 'work portfolio case study', section: 'projects' },
  { id: 'timeline', group: 'Navigate', label: 'Journey', icon: '05', keywords: 'timeline history experience', section: 'timeline' },
  { id: 'how-i-build', group: 'Navigate', label: 'Process', icon: '06', keywords: 'how i build method', section: 'how-i-build' },
  { id: 'contact', group: 'Navigate', label: 'Contact', icon: '07', keywords: 'hire email reach message', section: 'contact' },

  // ── Play ───────────────────────────────────────────────────────────────
  { id: 'arcade', group: 'Play', label: 'Open the arcade', icon: '🎮', keywords: 'games play cabinet', openArcade: true },
  { id: 'game-runner', group: 'Play', label: 'Forge Runner', icon: '🏃', keywords: 'endless runner lanes', game: 'runner' },
  { id: 'game-ludo', group: 'Play', label: 'Ludo: Recruiter', icon: '🎲', keywords: 'dice board race', game: 'ludo' },
  { id: 'game-snakes', group: 'Play', label: 'Snakes & CV', icon: '🪜', keywords: 'ladders board career', game: 'snakes' },
  { id: 'game-memory', group: 'Play', label: 'Memory Match', icon: '🧠', keywords: 'pairs flip cards', game: 'memory' },
  { id: 'game-snake', group: 'Play', label: 'Snake (classic)', icon: '🐍', keywords: 'konami classic', game: 'snake' },

  // ── Appearance ─────────────────────────────────────────────────────────
  //
  // GENERATED from `lib/appearance.js`, not typed out here.
  //
  // These fourteen rows used to be fourteen literals, with their own labels,
  // their own ordering and their own idea of what the modes were called — a
  // fourth vocabulary for three settings. Adding a theme meant remembering
  // this file. Now the palette renders whatever the facade declares, in the
  // facade's order, with the facade's human labels, so it cannot fall behind.
  { id: 'appearance', group: 'Appearance', label: 'Appearance… (theme, backdrop, motion)', icon: '◐', keywords: 'settings customise look colour scheme panel shift a', openAppearance: true },
  ...[...THEMES, SYSTEM_THEME].map((t) => ({
    id: `theme-${t.id}`,
    group: 'Appearance',
    label: `Theme: ${t.label}`,
    icon: '◐',
    keywords: `${t.id} ${t.meaning.toLowerCase()}`,
    theme: t.id,
  })),
  // T-025 — respecting the OS motion preference is the floor; letting the
  // visitor override it here, on the spot, is the part they can see. It is no
  // longer the ONLY place they can: motion has a real control now.
  ...MOTIONS.map((m) => ({
    id: `motion-${m.id}`,
    group: 'Appearance',
    label: `Motion: ${m.label}`,
    icon: '≈',
    keywords: `${m.id} ${m.meaning.toLowerCase()} animation`,
    motion: m.id,
  })),
  ...BACKDROPS.map((b) => ({
    id: `scene-${b.id}`,
    group: 'Appearance',
    label: `Backdrop: ${b.label}`,
    icon: b.glyph,
    keywords: `${b.id} background ${b.meaning.toLowerCase()}`,
    scene: b.id,
  })),
  { id: 'sound', group: 'Appearance', label: 'Sound on / off', icon: '♪', keywords: 'audio mute quiet volume', toggleSound: true },
  { id: 'recruiter', group: 'Appearance', label: 'Recruiter mode', icon: '◉', keywords: 'hiring concise fast skim', recruiter: true },

  // ── Links ──────────────────────────────────────────────────────────────
  { id: 'resume', group: 'Links', label: 'Résumé (PDF)', icon: '↗', keywords: 'cv download pdf', href: RESUME_PATH },
  { id: 'email', group: 'Links', label: `Email — ${SOCIALS.email}`, icon: '✉', keywords: 'hire contact mail write', href: `mailto:${SOCIALS.email}` },
  { id: 'github', group: 'Links', label: 'GitHub', icon: '↗', keywords: 'code source repos', href: SOCIALS.github },
  { id: 'leetcode', group: 'Links', label: 'LeetCode', icon: '↗', keywords: 'dsa problems rating knight', href: SOCIALS.leetcode },
  { id: 'codechef', group: 'Links', label: 'CodeChef', icon: '↗', keywords: 'contest competitive rating', href: SOCIALS.codechef },
  { id: 'linkedin', group: 'Links', label: 'LinkedIn', icon: '↗', keywords: 'profile network professional', href: SOCIALS.linkedin },

  // ── Advanced ───────────────────────────────────────────────────────────
  { id: 'terminal', group: 'Advanced', label: 'Terminal — run commands', icon: '>_', keywords: 'cli console shell forge', terminal: true },
  { id: 'status', group: 'Advanced', label: 'Show status (achievements, tier)', icon: 'i', keywords: 'debug info progress sparks', command: 'status' },
  { id: 'matrix', group: 'Advanced', label: 'Matrix overlay on / off', icon: '⣿', keywords: 'ascii dither easter egg', command: 'matrix' },
  { id: 'game-secret', group: 'Advanced', label: 'Hidden protocol', icon: '⌘', keywords: 'konami secret egg', playGame: true },
  { id: 'reset', group: 'Advanced', label: 'Reset progress and preferences', icon: '⟲', keywords: 'clear wipe start over', command: 'reset' },
]

/**
 * Subsequence match, so "gtp" finds "Go to Projects" the way a fuzzy finder
 * does. Keywords are searched alongside the label but never displayed, which
 * is what lets "dark" find a row called "Theme: Eclipse".
 */
function matches(action, query) {
  const q = query.toLowerCase().trim()
  if (!q) return true
  const haystack = `${action.label} ${action.group} ${action.keywords || ''}`.toLowerCase()
  if (haystack.includes(q)) return true
  // Subsequence over the label only — running it over the keywords too makes
  // almost everything match almost everything.
  const l = action.label.toLowerCase()
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

  /**
   * The grouped view is what the eye reads; the flat list is what the keyboard
   * walks. The flat list is *derived from* the grouped one rather than
   * computed alongside it, so the two can never disagree about which row index
   * 7 is — which is how a palette ends up highlighting one row and running
   * another.
   */
  const grouped = useMemo(() => {
    if (isTerminal) return []
    const out = []
    let cursor = 0
    for (const group of GROUPS) {
      const items = ACTIONS.filter((a) => a.group === group && matches(a, query))
      if (!items.length) continue
      out.push({ group, items: items.map((action) => ({ action, index: cursor++ })) })
    }
    return out
  }, [isTerminal, query])

  const filtered = useMemo(
    () => grouped.flatMap((g) => g.items.map((i) => i.action)),
    [grouped]
  )

  const log = useCallback((text, kind = 'out') => {
    if (kind === 'clear') { setTranscript([]); return }
    setTranscript((lines) => [...lines, { kind, text }].slice(-200))
  }, [])

  const close = useCallback(() => setOpen(false), [])

  /**
   * Opening always opens the SEARCH — D-43.
   *
   * `query` survived a close, so a visitor who had used the terminal once got
   * the terminal every time afterwards: Escape, then the shortcut again, and
   * they were back at a `> ` prompt with no list, no groups and no obvious way
   * back to the thing they had actually opened. The mode is a thing you enter
   * deliberately by typing `>`; it is not a preference, and it should not
   * outlive the dialog that hosted it.
   *
   * The transcript is deliberately NOT cleared — a returning visitor's command
   * history is worth keeping. Only the mode resets.
   */
  const openPalette = useCallback(() => {
    setQuery('')
    setSelected(0)
    setOpen(true)
  }, [])

  // ── the one opening channel (T-002) ──────────────────────────────────────
  useEffect(() => {
    window.addEventListener('forge:open-palette', openPalette)
    return () => window.removeEventListener('forge:open-palette', openPalette)
  }, [openPalette])

  useEffect(() => {
    const handler = (e) => {
      if (!isPaletteShortcut(e)) return
      e.preventDefault()
      if (dialogRef.current?.open) setOpen(false)
      else openPalette()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openPalette])

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

  /*
   * D-35 — the list is now long enough to scroll, so two things that did not
   * matter at 24 always-visible rows now do:
   *
   *  · the highlight has to stay on screen while the arrows walk past the
   *    fold, or the visitor is driving something they cannot see;
   *  · the index has to stay in range when a keystroke shrinks the list,
   *    otherwise Enter runs nothing (or, worse, the row that has since moved
   *    into that slot).
   */
  useEffect(() => {
    if (selected > filtered.length - 1) setSelected(Math.max(0, filtered.length - 1))
  }, [filtered.length, selected])

  useEffect(() => {
    if (isTerminal) return
    const row = dialogRef.current?.querySelector('.cmdpal__item.is-selected')
    row?.scrollIntoView({ block: 'nearest' })
  }, [selected, isTerminal])

  const cliContext = () => ({
    log,
    setTheme: (id) => withViewTransition(() => setTheme(id), { mode: 'nav' }),
    openArcade: () => onOpenArcade?.(),
    scrollTo: (id) => navigateToSection(id),
    close,
  })

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
    } else if (action.openAppearance) {
      setOpen(false)
      openAppearanceConsole({ source: 'palette' })
    } else if (action.theme) {
      setOpen(false)
      // Through the facade. This used to call `setTheme` from the context
      // directly while the motion row wrote the store AND dispatched an event,
      // and the backdrop row dispatched a different event — three settings,
      // three mechanisms, in one switch statement.
      withViewTransition(() => setAppearanceTheme(action.theme), { mode: 'nav' })
    } else if (action.motion) {
      setMotion(action.motion)
      setOpen(false)
    } else if (action.scene) {
      setBackdrop(action.scene)
      setOpen(false)
    } else if (action.toggleSound) {
      sound?.setMuted((muted) => !muted)
      setOpen(false)
    } else if (action.recruiter) {
      setOpen(false)
      window.dispatchEvent(new CustomEvent('forge:toggle-recruiter'))
    } else if (action.scrollTop) {
      setOpen(false)
      scrollToTop()
    } else if (action.game) {
      // D-35 — the five games are launchable by name from here, which is what
      // the nav dropdown offers a mouse and nothing offered a keyboard.
      setOpen(false)
      window.dispatchEvent(new CustomEvent('forge:open-arcade', { detail: action.game }))
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

  // One read for all three current values, so the check marks beside the rows
  // cannot disagree with each other or with the console.
  const appearance = getAppearance()
  const motionMode = appearance.motion
  const sceneMode = appearance.backdrop

  return (
    <dialog
      ref={dialogRef}
      className="cmdpal"
      data-mode={isTerminal ? 'terminal' : 'search'}
      aria-label="Command palette"
      onClose={() => setOpen(false)}
      /*
       * D-43 — Escape backs out one level before it closes.
       *
       * In terminal mode the first Escape returns to the search list, which is
       * the thing a visitor who typed `>` by accident, or who is done running
       * commands, actually wants; a second Escape closes the dialog. Without
       * this the only way back to the command list was to delete the `>` by
       * hand, which nothing tells you.
       */
      onCancel={(e) => {
        if (isTerminal) {
          e.preventDefault()
          setQuery('')
          setSelected(0)
          inputRef.current?.focus()
          return
        }
        setOpen(false)
      }}
      onPointerDown={onDialogPointerDown}
      /*
       * The key handler lives on the dialog, not on the input. `showModal()`
       * moves focus asynchronously, so a keystroke arriving in the same tick
       * as the open — which is exactly what happens when a visitor opens the
       * palette and immediately starts arrowing — would otherwise be delivered
       * to the dialog and dropped. Events bubble, so the input is still
       * covered.
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
            {grouped.map(({ group, items }) => (
              <li key={group} role="presentation">
                {/* The heading is `aria-hidden` and the rows stay direct
                    `role="option"` descendants of the listbox, so grouping is
                    a visual affordance rather than a new tree for a screen
                    reader to get lost in. */}
                <p className="cmdpal__group" aria-hidden="true">{group}</p>
                <ul className="cmdpal__grouplist" role="presentation">
                  {items.map(({ action, index }) => (
                    <li key={action.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === selected}
                        onClick={() => execute(action)}
                        onPointerEnter={() => setSelected(index)}
                        className={`cmdpal__item${index === selected ? ' is-selected' : ''}`}
                      >
                        <span className="cmdpal__icon" aria-hidden="true">{action.icon}</span>
                        <span className="cmdpal__label">{action.label}</span>
                        {action.motion && action.motion === motionMode && (
                          <span className="cmdpal__badge" aria-label="current">●</span>
                        )}
                        {action.theme && action.theme === appearance.themePreference && (
                          <span className="cmdpal__badge" aria-label="current">●</span>
                        )}
                        {action.scene && action.scene === sceneMode && (
                          <span className="cmdpal__badge" aria-label="current">●</span>
                        )}
                        {action.toggleSound && (
                          <span className="cmdpal__state" aria-hidden="true">{sound?.muted ? 'OFF' : 'ON'}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <p className="cmdpal__hint">
          {isTerminal
            ? `${COMMANDS.length} commands · Tab completes · ↑↓ history`
            : `↑↓ to move · Enter to run · ${PALETTE_HINT} or / to reopen · > for the terminal`}
        </p>
      </div>
    </dialog>
  )
}
