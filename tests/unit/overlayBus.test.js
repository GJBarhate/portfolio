/**
 * The interruption contract, at the unit level.
 *
 * The e2e spec proves the contract holds for a real session; this proves the
 * arbiter's rules individually, which is the only way to test the ones that
 * are about *time* (the quiet period, the TTL, the pre-emption window) without
 * a ten-second test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  claimOverlay,
  currentOverlay,
  interruptionsSpent,
  resetOverlayBus,
  forgetOverlay,
  SESSION_BUDGET,
  PREEMPT_WINDOW_MS,
} from '../../src/lib/overlayBus.js'
import { resetStore } from '../../src/lib/store.js'

/**
 * The quiet period is measured from module load, so every test has to start
 * past it or every claim is refused for reasons unrelated to what is being
 * tested. `performance.now` is stubbed rather than the clock advanced, because
 * the module captured `startedAt` at import time.
 *
 * A million, not `QUIET_PERIOD_MS + 1000`.
 *
 * Setting up the jsdom environment takes ~2 s, so the bus's `startedAt` is
 * around 2,100 by the time this file imports it — and 11,000 − 2,100 is 8,900,
 * still inside the 10 s quiet period. Every test failed with "expected null to
 * be type of function" for a reason that had nothing to do with what any of
 * them was testing. A base far past any plausible import time removes the
 * coupling entirely.
 */
const BASE = 1_000_000
let now = BASE

beforeEach(() => {
  /*
   * `toFake` is not optional here.
   *
   * `vi.useFakeTimers()` with no arguments also replaces `performance.now`
   * with a fake clock starting at 0 — which silently undid the spy below and
   * made every single claim land inside the quiet period, so all 13 tests
   * failed with "expected null to be type of function". Faking only the two
   * timer functions the bus actually uses leaves `performance.now` to the spy.
   */
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  now = BASE
  resetStore()
  resetOverlayBus()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-recruiter')
})

describe('the session budget', () => {
  it(`grants exactly ${SESSION_BUDGET} uninvited overlays and then refuses`, () => {
    expect(claimOverlay('coach')).toBeTypeOf('function')
    expect(interruptionsSpent()).toBe(1)
    // Release so the slot is free — the budget is about COUNT, not concurrency.
    currentRelease()

    expect(claimOverlay('welcome-back')).toBeTypeOf('function')
    expect(interruptionsSpent()).toBe(2)
    currentRelease()

    // The third is refused even though nothing is on screen.
    expect(claimOverlay('achievement')).toBeNull()
    expect(currentOverlay()).toBeNull()
  })

  it('does not charge a re-claim by the current holder', () => {
    claimOverlay('coach')
    claimOverlay('coach')
    claimOverlay('coach')
    expect(interruptionsSpent()).toBe(1)
  })

  it('does not charge an overlay the visitor asked for', () => {
    expect(claimOverlay('run-complete', { budgeted: false })).toBeTypeOf('function')
    expect(interruptionsSpent()).toBe(0)
  })
})

describe('the quiet period', () => {
  it('refuses everything for the first 10 seconds', () => {
    now = 1
    expect(claimOverlay('coach')).toBeNull()
    // …and the refusal costs no budget, so nothing is silently spent while
    // the page is still assembling.
    expect(interruptionsSpent()).toBe(0)

    now = BASE
    expect(claimOverlay('coach')).toBeTypeOf('function')
  })

  it('lets an explicitly-requested overlay through during it', () => {
    now = 1
    expect(claimOverlay('run-complete', { budgeted: false })).toBeTypeOf('function')
  })
})

describe('recruiter mode', () => {
  it('refuses every claim, unconditionally', () => {
    document.documentElement.setAttribute('data-recruiter', '')
    expect(claimOverlay('coach')).toBeNull()
    expect(claimOverlay('run-complete', { budgeted: false })).toBeNull()
    expect(currentOverlay()).toBeNull()
    expect(interruptionsSpent()).toBe(0)
  })
})

describe('the hard TTL', () => {
  it('releases the slot without the component doing anything', () => {
    claimOverlay('coach', { ttl: 3000 })
    expect(currentOverlay()).toBe('coach')

    vi.advanceTimersByTime(2999)
    expect(currentOverlay()).toBe('coach')

    vi.advanceTimersByTime(2)
    // This is the structural fix for D-4.3: the component never set a timer,
    // and it did not have to.
    expect(currentOverlay()).toBeNull()
  })

  it('notifies the holder exactly once so it can animate out', () => {
    const onExpire = vi.fn()
    const release = claimOverlay('coach', { ttl: 1000, onExpire })
    vi.advanceTimersByTime(1500)
    expect(onExpire).toHaveBeenCalledTimes(1)
    // Releasing after expiry is a no-op, not a second notification.
    release()
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('cancels the timer when the holder releases first', () => {
    const onExpire = vi.fn()
    const release = claimOverlay('coach', { ttl: 1000, onExpire })
    release()
    vi.advanceTimersByTime(2000)
    expect(onExpire).not.toHaveBeenCalled()
  })
})

describe('once-only overlays', () => {
  it('never grants a second time', () => {
    expect(claimOverlay('spark-complete', { once: true })).toBeTypeOf('function')
    currentRelease()
    resetOverlayBus() // a fresh page load, same visitor
    // This is D-4.2: without the store write, completion is still true on the
    // next load and the toast returns after 800 ms, forever.
    expect(claimOverlay('spark-complete', { once: true })).toBeNull()
  })

  it('can be deliberately forgotten', () => {
    claimOverlay('spark-complete', { once: true })
    currentRelease()
    resetOverlayBus()
    forgetOverlay('spark-complete')
    expect(claimOverlay('spark-complete', { once: true })).toBeTypeOf('function')
  })
})

describe('pre-emption', () => {
  it('lets a higher priority take a slot claimed moments ago', () => {
    claimOverlay('coach')            // priority 0
    now += 100                       // still inside the window
    expect(claimOverlay('run-complete')).toBeTypeOf('function') // priority 3
    expect(currentOverlay()).toBe('run-complete')
  })

  it('refuses to steal a slot the visitor has been looking at', () => {
    claimOverlay('coach')
    now += PREEMPT_WINDOW_MS + 1
    // D-10f: outranking is not a licence to yank a toast out mid-read. The
    // higher-priority claim is REFUSED rather than granted, which is the
    // difference between a priority system and a glitch.
    expect(claimOverlay('run-complete')).toBeNull()
    expect(currentOverlay()).toBe('coach')
  })

  it('refuses a lower priority outright', () => {
    claimOverlay('run-complete')
    expect(claimOverlay('coach')).toBeNull()
    expect(currentOverlay()).toBe('run-complete')
  })

  it('tells the displaced holder it has lost the slot', () => {
    const onExpire = vi.fn()
    claimOverlay('coach', { onExpire })
    now += 100
    claimOverlay('run-complete')
    // The displaced component must stop rendering into a slot it no longer
    // owns; it finds out by having its release called for it.
    expect(currentOverlay()).toBe('run-complete')
  })
})

describe('the DOM mirror', () => {
  it('publishes the holder on <html data-overlay> and clears it', () => {
    claimOverlay('coach')
    expect(document.documentElement.dataset.overlay).toBe('coach')
    currentRelease()
    expect(document.documentElement.dataset.overlay).toBeUndefined()
  })
})

/** Release whoever currently holds the slot, from outside. */
function currentRelease() {
  // `claimOverlay` by the same id returns a fresh release for the same holder
  // without spending budget, which is the supported way to do this.
  const id = currentOverlay()
  if (!id) return
  const release = claimOverlay(id)
  release?.()
}
