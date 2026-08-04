import { test, expect } from '@playwright/test'
import { open, collectErrors, realErrors, fullScroll } from './helpers.js'

/**
 * smoke.spec.js — T-013.
 *
 * The assertions that must hold on every viewport in the matrix. Each one
 * corresponds to a defect that actually shipped:
 *
 *   overflow        the single most common "the site is broken" report
 *   console errors  the thing nobody checks on a phone
 *   hit areas       ten controls were under 44px before the audit found them
 *   the search      D-01: no way to open the palette on touch
 *   alt text        an image with no alt is invisible to a screen reader
 *   type size       9px "technical" labels are a style, not a size
 */

test.describe('smoke', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test.skip(({ browserName }) => browserName === 'firefox', 'matrix is Chromium + WebKit')

  test('no horizontal overflow, at rest or after a full scroll', async ({ page }) => {
    await open(page)
    const overflow = async () => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(await overflow(), 'overflow at rest').toBeLessThanOrEqual(1)
    await fullScroll(page)
    expect(await overflow(), 'overflow after scrolling').toBeLessThanOrEqual(1)
  })

  test('no console errors during load and a full scroll', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page)
    await fullScroll(page)
    expect(realErrors(errors)).toEqual([])
  })

  test('the header search button is present and opens the palette', async ({ page }) => {
    await open(page)
    const search = page.locator('.nav-search')
    await expect(search).toBeVisible()
    await search.click()
    await expect(page.locator('.cmdpal')).toBeVisible({ timeout: 25_000 })
  })

  test('every interactive control has a 44px hit area on a coarse pointer', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the 44px expansion is gated on (pointer: coarse)')
    await open(page)
    const undersized = await page.evaluate(() => {
      const selector = 'a[href], button, [role="button"], input, select, textarea, summary'
      const bad = []
      for (const el of document.querySelectorAll(selector)) {
        const rect = el.getBoundingClientRect()
        // Off-screen, hidden or zero-size elements are not targets.
        if (rect.width === 0 || rect.height === 0) continue
        if (getComputedStyle(el).visibility === 'hidden') continue
        // The expansion lives on ::after, so the *effective* target is the
        // larger of the element box and its pseudo-element box.
        const after = getComputedStyle(el, '::after')
        const pseudoW = parseFloat(after.width) || 0
        const pseudoH = parseFloat(after.height) || 0
        const w = Math.max(rect.width, pseudoW)
        const h = Math.max(rect.height, pseudoH)
        // Inline links inside running text are exempt by design (a 44px box
        // around a word would overlap the lines above and below it).
        if (el.closest('p, li, dd, blockquote, figcaption')) continue
        if (w < 44 || h < 44) {
          bad.push(`${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] || ''} ${Math.round(w)}x${Math.round(h)}`)
        }
      }
      return bad
    })
    expect(undersized).toEqual([])
  })

  test('every image has alt text or is explicitly decorative', async ({ page }) => {
    await open(page)
    await fullScroll(page)
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((img) => !img.alt && img.getAttribute('aria-hidden') !== 'true' && img.getAttribute('role') !== 'presentation')
        .map((img) => img.currentSrc || img.src)
    )
    expect(unlabelled).toEqual([])
  })

  test('no rendered text is smaller than 12px', async ({ page }) => {
    await open(page)
    const tiny = await page.evaluate(() => {
      const bad = new Set()
      for (const el of document.querySelectorAll('body *')) {
        if (!el.textContent?.trim()) continue
        // Only elements that render text themselves, not their containers.
        const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (!hasOwnText) continue
        const size = parseFloat(getComputedStyle(el).fontSize)
        if (size && size < 12) bad.add(`${el.tagName.toLowerCase()}.${el.className?.toString().split(' ')[0] || ''} @ ${size}px`)
      }
      return [...bad]
    })
    expect(tiny).toEqual([])
  })

  test('the page has exactly one h1 and a main landmark', async ({ page }) => {
    await open(page)
    expect(await page.locator('h1').count()).toBe(1)
    await expect(page.locator('main#main')).toHaveCount(1)
    await expect(page.locator('header.site-header')).toHaveCount(1)
  })

  test('no single request exceeds 200 KB', async ({ page }) => {
    const oversized = []
    page.on('response', async (response) => {
      const length = Number(response.headers()['content-length'] || 0)
      // Images are budgeted separately (T-052); this catches JS/CSS bloat.
      if (length > 200 * 1024 && /\.(js|css)$/.test(new URL(response.url()).pathname)) {
        oversized.push(`${new URL(response.url()).pathname} ${Math.round(length / 1024)} KB`)
      }
    })
    await open(page)
    await page.waitForTimeout(800)
    expect(oversized).toEqual([])
  })
})
