/**
 * Shared test setup — T-013.
 *
 * Every spec needs the same two things: a page whose first-visit curtain is
 * already spent (a screenshot of a preloader mid-lift tells you nothing), and
 * a known theme. Both live in the unified store (`forge:v1`, src/lib/store.js),
 * so they are seeded together rather than through the five legacy keys the
 * store replaced.
 */

export const STORE_KEY = 'forge:v1'

/**
 * Seed the store before any app code runs.
 * @param {import('@playwright/test').Page} page
 * @param {{theme?: string, motion?: string, intro?: boolean, recruiter?: boolean}} options
 */
export async function seed(page, options = {}) {
  const {
    theme = 'eclipse',
    motion = 'system',
    // `intro: false` means "already seen", i.e. do not run the curtain. That
    // is the default for every test that is not specifically about the intro.
    intro = false,
    recruiter = false,
  } = options

  await page.addInitScript(
    ({ key, payload }) => {
      try { window.localStorage.setItem(key, JSON.stringify(payload)) } catch { /* ignore */ }
    },
    {
      key: STORE_KEY,
      payload: {
        version: 1,
        theme,
        motion,
        progress: { unlocked: [] },
        sparks: [],
        scores: {},
        seen: intro ? {} : { intro: Date.now() },
        prefs: { recruiter, sound: false, tier: null },
      },
    }
  )
}

/** Load the page with the store seeded and the first paint settled. */
export async function open(page, options = {}) {
  await seed(page, options)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  // The app mounts its idle chrome on requestIdleCallback; waiting for the
  // header is a real signal rather than an arbitrary sleep.
  await page.locator('header.site-header').waitFor({ state: 'visible' })

  // …but the header is styled by the INLINED critical sheet, so it appears
  // well before the deferred stylesheet applies. Anything asserting a value
  // that lives in the main sheet — `--motion-scale`, the skip link's focus
  // position, any Tailwind utility — has to wait for that too, or it reads
  // the intermediate state and fails in a way that looks like a site bug and
  // is not. `--motion-scale` is defined only in motion.css, so its presence
  // is the signal that the sheet has landed.
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue('--motion-scale').trim() !== '',
    null,
    { timeout: 20_000 }
  )
}

/** Every console error and page error during the run, for the smoke assertions. */
export function collectErrors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  return errors
}

/**
 * Errors that are environmental rather than ours: a preview server has no
 * `/api/rum` endpoint and no favicon variants, and the browser reports both
 * as console errors that say nothing about the page.
 */
export const IGNORABLE = [
  /\/api\/rum/i,
  /favicon/i,
  /Failed to load resource.*404/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
  /ServiceWorker/i,
]

export const realErrors = (errors) =>
  errors.filter((e) => !IGNORABLE.some((pattern) => pattern.test(e)))

/** Scroll the whole document in steps, as a visitor would. */
export async function fullScroll(page, steps = 8) {
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((fraction) => {
      window.scrollTo({ top: document.documentElement.scrollHeight * fraction, behavior: 'instant' })
    }, i / steps)
    await page.waitForTimeout(120)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
}
