import { test, expect } from '@playwright/test'

// §11 — 6 widths × 3 themes × 3 sections. `maxDiffPixelRatio` is set in the
// config, so a font hinting difference does not fail the run but a collapsed
// layout does.
const WIDTHS = [320, 375, 768, 1024, 1440, 1920]
const THEMES = ['eclipse', 'ember', 'paper']
const SECTIONS = ['hero', 'about', 'projects']

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test(`${width}px · ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('forge-theme', t)
        // Skip the first-visit curtain so screenshots are of the page, not of
        // the preloader mid-lift.
        sessionStorage.setItem('forge-intro', '1')
      }, theme)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      for (const id of SECTIONS) {
        const section = page.locator(`#${id}`)
        await section.scrollIntoViewIfNeeded()
        // Let entrance animations and lazy images settle.
        await page.waitForTimeout(900)
        await expect(section).toHaveScreenshot(`${id}-${theme}-${width}.png`, {
          animations: 'disabled',
          caret: 'hide',
        })
      }
    })
  }
}

test('no horizontal overflow at any width', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('forge-intro', '1'))
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await page.waitForTimeout(400)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
  }
})
