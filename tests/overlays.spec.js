/**
 * P2 exit criteria — the Do-Not-Disturb contract, end to end.
 *
 * The unit suite (tests/unit/overlayBus.test.js) proves the arbiter's rules in
 * isolation. This proves the thing that actually matters: that in a real
 * session, with all eight candidates mounted and racing, the visitor is
 * interrupted at most twice — and never in Recruiter Mode.
 *
 * The distinction is not academic. Every one of the eight overlays was
 * individually polite before this phase, and the page was still cluttered,
 * because politeness does not compose. Only an integration test can show that
 * it now does.
 */
import { test, expect } from '@playwright/test'
import { open, seed, collectErrors, realErrors } from './helpers.js'

/** The eight things that can appear without being asked for. */
const OVERLAY_IDS = [
  'coach', 'welcome-back', 'time-suggestion', 'achievement',
  'run-complete', 'exit-intent', 'spark-complete', 'idle-easter-egg',
]

/**
 * Watch `<html data-overlay>` for the whole run and report every holder it ever
 * had, WITH THE TIME IT APPEARED. The bus mirrors itself onto that attribute
 * precisely so something outside the module can audit it.
 *
 * The timestamp is `performance.now()` inside the page, not elapsed test time,
 * and that distinction caused a false failure: the quiet period is measured
 * from page load, the test was measuring from "header is visible", and those
 * are two or three seconds apart. The toast that "interrupted during the
 * entrance" had in fact appeared at ~11 s — the contract held and the ruler
 * was wrong.
 */
async function recordOverlays(page) {
  await page.addInitScript(() => {
    window.__overlayLog = []
    const record = () => {
      // `<html>` does not exist yet on the first, synchronous call.
      const root = document.documentElement
      if (!root) return
      const id = root.dataset.overlay
      const log = window.__overlayLog
      if (id && log[log.length - 1]?.id !== id) log.push({ id, at: performance.now() })
    }
    // Observing `document`, not `document.documentElement`.
    //
    // `addInitScript` runs at document-start, before `<html>` exists, so
    // observing `documentElement` threw "parameter 1 is not of type 'Node'"
    // — which then surfaced as a *console error assertion failure* in an
    // unrelated test, i.e. the instrument broke the measurement. `document`
    // always exists, and `subtree` covers its element's attributes.
    new MutationObserver(record).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-overlay'],
    })
    record()
  })
}

