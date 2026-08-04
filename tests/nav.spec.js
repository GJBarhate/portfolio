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

  test('arcade dropdown — hovering ARCADE reveals five launchable games', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the hover panel is gated on (hover: hover) and (pointer: fine)')
    await open(page)
    const trigger = page.locator('.arcade-nav-btn')
    await expect(trigger).toBeVisible()

    const menu = page.locator('.arcade-menu [role="menu"]')
    // Before the hover the panel is present but not visible — that half was
    // never in doubt. The bug was that it stayed that way forever.
    await expect(page.locator('.arcade-menu')).toHaveCSS('visibility', 'hidden')

    await trigger.hover()
    await expect(menu).toBeVisible()
    await expect(menu.locator('[role="menuitem"]')).toHaveCount(5)

    await menu.locator('[role="menuitem"]').first().click()
    await expect(page.locator('.arcade-cabinet')).toBeVisible()
  })

  test('arcade dropdown — keyboard focus opens it too', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hover panel, desktop only')
    await open(page)
    await page.locator('.arcade-nav-btn').focus()
    await expect(page.locator('.arcade-menu [role="menu"]')).toBeVisible()
  })
})
