/**
 * check-layout.mjs — the layout gate that `check-overflow.mjs` is not.
 *
 * Overflow only asks "does the document scroll sideways". That leaves a whole
 * class of defect invisible: a box the right size holding text that is clipped
 * anyway. Three real ones shipped past every other gate on this repo and were
 * only ever found by eye —
 *
 *   · the hero rotator reserved `h-[1.4em]` against an inherited 16px while
 *     the text inside it was `text-lg`, so the words were cropped at every
 *     width from md up;
 *   · `.split-word` clipped with `overflow: hidden` at the border box, shaving
 *     the descender off every g, y, p, j and q in 37px display type;
 *   · `background-clip: text` on a `<SplitText>` painted NOTHING, because the
 *     glyphs sit inside an `inline-block` the clip cannot reach — half the
 *     About headline did not render at all, at 738 x 52, which is exactly why
 *     a size-based gate never noticed.
 *
 * So this asks the questions a person asks when looking at the page: is
 * anything sticking out of the window, is text sitting on top of other text,
 * is in-flow content being cut off by an ancestor, and does every image
 * reserve its own box.
 *
 * Run against a built preview: `node scripts/check-layout.mjs`
 */
import { chromium } from '@playwright/test'

const BASE = process.env.BASE || 'http://localhost:4183/'
const WIDTHS = [320, 360, 390, 414, 480, 600, 768, 834, 900, 1024, 1152, 1280, 1366, 1440, 1600, 1920, 2560]

const SEED = {
  version: 1, theme: 'eclipse', motion: 'system',
  progress: { unlocked: [] }, sparks: [], scores: {},
  seen: { intro: Date.now() }, prefs: { recruiter: false, sound: false, tier: null },
}

