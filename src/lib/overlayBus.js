/**
 * The interruption arbiter — D-47, extended by P2 into a real contract.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 *
 *   Do Not Disturb. At most TWO uninvited overlays per session. ZERO in
 *   Recruiter Mode. Every overlay auto-dismisses. Every dismissal is
 *   remembered for 30 days. Nothing appears in the first 10 seconds.
 *
 * ── Why it had to move into the bus ───────────────────────────────────────
 *
 * The first version of this file did one job — one holder at a time — and did
 * it correctly. What it could not do was stop the site from being *polite
 * eight times*. Eight components can appear uninvited: the coach chip,
 * run-complete, the achievement toast, the time suggestion, welcome-back,
 * exit-intent, spark-complete and the idle easter egg. Serialising eight
 * interruptions is still eight interruptions.
 *
 * Every one of the missing behaviours had been left to the components, and
 * `SparkCompleteToast` is the proof that this does not work. It (1) never
 * claimed the slot at all, so it could land underneath a card whose backdrop
 * swallowed its own dismiss button — literally the reported "the popup comes
 * but does not go"; (2) stored nothing on dismissal, so it returned 800 ms
 * after every subsequent page load, forever; (3) had no timer, no Escape and
 * no click-outside; and (4) was rendered outside the `!recruiter` guard.
 *
 * Four independent faults in one 30-line component. The lesson is not that
 * this component was careless — it is that a policy which every component has
 * to re-implement is a policy that some component will not implement. So the
 * TTL, the budget, the recruiter refusal, the quiet period and the "once"
 * memory all live here, where a component cannot forget them.
 */
import { getStore, hasSeen, markSeen, setStore } from './store.js'

const listeners = new Set()
let holder = null
let holderPriority = -1
let holderSince = 0
let holderTimer = null
let holderRelease = null

/** How many uninvited overlays have been granted this page view. */
let spent = 0

/*
 * DND v2 — P2.1/P2.5. The numbers, and why each one is what it is.
 *
 * The budget used to be a single constant (2). It is now a policy keyed by
 * `prefs.notices`, because the brief's "gone within a second, no cross to
 * click" and WCAG 2.2.1's "a visitor may need more time to read it" are both
 * legitimate and they pull in opposite directions — the only way to satisfy
 * both is to make the dwell adjustable rather than picking one number.
 *
 *   brief    budget 1, ttl 2200    One moment of personality per visit, not
 *                                  two — two was already the ceiling before
 *                                  it read as a site that wants something,
 *                                  and the first-run choreography (§9) spends
 *                                  one of them by design. 2200 ms matches
 *                                  GameContext's achievement toast, the one
 *                                  that has always felt right: long enough to
 *                                  read four words and a number, short enough
 *                                  to be gone before it is annoying.
 *   longer   budget 2, ttl 22000   Exactly 10x brief's TTL — the WCAG 2.2.1
 *                                  "Timing Adjustable" threshold — for anyone
 *                                  who explicitly asked for more time. Budget
 *                                  also relaxes to 2, because "give me longer
 *                                  to read things" and "limit how many things
 *                                  appear" are different asks.
 *   off      budget 0              `claimOverlay` refuses unconditionally,
 *                                  the same code path as Recruiter Mode.
 *
 * The multiplier applies to every claim's ttl, not only the ones that omit it
 * — `Infinity * 10` is still `Infinity` in JS, so budgeted:false claims
 * (Achievement, RunComplete) are unaffected for free.
 */
export const NOTICES = [
  { id: 'brief', label: 'Brief', meaning: 'A moment, then gone (default)' },
  { id: 'longer', label: 'Longer', meaning: 'Stays until you have read it' },
  { id: 'off', label: 'Off', meaning: 'Nothing appears uninvited' },
]
export const DEFAULT_NOTICES = 'brief'
export const DEFAULT_TTL = 2200
export const ACTIONABLE_TTL = 8000

const NOTICES_POLICY = {
  brief: { budget: 1, multiplier: 1 },
  longer: { budget: 2, multiplier: 10 },
  off: { budget: 0, multiplier: 0 },
}

/** The stored notices preference, falling back to the default. */
export function noticesPreference() {
  const stored = getStore().prefs?.notices
  return NOTICES.some((n) => n.id === stored) ? stored : DEFAULT_NOTICES
}

function policy() {
  return NOTICES_POLICY[noticesPreference()] || NOTICES_POLICY[DEFAULT_NOTICES]
}

