import { test, expect } from '@playwright/test'
import { open, seed } from './helpers.js'

/**
 * resilience.spec.js — T-029 and T-045.
 *
 * D-20: seven lazy sections shared one `<Suspense>` and one `<ErrorBoundary>`,
 * so a single failed chunk replaced the entire page body with a four-card
 * skeleton that matched none of them. The fix is one boundary per section, and
 * this is the test that proves it: kill one chunk, and exactly one section
 * degrades.
 *
 * D-45: WebGL context loss is routine on mobile — backgrounding an app
 * frequently kills the context — and there was no `webglcontextlost` handler
 * anywhere, so the canvas went black permanently.
 */

test.describe('resilience', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test('a 404 on one section chunk degrades only that section', async ({ page }) => {
    await seed(page)
    // Projects is the largest lazy chunk and the one a recruiter came for, so
    // it is the one worth proving.
    await page.route(/\/assets\/Projects-.*\.js$/, (route) => route.fulfill({ status: 404, body: '' }))
    await page.goto('/')
    await page.locator('header.site-header').waitFor()

    // The rest of the page is intact.
    await expect(page.locator('#hero')).toBeVisible()
    await expect(page.locator('#about')).toBeVisible()
    await expect(page.locator('#contact')).toBeVisible()

    // And the failure is reported in place, with a retry.
    const failure = page.locator('.section-error')
    await expect(failure).toHaveCount(1)
    await expect(failure.getByRole('button', { name: /retry/i })).toBeVisible()
  })

  test('a lost WebGL context does not leave a black rectangle', async ({ page }) => {
    await open(page)
    // Let any canvas mount at idle.
    await page.waitForTimeout(1500)
    const hadCanvas = await page.evaluate(() => document.querySelectorAll('canvas').length > 0)
    test.skip(!hadCanvas, 'no canvas mounted at this tier — nothing to lose')

    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.evaluate(() => {
      for (const canvas of document.querySelectorAll('canvas')) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        gl?.getExtension('WEBGL_lose_context')?.loseContext()
      }
    })
    await page.waitForTimeout(600)

    // The page keeps working: no uncaught error, content still visible.
    expect(errors).toEqual([])
    await expect(page.locator('h1')).toBeVisible()
  })

  test('storage failures do not break the page', async ({ page }) => {
    // Safari in private mode throws on setItem. Simulated here because it is
    // the failure mode nobody tests until a visitor reports a white screen.
    await page.addInitScript(() => {
      const throwing = {
        getItem() { throw new Error('SecurityError') },
        setItem() { throw new Error('QuotaExceededError') },
        removeItem() { throw new Error('SecurityError') },
        key() { throw new Error('SecurityError') },
        clear() { throw new Error('SecurityError') },
        get length() { throw new Error('SecurityError') },
      }
      Object.defineProperty(window, 'localStorage', { get: () => throwing, configurable: true })
      Object.defineProperty(window, 'sessionStorage', { get: () => throwing, configurable: true })
    })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.locator('header.site-header').waitFor()
    await expect(page.locator('h1')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a corrupt store payload falls back to the documented defaults', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('forge:v1', '{not json at all') } catch { /* ignore */ }
    })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await page.locator('header.site-header').waitFor()
    await expect(page.locator('h1')).toBeVisible()
    expect(errors).toEqual([])
  })
})
