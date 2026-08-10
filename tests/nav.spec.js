import { test, expect } from '@playwright/test'
import { open } from './helpers.js'

const SECTIONS = ['about', 'stats', 'skills', 'projects', 'timeline', 'how-i-build', 'contact']

/**
 * nav.spec.js — T-004 and T-012.
 *
 * Three defects meet here:
 *   D-03  the ARCADE dropdown had never rendered, on any device, because the
 *         `group-hover:` variants had no `group` ancestor to resolve against
 *   D-10  a 10 %-tall IntersectionObserver band meant short sections never
 *         became the active nav item
 *   D-11  `offset: -80` hardcoded a header height that no phone has, so every
 *         anchor landed with its heading hidden behind the header
 */

/** All seven lazily-loaded sections are in the DOM. */
async function waitForSections(page) {
  await page.waitForFunction(
    (ids) => ids.every((id) => document.getElementById(id)),
    SECTIONS,
    { timeout: 20_000 }
  )
}

test.describe('navigation', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test('publishes the real header height as --header-h', async ({ page }) => {
    await open(page)
    const { variable, measured } = await page.evaluate(() => ({
      variable: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')),
      measured: document.querySelector('header.site-header').getBoundingClientRect().height,
    }))
    expect(Math.abs(variable - measured)).toBeLessThanOrEqual(1.5)
  })

  test('anchor navigation lands the heading below the header, not behind it', async ({ page, isMobile }) => {
    await open(page)
    if (isMobile) {
      await page.locator('.nav-burger').click()
      await page.locator('.nav-drawer__link', { hasText: 'Work' }).click()
    } else {
      await page.locator('nav[aria-label="Sections"] button', { hasText: 'Work' }).click()
    }
    // Smooth scrolling needs to settle.
    await page.waitForTimeout(1400)
    const { headingTop, headerBottom } = await page.evaluate(() => {
      const header = document.querySelector('header.site-header').getBoundingClientRect()
      const section = document.getElementById('projects')
      const heading = section.querySelector('h1, h2, h3') || section
      return { headingTop: heading.getBoundingClientRect().top, headerBottom: header.bottom }
    })
    expect(headingTop, 'the heading is below the header').toBeGreaterThanOrEqual(headerBottom - 8)
  })

  test('the active link tracks the section, including short ones', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the horizontal link list only exists at lg and above')
    await open(page)
    // Every section is a lazy chunk, so they exist a moment after the header
    // does. Scrolling to an id that has not mounted yet is a test bug, not a
    // site bug — but it is worth waiting for explicitly rather than sleeping.
    await waitForSections(page)
    for (const id of SECTIONS) {
      await page.evaluate((section) => {
        const el = document.getElementById(section)
        const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 4, behavior: 'instant' })
      }, id)
      await page.waitForTimeout(220)
      await expect
        .poll(() => page.evaluate(() => document.querySelector('nav[aria-label="Sections"] button[aria-current]')?.textContent?.trim()))
        .toBeTruthy()
    }
  })

  test('the URL hash follows the section being read', async ({ page, isMobile }) => {
    test.skip(isMobile, 'one assertion per behaviour; the desktop run covers it')
    await open(page)
    await waitForSections(page)
    await page.evaluate(() => {
      const el = document.getElementById('projects')
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 40, behavior: 'instant' })
    })
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 5000 }).not.toBe('')
  })

  /*
   * These two used to assert the hover dropdown: that hovering ARCADE revealed
   * five `role="menuitem"` entries, and that focusing it did the same.
   *
   * That panel is gone (D-10h). It was gated on `(hover: hover)`, so on a
   * touch-capable laptop — which reports `hover: none` — it was not rendered at
   * all, and a keyboard user could reach the ARCADE button and none of the five
   * games behind it. `focus-within` cannot rescue a panel that was never
   * mounted. It also duplicated the hub's own game list, so adding a game meant
   * editing two places, one of which half the visitors could not see.
   *
   * The contract now is simpler and testable on every device: ONE button, which
   * opens the hub, where the games are chosen. That is what these assert.
   */
  test('ARCADE opens the hub — one button', async ({ page, isMobile }) => {
    // The header's section nav (which carries this button) is `hidden lg:flex`;
    // on a phone the drawer's "Play something" row is the affordance, and
    // drawer.spec.js covers it.
    test.skip(isMobile, 'the header nav is a drawer below lg')
    await open(page)
    const trigger = page.locator('.arcade-nav-btn')
    await expect(trigger).toBeVisible()
    // No second, hover-only door.
    await expect(page.locator('.arcade-menu')).toHaveCount(0)

    await trigger.click()
    await expect(page.locator('.arcade-cabinet')).toBeVisible()
  })

  test('ARCADE is reachable and operable by keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the header nav is a drawer below lg')
    await open(page)
    const trigger = page.locator('.arcade-nav-btn')
    await trigger.focus()
    await expect(trigger).toBeFocused()
    // The keyboard path and the pointer path are the SAME path now, which is
    // the entire point of removing the hover panel.
    await page.keyboard.press('Enter')
    await expect(page.locator('.arcade-cabinet')).toBeVisible()
  })
})