/** Persist and publish `html[data-notices]`, exactly like the other three settings. */
export function setNotices(mode) {
  const value = NOTICES.some((n) => n.id === mode) ? mode : DEFAULT_NOTICES
  setStore({ prefs: { ...getStore().prefs, notices: value } })
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.notices = value
    document.documentElement.dispatchEvent(
      new CustomEvent('forge:notices-changed', { bubbles: false, detail: value })
    )
  }
}

/** Wire the stored preference onto the DOM once, from App — mirrors installBgScene. */
export function installNotices() {
  if (typeof document === 'undefined') return () => {}
  document.documentElement.dataset.notices = noticesPreference()
  return () => {}
}

/** Two, kept for anything still reading the old export name. Prefer `policy().budget`. */
export const SESSION_BUDGET = NOTICES_POLICY.brief.budget

/**
 * Nothing for the first 10 seconds after load.
 *
 * The measured failure was the coach chip landing at 8 s — timed from the idle
 * callback, which on a phone fires while the hero is still assembling. An
 * interruption during the entrance is not an interruption, it is a glitch.
 */
export const QUIET_PERIOD_MS = 10_000

/**
 * A claim may only pre-empt a holder that has been visible for less than this.
 *
 * D-10f: `achievement` (2) outranks `time-suggestion` (1), so it could take the
 * slot from a toast that was 200 ms into its entrance animation — the first
 * toast would vanish mid-fade and the second would appear in its place, which
 * reads as a rendering bug rather than as a priority decision. Priority now
 * decides who wins a *contest*, not who can interrupt something the visitor
 * has already started reading.
 */
export const PREEMPT_WINDOW_MS = 400

/** 30 days — long enough that "I have seen this" survives a job hunt. */
export const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Higher wins. Anything not listed is 0. */
const PRIORITY = {
  'coach': 0,
  'welcome-back': 1,
  'time-suggestion': 1,
  // P2.3 — the two that never registered. `spark-complete` is the D-4 bug;
  // `idle-easter-egg` simply never asked. An unlisted id defaulted to 0, which
  // is a defensible fallback and a terrible way to find out you forgot.
  'idle-easter-egg': 0,
  'spark-complete': 2,
  'achievement': 2,
  'run-complete': 3,
  'exit-intent': 3,
}

/** When the page finished loading — the quiet period is measured from here. */
const startedAt = typeof performance !== 'undefined' ? performance.now() : 0

function publish() {
  if (typeof document !== 'undefined') {
    if (holder) document.documentElement.dataset.overlay = holder
    else delete document.documentElement.dataset.overlay
  }
  for (const fn of listeners) {
    try { fn(holder) } catch { /* a bad listener must not wedge the bus */ }
  }
}

/** Recruiter Mode refuses everything, unconditionally. */
const recruiterActive = () =>
  typeof document !== 'undefined' && document.documentElement.hasAttribute('data-recruiter')

/**
 * P2.5 — `Notices: Off` refuses everything, unconditionally — the SAME code
 * path as Recruiter Mode, including claims that would otherwise skip the
 * budget check (`budgeted: false`). A visitor who turned notices off does not
 * want to see WHY a toast is uninvited; "off" means off.
 */
const noticesOffActive = () => noticesPreference() === 'off'

function clearHolder() {
  if (holderTimer) { clearTimeout(holderTimer); holderTimer = null }
  holder = null
  holderPriority = -1
  holderSince = 0
  holderRelease = null
  publish()
}

/**
 * Ask for the overlay slot.
 *
 * @param {string} id
 * @param {object} [options]
 * @param {number} [options.ttl] ms after which the BUS releases the slot and
 *   calls `onExpire`. Defaults to the current notices mode's base dwell
 *   (2200 ms at `brief`). Whatever value is passed — default or explicit — is
 *   scaled by the notices multiplier (1x brief, 10x longer), so a component
 *   never has to know which mode is active. Pass `Infinity` only for an
 *   overlay the visitor explicitly opened (which is not an interruption and
 *   should not be using this module) — `Infinity * multiplier` is still
 *   `Infinity`, so this is safe unconditionally.
 * @param {boolean} [options.once] remember the grant, and never grant again
 *   within {@link SEEN_TTL_MS}.
 * @param {number} [options.seenTtl] override that window for this overlay.
 *   Exit-intent uses 90 days rather than 30: an "are you leaving?" prompt is
 *   the one interruption whose second appearance is worse than its first.
 * @param {boolean} [options.budgeted] whether this claim spends one of the
 *   session's budget (1 at `brief`, 2 at `longer`). Defaults to true; `false`
 *   is for an overlay the visitor's own action earned (Achievement,
 *   RunComplete) — but `Notices: Off` still refuses it, see `noticesOffActive`.
 * @param {() => void} [options.onExpire] called when the TTL fires, so the
 *   component can animate itself out. It is called exactly once.
 * @returns {(() => void) | null} the release function, or null if refused.
 *   Releasing twice is a no-op, so it is safe to hand to a React cleanup.
 */
