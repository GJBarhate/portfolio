import { test, expect } from '@playwright/test'
import { open } from './helpers.js'

/**
 * cli.spec.js — T-003.
 *
 * D-02: `window.forge` was a real command surface behind a devtools console
 * that no phone has and no recruiter opens. The assertion that matters is
 * that every command reachable from the console is reachable from the palette
 * terminal, by touch, with no keyboard shortcuts.
 */

const run = async (page, line) => {
  await page.locator('.cmdpal__input').fill(`> ${line}`)
  await page.locator('.cmdpal__input').press('Enter')
}

const transcript = (page) => page.locator('.cmdpal__line')

test.describe('palette terminal', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test.beforeEach(async ({ page }) => {
    await open(page)
    await page.locator('.nav-search').click()
    // The palette is a lazy chunk. On a machine running four browser workers
    // its fetch and evaluation can exceed the default expect timeout, and a
    // slow chunk is not the thing these tests are about.
    await expect(page.locator('.cmdpal')).toBeVisible({ timeout: 25_000 })
  })

  test('typing > switches the palette into terminal mode', async ({ page }) => {
    await page.locator('.cmdpal__input').fill('>')
    await expect(page.locator('.cmdpal__transcript')).toBeVisible()
    await expect(page.locator('.cmdpal__results')).toHaveCount(0)
  })

  test('help lists every command in the registry', async ({ page }) => {
    await run(page, 'help')
    const text = await transcript(page).allInnerTexts()
    const joined = text.join('\n')
    for (const command of ['help', 'hire', 'theme', 'motion', 'arcade', 'matrix', 'status', 'scrollTo', 'reset', 'version']) {
      expect(joined, `help mentions ${command}`).toContain(command)
    }
  })

  test('theme switches the palette', async ({ page }) => {
    await run(page, 'theme ember')
    await expect.poll(() =>
      page.evaluate(() => document.documentElement.dataset.theme)
    ).toBe('ember')
  })

  test('motion sets the scalar the whole page multiplies by', async ({ page }) => {
    await run(page, 'motion off')
    await expect.poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-scale').trim())
    ).toBe('0')
  })

  test('status reports the resolved graphics tier', async ({ page }) => {
    await run(page, 'status')
    await expect(transcript(page).filter({ hasText: 'graphics tier' })).toHaveCount(1)
  })

  test('scrollTo navigates', async ({ page }) => {
    await run(page, 'scrollTo projects')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
  })

  test('an unknown command explains itself instead of failing silently', async ({ page }) => {
    await run(page, 'nonsense')
    await expect(transcript(page).filter({ hasText: 'Unknown command' })).toHaveCount(1)
  })

  test('history recalls the previous line with ArrowUp', async ({ page }) => {
    await run(page, 'version')
    await page.locator('.cmdpal__input').press('ArrowUp')
    await expect(page.locator('.cmdpal__input')).toHaveValue('> version')
  })

  test('Tab completes a partial command', async ({ page }) => {
    await page.locator('.cmdpal__input').fill('> vers')
    await page.locator('.cmdpal__input').press('Tab')
    await expect(page.locator('.cmdpal__input')).toHaveValue('> version ')
  })

  test('clear empties the transcript', async ({ page }) => {
    await run(page, 'help')
    expect(await transcript(page).count()).toBeGreaterThan(3)
    await run(page, 'clear')
    // Only the echoed `> clear` line survives, if that.
    expect(await transcript(page).count()).toBeLessThanOrEqual(1)
  })

  test('the console shim exposes the same registry', async ({ page }) => {
    // The shim is installed at idle; the palette chunk is already loaded.
    await expect.poll(
      () => page.evaluate(() => typeof window.forge?.help === 'function'),
      { timeout: 10_000 }
    ).toBe(true)
    const names = await page.evaluate(() => Object.keys(window.forge))
    for (const command of ['help', 'hire', 'theme', 'arcade', 'matrix', 'status', 'scrollTo', 'version']) {
      expect(names).toContain(command)
    }
  })
})
