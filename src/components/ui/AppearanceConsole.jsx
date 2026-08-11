/**
 * AppearanceConsole — one panel, three groups, thirty-six reachable states.
 *
 * This replaces six surfaces with four interaction models (see the header of
 * `lib/appearance.js` for the inventory). The design decisions worth recording:
 *
 * **A panel, not a popover.** Below 640 px it is a bottom sheet, because that
 * is where a thumb is; at and above 640 px it is an anchored dialog. One
 * component, one media query. The Theme Atelier it replaces was an absolutely
 * positioned popover that could not fit three groups on a phone at all, which
 * is a large part of why motion never got a control.
 *
 * **Live previews, not swatches.** Each theme card renders a miniature of the
 * actual hero — a name, an accent rule, a button, a card — in that theme's own
 * tokens. A three-stripe swatch tells you a theme has three colours in it; it
 * does not tell you what Ember *looks* like. This costs no JavaScript, because
 * it is pure tokens under a scoped `[data-theme]` on the card itself.
 *
 * **Every card states its consequence.** `Forest — a living scene. Costs the
 * most.` Honest performance labelling is a premium signal.
 *
 * **The WAI-ARIA radio-group pattern, not a pile of buttons.** Each group is a
 * `radiogroup`; arrow keys move *within* a group and select as they go, Tab
 * moves *between* groups, and only the checked radio is in the tab order. A
 * pile of eleven tab stops is what the Atelier was, and it is exhausting.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { claimOverlay, NOTICES, noticesPreference, setNotices } from '../../lib/overlayBus.js'
import {
  THEMES,
  SYSTEM_THEME,
  BACKDROPS,
  MOTIONS,
  getAppearance,
  onAppearanceChange,
  setTheme,
  setBackdrop,
  setMotion,
  restoreRecommended,
  OPEN_CONSOLE_EVENT,
} from '../../lib/appearance.js'
import { useSound } from '../../contexts/SoundContext.jsx'

const THEME_CARDS = [...THEMES, SYSTEM_THEME]

/**
 * Applies a change with the circular View-Transition sweep radiating from the
 * card that was clicked. Only the theme uses it — a backdrop or motion change
 * has no palette to reveal, and wrapping them in a transition just adds
 * latency to a control that should feel instant.
 */
function withSweep(el, apply) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (document.startViewTransition && !reduced && el) {
    const rect = el.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--vt-x', `${rect.left + rect.width / 2}px`)
    root.style.setProperty('--vt-y', `${rect.top + rect.height / 2}px`)
    document.startViewTransition(() => flushSync(apply))
  } else {
    apply()
  }
}

/**
 * One group. Rendered three times with different data rather than written
 * three times, which is what keeps the keyboard model identical across them —
 * the old system had three groups with three different models precisely
 * because each was hand-written.
 */
function Group({ label, hint, options, value, onSelect, renderCard, columns }) {
  const id = useId()
  const ref = useRef(null)

  /**
   * Arrow keys move within the group and select as they move, which is the
   * radio-group pattern: for a control whose entire effect is visible
   * immediately, "move then confirm" is a step with nothing behind it.
   */
  const onKeyDown = (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const delta = keys[e.key]
    if (delta === undefined && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const index = options.findIndex((o) => o.id === value)
    let next
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else next = (index + delta + options.length) % options.length
    onSelect(options[next].id, ref.current?.children[next])
    // Keep focus with the selection so the next arrow press continues from
    // where the visitor is, not from where they started. Deferred by a task
    // rather than a frame: `raf.js` owns the only requestAnimationFrame loop
    // on this site (the lint rule enforcing that is correct), and a focus move
    // has no business being on the render clock anyway.
    setTimeout(() => ref.current?.children[next]?.focus(), 0)
  }

  return (
    <section className="appearance__group">
      <h3 className="appearance__group-title" id={`${id}-label`}>{label}</h3>
      <div
        ref={ref}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="appearance__options"
        data-columns={columns}
        onKeyDown={onKeyDown}
      >
        {options.map((option) => {
          const checked = option.id === value
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              // Only the checked option is in the tab order — Tab moves
              // between the three groups, arrows move inside one.
              tabIndex={checked ? 0 : -1}
              data-checked={checked ? 'true' : 'false'}
              className="appearance__option"
              data-cursor="view"
              onClick={(e) => onSelect(option.id, e.currentTarget)}
            >
              {renderCard(option, checked)}
            </button>
          )
        })}
      </div>
      <p className="appearance__group-hint">{hint(value)}</p>
    </section>
  )
}

