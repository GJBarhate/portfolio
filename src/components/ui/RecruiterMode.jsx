import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from '../../lib/viewTransition.js'
import { MOD_KEY, isApple } from '../../lib/platform.js'
import { isRecruiter, onRecruiterChange, setRecruiter } from '../../lib/recruiter.js'
import { AUTHOR, RESUME_PATH } from '../../lib/siteConfig.js'
import platformStats from '../../lib/platformStats.json'

/**
 * W1 — Recruiter Mode.
 *
 * 84 % of hiring managers say they want working applications, and portfolios
 * that take more than two seconds to load get bounced. This is the escape
 * hatch for the visitor who is here to evaluate, not to play: the arcade
 * chrome, the ambient GPU layer, the ghost numerals and every looping
 * animation fold away, leaving outcomes, screenshots, the timeline and the two
 * things they came for — the résumé and an email address.
 *
 * The state itself lives in `lib/recruiter.js` now, because it stopped being a
 * component's private boolean the moment `App` needed it to decide what to
 * *mount* (P2.5) and the pre-paint script needed to decide it from the URL
 * (P2.5b). This file is the chip and the summary rail.
 */
export default function RecruiterMode() {
  const [on, setOn] = useState(isRecruiter)

  // The attribute can change without this component doing it — from the URL at
  // pre-paint, from the palette, from the drawer, from ⌘⇧R.
  useEffect(() => onRecruiterChange(setOn), [])

  const toggle = useCallback(() => {
    // The mode change should read as decisive, not a plain attribute flip —
    // a cross-fade + scale carries that without a second render tree.
    // startViewTransition snapshots the DOM when the callback returns, so
    // the state update must be flushed synchronously (Projects.jsx's
    // switchView established this pattern first).
    withViewTransition(
      () => {
        flushSync(() => {
          const next = !isRecruiter()
          if (next) window.dispatchEvent(new CustomEvent('forge:unlock', { detail: 'recruiter-mode' }))
          setRecruiter(next)
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
        /* D.1 — the label describes the PAGE, not the visitor. Nobody
           self-identifies by pressing a button labelled with their job title,
           and "arcade chrome" is three words of internal vocabulary. */
        title={`A faster, quieter version of this page — results first (${MOD_KEY}${isApple ? '⇧' : '+Shift+'}R)`}
      >
        <span className="recruiter-chip__dot" aria-hidden="true" />
        <span className="recruiter-chip__label">{on ? 'Short version · on' : 'Short version'}</span>
      </button>
      {on && <RecruiterBar onExit={toggle} />}
    </>
  )
}

/**
 * The four numbers a screener actually reads — and the reason they are not
 * typed out here any more.
 *
 * They were four string literals (`'1972'`, `'800+'`, `'5'`, `'2026'`)
 * duplicating `lib/platformStats.json`, which has a `check:live` gate and a
 * `scripts/fetch-stats.mjs` behind it. The hardcoded copies escaped both. Of
 * everything on this page these are the worst four values to let go stale: a
 * screener who checks the LeetCode profile and finds a different rating has
 * learned something about the candidate's attention to detail, and it is not
 * the thing the number was there to say.
 *
 * `solved` is rounded down to a "+" figure deliberately — an exact count is
 * stale the day after it is fetched, and "800+" stays true for months.
 */
function headlineStats() {
  const rating = platformStats.leetcode?.rating
  const solved = platformStats.leetcode?.solved
  const solvedFloor = Number.isFinite(solved) ? `${Math.floor(solved / 100) * 100}+` : null

  return [
    rating ? [String(rating), 'LEETCODE PEAK'] : null,
    solvedFloor ? [solvedFloor, 'PROBLEMS'] : null,
    ['5', 'APPS LIVE'],
    ['2026', 'B.TECH CSE'],
  ].filter(Boolean)
}

/**
 * The visible half of the feature. Toggling a mode that only removes things is
 * indistinguishable from nothing happening, which is precisely the complaint
 * this answers: turning it on has to LOOK like a different site. So the mode
 * also adds — a fixed summary rail with the numbers a screener is actually
 * checking, the résumé, and a direct email.
 */
function RecruiterBar({ onExit }) {
  const stats = headlineStats()
  const verified = platformStats.lastUpdated
    ? new Date(platformStats.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="recruiter-bar" role="region" aria-label="Recruiter summary">
      <div className="recruiter-bar__inner">
        <span className="recruiter-bar__badge font-mono">The short version</span>

        <dl className="recruiter-bar__stats">
          {stats.map(([value, label]) => (
            <div key={label} className="recruiter-bar__stat">
              <dt className="recruiter-bar__stat-label font-mono">{label}</dt>
              <dd className="recruiter-bar__stat-value font-display">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="recruiter-bar__actions">
          {/* D-10k — `RESUME_PATH`, not a second copy of the same string. The
              Navbar already imported it from siteConfig; this file hardcoded
              `/Gaurav_Resume.pdf`, so renaming the file would have broken
              exactly one of the two links. */}
          <a
            className="recruiter-bar__cta recruiter-bar__cta--primary font-mono"
            href={RESUME_PATH}
            target="_blank"
            rel="noopener noreferrer"
          >
            Résumé ↗
          </a>
          {/* D.3.3 — a button's label is a verb or a destination. "EMAIL" is a
              noun describing a feature. */}
          <a
            className="recruiter-bar__cta font-mono"
            href={`mailto:${AUTHOR.email}?subject=${encodeURIComponent('Opportunity for Gaurav')}`}
          >
            Email me
          </a>
          {/* D.1 — "EXIT" implies leaving the site. */}
          <button type="button" className="recruiter-bar__cta font-mono" onClick={onExit}>
            Show everything
          </button>
        </div>

        {/* 8.5 — a number with no date behind it is a claim; a number with a
            date is evidence. A wrong number is worse than no number. */}
        {verified && (
          <p className="recruiter-bar__verified font-mono">Last verified {verified}</p>
        )}
      </div>
    </div>
  )
}
