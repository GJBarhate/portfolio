#!/usr/bin/env node
/**
 * check-overflow.mjs — T-027.
 *
 * Horizontal scroll on a phone is the single most common "the site is broken"
 * report, and the thing that makes it expensive is that
 * `scrollWidth > clientWidth` tells you *that* something overflows and never
 * *what*. This walks the DOM and names the element, at every width in the
 * device matrix, in every theme, with the drawer and the palette both open
 * and closed — because a page that is clean at rest and 40px wide with the
 * menu open is still broken.
 *
 * `html { overflow-x: clip }` (layout.css) means the document itself will not
 * report an overflow any more, which is exactly why this script compares
 * element rectangles against the viewport instead of trusting scrollWidth.
 *
 * Usage: npm run build && node scripts/check-overflow.mjs
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const PORT = Number(process.env.OVERFLOW_PORT || 4188)
const ORIGIN = `http://localhost:${PORT}`

/** §3.2, plus the two iPad Split View widths from T-028.4. */
const WIDTHS = [320, 344, 375, 390, 430, 507, 673, 694, 768, 844, 1024, 1440, 1920, 2560]
const THEMES = ['eclipse', 'ember', 'paper']

/** The states a visitor can put the page into without leaving the route. */
const STATES = [
  { name: 'at rest', open: null },
  { name: 'drawer open', open: '.nav-burger' },
  { name: 'palette open', open: '.nav-search' },
]

if (!existsSync(DIST)) {
  console.error('check-overflow: no dist/ — run `npm run build` first.')
  process.exit(1)
}

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', shell: process.platform === 'win32' })

const stop = () => { try { server.kill() } catch { /* already gone */ } }
process.on('exit', stop)
process.on('SIGINT', () => { stop(); process.exit(130) })

/** Wait for the preview server rather than sleeping a guessed amount. */
async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN, { method: 'HEAD' })
      if (response.ok || response.status === 404) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

/**
 * The DOM walk. An element counts as overflowing when its border box extends
 * past the viewport on either side by more than a pixel — the tolerance is
 * for sub-pixel rounding, not for "nearly fits".
 */
const FIND_OVERFLOW = () => {
  const limit = document.documentElement.clientWidth
  const offenders = []
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    // Fixed/sticky decoration that is deliberately wider than the viewport
    // (a marquee track, say) is clipped by an ancestor and cannot be scrolled
    // to; what matters is whether an ancestor allows it to be reached.
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const overRight = rect.right - limit
    const overLeft = -rect.left
    if (overRight <= 1 && overLeft <= 1) continue

    // Walk up: if any ancestor clips, this element cannot cause scroll.
    let clipped = false
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const ps = getComputedStyle(parent)
      if (/(hidden|clip|auto|scroll)/.test(ps.overflowX)) { clipped = true; break }
    }
    if (clipped) continue

    const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className || '').split(' ')[0]}`
    if (seen.has(label)) continue
    seen.add(label)
    offenders.push(`${label} → ${Math.round(Math.max(overRight, overLeft))}px past the edge`)
  }
  return offenders
}

const failures = []

if (!(await waitForServer())) {
  console.error('check-overflow: the preview server never came up.')
  stop()
  process.exit(1)
}

const browser = await chromium.launch()
let checks = 0

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width <= 844,
      isMobile: width <= 844,
    })
    const page = await context.newPage()
    await page.addInitScript((t) => {
      localStorage.setItem('forge:v1', JSON.stringify({
        version: 1, theme: t, motion: 'system',
        progress: { unlocked: [] }, sparks: [], scores: {},
        seen: { intro: Date.now() }, prefs: {},
      }))
    }, theme)
    await page.goto(ORIGIN)
    await page.waitForSelector('header.site-header')

    for (const state of STATES) {
      // The drawer only exists below the lg nav switch.
      if (state.open === '.nav-burger' && width >= 1024) continue
      // Scrolling to the bottom of the page raises the "run complete"
      // overlay, which is a modal and correctly swallows clicks aimed at the
      // header. Return to the top and dismiss it before opening the next
      // state — Escape first, then a backdrop click, because it can re-arm
      // if the bottom is reached again.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.keyboard.press('Escape')
      await page.waitForTimeout(120)
      await page.evaluate(() => {
        const overlay = document.querySelector('.run-complete')
        if (overlay) overlay.click()
      })
      await page.waitForTimeout(120)

      if (state.open) {
        const control = page.locator(state.open)
        if (await control.count() === 0 || !(await control.first().isVisible())) continue
        await control.first().click()
        await page.waitForTimeout(250)
      }

      // Scroll through the page: an overflow can be introduced by a section
      // that has not entered the viewport yet.
      for (const fraction of [0, 0.35, 0.7, 1]) {
        await page.evaluate((f) => window.scrollTo({ top: document.documentElement.scrollHeight * f, behavior: 'instant' }), fraction)
        await page.waitForTimeout(100)
        const offenders = await page.evaluate(FIND_OVERFLOW)
        checks += 1
        for (const offender of offenders) {
          failures.push(`${width}px · ${theme} · ${state.name} · ${Math.round(fraction * 100)}% — ${offender}`)
        }
      }

      if (state.open) await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
    }
    await context.close()
  }
}

await browser.close()
stop()

if (failures.length) {
  console.error('Overflow check failed:\n')
  // Same element at many widths is one bug; report it once with its widths.
  for (const failure of [...new Set(failures)].slice(0, 40)) console.error(`  ✗ ${failure}`)
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`)
  process.exit(1)
}

console.log(`OVERFLOW-CLEAN — ${checks} states across ${WIDTHS.length} widths x ${THEMES.length} themes`)
