import { test, expect } from '@playwright/test'

/**
 * nojs.spec.js — T-036.
 *
 * With scripting off the page used to be a blank rectangle. Beyond the
 * crawler edge cases, this is the honest test of whether the content exists
 * independently of the effects: if the answer is "no", the effects are
 * load-bearing, which Law 2 of the effect system says they must never be.
 */

test.describe('no JavaScript', () => {
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled !== false, 'the no-js project only')

  test('shows a readable, styled, linked summary', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Gaurav Barhate', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /PeerCode/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /gauravjbarhate554@gmail\.com/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /résumé/i })).toBeVisible()
  })

  test('is styled, not raw markup', async ({ page }) => {
    await page.goto('/')
    const styled = await page.locator('.noscript-shell').evaluate((el) => {
      const cs = getComputedStyle(el)
      return { maxWidth: cs.maxWidth, padding: cs.padding }
    })
    // `max-width: none` would mean the critical stylesheet never applied.
    expect(styled.maxWidth).not.toBe('none')
  })

  test('does not scroll sideways', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('every project links somewhere real', async ({ page }) => {
    await page.goto('/')
    const hrefs = await page.locator('.noscript-list a').evaluateAll((links) => links.map((a) => a.href))
    expect(hrefs.length).toBeGreaterThanOrEqual(8)
    for (const href of hrefs) expect(href).toMatch(/^(https?:|mailto:)/)
  })
})