export function claimOverlay(id, options = {}) {
  const {
    ttl,
    once = false,
    seenTtl = SEEN_TTL_MS,
    budgeted = true,
    onExpire,
  } = options

  // ── the refusals, cheapest first ────────────────────────────────────────

  // Zero in Recruiter Mode. Not "styled away" — refused, so the component
  // renders nothing and costs nothing.
  if (recruiterActive()) return null

  // Zero at `Notices: Off`, unconditionally — see noticesOffActive's comment.
  if (noticesOffActive()) return null

  const { budget, multiplier } = policy()
  const effectiveTtl = (ttl === undefined ? DEFAULT_TTL : ttl) * multiplier

  // Nothing during the entrance.
  if (budgeted && typeof performance !== 'undefined' && performance.now() - startedAt < QUIET_PERIOD_MS) {
    return null
  }

  // Already seen, and it was a once-only.
  if (once && hasSeen(`overlay:${id}`, seenTtl)) return null

  // The budget is spent. Re-claiming while already holding is free — a
  // component that re-renders must not be charged twice.
  if (budgeted && holder !== id && spent >= budget) return null

  const priority = PRIORITY[id] ?? 0

  if (holder && holder !== id) {
    if (priority <= holderPriority) return null
    // P2.4 — outranking is not enough. The holder also has to be young.
    const visibleFor = (typeof performance !== 'undefined' ? performance.now() : 0) - holderSince
    if (visibleFor >= PREEMPT_WINDOW_MS) return null
    // Let the displaced holder tidy up rather than leaving it rendering into
    // a slot it no longer owns.
    const displaced = holderRelease
    clearHolder()
    try { displaced?.() } catch { /* ignore */ }
  }

  const isNewClaim = holder !== id
  // A re-claim by the current holder must not leave the PREVIOUS TTL armed.
  // Without this, a component that re-renders and re-claims accumulates
  // timers, and the oldest one fires first — so the overlay would vanish
  // early, at the age of the first claim rather than the latest.
  if (holderTimer) { clearTimeout(holderTimer); holderTimer = null }
  holder = id
  holderPriority = priority
  holderSince = typeof performance !== 'undefined' ? performance.now() : 0

  if (isNewClaim && budgeted) spent += 1
  if (once) markSeen(`overlay:${id}`)

  let released = false
  const release = () => {
    if (released) return
    released = true
    // Someone else may have taken the slot in the meantime; releasing must
    // not clear THEIR claim.
    if (holder !== id) return
    clearHolder()
  }
  holderRelease = release

  /*
   * The TTL lives here, not in the component.
   *
   * This is the structural fix for D-4.3. A component can forget to set a
   * timer — one did — and the result is an overlay that stays until it is
   * clicked, which is a modal wearing a toast's clothing. The bus cannot
   * forget, because there is one implementation.
   */
  if (Number.isFinite(effectiveTtl) && effectiveTtl > 0) {
    holderTimer = setTimeout(() => {
      holderTimer = null
      try { onExpire?.() } catch { /* a component that throws on exit still loses the slot */ }
      release()
    }, effectiveTtl)
  }

  publish()
  return release
}

/** Who holds the slot right now, or null. */
export function currentOverlay() {
  return holder
}

/** True while anything other than `exceptId` is showing. */
export function overlayBusy(exceptId) {
  return holder !== null && holder !== exceptId
}

/** How many of the session's interruptions have been spent. */
export function interruptionsSpent() {
  return spent
}

/** Subscribe to holder changes. Returns an unsubscribe. */
export function onOverlayChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Forget one overlay's "seen" flag.
 *
 * `RunComplete` offers the spark hunt again, and `forge.reset()` clears the
 * store — both need a way to make a once-only overlay eligible once more
 * without knowing how the flag is keyed.
 */
export function forgetOverlay(id) {
  /*
   * `setStore`, not `markSeen(id, undefined)`.
   *
   * `markSeen`'s second parameter defaults to `Date.now()`, so passing
   * `undefined` marks the overlay as seen RIGHT NOW — the exact opposite of
   * forgetting it, and silently, since both spellings type-check and neither
   * throws. `setStore` merges one level deep, so writing the key as
   * `undefined` leaves it present but non-finite, which is what `hasSeen`
   * treats as "never seen".
   */
  setStore({ seen: { [`overlay:${id}`]: undefined } })
}

/** Test seam. Resets the holder, the budget and the timers — not the store. */
export function resetOverlayBus() {
  spent = 0
  clearHolder()
}
