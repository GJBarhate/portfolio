/**
 * Which modifier key this visitor actually has — D-34.
 *
 * The site advertised `⌘K` in the header, the drawer, the coach mark and the
 * console banner, on every platform. On Windows that glyph reads as the
 * Windows key, and `Win+K` is an operating-system shortcut (Cast) that the
 * page never receives — so the reported symptom is "the shortcut does
 * nothing", and it is the label that is wrong rather than the handler.
 *
 * `navigator.userAgentData.platform` where it exists, `navigator.platform`
 * where it does not. Both are advisory, and both are wrong far less often
 * than a hardcoded `⌘`.
 */

function rawPlatform() {
  if (typeof navigator === 'undefined') return ''
  return (
    navigator.userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    ''
  )
}

export const isApple = /mac|iphone|ipad|ipod/i.test(rawPlatform())

/** The glyph to print in a `<kbd>`: `⌘` on Apple, `Ctrl` everywhere else. */
export const MOD_KEY = isApple ? '⌘' : 'Ctrl'

/** A complete, printable shortcut label — `⌘K` or `Ctrl K`. */
export const shortcut = (key) => (isApple ? `${MOD_KEY}${key.toUpperCase()}` : `${MOD_KEY} ${key.toUpperCase()}`)

/**
 * The palette's label — D-34.2. Just `/`.
 *
 * D-34 fixed the LABEL (`⌘K` printed on Windows, where that glyph reads as the
 * Windows key) and left the binding alone. The binding was the other half of
 * the problem, and on Windows it fails twice over:
 *
 *   Win+K   is an OS shortcut (Cast). The page never receives the event, so
 *           the reach that feels natural — the modifier next to space — is a
 *           reach the site cannot answer no matter what it advertises.
 *   Ctrl+K  is taken by the BROWSER. Chrome focuses the omnibox in search
 *           mode; Firefox focuses the search bar. A page can preventDefault it,
 *           but competing with the user agent for a keystroke the user agent
 *           claimed first is a fight worth losing on purpose.
 *
 * So `⌘K`/`Ctrl+K` is gone rather than relabelled again. `/` is what a visitor
 * who has used any search-first site already tries, it needs no modifier, and
 * nothing else claims it. `Ctrl/⌘ + /` stays as the modifier form for anyone
 * who reaches for one out of habit — no browser or OS claims that pair.
 */
export const PALETTE_HINT = '/'

/**
 * `aria-keyshortcuts` takes the platform-neutral form and may list
 * alternatives, so assistive tech can announce whichever the visitor has.
 */
export const PALETTE_KEYSHORTCUTS = 'Slash Control+Slash Meta+Slash'

/** True while the keystroke belongs to whatever the visitor is typing into. */
export function isTypingTarget(target) {
  const el = target
  if (!el || !el.tagName) return false
  if (el.isContentEditable) return true
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

/**
 * Does this keydown mean "open the command palette"?
 *
 *   /            bare, outside a text field — the primary binding
 *   ⌘/ or Ctrl+/ for anyone who reaches for a modifier by habit
 *
 * See PALETTE_HINT for why `⌘K`/`Ctrl+K` is no longer one of them.
 *
 * Bare `/` is only honoured outside a text field, or it would eat the
 * character every time somebody types a URL into the contact form. The
 * modifier form is honoured everywhere, because `Ctrl+/` types nothing.
 */
export function isPaletteShortcut(e) {
  if (e.defaultPrevented || e.altKey) return false
  const key = e.key || ''
  if (key !== '/') return false
  if (e.metaKey || e.ctrlKey) return true
  return !isTypingTarget(e.target)
}