/**
 * `defaultOpen` is not a convenience — it is required for correctness.
 *
 * App mounts this component lazily, in response to the very event that is
 * supposed to open it. By the time the chunk has loaded and the listener below
 * is attached, that event is long gone, so a first open would mount an invisible
 * panel and do nothing. (The Command Palette carries the same prop for exactly
 * the same reason.) Every subsequent open goes through the listener.
 */
export default function AppearanceConsole({ defaultOpen = true, defaultAutoClose = 0 }) {
  const [open, setOpen] = useState(defaultOpen)
  /** ms, or 0 for a panel the visitor opened themselves (which never closes). */
  const [autoClose, setAutoClose] = useState(defaultAutoClose)
  const [state, setState] = useState(getAppearance)
  // P2.5 — notices lives in overlayBus.js, not appearance.js: it governs
  // interruptions, not theme/backdrop/motion, so it has no business in the
  // facade whose entire job is those three. `onAppearanceChange` therefore
  // does not cover it — this is its own bit of local state.
  const [notices, setNoticesState] = useState(noticesPreference)
  const sound = useSound()
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const titleId = useId()

  // The store is the source of truth, not this component: the palette, the
  // CLI and the OS media queries all change the same three values, and a panel
  // showing a stale selection is the exact class of small lie this whole phase
  // exists to remove.
  useEffect(() => onAppearanceChange(setState), [])

  /*
   * On the FIRST open the event fired before this component existed (see
   * `defaultOpen`), so there was nothing listening to record what to give
   * focus back to. It is captured on mount instead — while the lazy chunk was
   * in flight the trigger kept focus, so it is still `activeElement` here.
   */
  useEffect(() => {
    restoreRef.current = document.activeElement
  }, [])

  // ── The one door ────────────────────────────────────────────────────────
  useEffect(() => {
    const onOpen = (e) => {
      restoreRef.current = document.activeElement
      setOpen(true)
      setAutoClose(e?.detail?.autoClose ?? 0)
    }
    window.addEventListener(OPEN_CONSOLE_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CONSOLE_EVENT, onOpen)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    // Focus goes back to whatever opened it. A dialog that dumps focus on
    // <body> when it closes sends a keyboard user back to the top of the page.
    const restore = restoreRef.current
    if (restore?.isConnected) setTimeout(() => restore.focus?.(), 0)
  }, [])

  /*
   * P9.2 — the first-run reveal closes itself, and it SPENDS one of the
   * Do-Not-Disturb budget's two interruptions.
   *
   * Claiming the overlay slot is not bookkeeping here: it is what stops the
   * site's own opening move from landing on top of the coach chip or the
   * welcome-back toast, and what makes the budget honest. An interruption the
   * site chooses to make has to be counted like any other, or the "at most two
   * per session" contract is two plus however many the site exempts itself.
   *
   * Any interaction cancels it — a visitor who has started choosing a theme is
   * no longer being shown something, they are using it.
   */
  useEffect(() => {
    if (!open || !autoClose) return
    const release = claimOverlay('first-run-appearance', {
      ttl: autoClose,
      once: true,
      onExpire: () => { setAutoClose(0); close() },
    })
    if (!release) { setAutoClose(0); return }
    return () => release()
  }, [open, autoClose, close])


  // ── Escape, click-outside, and a real focus trap ────────────────────────
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    // Focus the panel itself rather than the first radio: landing on a control
    // that changes the page the moment an arrow key is pressed is startling,
    // and the heading is what tells the visitor where they are.
    setTimeout(() => panel?.focus(), 0)

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return }
      if (e.key !== 'Tab' || !panel) return
      const focusables = panel.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    const onDown = (e) => {
      if (!panel?.contains(e.target)) close()
    }
    document.addEventListener('keydown', onKey, true)
    // `pointerdown` on the next tick, so the click that OPENED the panel does
    // not immediately close it again.
    const id = setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, close])

  const pickTheme = (id, el) => {
    // A visitor who is choosing is no longer being shown; stop the timer.
    setAutoClose(0)
    if (id === state.themePreference) return
    withSweep(el, () => setTheme(id))
    sound?.play('themeSwitch')
    window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'shapeshifter' }))
  }

  const pickBackdrop = (id) => {
    setAutoClose(0)
    if (id === state.backdrop) return
    setBackdrop(id)
    sound?.play('click')
  }

  const pickMotion = (id) => {
    setAutoClose(0)
    if (id === state.motion) return
    setMotion(id)
    sound?.play('click')
  }

  const pickNotices = (id) => {
    setAutoClose(0)
    if (id === notices) return
    setNotices(id)
    setNoticesState(id)
    sound?.play('click')
  }

  if (!open) return null

  return (
    <div className="appearance-scrim" data-open="true">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="appearance"
      >
        <header className="appearance__head">
          <h2 id={titleId} className="appearance__title">Appearance</h2>
          <button
            type="button"
            onClick={close}
            className="appearance__close"
            aria-label="Close appearance settings"
            data-cursor="view"
          >
            ×
          </button>
        </header>

        <Group
          label="Theme"
          columns={4}
          options={THEME_CARDS}
          value={state.themePreference}
          onSelect={pickTheme}
          hint={(value) => THEME_CARDS.find((t) => t.id === value)?.meaning ?? ''}
          renderCard={(theme, checked) => (
            <>
              {/*
                The live preview. `data-theme` on this element scopes the whole
                token set to the card, so these four rows are rendered in the
                real palette — the same variables the page itself uses — rather
                than in three hand-picked hex values that will drift.
              */}
              <span
                className="appearance__preview"
                data-theme={theme.id === 'system' ? undefined : theme.id}
                data-system={theme.id === 'system' ? 'true' : undefined}
                aria-hidden="true"
              >
                <span className="appearance__preview-name" />
                <span className="appearance__preview-rule" />
                <span className="appearance__preview-row">
                  <span className="appearance__preview-btn" />
                  <span className="appearance__preview-card" />
                </span>
              </span>
              <span className="appearance__option-label">
                {theme.label}
                {checked && <span className="appearance__dot" aria-hidden="true">●</span>}
              </span>
              {/* P1.4 — the default is framed as the intended experience. */}
              {theme.recommended && <span className="appearance__rec">Recommended</span>}
            </>
          )}
        />

        <Group
          label="Backdrop"
          columns={3}
          options={BACKDROPS}
          value={state.backdrop}
          onSelect={pickBackdrop}
          hint={(value) => {
            const b = BACKDROPS.find((x) => x.id === value)
            if (!b) return ''
            return b.detail ? `${b.meaning}. ${b.detail}` : `${b.meaning} — ${b.cost.toLowerCase()}.`
          }}
          renderCard={(backdrop, checked) => (
            <>
              <span className="appearance__glyph" aria-hidden="true">{backdrop.glyph}</span>
              <span className="appearance__option-label">
                {backdrop.label}
                {checked && <span className="appearance__dot" aria-hidden="true">●</span>}
              </span>
              <span className="appearance__cost">{backdrop.cost}</span>
              {backdrop.recommended && <span className="appearance__rec">Recommended</span>}
            </>
          )}
        />

        <Group
          label="Motion"
          columns={4}
          options={MOTIONS}
          value={state.motion}
          onSelect={pickMotion}
          hint={(value) => MOTIONS.find((m) => m.id === value)?.meaning ?? ''}
          renderCard={(motion, checked) => (
            <span className="appearance__option-label">
              {motion.label}
              {checked && <span className="appearance__dot" aria-hidden="true">●</span>}
            </span>
          )}
        />

        {/*
          P2.5 — Do Not Disturb, made explicit. `brief` (the default) already
          satisfies the "gone within a second, no cross to click" brief on its
          own; this row exists for the visitor who wants either more time
          (WCAG 2.2.1) or none at all.
        */}
        <Group
          label="Notices"
          columns={3}
          options={NOTICES}
          value={notices}
          onSelect={pickNotices}
          hint={(value) => NOTICES.find((n) => n.id === value)?.meaning ?? ''}
          renderCard={(notice, checked) => (
            <span className="appearance__option-label">
              {notice.label}
              {checked && <span className="appearance__dot" aria-hidden="true">●</span>}
            </span>
          )}
        />

        <footer className="appearance__foot">
          {/*
            P1.5 — the escape hatch that makes the v1→v2 migration safe to
            ship. That migration has to guess whether an old stored backdrop
            was chosen or inherited; this makes a wrong guess cost one click.
          */}
          <button
            type="button"
            className="appearance__restore"
            onClick={() => { restoreRecommended(); sound?.play('click') }}
            data-cursor="view"
          >
            Restore recommended
          </button>
          {/* Pre-empts the question a privacy-minded visitor would otherwise
              have to guess at, and it is the truth: there is no account, no
              sync and no request. */}
          <p>Saved on this device. Nothing leaves your browser.</p>
          <p className="appearance__shortcut">
            <kbd>Shift</kbd> + <kbd>A</kbd> opens this panel
          </p>
        </footer>
      </div>
    </div>
  )
}
