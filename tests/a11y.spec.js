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

/**
 * P6.6 / P7.2 — the two gaps the phase closes, asserted.
 *
 * These are separated from the block above because they are about the NEW
 * surfaces (the Appearance Console) and about a rule that had never been
 * checked anywhere (the 44px minimum), rather than about the focus ring.
 */
test.describe('targets and dialogs', () => {
  test('every touch target clears 44x44', async ({ page }, testInfo) => {
    /*
     * §6.6, and the scope is deliberate on two axes.
     *
     * TOUCH ONLY. 44×44 is WCAG 2.5.5, which is AAA and is written for
     * fingers; the AA rule (2.5.8) is 24×24. Asserting 44 on a mouse-driven
     * desktop flagged 39 elements — every nav link, every card link, the
     * wordmark — none of which is a defect, because a 21px-tall text link is
     * a perfectly good mouse target and making it 44 would wreck the layout.
     * `playwright.config.js` already models this: everything at or below
     * 844px is configured `hasTouch`, and that is exactly the population the
     * rule applies to.
     *
     * CONTROLS, NOT TEXT. Inline links inside prose are flow content and are
     * explicitly exempt from 2.5.8; the rule is about things you press.
     *
     * The two known failures this was written for were the spark collectible
     * (18×18 — a quarter of the minimum, on a control deliberately tucked into
     * decorative corners) and the nav search button (32×32 from a Tailwind
     * `w-8 h-8` in the markup).
     */
    test.skip(!testInfo.project.use.hasTouch, 'the 44px rule is for fingers')
    await open(page)
    const small = await page.evaluate(() => {
      const out = []
      // The controls the header and the HUD are made of — the ones a thumb
      // actually goes for, and the ones this phase changed.
      const selectors = [
        '.nav-search', '.appearance-btn', '.recruiter-chip', '.spark-counter',
        '.spark-collectible', '.nav-burger', '.nav-sound', '.arcade-fab',
        '.appearance__option', '.appearance__close', '.spark-toast__close',
        '.nav-drawer__tool', '.nav-drawer__link',
      ].join(', ')
      for (const el of document.querySelectorAll(selectors)) {
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') continue
        if (r.width < 44 || r.height < 44) {
          out.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`)
        }
      }
      return out
    })
    expect(small, `targets below 44px: ${small.join(', ')}`).toEqual([])
  })

  test('the appearance console traps focus and restores it', async ({ page }) => {
    await open(page)
    const trigger = page.locator('.appearance-btn')
    await trigger.click()

    const panel = page.locator('.appearance')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveAttribute('aria-modal', 'true')
    await expect(panel).toHaveAttribute('role', 'dialog')

    // Each group is a real radiogroup with exactly one checked radio, which is
    // what makes arrow-key navigation mean anything. Four groups: Theme,
    // Backdrop, Motion, and Notices (the Do Not Disturb control — P2.5).
    const groups = page.locator('.appearance [role="radiogroup"]')
    await expect(groups).toHaveCount(4)
    for (let i = 0; i < 4; i += 1) {
      await expect(groups.nth(i).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1)
    }

    // Escape closes, and focus goes back to what opened it rather than to
    // <body> — which would strand a keyboard user at the top of the document.
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.className || ''))
      .toContain('appearance-btn')
  })
})
