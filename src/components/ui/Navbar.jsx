import { useCallback, useEffect, useRef, useState } from 'react'
import { onFrame } from '../../lib/raf.js'
import { onScrollFrame } from '../../lib/scrollState.js'
import { scrollTo } from '../../lib/scroller.js'
import { useSound } from '../../contexts/SoundContext.jsx'
import { PALETTE_HINT, PALETTE_KEYSHORTCUTS } from '../../lib/platform.js'
import MagneticButton from './MagneticButton.jsx'
import AppearanceButton from './AppearanceButton.jsx'
import { openAppearanceConsole } from '../../lib/appearance.js'
import RecruiterMode from './RecruiterMode.jsx'
import MorphLink from './MorphLink.jsx'
import Drawer from './Drawer.jsx'
import { SparkCounter } from './SparkHunt.jsx'
import { RESUME_PATH } from '../../lib/siteConfig.js'

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'stats', label: 'Stats' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Work' },
  { id: 'timeline', label: 'Journey' },
  { id: 'how-i-build', label: 'Process' },
  { id: 'contact', label: 'Contact' },
]

/* The per-game list lived here as well as in ArcadeHub, to feed a hover-only
   dropdown. One list, in the hub, now — see the ARCADE button below. */

const RING_R = 18
const RING_C = 2 * Math.PI * RING_R

/** The gap between the header's bottom edge and a scrolled-to heading. */
const ANCHOR_GAP = 12

