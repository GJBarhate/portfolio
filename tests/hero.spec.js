import { test, expect } from '@playwright/test'
import { open } from './helpers.js'

/**
 * hero.spec.js — T-022 and T-023.
 *
 * The hero is the LCP element and the whole first impression, and it is the
 * one component where a width-only mental model fails outright: `--fs-hero`
 * was `clamp(3rem, 12vw, 10rem)`, which on an 844 x 390 landscape phone
 * resolved to about 101px of type inside a 390px-tall viewport.
 *
 * The assertion that matters on every shape: the primary call to action is
 * above the fold.
 */

test.describe('hero', () => {
  // The no-js project exists to prove the <noscript> floor works
  // (`nojs.spec.js`). Everything in this file is about the React app, which
  // never mounts there — so these are not failures, they are the wrong
  // questions asked of the wrong build.
  test.skip(({ javaScriptEnabled }) => javaScriptEnabled === false, 'requires the app to mount')

  test('the name renders as real text, not only as an animation', async ({ page }) => {
    await open(page)
    const name = page.locator('#hero').getByText('Gaurav Barhate').first()
    await expect(name).toBeVisible()
  })

  test('the primary CTA is above the fold', async ({ page }) => {
    await open(page)
    const cta = page.locator('#hero a[href="#projects"], #hero a[href*="projects"]').first()
    await expect(cta).toBeVisible()
    const { top, bottom } = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom }
    })
    const viewportHeight = page.viewportSize().height
    expect(top).toBeGreaterThanOrEqual(0)
    expect(bottom, 'the CTA is within the first viewport').toBeLessThanOrEqual(viewportHeight + 1)
  })

  test('landscape: the hero does not overflow its own viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'landscape', 'this is the landscape case')
    await open(page)
    const heroHeight = await page.locator('#hero').evaluate((el) => el.getBoundingClientRect().height)
    // In the compact composition the hero may grow past one viewport, but not
    // past two — that would mean the "above the fold" promise is decorative.
    expect(heroHeight).toBeLessThanOrEqual(page.viewportSize().height * 2)
  })

  test('display type is clamped against the shorter axis', async ({ page }) => {
    await open(page)
    const { fontSize, viewportHeight } = await page.evaluate(() => ({
      fontSize: parseFloat(getComputedStyle(document.querySelector('#hero h1')).fontSize),
      viewportHeight: window.innerHeight,
    }))
    // The rule the two-axis clamp exists to enforce: the headline never eats
    // more than a third of the vertical space it has.
    expect(fontSize).toBeLessThanOrEqual(viewportHeight / 3)
  })

  test('the hero object is still turning half a minute in', async ({ page }, testInfo) => {
    // One project's worth of soak is enough, and it is the slowest test here.
    test.skip(testInfo.project.name !== 'laptop', 'one soak run is the whole point')
    test.slow()

    // This is a regression test with a specific history. The object froze
    // twice, both times because something judged the frame and gave up
    // permanently on the wrong thing:
    //
    //   1. the shared ticker EVICTED any callback averaging over 8 ms/frame,
    //      and a WebGL render on a contended GPU crosses that easily. Nothing
    //      ever re-subscribed it.
    //   2. the device probe runs after LCP — while the page is already
    //      driving four canvases — and a single slow reading demoted to tier
    //      1, which means "no WebGL"; both 3-D scenes hard-gate on tier >= 2,
    //      and the tier floor moved down with the verdict.
    //
    // Both failures look identical from outside and neither shows up in a
    // one-second check, which is why this test waits. What it asserts is the
    // only thing that matters to a visitor: thirty seconds later, is it still
    // moving?
    await open(page)
    const canvas = page.locator('.hero-forge-object canvas')

    // Four headless browsers sharing one software GL stack is a situation the
    // site is BUILT to survive — `glResilience` drops to the CSS hero and
    // `resilience.spec.js` asserts it leaves no black rectangle. So a run
    // where no context was granted is not a result here; asserting through it
    // produced a gate that failed two runs in three and measured the test
    // machine's GPU contention rather than the page. When there is a canvas,
    // the assertion below is exact.
    const gotContext = await canvas
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false)
    test.skip(!gotContext, 'no WebGL context was granted — glResilience territory, covered elsewhere')

    // Deliberately NOT focused. The ambient band pauses on `blur` so an
    // unfocused window is not burning battery on fields and hazes nobody is
    // looking at — but a browser window that is fully visible while the
    // visitor's focus is in another application is the single most common way
    // this object was seen to stop dead. The two 3-D scenes are exempt from
    // that pause (`critical: true`), and this is where that is proven.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))

    const frames = []
    for (let i = 0; i < 12; i++) {
      frames.push((await canvas.screenshot()).toString('base64').slice(0, 64))
      await page.waitForTimeout(2500)
    }

    // The assertion is on the longest RUN of identical samples, not on the
    // count of distinct ones. That is the shape of the actual failure: an
    // object that stops emits identical frames from that moment to the end of
    // the test, while an object that is merely being throttled to a quarter
    // rate still moves visibly between samples 2.5 s apart. A distinct-count
    // assertion would fail on both, and only one of them is a bug.
    let longestRun = 1
    let run = 1
    for (let i = 1; i < frames.length; i++) {
      run = frames[i] === frames[i - 1] ? run + 1 : 1
      if (run > longestRun) longestRun = run
    }
    // The thresholds are set where the two populations actually separate, not
    // where they would look strictest. A frozen object produces identical
    // samples from the stall to the end of the run — longest run ~12, one or
    // two distinct frames. A healthy object on a CI machine running four
    // headless browsers against one software GL stack occasionally repeats a
    // pair, and that is the test machine, not the page. Anything between
    // those is not a real state, so a run of 4 is a decisive line.
    expect(longestRun, 'consecutive identical frames across 30 s').toBeLessThanOrEqual(4)
    expect(new Set(frames).size, 'distinct frames across 30 s').toBeGreaterThanOrEqual(6)
    expect(
      Number(await page.evaluate(() => document.documentElement.dataset.gfxTier)),
      'the tier never fell below the WebGL floor'
    ).toBeGreaterThanOrEqual(2)
  })

  test('at 200 % zoom the hero still fits and does not overflow sideways', async ({ page }) => {
    await open(page)
    // Doubling the root font size is how a browser's 200 % text zoom presents
    // itself to CSS that is written in rem.
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px' })
    await page.waitForTimeout(200)
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