test.describe('the interruption contract', () => {
  // Playwright requires the first parameter to be an object-destructuring
  // pattern even when no fixture is wanted; ESLint dislikes the empty one.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'laptop', 'the contract does not vary with viewport')
  })

  test('at most two uninvited overlays in a whole session', async ({ page }) => {
    // The contract is about a SESSION: a 10 s quiet period, then time for the
    // eight candidates to try, then time for whatever won to auto-dismiss.
    // That is a ~25 s observation window by definition, and it does not fit in
    // the 60 s default alongside a cold load of a WebGL page.
    test.setTimeout(120_000)
    const errors = collectErrors(page)
    await recordOverlays(page)

    // A returning visitor mid-hunt: the state that makes the MOST overlays
    // eligible at once — welcome-back has a last visit to compare against,
    // exit-intent has sparks left to mention, the coach chip has not been
    // seen, and the time suggestion has a stored theme to argue with.
    await seed(page, { theme: 'ember' })
    await page.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('forge:v1'))
      raw.seen.lastVisit = Date.now() - 48 * 60 * 60 * 1000
      raw.sparks = ['spark-hero', 'spark-stats']
      localStorage.setItem('forge:v1', JSON.stringify(raw))
    })
    await page.goto('/')
    await page.locator('header.site-header').waitFor({ state: 'visible' })

    // Drive the session: scroll the page, go idle, and try to trigger exit
    // intent. This is a visitor doing everything that can summon something.
    await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'instant' }))
    await page.waitForTimeout(1500)
    await page.mouse.move(400, 300)
    await page.mouse.move(400, 2)   // exit intent
    await page.waitForTimeout(1000)

    // Past the 10 s quiet period, where the toasts that were refused during it
    // would otherwise be free to fire.
    await page.waitForTimeout(11_000)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.mouse.move(200, 2)
    await page.waitForTimeout(2000)

    const seenOverlays = await page.evaluate(() => window.__overlayLog)
    const distinct = [...new Set(seenOverlays.map((e) => e.id))]

    expect(
      distinct.length,
      `expected at most 2 uninvited overlays, saw: ${distinct.join(', ') || '(none)'}`
    ).toBeLessThanOrEqual(2)

    // Every one of them auto-dismissed: nothing is still holding the slot.
    await page.waitForTimeout(8000)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.overlay ?? null))
      .toBeNull()

    expect(realErrors(errors)).toEqual([])
  })

  test('nothing appears during the first ten seconds', async ({ page }) => {
    test.setTimeout(90_000)
    await recordOverlays(page)
    await seed(page, {})
    await page.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('forge:v1'))
      raw.seen.lastVisit = Date.now() - 48 * 60 * 60 * 1000
      localStorage.setItem('forge:v1', JSON.stringify(raw))
    })
    await page.goto('/')
    await page.locator('header.site-header').waitFor({ state: 'visible' })

    // The welcome-back toast used to fire at 2.5 s — while the hero is still
    // assembling on a phone. Nine seconds in, the page should still be the
    // visitor's alone.
    await page.waitForTimeout(12_000)
    const log = await page.evaluate(() => window.__overlayLog)
    // Measured on the page's own clock, from navigation start — the same
    // origin the arbiter uses.
    const tooEarly = log.filter((e) => e.at < 10_000)
    expect(
      tooEarly,
      `interrupted during the entrance: ${tooEarly.map((e) => `${e.id} at ${Math.round(e.at)}ms`).join(', ')}`
    ).toEqual([])
  })

  test('recruiter mode: zero overlays, and the chrome is not in the DOM', async ({ page }) => {
    test.setTimeout(90_000)
    const errors = collectErrors(page)
    await recordOverlays(page)

    // Through the URL door (D-10j), which is also the assertion that the door
    // exists — before this phase there was no way to reach the mode from a link.
    await seed(page, {})
    await page.goto('/?recruiter=1')
    await page.locator('header.site-header').waitFor({ state: 'visible' })

    await expect(page.locator('html')).toHaveAttribute('data-recruiter', '')

    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }))
    await page.waitForTimeout(12_000)
    await page.mouse.move(400, 2)
    await page.waitForTimeout(1000)

    expect(await page.evaluate(() => window.__overlayLog)).toEqual([])

    // NOT MERELY HIDDEN. This is the whole point of P2.5: these used to mount
    // and be `display: none`, so they still cost a subscription each and, for
    // the clock, a WebGL context.
    for (const selector of ['.forge-clock', '.xp-bar', '.arcade-fab', '.level-ribbon', '.spark-collectible']) {
      await expect(page.locator(selector), `${selector} should not be in the DOM`).toHaveCount(0)
    }

    expect(realErrors(errors)).toEqual([])
  })

  test('a job-board referrer lands in the short version', async ({ page }) => {
    await seed(page, {})
    // 8.6 — the highest-leverage two-line change in the plan: traffic that
    // arrives from a hiring funnel starts in the mode built for it.
    await page.goto('/?ref=linkedin')
    await page.locator('header.site-header').waitFor({ state: 'visible' })
    await expect(page.locator('html')).toHaveAttribute('data-recruiter', '')
  })

  test('ordinary referrers are left alone', async ({ page }) => {
    await seed(page, {})
    await page.goto('/?ref=newsletter')
    await page.locator('header.site-header').waitFor({ state: 'visible' })
    // Guessing wrong in this direction hides the work from someone who came
    // to look at it, so the referrer list is deliberately narrow.
    await expect(page.locator('html')).not.toHaveAttribute('data-recruiter', '')
  })

  test('the spark toast does not come back on the next visit', async ({ page }) => {
    test.setTimeout(90_000)
    await recordOverlays(page)
    // A visitor who has already completed the hunt AND already seen the toast.
    await seed(page, {})
    await page.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('forge:v1'))
      raw.sparks = ['spark-hero', 'spark-stats', 'spark-skills', 'spark-timeline', 'spark-footer']
      raw.seen['overlay:spark-complete'] = Date.now() - 60 * 1000
      localStorage.setItem('forge:v1', JSON.stringify(raw))
    })
    await page.goto('/')
    await page.locator('header.site-header').waitFor({ state: 'visible' })
    await page.waitForTimeout(12_000)

    // D-4.2 — before this, `collected.length === total` was still true on
    // every load, so the toast reappeared 800 ms in, forever.
    await expect(page.locator('.spark-toast')).toHaveCount(0)
    const log = await page.evaluate(() => window.__overlayLog)
    expect(log.map((e) => e.id)).not.toContain('spark-complete')
  })

  test('the spark counter is visible before anything is found', async ({ page }) => {
    await open(page, {})
    // P2.7 — the hunt used to be entirely undiscoverable: no counter until the
    // first find, and no other signal that the five dots meant anything.
    const counter = page.locator('.spark-counter')
    await expect(counter).toBeVisible()
    await expect(counter).toHaveAttribute('data-started', 'false')
    await expect(counter).toContainText('0/5')
  })
})

test.describe('every overlay id is registered', () => {
  // Playwright requires the first parameter to be an object-destructuring
  // pattern even when no fixture is wanted; ESLint dislikes the empty one.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'laptop', 'source-level check')
  })

  test('the priority table covers all eight', async () => {
    // A guard against the D-4.1 class: an unregistered id silently defaults to
    // priority 0, so forgetting to register looks exactly like registering it
    // as the lowest priority. There is no runtime signal at all.
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../src/lib/overlayBus.js', import.meta.url), 'utf8')
    for (const id of OVERLAY_IDS) {
      expect(source, `'${id}' is missing from the PRIORITY table`).toContain(`'${id}':`)
    }
  })
})
