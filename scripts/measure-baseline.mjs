#!/usr/bin/env node
/**
 * measure-baseline.mjs — T-009.
 *
 * "Phase gates compare against something. There is nothing to compare
 * against." This measures the something.
 *
 * It is deliberately not a Lighthouse wrapper. Lighthouse gives one composite
 * score that moves for reasons unrelated to the change under test; what a
 * gate needs is the individual field metrics, measured the same way every
 * time, on a device profile that resembles the visitor who is hardest to
 * serve. So: Chrome DevTools Protocol throttling at the Moto G Power profile
 * (4x CPU slowdown, Slow 4G), real `PerformanceObserver` entries, five runs,
 * medians reported.
 *
 * The numbers are honest about what they are: emulated CPU throttling is not
 * a Moto G, and this says so in the output rather than implying otherwise.
 *
 *   node scripts/measure-baseline.mjs                 → prints a table
 *   node scripts/measure-baseline.mjs --write <path>  → writes the markdown
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const PORT = Number(process.env.BASELINE_PORT || 4191)
const ORIGIN = `http://localhost:${PORT}`
const RUNS = Number(process.env.BASELINE_RUNS || 5)
const THEMES = ['eclipse', 'ember', 'paper']

/**
 * The Moto G Power profile: the device Google's own field guidance uses as
 * "the slow phone most people actually own".
 */
const PROFILES = {
  'moto-g-power': {
    label: 'Moto G Power (emulated: 4x CPU, Slow 4G)',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    cpuThrottling: 4,
    network: { downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 },
  },
  desktop: {
    label: 'Desktop (no throttling)',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    cpuThrottling: 1,
    network: null,
  },
}

if (!existsSync(DIST)) {
  console.error('measure-baseline: no dist/ — run `npm run build` first.')
  process.exit(1)
}

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore', shell: process.platform === 'win32' })
const stopServer = () => { try { server.kill() } catch { /* already gone */ } }
process.on('exit', stopServer)

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(ORIGIN, { method: 'HEAD' })
      if (res.ok || res.status === 404) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

/** The observers, installed before any app code runs. */
const INSTALL_OBSERVERS = () => {
  window.__metrics = { lcp: 0, cls: 0, fcp: 0, ttfb: 0, longTasks: 0, longTaskMs: 0 }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__metrics.lcp = entry.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only shifts the visitor did not cause count toward CLS.
        if (!entry.hadRecentInput) window.__metrics.cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') window.__metrics.fcp = entry.startTime
      }
    }).observe({ type: 'paint', buffered: true })
  } catch { /* unsupported */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__metrics.longTasks += 1
        window.__metrics.longTaskMs += entry.duration
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* Safari */ }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function runOnce(browser, profile, theme) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.isMobile,
  })
  const page = await context.newPage()
  const client = await context.newCDPSession(page)

  if (profile.cpuThrottling > 1) {
    await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottling })
  }
  if (profile.network) {
    await client.send('Network.emulateNetworkConditions', { offline: false, ...profile.network })
  }

  await page.addInitScript(INSTALL_OBSERVERS)
  await page.addInitScript((t) => {
    localStorage.setItem('forge:v1', JSON.stringify({
      version: 1, theme: t, motion: 'system',
      progress: { unlocked: [] }, sparks: [], scores: {},
      seen: { intro: Date.now() }, prefs: {},
    }))
  }, theme)

  const started = Date.now()
  await page.goto(ORIGIN, { waitUntil: 'load' })
  // Give LCP candidates and lazy sections a chance to settle, then scroll —
  // a metric taken without scrolling misses everything below the fold.
  await page.waitForTimeout(2500)
  for (let i = 1; i <= 6; i++) {
    await page.evaluate((f) => window.scrollTo({ top: document.documentElement.scrollHeight * f, behavior: 'instant' }), i / 6)
    await page.waitForTimeout(250)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

  // INP is an interaction metric, so it needs an interaction. A click on the
  // search button opens the palette, which is the heaviest single interaction
  // the page has.
  const interactionStart = Date.now()
  try {
    await page.locator('.nav-search').click({ timeout: 5000 })
    await page.locator('.cmdpal').waitFor({ state: 'visible', timeout: 5000 })
  } catch { /* the interaction cost is still recorded below */ }
  const interactionMs = Date.now() - interactionStart

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    return {
      ...window.__metrics,
      ttfb: nav ? nav.responseStart : 0,
      domInteractive: nav ? nav.domInteractive : 0,
      transferKB: performance.getEntriesByType('resource')
        .reduce((sum, r) => sum + (r.transferSize || 0), (nav?.transferSize || 0)) / 1024,
      requests: performance.getEntriesByType('resource').length + 1,
    }
  })

  await context.close()
  return { ...metrics, interactionMs, wallMs: Date.now() - started }
}

