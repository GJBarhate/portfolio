import { test, expect } from '@playwright/test'
import { open, fullScroll } from './helpers.js'

/**
 * a11y.spec.js — T-040, T-041, T-024.
 *
 * The site is heavily custom-styled, several controls used to be `<div>`s
 * with click handlers, and it has a custom cursor — which is the single
 * easiest way to ship an invisible focus ring without noticing. These are the
 * structural checks; the full axe sweep runs in CI where the extra dependency
 * is free.
 */

test.describe('accessibility', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test('the skip link is the first focusable element and becomes visible', async ({ page }) => {
    await open(page)
    await page.keyboard.press('Tab')
    const skip = page.locator('.skip-link')
    await expect(skip).toBeFocused()
    // The link slides in over --dur-fast; reading its box in the same tick as
    // the keypress catches it mid-transition, which is a measurement bug
    // rather than a site one.
    await expect
      .poll(() => skip.evaluate((el) => el.getBoundingClientRect().top), { timeout: 10_000 })
      .toBeGreaterThan(-10)
    await page.keyboard.press('Enter')
    expect(await page.evaluate(() => location.hash)).toBe('#main')
  })

  test('every focus stop has a visible indicator', async ({ page }) => {
    await open(page)
    const problems = []
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab')
      const result = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        const cs = getComputedStyle(el)
        const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
        const hasShadow = cs.boxShadow && cs.boxShadow !== 'none'
        const label = `${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] || ''}`
        return { ok: hasOutline || hasShadow, label }
      })
      if (result && !result.ok) problems.push(result.label)
    }
    expect(problems).toEqual([])
  })

  test('no click handler sits on a non-interactive element', async ({ page }) => {
    await open(page)
    await fullScroll(page)
    // React attaches at the root, so the DOM cannot be asked directly — what
    // it *can* be asked is whether anything carries a cursor:pointer without
    // being reachable by keyboard, which is the same defect from the outside.
    const orphans = await page.evaluate(() => {
      const bad = []
      for (const el of document.querySelectorAll('div, span, li, p')) {
        const cs = getComputedStyle(el)
        if (cs.cursor !== 'pointer') continue
        if (el.closest('a[href], button, [role="button"], [tabindex]:not([tabindex="-1"]), label')) continue
        if (el.getAttribute('aria-hidden') === 'true') continue
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        bad.push(`${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] || ''}`)
      }
      return [...new Set(bad)]
    })
    expect(orphans).toEqual([])
  })

  test('every section is a labelled landmark', async ({ page }) => {
    await open(page)
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll('main section[id]')]
        .filter((s) => !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby'))
        .map((s) => s.id)
    )
    expect(unlabelled).toEqual([])
  })

  test('every icon-only control has an accessible name', async ({ page }) => {
    await open(page)
    const unnamed = await page.evaluate(() => {
      const bad = []
      for (const el of document.querySelectorAll('button, a[href]')) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const text = el.textContent?.replace(/\s+/g, '') || ''
        const name = el.getAttribute('aria-label') || el.getAttribute('title') || text
        if (!name) bad.push(el.outerHTML.slice(0, 90))
      }
      return bad
    })
    expect(unnamed).toEqual([])
  })

  test('heading levels never skip', async ({ page }) => {
    await open(page)
    await fullScroll(page)
    const skips = await page.evaluate(() => {
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter((h) => h.getBoundingClientRect().height > 0)
        .map((h) => Number(h.tagName[1]))
      const bad = []
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] - levels[i - 1] > 1) bad.push(`h${levels[i - 1]} → h${levels[i]}`)
      }
      return bad
    })
    expect(skips).toEqual([])
  })

  test('reduced motion stills the page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'reduced-motion', 'this is the reduced-motion project')
    // Emulate here as well as in the project config. The project's
    // `reducedMotion: 'reduce'` sets the preference for the context; calling
    // it on the page makes the assertion self-contained, which matters
    // because this test is the one that proves the whole T-025 scalar works.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page)
    // Poll rather than read once: `installMotionMode()` runs in an effect, so
    // for a tick after the stylesheet lands the root can still carry whatever
    // the inline script wrote. The state that matters is the settled one.
    await expect
      .poll(async () => page.evaluate(() => ({
        scale: getComputedStyle(document.documentElement).getPropertyValue('--motion-scale').trim(),
        attr: document.documentElement.dataset.motion ?? null,
        mq: matchMedia('(prefers-reduced-motion: reduce)').matches,
      })), { timeout: 8000 })
      .toEqual({ scale: '0', attr: null, mq: true })
  })

  test('forced colors: no information is carried by a hidden canvas', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'forced-colors', 'this is the forced-colors project')
    await open(page)
    // The page must still present its content with every decorative layer gone.
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('.nav-search')).toBeVisible()
  })
})
