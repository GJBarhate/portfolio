import { test, expect } from '@playwright/test'
import { open } from './helpers.js'

/**
 * palette.spec.js — T-002. The reported bug, asserted.
 *
 * D-01 was that `paletteMounted` flipped only inside a `keydown` handler
 * testing `(metaKey || ctrlKey) && key === 'k'`. There was no button, no
 * gesture, no drawer entry and no FAB anywhere that could reach it, so on a
 * touch device the command palette was unreachable — 100 % of phone visitors.
 *
 * These tests fail if any of the three doors is removed again.
 */

test.describe('command palette', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test('opens from the header button', async ({ page }) => {
    await open(page)
    await page.locator('.nav-search').click()
    const dialog = page.locator('.cmdpal')
    // Lazy chunk — see the note in cli.spec.js.
    await expect(dialog).toBeVisible({ timeout: 25_000 })
    await expect(page.locator('.cmdpal__input')).toBeFocused()
  })

  test('opens from the drawer, on touch, with no keyboard', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the drawer only exists below the lg nav switch')
    await open(page)
    await page.locator('.nav-burger').click()
    await expect(page.locator('.drawer')).toBeVisible()
    await page.locator('.drawer__search').click()
    await expect(page.locator('.cmdpal')).toBeVisible({ timeout: 25_000 })
  })

  /*
   * D-34.2 — the binding is `/`, not Ctrl/Meta+K.
   *
   * Win+K is an OS shortcut (Cast) the page never receives, and Ctrl+K is
   * claimed by the browser (omnibox search in Chrome, the search bar in
   * Firefox). Both tests below exist so that re-adding a modifier binding that
   * competes with the user agent is a deliberate act rather than a habit.
   */
  test('opens from a bare slash', async ({ page }) => {
    await open(page)
    await page.keyboard.press('/')
    await expect(page.locator('.cmdpal')).toBeVisible({ timeout: 25_000 })
  })

  test('opens from the modifier form', async ({ page }) => {
    await open(page)
    await page.keyboard.press('Control+/')
    await expect(page.locator('.cmdpal')).toBeVisible({ timeout: 25_000 })
  })

  test('a bare slash typed into a field is a slash, not a shortcut', async ({ page }) => {
    await open(page)
    const field = page.locator('#from_name')
    await field.scrollIntoViewIfNeeded()
    await field.fill('')
    await field.press('/')
    await expect(page.locator('.cmdpal')).toBeHidden()
    await expect(field).toHaveValue('/')
  })

  test('closes on Escape and on a backdrop tap', async ({ page }) => {
    await open(page)
    await page.locator('.nav-search').click()
    await expect(page.locator('.cmdpal')).toBeVisible({ timeout: 25_000 })
    await page.keyboard.press('Escape')
    await expect(page.locator('.cmdpal')).toBeHidden()

    await page.locator('.nav-search').click()
    await expect(page.locator('.cmdpal')).toBeVisible()
    // A tap in the far corner is unambiguously outside the panel.
    await page.mouse.click(5, 5)
    await expect(page.locator('.cmdpal')).toBeHidden()
  })

  test('is operable by touch: filter, then tap a result', async ({ page }) => {
    await open(page)
    await page.locator('.nav-search').click()
    await page.locator('.cmdpal__input').fill('projects')
    const first = page.locator('.cmdpal__item').first()
    await expect(first).toContainText(/projects/i)
    await first.click()
    await expect(page.locator('.cmdpal')).toBeHidden()
    // The palette navigated rather than merely closing.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
  })

  test('the input is at least 16px, so iOS does not zoom the page on focus', async ({ page }) => {
    await open(page)
    await page.locator('.nav-search').click()
    const size = await page.locator('.cmdpal__input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(16)
  })

  test('the results list is capped and scrolls inside itself', async ({ page }) => {
    await open(page)
    await page.locator('.nav-search').click()
    const box = await page.locator('.cmdpal__panel').boundingBox()
    const viewport = page.viewportSize()
    expect(box.height).toBeLessThanOrEqual(viewport.height)
    const contain = await page.locator('.cmdpal__results').evaluate((el) => getComputedStyle(el).overscrollBehavior)
    expect(contain).toContain('contain')
  })

  test('keyboard traversal moves the selection and Enter runs it', async ({ page }) => {
    await open(page)
    await page.keyboard.press('/')
    // The palette is a lazy chunk: the keystroke that summons it arrives
    // before the component exists, so the arrow key has to wait for the list
    // to be on screen. A visitor experiences the same thing once, for one
    // frame, on their first `/` of the session.
    await expect(page.locator('.cmdpal__item').first()).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('.cmdpal__item').nth(1)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Escape')
    await expect(page.locator('.cmdpal')).toBeHidden()
  })
})
