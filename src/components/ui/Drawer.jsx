import { useCallback, useEffect, useRef } from 'react'
import { lockScroll } from '../../lib/scrollLock.js'

/**
 * Drawer — T-026. The mobile navigation, as a real dialog.
 *
 * What this replaces was a `<div>` with `data-open` and a `grid-template-rows`
 * transition. The transition technique is genuinely good — `height: auto`
 * cannot be animated and `grid-template-rows: 0fr → 1fr` can — so it is kept.
 * What was missing was every piece of dialog *semantics*: no focus trap, no
 * `inert` on the rest of the page, no scroll lock, no `aria-modal`, no Escape
 * handler, no focus restoration. This is the primary navigation for every
 * phone visitor, and a keyboard user could tab straight through it into the
 * page behind.
 *
 * Native `<dialog>` + `showModal()` supplies the focus trap, the Escape
 * handler, the top-layer stacking and `::backdrop` — all Baseline, all
 * correct, none of it ours to get wrong. What is left for us:
 *
 *   · `inert` on <main> and the header, because the top layer stops *clicks*
 *     reaching the page behind but not screen-reader traversal
 *   · a scroll lock that preserves and restores `scrollY`, because iOS Safari
 *     loses the scroll position on a naive body lock
 *   · drag-to-dismiss, which is what a sheet is expected to do in 2026 — its
 *     absence reads as "a website" rather than "an app"
 */
export default function Drawer({ open, onClose, labelledBy, children, id = 'nav-drawer' }) {
  const dialogRef = useRef(null)
  const sheetRef = useRef(null)
  const restoreRef = useRef(null)
  const dragRef = useRef({ startY: 0, lastY: 0, startTime: 0, dragging: false })

  const close = useCallback(() => onClose?.(), [onClose])

  // ── open / close, and the focus that goes with it ───────────────────────
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      restoreRef.current = document.activeElement
      try { dialog.showModal() } catch { /* already open */ }
    } else if (!open && dialog.open) {
      dialog.close()
      // Return focus to whatever opened it — the burger, in practice. A modal
      // that drops focus to <body> on close strands a keyboard user at the
      // top of the document.
      const restore = restoreRef.current
      if (restore && document.contains(restore)) setTimeout(() => restore.focus(), 0)
    }
  }, [open])

  // ── inert + scroll lock ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const main = document.getElementById('main')
    const header = document.querySelector('.site-header')

    if (main) main.inert = true
    if (header) header.inert = true

    // D-40 — the lock, its iOS body-fixed fallback and the scroll restore all
    // moved into `lib/scrollLock.js`, unchanged in behaviour. They live there
    // because two other overlays needed the same thing and wrote their own
    // versions, one of which locked nothing and one of which locked nothing
    // because it did not try. The shared one is ref-counted, so a case study
    // opened over this drawer cannot unlock the page when it closes.
    const unlock = lockScroll()

    return () => {
      if (main) main.inert = false
      if (header) header.inert = false
      unlock()
    }
  }, [open])

  // ── drag to dismiss ─────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return
    const sheet = sheetRef.current
    // Only start a drag from the top of the sheet, so a list that scrolls
    // inside the drawer still scrolls.
    if (sheet && sheet.scrollTop > 0) return
    dragRef.current = { startY: e.clientY, lastY: e.clientY, startTime: performance.now(), dragging: true }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag.dragging) return
    const dy = e.clientY - drag.startY
    drag.lastY = e.clientY
    if (dy <= 0) return
    // Written straight to a custom property: no React commit per pointer
    // event, which is the rule for every gesture on this site (T-055).
    sheetRef.current?.style.setProperty('--drag-y', `${dy}px`)
  }

  const endDrag = (e) => {
    const drag = dragRef.current
    if (!drag.dragging) return
    drag.dragging = false
    const dy = (e?.clientY ?? drag.lastY) - drag.startY
    const dt = Math.max(1, performance.now() - drag.startTime)
    const velocity = dy / dt // px per ms
    sheetRef.current?.style.removeProperty('--drag-y')
    // Either far enough or fast enough. Distance alone makes a flick feel
    // ignored; velocity alone makes a slow deliberate pull feel broken.
    if (dy > 120 || velocity > 0.5) close()
  }

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className="drawer"
      aria-label={labelledBy ? undefined : 'Navigation'}
      aria-labelledby={labelledBy}
      onClose={close}
      onCancel={(e) => { e.preventDefault(); close() }}
      onPointerDown={(e) => { if (e.target === dialogRef.current) close() }}
    >
      <div
        className="drawer__sheet"
        ref={sheetRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="drawer__grabber" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  )
}
