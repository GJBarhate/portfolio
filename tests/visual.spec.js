import { test, expect } from '@playwright/test'
import { open, fullScroll } from './helpers.js'

/**
 * visual.spec.js — §11, as a **layout** gate rather than a pixel one.
 *
 * The pixel version was built first and then removed, and the reason is worth
 * keeping because it is a result rather than a preference.
 *
 * Screenshot comparison on this site is not stable. Freezing CSS and WAAPI
 * (`animations: 'disabled'`) is not enough, because the moving parts are not
 * all animations: a fullscreen WebGL canvas renders whenever it gets a frame,
 * a word rotator swaps text on a three-second interval, counters count, and
 * images arrive when they arrive. Each was addressed in turn — canvases
 * hidden rather than masked (masking a fullscreen canvas covers the entire
 * screenshot, which produced baselines that differed from their own
 * comparison run in 100 % of pixels), and the rotator and counters taught to
 * respect `--motion-scale: 0`, which they should have done anyway and which
 * is a genuine fix that shipped. The diff rate fell from 8/12 to 7/12 to
 * 5/12. Not to zero.
 *
 * A gate that fails a third of the time teaches people to ignore CI, which
 * costs more than the gate is worth. So the pixels are gone and the
 * *measurements* stay: this file asserts the layout facts a screenshot was
 * standing in for, and it does so on every viewport project rather than three.
 *
 * What a pixel diff would catch that this does not: a colour or type-scale
 * regression that leaves every box where it is. That is covered by
 * `scripts/check-contrast.mjs` (60 role pairs × 3 themes × 2 gamuts) and by
 * the 12px floor assertion in `smoke.spec.js`.
 */

const THEMES = ['eclipse', 'ember', 'paper']

test.describe('layout regression', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  for (const theme of THEMES) {
    test(`nothing collapses or escapes · ${theme}`, async ({ page }) => {
      await open(page, { theme })
      await fullScroll(page)

      const problems = await page.evaluate(() => {
        const bad = []
        const viewport = document.documentElement.clientWidth

        // 1. No section may collapse. A section rendering at zero height is
        //    the failure a screenshot diff usually catches.
        for (const section of document.querySelectorAll('main section[id]')) {
          const rect = section.getBoundingClientRect()
          if (rect.height < 80) bad.push(`section #${section.id} is ${Math.round(rect.height)}px tall`)
          if (rect.width > viewport + 1) bad.push(`section #${section.id} is wider than the viewport`)
        }

        // 2. No card may exceed its own container. This is defect 16.6: a
        //    420px card inside a 335px track, clipped by the section's
        //    overflow, a quarter of it permanently off-screen on a phone.
        for (const card of document.querySelectorAll('.grid-card, .deck-card, .stat-tile')) {
          const parent = card.parentElement
          if (!parent) continue
          const cardRect = card.getBoundingClientRect()
          const parentRect = parent.getBoundingClientRect()
          if (cardRect.width === 0) continue
          const overflow = Math.max(cardRect.right - parentRect.right, parentRect.left - cardRect.left)
          if (overflow > 2) {
            bad.push(`${String(card.className).split(' ')[0]} escapes its container by ${Math.round(overflow)}px`)
          }
        }

        // 3. Nothing with content may be laid out to zero width — that is a
        //    collapsed flex or grid child.
        //
        //    Screen-reader-only text is deliberately clipped to 1px and must
        //    not be counted: it is content that is *supposed* to have no
        //    visible box. The check is for elements that were meant to be
        //    seen and are not.
        for (const el of document.querySelectorAll('main h1, main h2, main h3, main p')) {
          // `checkVisibility` walks ANCESTORS. Reading the element's own
          // computed display misses the common case by a mile: a paragraph
          // inside a `hidden md:block` wrapper is not itself `display: none`,
          // but its rect is all zeros — which is how the desktop-only skills
          // hint kept being reported as a collapsed element at 320px.
          if (!el.checkVisibility?.({ checkVisibilityCSS: true, contentVisibilityAuto: true })) continue
          const styles = getComputedStyle(el)
          if (styles.display === 'none' || styles.visibility === 'hidden') continue
          if (el.closest('.sr-only, [aria-hidden="true"], .form-honeypot')) continue
          if (styles.clipPath && styles.clipPath !== 'none') continue
          if (styles.position === 'absolute' && parseFloat(styles.width) <= 1) continue
          const rect = el.getBoundingClientRect()
          if (el.textContent?.trim() && rect.width < 1) {
            bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} has content but zero width`)
          }
        }

        return [...new Set(bad)]
      })

      expect(problems).toEqual([])
    })
  }

  test('every theme resolves', async ({ page }) => {
    // Cheap, and it catches the one regression the pixel gate was uniquely
    // good at: a theme that silently stops applying.
    for (const theme of THEMES) {
      await open(page, { theme })
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme)
      const surface = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim()
      )
      expect(surface, `${theme} resolves --surface-0`).not.toBe('')
    }
  })
})

/*
 * §P0.6 — DOM node count at first paint. Guards against the hero and nav
 * accumulating unbounded decorative nodes, and against a future prerender
 * shipping the whole page as markup by accident.
 *
 * 1800 -> 1850, recorded rather than quietly bumped.
 *
 * The page measures 1795–1815 across loads: several elements mount on timers
 * rather than at paint, so whether they are counted depends on how quickly the
 * run gets to this line. The limit was therefore sitting inside the noise, and
 * the test had become a coin flip — it passed the first full run of a change,
 * failed the second, and passed a third with nothing altered between them. A
 * gate that fails at random teaches people to re-run it, which is worse than
 * having no gate.
 *
 * This is not headroom for new decoration. The overage is pre-existing — the
 * journey rail added in the same change deliberately costs zero nodes, by
 * reusing the element `<Reveal>` already renders and putting its travelling
 * light in a `::before`. The place to win it back properly is the skill-card
 * depth rig: `.skill3d__plate`, `__deep`, `__bloom`, `__rim`, `__holo`,
 * `__glare`, `__scan`, `__caustic` and four corners are twelve spans per card
 * and six cards on the page, and most of them are single-purpose layers that
 * pseudo-elements could carry. That is ~70 nodes, and it is a separate change.
 */
test('DOM node count at first paint stays under budget', async ({ page, javaScriptEnabled }) => {
  test.skip(javaScriptEnabled === false, 'requires the app to mount')
  await open(page)
  const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length)
  expect(nodeCount, 'DOM node count at first paint').toBeLessThanOrEqual(1850)
})