const openPalette = () => window.dispatchEvent(new CustomEvent('forge:open-palette'))

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const sound = useSound()
  const ringRef = useRef(null)
  const headerRef = useRef(null)
  const headerHeightRef = useRef(80)

  // The progress ring is written straight onto the SVG attribute from the
  // shared ticker — no React re-render per scroll frame, and no spring engine
  // in the critical path to draw one circle (§8.3).
  useEffect(() => {
    const circle = ringRef.current
    if (!circle) return
    let value = 0
    return onFrame((_t, dt) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      value += (target - value) * (1 - Math.exp(-(dt / 1000) * 10))
      circle.style.strokeDashoffset = (RING_C * (1 - value)).toFixed(2)
    })
  }, [])

  /**
   * T-012.1 — publish the real header height as `--header-h`.
   *
   * `goTo()` used to hardcode `offset: -80`. The mobile header is not 80px
   * tall, so anchor navigation landed with the heading tucked underneath it.
   * A ResizeObserver writes the measured value once per actual change — not
   * once per frame, and not once per `resize` event, which fires constantly
   * during a mobile scroll.
   */
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const publish = () => {
      const h = header.getBoundingClientRect().height
      headerHeightRef.current = h
      document.documentElement.style.setProperty('--header-h', `${Math.round(h)}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(header)
    return () => ro.disconnect()
  }, [])

  /**
   * T-012.4 — active section detection.
   *
   * The `IntersectionObserver` this replaces used `rootMargin: '-45% 0px -45%
   * 0px'`, which leaves a 10 %-tall detection band: 67px on a 667px phone. A
   * section shorter than that band never intersects it at all, so the nav
   * highlight silently died on every short section.
   *
   * The standard algorithm has no such failure mode: the active section is
   * the last one whose top has crossed the header line. It is correct for
   * sections of any height, including ones shorter than the viewport, costs
   * O(sections) per frame with zero observers, and rides the scroll read that
   * `scrollState.js` is already doing once per frame for everybody.
   */
  useEffect(() => {
    let tops = []
    const measure = () => {
      tops = LINKS.map((l) => {
        const el = document.getElementById(l.id)
        return el ? { id: l.id, top: el.getBoundingClientRect().top + window.scrollY } : null
      }).filter(Boolean)
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement)

    let current = ''
    let lastHashWrite = 0
    const stop = onScrollFrame((state) => {
      const line = state.y + headerHeightRef.current + ANCHOR_GAP + 1
      let found = ''
      for (const section of tops) {
        if (section.top <= line) found = section.id
        else break
      }
      // The last section can be too short to ever reach the line on a tall
      // screen; being at the bottom of the document means being in it.
      if (state.max > 0 && state.y >= state.max - 2 && tops.length) {
        found = tops[tops.length - 1].id
      }
      if (found === current) return
      current = found
      setActive(found)

      // T-012.5 — reflect the active section in the URL, throttled, with
      // `replaceState` so the back button still means "the previous page"
      // rather than "the previous heading".
      const now = performance.now()
      if (found && now - lastHashWrite > 500) {
        lastHashWrite = now
        try { history.replaceState(null, '', `#${found}`) } catch { /* file:// */ }
      }
    })

    return () => { ro.disconnect(); stop() }
  }, [])

  const goTo = useCallback((id) => {
    setOpen(false)
    /*
     * The scroll is DEFERRED by one task, and that is a bug fix rather than a
     * flourish.
     *
     * `setOpen(false)` only schedules a React update. The drawer's scroll lock
     * — root-level `overflow: hidden`, plus `position: fixed` on the body for
     * iOS — is released in that component's effect CLEANUP, which runs after
     * React commits. Calling `scrollTo` synchronously here therefore ran while
     * the page was still locked, and `window.scrollTo` against
     * `overflow: hidden` is a no-op.
     *
     * The effect: every section link in the MOBILE MENU silently did nothing.
     * The drawer closed and the page stayed exactly where it was. Caught by
     * `recruiter-path.spec.js` on a 390px viewport — "one click on Work must
     * bring the work section into view" — reporting `viewport ratio 0`.
     *
     * A macrotask is enough and is the right size: React's commit and its
     * effect cleanups both complete before the next task runs, so by the time
     * this fires the page is genuinely scrollable. On desktop the drawer is
     * closed already and the extra tick is imperceptible.
     *
     * D-30 — one scroll implementation. `scrollTo` reads the measured
     * `--header-h` itself, so the heading lands below the header rather than
     * underneath it, on every entry point that calls it.
     */
    setTimeout(() => scrollTo(id), 0)
  }, [])

  const toggleMute = () => {
    sound?.setMuted((v) => !v)
  }

  const launchGame = (gameId) => {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('forge:open-arcade', { detail: gameId }))
  }

  return (
    <header
      ref={headerRef}
      className="site-header fixed top-0 left-0 right-0 container-px py-4 flex items-center justify-between progressive-blur bg-[color-mix(in_oklch,var(--surface-0)_70%,transparent)] border-b border-[var(--glass-border)]"
      style={{ zIndex: 'var(--z-nav)' }}
    >
      <a href="#hero" data-cursor="view" className="nav-wordmark font-display text-sm tracking-wide text-[var(--ink)]">
        Gaurav Barhate
      </a>

      <nav className="hidden lg:flex items-center gap-8 font-mono text-xs tracking-wider" aria-label="Sections">
        {LINKS.map((l) => (
          <button
            key={l.id}
            type="button"
            data-cursor="view"
            onClick={() => goTo(l.id)}
            onMouseEnter={() => sound?.play('hover')}
            aria-current={active === l.id ? 'true' : undefined}
            className={`uppercase ${active === l.id ? 'text-[var(--accent-bright)]' : ''}`}
          >
            <MorphLink className={active === l.id ? 'text-[var(--accent-bright)]' : ''}>
              {l.label}
            </MorphLink>
          </button>
        ))}

        {/*
          D-10h — one button, and the games are chosen inside the hub.

          This was a five-item panel gated on `hover`, which made it a keyboard
          trap on exactly the machine most likely to hit it: a touch-capable
          laptop reports `hover: none`, so the panel was not rendered at all,
          and a keyboard user could Tab to ARCADE and reach none of the five
          games. `focus-within` cannot rescue a panel that was never mounted.

          Splitting one feature across a button and a hover menu also meant the
          menu had to duplicate the hub's own game list — two places to add a
          game, one of which was invisible to half the visitors.

          So: the button opens the hub, the hub is where you pick. The games
          themselves are untouched; the second, hover-only door is gone.
        */}
        <button
          type="button"
          onClick={() => launchGame(null)}
          data-cursor="view"
          className="arcade-nav-btn relative px-3 py-1.5 rounded-full font-mono text-[12px] tracking-wider flex items-center gap-1.5 transition-all duration-fast"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            <span className="arcade-nav-icon text-[13px]" aria-hidden="true">🎮</span>
            <span className="arcade-nav-text">ARCADE</span>
            <span className="arcade-nav-dot w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgb(52,211,153)]" aria-hidden="true" />
          </span>
        </button>
      </nav>

      <div className="nav-cluster flex items-center gap-3 sm:gap-4">
        {/*
          T-002.4 — the search affordance, visible at EVERY width.

          This is the door that did not exist. Below `lg` it is the only way
          into the palette in the header; at `lg`+ it carries the `/` hint.
        */}
        <button
          type="button"
          onClick={openPalette}
          data-cursor="view"
          aria-label="Open search and commands"
          // Below 96rem the printed hint is hidden for want of room, so the
          // tooltip carries it instead — the shortcut stays discoverable at
          // every width rather than only on the widest screens.
          title={`Search and commands (${PALETTE_HINT} or /)`}
          aria-keyshortcuts={PALETTE_KEYSHORTCUTS}
          className="nav-search rounded-full border border-[var(--glass-border)] bg-[var(--surface-2)] flex items-center justify-center hover:border-[var(--accent-dim)] transition-colors duration-fast text-[var(--ink-mid)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {/* D-34 — the label follows the platform. A Windows visitor reading
              `⌘K` reaches for the Windows key, and `Win+K` is an OS shortcut
              the page never sees. */}
          <span className="nav-search__hint font-mono" aria-hidden="true">{PALETTE_HINT}</span>
        </button>

        <RecruiterMode />
        <SparkCounter />
        {/*
          ONE appearance control, visible at every width.

          It replaces three: the theme knob, the backdrop segmented control
          (invisible below 1,792 px) and the popover that carried both. Losing
          two controls from the cluster is also what makes room for this one to
          be 44px and to carry a word rather than a glyph.
        */}
        <AppearanceButton />

        {/* Below 1024px this moves into the drawer. Six controls and a wordmark
            do not fit across a 320px phone, and the sound switch is the one
            with the least claim on permanent screen real estate. It is a
            stateless button reading context, so the two render sites are
            interchangeable — only ever one of them is visible.

            The whole nav switches at `lg`, not `md`: the horizontal link list
            needs ~620px, and between 768 and 1024 it wrapped onto a second row
            and drove the fixed header to 145px tall — a landscape phone lost a
            third of its viewport to the navigation. */}
        <button
          type="button"
          onClick={toggleMute}
          data-cursor="view"
          aria-label={sound?.muted ? 'Unmute sound' : 'Mute sound'}
          aria-pressed={!sound?.muted}
          className="nav-sound hidden lg:flex w-8 h-8 rounded-full border border-[var(--glass-border)] bg-[var(--surface-2)] items-center justify-center hover:border-[var(--accent-dim)] transition-colors duration-fast font-mono text-[12px] text-[var(--ink-mid)]"
        >
          {sound?.muted ? 'OFF' : 'ON'}
        </button>

        <svg width="40" height="40" className="hidden lg:block" aria-hidden="true">
          <circle cx="20" cy="20" r={RING_R} fill="none" stroke="var(--surface-3)" strokeWidth="2" />
          <circle
            ref={ringRef}
            cx="20"
            cy="20"
            r={RING_R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray={RING_C}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
            style={{ strokeDashoffset: RING_C }}
          />
        </svg>

        <button
          type="button"
          data-cursor="menu"
          onClick={() => setOpen((v) => !v)}
          className="nav-burger lg:hidden flex flex-col gap-1.5 w-7 h-7 justify-center"
          data-open={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="nav-drawer"
        >
          <span className="nav-burger__bar" />
          <span className="nav-burger__bar" />
          <span className="nav-burger__bar" />
        </button>

        <MagneticButton
          as="a"
          href={RESUME_PATH}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="view"
          /* P5.5 — `nav-resume-cta` only sets a min-block-size (index.css):
             44px (§6.6 / WCAG 2.5.5) at the 640–1024px widths where this is
             the only way to reach the résumé without opening the drawer. */
          className="nav-resume-cta hidden sm:inline-flex items-center px-5 py-2 rounded-full border border-[var(--accent-dim)] text-xs font-mono tracking-wider hover:border-[var(--accent)] hover:shadow-[0_0_24px_var(--accent-dim)]"
        >
          RESUME
        </MagneticButton>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} id="nav-drawer">
        <div className="drawer__body l-stack" style={{ '--gap': 'var(--space-s)' }}>
          {/*
            T-002.3 — the first row in the drawer is the way into the palette.
            On a phone this and the header button are the only two doors, and
            a visitor who opened the menu looking for "search" finds it at the
            top rather than after seven section links.
          */}
          <button
            type="button"
            onClick={() => { setOpen(false); openPalette() }}
            className="drawer__search"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>SEARCH / COMMANDS</span>
            <kbd className="drawer__kbd" aria-hidden="true">{PALETTE_HINT}</kbd>
          </button>

          {/* Not "Sections": the header nav already claims that name, and two
              landmarks with one label are ambiguous to a screen reader
              reading the landmark list — and to anything else looking for one
              of them. */}
          <nav className="drawer__links" aria-label="Sections (menu)">
            {LINKS.map((l, i) => (
              <button
                key={l.id}
                type="button"
                onClick={() => goTo(l.id)}
                style={{ '--i': i }}
                aria-current={active === l.id ? 'true' : undefined}
                className="nav-drawer__link text-left font-display text-2xl text-[var(--ink-mid)] hover:text-[var(--accent-bright)]"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="nav-drawer__tools">
            {/* D.1 — a count is not a reason. */}
            <button type="button" onClick={() => launchGame(null)} className="nav-drawer__tool">
              <span aria-hidden="true">🎮</span>
              <span>Play something</span>
            </button>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={sound?.muted ? 'Unmute sound' : 'Mute sound'}
              className="nav-drawer__tool"
            >
              <span aria-hidden="true">{sound?.muted ? '🔇' : '🔊'}</span>
              <span>SOUND {sound?.muted ? 'OFF' : 'ON'}</span>
            </button>
            {/*
              ONE row, opening the SAME panel the header button opens.

              This used to be two rows — a CYCLING "THEME · NEXT" and a CYCLING
              "BACKDROP · FOREST" — and motion, the third setting, had no row
              at all. So the drawer offered a third interaction model for two
              settings a visitor had already met as a sliding knob and a
              segmented control, and silently omitted the one they would want
              if the page felt busy.

              The theme row also hardcoded `['eclipse','ember','paper']`
              (D-10g), so a fourth theme would have been invisible here while
              appearing everywhere else. Nothing in this file knows the theme
              list any more.
            */}
            <button
              type="button"
              onClick={() => { setOpen(false); openAppearanceConsole({ source: 'drawer' }) }}
              className="nav-drawer__tool"
            >
              <span aria-hidden="true">◐</span>
              <span>Appearance</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                window.dispatchEvent(new CustomEvent('forge:toggle-recruiter'))
              }}
              className="nav-drawer__tool"
            >
              <span aria-hidden="true">◉</span>
              {/* D.1 — nobody knows what "recruiter mode" does before clicking
                  it. The label describes the PAGE, not the visitor. */}
              <span>Recruiter view — the short version</span>
            </button>
            <a
              href={RESUME_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-drawer__tool nav-drawer__tool--accent"
            >
              <span aria-hidden="true">↗</span>
              <span>RESUME</span>
            </a>
          </div>
        </div>
      </Drawer>
    </header>
  )
}
