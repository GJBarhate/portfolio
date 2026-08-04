import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from '../../lib/viewTransition.js'
import { getStore, setStore } from '../../lib/store.js'

// T-030 — the flag lives in the unified store's `prefs`, and index.html reads
// the same key before first paint so recruiter mode survives a reload without
// a frame of the full experience first.

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
  const [on, setOn] = useState(() => getStore().prefs.recruiter)

  useEffect(() => {
    const root = document.documentElement
    if (on) root.setAttribute('data-recruiter', '')
    else root.removeAttribute('data-recruiter')
    setStore({ prefs: { recruiter: on } })
  }, [on])

  const toggle = useCallback(() => {
    // The mode change should read as decisive, not a plain attribute flip —
    // a cross-fade + scale carries that without a second render tree.
    // startViewTransition snapshots the DOM when the callback returns, so
    // the state update must be flushed synchronously (Projects.jsx's
    // switchView established this pattern first).
    withViewTransition(
      () => {
        flushSync(() => {
          setOn((v) => {
            if (!v) window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'recruiter-mode' }))
            return !v
          })
        })
      },
      { mode: 'recruiter' }
    )
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
    // T-024 — below 26rem the chip leaves the header entirely (four 44px
    // controls plus a wordmark do not fit across 320px), so the drawer needs a
    // way to reach the same toggle. One event, one owner of the state.
    window.addEventListener('forge:toggle-recruiter', toggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('forge:toggle-recruiter', toggle)
    }
  }, [toggle])

  return (
    <>
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
        <span className="recruiter-chip__label">{on ? 'RECRUITER ON' : 'RECRUITER'}</span>
      </button>
      {on && <RecruiterBar onExit={toggle} />}
    </>
  )
}

/**
 * The visible half of the feature. Toggling a mode that only removes things is
 * indistinguishable from nothing happening, which is precisely the complaint
 * this answers: turning it on has to LOOK like a different site. So the mode
 * also adds — a fixed summary rail with the four numbers a screener is
 * actually checking, the résumé, and a direct email.
 */
function RecruiterBar({ onExit }) {
  return (
    <div className="recruiter-bar" role="region" aria-label="Recruiter summary">
      <div className="recruiter-bar__inner">
        <span className="recruiter-bar__badge font-mono">RECRUITER VIEW</span>

        <dl className="recruiter-bar__stats">
          {[
            ['1972', 'LEETCODE PEAK'],
            ['800+', 'PROBLEMS'],
            ['5', 'APPS LIVE'],
            ['2026', 'B.TECH CSE'],
          ].map(([value, label]) => (
            <div key={label} className="recruiter-bar__stat">
              <dt className="recruiter-bar__stat-label font-mono">{label}</dt>
              <dd className="recruiter-bar__stat-value font-display">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="recruiter-bar__actions">
          <a
            className="recruiter-bar__cta recruiter-bar__cta--primary font-mono"
            href="/Gaurav_Resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            RÉSUMÉ ↗
          </a>
          <a
            className="recruiter-bar__cta font-mono"
            href="mailto:gauravjbarhate554@gmail.com?subject=Opportunity%20for%20Gaurav"
          >
            EMAIL
          </a>
          <button type="button" className="recruiter-bar__cta font-mono" onClick={onExit}>
            EXIT
          </button>
        </div>
      </div>
    </div>
  )
}
