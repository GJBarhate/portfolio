/**
 * recruiter.js — P2.5. Recruiter Mode as a real mode.
 *
 * ── What it was ───────────────────────────────────────────────────────────
 *
 * `data-recruiter` on `<html>` plus ~20 `display: none` rules. The component's
 * own docstring said so with some pride: "all of it is a `data-recruiter`
 * attribute on <html> and the CSS that responds to it. There is no second
 * render tree to maintain."
 *
 * That was the right call for the goal it was written against — *no second
 * render tree* — and it is the wrong call for the goal that matters now. The
 * arcade FAB, the XP bar, the level ribbon, the level map, the spark provider,
 * the idle easter egg, the exit intent and the corner clock were all still
 * mounted, still subscribed to the frame loop, and in the clock's case still
 * holding a WebGL context. Recruiter Mode made the page look like it was doing
 * less while doing exactly as much.
 *
 * The whole point of the mode is a visitor with about forty seconds and,
 * frequently, a phone on a train. `display: none` does not give them back a
 * millisecond.
 *
 * ── The URL door (D-10j / P2.5b) ──────────────────────────────────────────
 *
 * The mode had three doors — a header chip, ⌘⇧R, and a drawer event — and all
 * three require the visitor to already be here and to already want it. The one
 * traffic source that should land in it directly is a job board or a LinkedIn
 * click, and that traffic arrives with `?ref=` or `utm_source` attached.
 *
 * The resolution happens in `index.html`'s pre-paint script, next to the store
 * read, and NOT here — if React decided it, the full experience would paint for
 * one frame first, which is the exact thing the pre-paint script exists to
 * prevent. This module is the runtime half: it reads what the attribute already
 * says, keeps the store in step, and publishes changes.
 */
import { getStore, setStore, subscribe } from './store.js'

const listeners = new Set()

/**
 * Sources that mean "someone is evaluating me", not "someone is browsing".
 *
 * Deliberately a short, boring list of things that are unambiguously hiring
 * funnels. A `ref` this does not recognise is treated as ordinary traffic:
 * guessing wrong in that direction costs a visitor nothing, and guessing wrong
 * in the other direction hides the site's actual work from someone who came to
 * look at it.
 */
export const RECRUITER_REFERRERS = [
  'linkedin', 'lnkd', 'indeed', 'naukri', 'glassdoor', 'wellfound',
  'angellist', 'hired', 'monster', 'shine', 'internshala', 'cutshort',
  'instahyre', 'hirist', 'jobs', 'recruiter', 'hiring', 'resume', 'cv',
]

/** True when this URL asks for the short version. */
export function recruiterFromUrl(search = typeof location !== 'undefined' ? location.search : '') {
  try {
    const params = new URLSearchParams(search)
    // An explicit switch always wins, in both directions — `?recruiter=0` is
    // how someone shares the full site from a link that carried a `ref`.
    const explicit = params.get('recruiter')
    if (explicit === '1' || explicit === 'true') return true
    if (explicit === '0' || explicit === 'false') return false

    const source = (params.get('ref') || params.get('utm_source') || '').toLowerCase()
    if (!source) return false
    return RECRUITER_REFERRERS.some((needle) => source.includes(needle))
  } catch {
    return false
  }
}

/** The current answer. `<html data-recruiter>` is the authority at runtime. */
export function isRecruiter() {
  if (typeof document === 'undefined') return false
  return document.documentElement.hasAttribute('data-recruiter')
}

/**
 * Set the mode, publish it, and persist it.
 *
 * `persist: false` is for a URL-driven activation: someone who arrived from a
 * job board should get the short version *this visit* without having their
 * saved preference silently rewritten. If they later toggle it by hand, that
 * is a choice and it is remembered.
 */
export function setRecruiter(on, { persist = true } = {}) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (on) root.setAttribute('data-recruiter', '')
  else root.removeAttribute('data-recruiter')
  if (persist) setStore({ prefs: { recruiter: on } })
  for (const fn of listeners) {
    try { fn(on) } catch { /* a bad listener must not wedge the toggle */ }
  }
  root.dispatchEvent(new CustomEvent('forge:recruiter-changed', { bubbles: false, detail: on }))
}

export function onRecruiterChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Reconcile the attribute the pre-paint script wrote with the store.
 *
 * The pre-paint script may have turned the mode on from the URL without
 * touching localStorage; this makes the React tree agree with what is already
 * on screen rather than fighting it.
 */
export function installRecruiter() {
  if (typeof window === 'undefined') return () => {}
  const fromUrl = recruiterFromUrl()
  const stored = getStore().prefs.recruiter
  const active = isRecruiter() || fromUrl || stored
  // `persist` only when the store already agreed — see setRecruiter.
  setRecruiter(active, { persist: stored === active })

  /*
   * Follow the store only when the STORE CHANGES — not whenever it disagrees
   * with the DOM.
   *
   * The first version compared `state.prefs.recruiter !== isRecruiter()`, which
   * looks equivalent and is not. A URL-activated session has the attribute on
   * and the stored preference off, by design (see `persist` above), so the two
   * legitimately disagree for the whole visit. Under that rule, the very next
   * write to the store from anywhere — `markSeen`, the `lastVisit` stamp, a
   * theme change — dragged recruiter mode back off. A visitor arriving from
   * LinkedIn got the short version for about a second.
   *
   * Comparing against the last value this subscription saw means an unrelated
   * write is ignored and an actual toggle is followed.
   */
  let lastStored = stored
  const offStore = subscribe((state) => {
    const next = state.prefs.recruiter
    if (next === lastStored) return
    lastStored = next
    setRecruiter(next)
  })
  return offStore
}