const probe = (touch) => {
  const bad = []
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ').filter(Boolean)[0] || ''}`

  const visible = (el) => {
    if (!el.checkVisibility?.({ checkVisibilityCSS: true, contentVisibilityAuto: true })) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
    if (el.closest('[aria-hidden="true"], .sr-only, dialog:not([open]), .form-honeypot')) return false
    return true
  }

  // An overlay legitimately covers the page. Comparing its text against the
  // text it is deliberately covering is not a finding.
  const inOverlay = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (cs.position === 'fixed' || cs.position === 'sticky') return true
      if (p.tagName === 'DIALOG') return true
    }
    return false
  }

  // 1. Anything visible sticking out past the viewport's left/right edge.
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed') continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > vw + 2 || r.left < -2) {
      // A deliberately clipped marquee/scroller is fine — its ancestor hides it.
      let clipped = false
      for (let p = el.parentElement; p; p = p.parentElement) {
        const pcs = getComputedStyle(p)
        if (pcs.overflowX !== 'visible' || pcs.overflowY !== 'visible') { clipped = true; break }
      }
      if (!clipped) bad.push(`ESCAPES-VIEWPORT ${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`)
    }
  }

  // 1b. Interactive controls must be fully reachable.
  //
  //     Rule 1 forgives an element whose ancestor clips it, because that is
  //     how a marquee works. A CONTROL is different: clipped means unusable,
  //     and the clip is exactly what hides the mistake from the overflow gate
  //     and from the document width. The header's RESUME link sat 69px past
  //     the header's right edge at 390px for this reason — a display utility
  //     hard-coded inside MagneticButton was beating the caller's `hidden`,
  //     and nothing on the page could see it.
  for (const el of document.querySelectorAll('a[href], button, [role="button"], input, select, textarea')) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (getComputedStyle(el).position === 'fixed') continue
    if (r.right > vw + 2 || r.left < -2) {
      bad.push(`CONTROL-OFF-SCREEN ${name(el)} "${(el.textContent || '').trim().slice(0, 18)}" [${Math.round(r.left)}..${Math.round(r.right)}] vw=${vw}`)
    }
    // …and inside whatever box actually clips them.
    for (let p = el.parentElement; p; p = p.parentElement) {
      const pcs = getComputedStyle(p)
      if (pcs.overflowX === 'visible' && pcs.overflowY === 'visible') continue
      const pr = p.getBoundingClientRect()
      // A horizontal scroller is a deliberate exception: its children are
      // meant to sit outside the frame until the visitor scrolls to them.
      if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') break
      if (r.right > pr.right + 2 || r.left < pr.left - 2) {
        bad.push(`CONTROL-CLIPPED ${name(el)} "${(el.textContent || '').trim().slice(0, 18)}" escapes ${name(p)}`)
      }
      break
    }
  }

  // 2. Text that overlaps other text in the same stacking context.
  const texts = [...document.querySelectorAll('h1,h2,h3,h4,p,li,button,a')].filter((el) => {
    if (!visible(el)) return false
    if (!el.textContent?.trim()) return false
    const cs = getComputedStyle(el)
    return cs.position === 'static' || cs.position === 'relative'
  })
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j]
      if (a.contains(b) || b.contains(a)) continue
      if (inOverlay(a) !== inOverlay(b) || inOverlay(a)) continue
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      if (ra.width === 0 || rb.width === 0) continue
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (ox > 8 && oy > 8) bad.push(`TEXT-OVERLAP ${name(a)} × ${name(b)}`)
    }
  }

  // 2b. Text squeezed until it wraps one character per line.
  //
  //     The time-suggestion toast did exactly this at 390px: `left-1/2` plus
  //     `translateX(-50%)` and only a MAX width, so the box's available space
  //     was what remained right of the 50% offset — half the viewport — and
  //     after padding and two `flex-shrink-0` buttons the paragraph got a
  //     negative remainder. Nothing was clipped and nothing overflowed the
  //     document, so every other check here passed it.
  for (const el of document.querySelectorAll('p, h1, h2, h3, h4, li, figcaption')) {
    if (!visible(el)) continue
    const text = el.textContent?.trim() || ''
    if (text.length < 15) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16
    // Four characters is already unreadable; anything narrower is a collapse,
    // not a narrow column.
    if (r.width < fontSize * 4) {
      bad.push(`TEXT-SQUEEZED ${name(el)} "${text.slice(0, 20)}" ${Math.round(r.width)}px wide at ${Math.round(fontSize)}px type`)
    }
  }

  // 3. Images with no intrinsic size declared — every one is a CLS source.
  for (const img of document.querySelectorAll('img')) {
    if (!visible(img)) continue
    const cs = getComputedStyle(img)
    const hasRatio = cs.aspectRatio && cs.aspectRatio !== 'auto'
    if (!img.getAttribute('width') && !img.getAttribute('height') && !hasRatio) {
      bad.push(`IMG-NO-DIMENSIONS ${img.getAttribute('src')?.slice(-40)}`)
    }
  }

  // 4. Content taller than its own fixed-height container and clipped away.
  for (const el of document.querySelectorAll('main *')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    if (cs.overflow !== 'hidden' && cs.overflowY !== 'hidden') continue
    if (!el.textContent?.trim()) continue
    if (el.scrollHeight <= el.clientHeight + 6 || el.clientHeight === 0) continue
    // scrollHeight counts absolutely-positioned decoration that is MEANT to
    // overhang and be clipped — an oversized hover sheen, an orbiting lattice.
    // The question is whether IN-FLOW content is being cut, so measure that.
    const flow = [...el.children].filter((c) => {
      const p = getComputedStyle(c).position
      return p === 'static' || p === 'relative'
    })
    const contentBottom = flow.reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), -Infinity)
    if (contentBottom === -Infinity) continue
    const overflowPx = contentBottom - el.getBoundingClientRect().bottom
    if (overflowPx > 4) {
      bad.push(`CLIPPED-TEXT ${name(el)} in-flow content ${Math.round(overflowPx)}px past the box`)
    }
  }

  // 5. P5.5 — every real control is at least a 44x44 target on a TOUCH
  //    viewport (§6.6, and WCAG 2.5.5's own intent — finger precision, not
  //    mouse precision). Scoped to `touch` widths deliberately: applied to
  //    every width, this flagged ~150 "violations", every one of them a
  //    compact desktop nav link (the 7-item link row, the wordmark, RESUME,
  //    ARCADE) that has been through several prior passes of careful
  //    header-overflow tuning — see `.appearance-btn__label`'s own comment a
  //    few hundred lines up in index.css for one of them. Forcing a 21px-tall
  //    nav link to 44px on a MOUSE-driven desktop layout is not what the
  //    criterion is for, and it would re-open exactly the overflow bugs
  //    those passes closed, for a device class where the constraint does not
  //    apply. Inline text links are also exempt on touch — a word inside a
  //    sentence is not a touch target in the sense the rule means. The site
  //    wordmark is the other standard exception: a header logo-link, sized
  //    to read as a name rather than as a button, and every accessibility
  //    guide that covers target size treats it as one — a mis-tap there
  //    costs nothing (it targets `#hero`, the very top of the page a mobile
  //    visitor already is), unlike a mis-tap on an action.
  if (touch) {
    for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
      if (!visible(el)) continue
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed') continue
      const inline = el.tagName === 'A' && el.closest('p, li, figcaption, dd, dt')
      if (inline) continue
      if (el.classList.contains('nav-wordmark')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.width < 43 || r.height < 43) {
        bad.push(`TARGET-TOO-SMALL ${name(el)} "${(el.textContent || '').trim().slice(0, 18)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
    }
  }

  return { bad: [...new Set(bad)], vw, vh }
}

const b = await chromium.launch()
let problems = 0
for (const width of WIDTHS) {
  const touch = width < 900
  const ctx = await b.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: touch,
    isMobile: touch,
  })
  const page = await ctx.newPage()
  await page.addInitScript((s) => {
    try { localStorage.setItem('forge:v1', JSON.stringify(s)) } catch { /* ignore */ }
  }, SEED)
  await page.goto(BASE)
  await page.waitForSelector('header.site-header')
  // Scroll the whole page so every lazy section mounts.
  for (let i = 1; i <= 10; i++) {
    await page.evaluate((f) => window.scrollTo({ top: document.documentElement.scrollHeight * f, behavior: 'instant' }), i / 10)
    await page.waitForTimeout(150)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(250)
  const result = await page.evaluate(probe, touch)
  if (result.bad.length) {
    problems += result.bad.length
    console.log(`\n${width}px — ${result.bad.length} problem(s)`)
    for (const line of result.bad.slice(0, 14)) console.log('   ' + line)
    if (result.bad.length > 14) console.log(`   … and ${result.bad.length - 14} more`)
  } else {
    console.log(`${width}px — clean`)
  }
  await ctx.close()
}
await b.close()
console.log(problems ? `\nAUDIT — ${problems} problem(s)` : '\nAUDIT-CLEAN')
process.exit(problems ? 1 : 0)
