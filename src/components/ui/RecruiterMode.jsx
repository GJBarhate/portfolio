import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { withViewTransition } from '../../lib/viewTransition.js'
import { MOD_KEY, isApple } from '../../lib/platform.js'
import { isRecruiter, onRecruiterChange, setRecruiter } from '../../lib/recruiter.js'
import { AUTHOR, RESUME_PATH } from '../../lib/siteConfig.js'
import { STATS } from '../../lib/content.js'
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
 * The rating is the one figure `lib/platformStats.json` can answer honestly
 * — it has a `check:live` gate and a `scripts/fetch-stats.mjs` behind it, so
 * it never drifts from the real LeetCode profile. The problems-solved count
 * used to be derived from that same file's `leetcode.solved` alone, rounded
 * down to a "+" figure — which is accurate for LeetCode specifically, but
 * read as a contradiction next to every other mention of this stat on the
 * site, all of which report the cross-platform total (LeetCode + CodeChef +
 * GFG) that lives in `STATS` (`lib/content.js`). Two different-but-true
 * numbers under the same unqualified "PROBLEMS" label is worse than one
 * number that is merely static: it looks like the site does not agree with
 * itself. This reads the same `STATS` entry everything else on the page
 * does, so there is exactly one number to keep current, not two.
 */
function headlineStats() {
  const rating = platformStats.leetcode?.rating
  const problems = STATS.find((s) => s.label === 'Problems Solved')
  const problemsValue = problems ? `${problems.value}${problems.suffix}` : null

  return [
    rating ? [String(rating), 'LEETCODE PEAK'] : null,
    problemsValue ? [problemsValue, 'PROBLEMS'] : null,
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
  const barRef = useRef(null)

  /*
   * Publish the real bar height as `--recruiter-bar-h`, the same pattern
   * `Navbar.jsx` already uses for `--header-h`.
   *
   * `body`'s reserved space under the bar was a flat 84px guess. The bar's
   * stats row and its actions row both wrap independently (`flex-wrap`) once
   * four stats and three real touch-target-sized buttons no longer fit one
   * line — which happens at ordinary laptop widths, not just narrow phones —
   * so a static number is only ever right by accident. A ResizeObserver
   * tracks whatever the bar's content actually needs, at any width, any
   * font-loading state, any stat-label length.
   */
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const publish = () => {
      const h = bar.getBoundingClientRect().height
      document.documentElement.style.setProperty('--recruiter-bar-h', `${Math.round(h)}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(bar)
    // Belt and suspenders: a viewport resize/orientation change is exactly
    // the case this exists for, and it should never depend on a single
    // observer implementation noticing the knock-on reflow.
    window.addEventListener('resize', publish)
    window.addEventListener('orientationchange', publish)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', publish)
      window.removeEventListener('orientationchange', publish)
      document.documentElement.style.removeProperty('--recruiter-bar-h')
    }
  }, [])

  return (
    <div ref={barRef} className="recruiter-bar" role="region" aria-label="Recruiter summary">
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
      </div>
    </div>
  )
}
