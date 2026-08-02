import { useCallback, useEffect, useState } from 'react'

const KEY = 'forge-recruiter'

/**
 * W1 — Recruiter Mode.
 *
 * 84% of hiring managers say they want working applications, and portfolios
 * that take more than two seconds to load get bounced (Research #14). This is
 * the escape hatch for the visitor who is here to evaluate, not to play: the
 * arcade chrome, the ambient GPU layer, the ghost numerals and every looping
 * animation fold away, leaving outcomes, screenshots, the timeline and the two
 * things they came for — the résumé and an email address.
 *
 * It is the only feature on the wow list that makes the page do LESS work: all
 * of it is a `data-recruiter` attribute on <html> and the CSS that responds to
 * it. There is no second render tree to maintain.
 */
export default function RecruiterMode() {
  const [on, setOn] = useState(() => {
    try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    const root = document.documentElement
    if (on) root.setAttribute('data-recruiter', '')
    else root.removeAttribute('data-recruiter')
    try { sessionStorage.setItem(KEY, on ? '1' : '0') } catch { /* private mode */ }
  }, [on])

  const toggle = useCallback(() => {
    setOn((v) => {
      if (!v) window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'recruiter-mode' }))
      return !v
    })
  }, [])

  // ⌘R / Ctrl+R is browser reload, so the shortcut is ⌘⇧R's neighbour: the
  // plan's "⌘R" cannot be captured reliably without breaking reload, and
  // breaking reload on a portfolio is not a trade worth making.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <button
      type="button"
      onClick={toggle}
      data-on={on}
      data-cursor="view"
      className="recruiter-chip"
      aria-pressed={on}
      title="Recruiter mode — outcome-first, no arcade chrome (⌘⇧R)"
    >
      <span className="recruiter-chip__dot" aria-hidden="true" />
      {on ? 'RECRUITER ON' : 'RECRUITER'}
    </button>
  )
}