if (!(await waitForServer())) {
  console.error('measure-baseline: the preview server never came up.')
  stopServer()
  process.exit(1)
}

const browser = await chromium.launch()
const results = {}

for (const [profileName, profile] of Object.entries(PROFILES)) {
  results[profileName] = {}
  for (const theme of THEMES) {
    const runs = []
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(browser, profile, theme))
    results[profileName][theme] = {
      lcp: median(runs.map((r) => r.lcp)),
      fcp: median(runs.map((r) => r.fcp)),
      cls: median(runs.map((r) => r.cls)),
      ttfb: median(runs.map((r) => r.ttfb)),
      longTasks: median(runs.map((r) => r.longTasks)),
      longTaskMs: median(runs.map((r) => r.longTaskMs)),
      interactionMs: median(runs.map((r) => r.interactionMs)),
      transferKB: median(runs.map((r) => r.transferKB)),
      requests: median(runs.map((r) => r.requests)),
      domInteractive: median(runs.map((r) => r.domInteractive)),
    }
    process.stderr.write(`  measured ${profileName} · ${theme}\n`)
  }
}

await browser.close()
stopServer()

const ms = (v) => `${Math.round(v)} ms`
const table = (profileName) => {
  const profile = PROFILES[profileName]
  const rows = THEMES.map((theme) => {
    const m = results[profileName][theme]
    return `| ${theme} | ${ms(m.lcp)} | ${ms(m.fcp)} | ${m.cls.toFixed(4)} | ${ms(m.ttfb)} | ${Math.round(m.longTasks)} | ${ms(m.longTaskMs)} | ${ms(m.interactionMs)} | ${Math.round(m.transferKB)} KB | ${Math.round(m.requests)} |`
  })
  return `### ${profile.label}

| Theme | LCP | FCP | CLS | TTFB | Long tasks | Long-task total | Palette open | Transfer | Requests |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join('\n')}`
}

const doc = `# Baseline — August 2026

<!-- GENERATED by scripts/measure-baseline.mjs. Re-run it rather than editing
     the numbers; a hand-edited baseline is not a baseline. -->

Measured on a local preview build, ${RUNS} runs per cell, medians reported.

**What these numbers are.** Chrome DevTools Protocol throttling at the
Moto G Power profile — 4x CPU slowdown and a Slow-4G network shape. That is an
*emulation*: it slows the main thread and the network by a fixed factor, and it
does not reproduce a real phone's thermal behaviour, its GPU, or its memory
pressure. Field RUM (T-008) is the authority on what visitors actually
experience; this is the number that has to move before that one will.

**What they are not.** They are not Lighthouse scores, deliberately. A
composite score moves for reasons unrelated to the change under test, which
makes it a poor gate; these are the individual metrics the gates in §3.1 name.

${table('moto-g-power')}

${table('desktop')}

## Reading these

| Metric | Google's "good" band (p75 field) | Where this build sits |
|---|---|---|
| LCP | < 2.5 s | ${ms(results['moto-g-power'].eclipse.lcp)} on the throttled profile |
| CLS | < 0.1 | ${results['moto-g-power'].eclipse.cls.toFixed(4)} |
| INP | < 200 ms | not directly measurable in a lab; the palette-open figure above is the closest proxy |

Long tasks are counted for the whole load-plus-scroll sequence, not only the
initial paint, because a page that loads fast and then blocks for 300 ms when
a section enters is not a fast page.

## Raw data

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`
`

const writeIndex = process.argv.indexOf('--write')
if (writeIndex !== -1) {
  const target = process.argv[writeIndex + 1] || 'docs/baseline/2026-08.md'
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, doc, 'utf8')
  console.log(`measure-baseline: wrote ${target}`)
} else {
  console.log(doc)
}
