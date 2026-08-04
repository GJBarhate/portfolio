import { test, expect } from '@playwright/test'
import { open } from './helpers.js'

/**
 * drawer.spec.js — T-026.
 *
 * The mobile drawer is the primary navigation for every phone visitor, and it
 * was a `<div>` with `data-open`: no focus trap, no `inert`, no scroll lock,
 * no Escape, no focus restoration. Each of those is one test here.
 */

test.describe('drawer', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test.skip(({ isMobile }) => !isMobile, 'the drawer only exists below the lg nav switch')

  test('opens, and marks the page behind it inert', async ({ page }) => {
    await open(page)
    await page.locator('.nav-burger').click()
    await expect(page.locator('.drawer')).toBeVisible()
    expect(await page.evaluate(() => document.getElementById('main').inert)).toBe(true)
    await expect(page.locator('.nav-burger')).toHaveAttribute('aria-expanded', 'true')
  })

  test('traps focus inside itself', async ({ page }) => {
    await open(page)
    await page.locator('.nav-burger').click()
    // Tab several times; focus must never land outside the dialog.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() =>
        !!document.activeElement?.closest('.drawer')
      )
      expect(inside, `focus escaped the drawer on tab ${i + 1}`).toBe(true)
    }
  })

  test('closes on Escape and returns focus to the burger', async ({ page }) => {
    await open(page)
    const burger = page.locator('.nav-burger')
    await burger.click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.drawer')).toBeHidden()
    await expect(burger).toBeFocused()
  })

  test('closes on a backdrop tap', async ({ page }) => {
    await open(page)
    await page.locator('.nav-burger').click()
    // ABOVE the sheet, not below it. The sheet starts at `--header-h` and is
    // free to reach the bottom of the screen when it has enough content — on
    // a 320x568 phone it does, so a click at the bottom edge lands on the
    // sheet itself and nothing happens.
    await page.mouse.click(page.viewportSize().width / 2, 6)
    await expect(page.locator('.drawer')).toBeHidden()
  })

  test('locks the page behind it and restores the scroll position', async ({ page }) => {
    await open(page)
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
    const before = await page.evaluate(() => window.scrollY)

    await page.locator('.nav-burger').click()
    await expect(page.locator('.drawer')).toBeVisible()

    // Assert the lock itself rather than the *effect* of a wheel event. A
    // synthetic wheel under four parallel workers is timing-dependent and
    // says nothing useful when it flakes; the root's overflow is the actual
    // contract.
    const locked = await page.evaluate(() => ({
      overflow: getComputedStyle(document.documentElement).overflowY,
      overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
    }))
    expect(locked.overflow, 'the page behind the sheet is locked').toBe('hidden')
    expect(locked.overscroll).toBe('contain')

    await page.keyboard.press('Escape')
    await expect(page.locator('.drawer')).toBeHidden()
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 })
      .toBeGreaterThan(before - 8)
  })

  test('the last row clears the home indicator', async ({ page }) => {
    await open(page)
    await page.locator('.nav-burger').click()
    const padding = await page.locator('.drawer__sheet').evaluate((el) =>
      getComputedStyle(el).paddingBottom
    )
    expect(parseFloat(padding)).toBeGreaterThan(0)
  })

  test('every drawer control clears 44px', async ({ page }) => {
    await open(page)
    await page.locator('.nav-burger').click()
    const small = await page.locator('.drawer').evaluate((drawer) =>
      [...drawer.querySelectorAll('a[href], button')]
        .map((el) => ({ el: el.className, r: el.getBoundingClientRect() }))
        // 43.5, not 44: a `min-block-size: 44px` box measures 43.98 at a
        // device pixel ratio of 3, and a gate that fails on sub-pixel
        // rounding is a gate that gets an exception added to it.
        .filter(({ r }) => r.height > 0 && r.height < 43.5)
        .map(({ el, r }) => `${el} ${Math.round(r.height)}px`)
    )
    expect(small).toEqual([])
  })
})
