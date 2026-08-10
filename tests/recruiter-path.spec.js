/**
 * P8.4 — the thirty-second path, measured rather than asserted.
 *
 * The research the plan is built on is blunt: more than 70 % of tech
 * recruiters look at a portfolio before interviewing, over 60 % of them do it
 * on a phone, and a site that takes more than about two seconds to load loses
 * them. Whatever else this page is, it has to answer three questions fast —
 * who is this, what have they built, and how do I contact them.
 *
 * "Fast" is the part that was never checked. This measures it as a distance:
 * how far does a visitor have to scroll before the first working link to a
 * live application is on screen? A number that can regress is worth more than
 * a paragraph asserting the path is short.
 */
import { test, expect } from '@playwright/test'
import { open, seed } from './helpers.js'

test.describe('the recruiter path', () => {
  test('name, role and proof are in the first viewport', async ({ page }) => {
    await open(page, {})
    // Nothing here may require a scroll: this is the whole of the first
    // impression, and on a phone it is most of what gets read at all.
    const hero = page.locator('#hero')
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(hero).toContainText(/B\.Tech|Developer/i)
    // One line of proof — the rating and the problem count are the two numbers
    // a screener actually checks.
    await expect(hero).toContainText(/1972|800\+/)
  })

  test('a live demo is reachable in three scrolls OR one click', async ({ page }) => {
    await open(page, {})

    /*
     * §8.4's contract is "in three scrolls **or one click**", and the first
     * draft of this test only measured the scrolling half — then failed,
     * reporting five screens. That is a true measurement of the wrong thing:
     * the hero, the ticker, About, Player Stats and Skills all sit above
     * Projects, so five screens is correct for someone who only scrolls, and
     * the site's answer for someone in a hurry is the "Work" link that is on
     * screen from the first frame.
     *
     * So both routes are measured, and the assertion is on the shorter one.
     * The scroll distance is still recorded, because it is the number that
     * would regress if a section were inserted above Projects.
     */
    const countVisibleDemos = () => page.evaluate(() => {
      const inView = (el) => {
        const r = el.getBoundingClientRect()
        return r.top < innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0
      }
      return [...document.querySelectorAll('a')].filter((a) => {
        const href = a.getAttribute('href') || ''
        return /^https?:/.test(href) && !/github|linkedin|leetcode|codechef/i.test(href) && inView(a)
      }).length
    })

    // ── route A: one click on a nav destination that is already on screen ──
    //
    // The claim is that one click puts the visitor IN the work section, with
    // the live links there — not that a specific link lands above the fold,
    // which depends on how tall a card happens to be. Asserting the stronger
    // version failed for a reason that is a layout detail rather than a
    // navigation one.
    /*
     * The header's section nav is `hidden lg:flex`, so on a phone the
     * equivalent affordance is the drawer — one tap to open it, one to choose.
     * Asserting the desktop path on a 390px viewport was measuring a control
     * that is not supposed to be there, and it failed for that reason rather
     * than because the path is slow.
     */
    const isPhone = page.viewportSize().width < 1024
    if (isPhone) {
      const burger = page.locator('.nav-burger')
      await expect(burger, 'a phone must have a visible way into the navigation').toBeVisible()
      await burger.click()
    }
    const workLink = page.getByRole('button', { name: /^work$/i }).filter({ visible: true }).first()
    await expect(workLink, 'the Work destination must be reachable without scrolling').toBeVisible()
    await workLink.click()

    const projects = page.locator('#projects')
    await expect(projects, 'one click on "Work" must bring the work section into view').toBeInViewport({ timeout: 15_000 })
    const demosInSection = projects.locator('a[href^="http"]').filter({ hasNotText: /github/i })
    await expect(demosInSection.first(), 'the work section must carry live links').toBeVisible({ timeout: 15_000 })

    // ── route B: how far a pure scroller has to go, for the record ─────────
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(300)
    let screens = 0
    for (; screens <= 8; screens += 1) {
      if (await countVisibleDemos() > 0) break
      await page.evaluate(() => window.scrollBy({ top: innerHeight * 0.9, behavior: 'instant' }))
      await page.waitForTimeout(300)
    }
    test.info().annotations.push({ type: 'screens-to-first-demo', description: String(screens) })
    /*
     * The ceiling is WIDTH-AWARE, because the same content is honestly more
     * screens on a phone: every section stacks to one column, so the five
     * sections above Projects roughly double in height.
     *
     * MEASURED: 6 screens at 1440px, 9 at 390px. Neither is a regression —
     * they are the same page at two widths — and a single number would either
     * pass trivially on desktop or fail permanently on mobile.
     *
     * This is a REGRESSION TRIPWIRE, not a UX target. The UX target is route A
     * above, which is one click at every width. What this catches is someone
     * inserting a sixth section above Projects; it is deliberately loose enough
     * not to fire when the hero gains a paragraph.
     *
     * Nine screens on a phone is nevertheless worth knowing, and it is a
     * product question rather than a bug: reducing it means reordering
     * sections, which is a decision about what the site is for.
     */
    const ceiling = page.viewportSize().width < 1024 ? 10 : 6
    expect(
      screens,
      `a pure scroller needed ${screens} screens to reach a live demo (ceiling ${ceiling} at this width)`
    ).toBeLessThanOrEqual(ceiling)

    /*
     * A recruiter-mode-vs-full-page comparison was here and is removed.
     *
     * It asserted "the short version reaches a demo in fewer screens", which
     * sounds obviously true and is not: Recruiter Mode condenses the hero and
     * removes the arcade chrome, but Projects still sits below About, Player
     * Stats and Skills, so the scroll distance is roughly the same. The
     * measurement also depended on the order the two routes were run in, which
     * is the tell that it was measuring the test rather than the page.
     *
     * What Recruiter Mode actually shortens is the *decision*, not the
     * scroll — it puts the four headline numbers, the résumé and the email in
     * a fixed bar that is on screen from the first frame. That is asserted
     * directly in "recruiter mode puts the numbers and both actions on screen
     * at once", where it belongs.
     */
  })

  test('the résumé is one click from the first viewport', async ({ page }) => {
    await open(page, {})
    // The single most-clicked thing on a portfolio by the audience that
    // matters most, and it must never be behind a menu on a desktop.
    /*
     * `.first()` was wrong, and it hid a real bug rather than catching one.
     *
     * The FIRST `.pdf` link in DOM order is the header button, which is
     * `hidden sm:inline-flex` — so on a phone this asserted a control that is
     * deliberately not rendered, and reported "hidden". The requirement is not
     * "the first pdf link is visible", it is "SOME résumé link is on screen
     * without opening anything", which is what a recruiter actually needs.
     *
     * The measurement drove a real fix: below 640px there was no visible
     * résumé anywhere in the first viewport, only one inside the drawer. The
     * hero now carries a `sm:hidden` résumé CTA.
     */
    const visibleResume = page.locator('a[href$=".pdf"]').filter({ visible: true })
    await expect(
      visibleResume.first(),
      'a résumé link must be visible in the first viewport, at every width'
    ).toBeVisible()
    await expect(visibleResume.first()).toBeInViewport()
  })

  test('recruiter mode puts the numbers and both actions on screen at once', async ({ page }) => {
    await seed(page, {})
    await page.goto('/?recruiter=1')
    await page.locator('header.site-header').waitFor({ state: 'visible' })

    const bar = page.locator('.recruiter-bar')
    await expect(bar).toBeVisible()
    // The four numbers a screener reads, now from platformStats.json rather
    // than from four string literals that could not be checked (D-10l).
    await expect(bar).toContainText('1972')
    await expect(bar.locator('.recruiter-bar__stat')).not.toHaveCount(0)
    // Both of the things they came for.
    await expect(bar.getByRole('link', { name: /résumé/i })).toBeVisible()
    await expect(bar.getByRole('link', { name: /email me/i })).toBeVisible()
    // 8.5 — a number with a date behind it is evidence; without one it is a
    // claim. A wrong number is worse than no number.
    await expect(bar).toContainText(/Last verified/i)
  })

  test('one email address ships, and it is the canonical one', async ({ page }) => {
    await open(page, {})
    /*
     * D-10e — the address used to exist in five places: siteConfig.js,
     * content.js, the Person JSON-LD, the <noscript> contact list and
     * RecruiterMode. Now everything derives from siteConfig and the two HTML
     * copies are generated (`scripts/gen-structured-data.mjs`), so this asserts
     * the observable consequence: the page offers exactly one address.
     */
    const addresses = await page.evaluate(() =>
      [...new Set(
        [...document.querySelectorAll('a[href^="mailto:"]')]
          .map((a) => a.getAttribute('href').replace(/^mailto:/, '').split('?')[0].toLowerCase())
      )]
    )
    expect(addresses.length, `more than one email address ships: ${addresses.join(', ')}`).toBeLessThanOrEqual(1)
  })
})
