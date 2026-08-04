#!/usr/bin/env node
/**
 * §11 — bundle budgets as a build gate.
 *
 * The point is that a regression fails the build rather than reaching
 * visitors. Every number here traces to §8.1; the eager set is derived from
 * what index.html actually preloads plus what the entry statically imports,
 * so "three crept back into the critical path" is caught by construction
 * rather than by someone remembering to open Lighthouse.
 *
 * Usage: npm run check:budgets   (runs automatically after `npm run build`)
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const ASSETS = join(DIST, 'assets')
const PUBLIC_FONTS = fileURLToPath(new URL('../public/fonts', import.meta.url))
const SHADERS_DIR = fileURLToPath(new URL('../src/shaders', import.meta.url))

const KB = 1024
const BUDGETS = {
  entry: 75 * KB,
  motion: 45 * KB,
  three: 135 * KB,
  threeWebgpu: 190 * KB,
  eagerTotal: 115 * KB,
  /*
   * 40 -> 44 KB, and the reason is recorded rather than quietly bumped.
   *
   * 40 KB was set when the page carried 12 registered effects. It now carries
   * 14, and the two additions are the largest visual systems on the site: the
   * orrery (Sun and eight planets, 2.6 KB) and the skill ring (a six-face 3-D
   * carousel, 2.1 KB), both requested, both deliberately CSS rather than
   * WebGL — see docs/gates/PHASE-5.md for why that trade was taken.
   *
   * The measured total is 39.6 KB. Consolidating the duplicated rules inside
   * those systems was tried first and moved the gzipped figure by less than
   * 0.1 KB, because gzip already collapses that repetition; the only way to
   * get materially under 40 was to delete the features. 44 restores the same
   * ~10 % headroom the budget was written with, so it still fails on drift
   * rather than sitting permanently on the line.
   *
   * 44 -> 46 KB, same rule: recorded, not quietly bumped.
   *
   * Two changes spent it. The skill reactor stopped being `hidden md:block`
   * and now has a phone geometry (~1 KB raw), and the run-complete celebration
   * stopped being a full-screen modal and became a corner toast — a card with
   * a lit rim, a specular sweep and a countdown rail costs more CSS than a
   * centred box on a blurred backdrop did (~4 KB raw). Both were asked for,
   * and both are the difference between an effect existing on a phone and not.
   *
   * Trimmed first, in this order: the toast's own reduced-motion block (every
   * loop already divides by --motion-scale, so it was dead weight), the four
   * hub ornaments in the reactor's phone block that already fit a 320px
   * screen, and the dead CRT-flicker keyframes the modal was the only user of.
   * That recovered ~0.4 KB gzipped and the measured total is 44.6 KB. There is
   * a genuine ~100-selector dead utility layer left in index.css (the `*pt`
   * spacing scale, `col-span-*`, `text-step-*`, `fs-*`, `shadow-e*`) which is
   * the right place to win this back properly — it is a separate change, not
   * something to fold into a feature.
   */
  cssTotal: 46 * KB,
  prerenderedHtml: 24 * KB,
  fontsTotal: 120 * KB,
  shadersTotal: 60 * KB,
}
const MIN_PROJECT_DERIVATIVES = 15

if (!existsSync(ASSETS)) {
  console.error('check-budgets: no dist/assets — run `npm run build` first.')
  process.exit(1)
}

const files = readdirSync(ASSETS)
const js = files.filter((f) => f.endsWith('.js'))

const gzSize = (name) => {
  const gz = join(ASSETS, name + '.gz')
  if (existsSync(gz)) return readFileSync(gz).length
  return gzipSync(readFileSync(join(ASSETS, name))).length
}

const chunkOf = (prefix) => js.find((f) => f.startsWith(prefix + '-'))
const html = readFileSync(join(DIST, 'index.html'), 'utf8')

// ── the eager set ─────────────────────────────────────────────────────────
// Vite 8 (Rolldown) modulepreloads popular lazy chunks for network perf.
// Those are downloaded-not-executed until their dynamic import fires, so
// they must not count as "eager". The eager set = modulepreloaded chunks
// MINUS anything listed in the dynamic-import dep map (__vite__mapDeps).
const preloaded = [...html.matchAll(/href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
const entry = chunkOf('index') || preloaded.find((f) => f.startsWith('index-'))
const entrySrc = readFileSync(join(ASSETS, entry), 'utf8')

// Rolldown stores lazy-chunk filenames in __vite__mapDeps. Any chunk that
// appears there is reachable only through dynamic import, not at first paint.
const lazyDepsMatch = entrySrc.match(/__vite__mapDeps[^[]*\[([^\]]+)\]/)
const lazyDeps = new Set(
  lazyDepsMatch
    ? [...lazyDepsMatch[1].matchAll(/"assets\/([^"]+\.js)"/g)].map((m) => m[1])
    : []
)

// ES-module static imports (Rollup style, still works if Vite falls back)
const staticImports = [...entrySrc.matchAll(/from\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1])

// The eager set: entry + its runtime deps + modulepreloads that are NOT lazy
const eager = [...new Set([entry, ...preloaded, ...staticImports])].filter(
  (f) => !lazyDeps.has(f)
)

const failures = []
const report = []

// ── per-chunk ceilings ────────────────────────────────────────────────────
const entrySize = gzSize(entry)
report.push(['entry', entrySize, BUDGETS.entry])
if (entrySize > BUDGETS.entry) failures.push(`entry ${entrySize} > ${BUDGETS.entry}`)

for (const name of ['motion', 'three']) {
  const chunk = chunkOf(name)
  if (!chunk) { report.push([name, 0, BUDGETS[name]]); continue }
  const size = gzSize(chunk)
  report.push([name, size, BUDGETS[name]])
  if (size > BUDGETS[name]) failures.push(`${name} ${size} > ${BUDGETS[name]}`)
  // The hard part of the budget is not the size — it is the reachability.
  if (eager.includes(chunk)) {
    failures.push(`${name} is in the EAGER graph — it must be reachable only from gated islands (§8.2/§8.3)`)
  }
}

const eagerTotal = eager.reduce((sum, f) => sum + gzSize(f), 0)
report.push(['eager total', eagerTotal, BUDGETS.eagerTotal])
if (eagerTotal > BUDGETS.eagerTotal) failures.push(`eager total ${eagerTotal} > ${BUDGETS.eagerTotal}`)

// ── v5 gates (§P0.6) ─────────────────────────────────────────────────────

// three-webgpu: absent until P1 lands gpu.js's WebGPU backend. Same
// reachability rule as `three`/`motion` once it exists.
{
  const chunk = chunkOf('three-webgpu')
  const size = chunk ? gzSize(chunk) : 0
  report.push(['three-webgpu', size, BUDGETS.threeWebgpu])
  if (size > BUDGETS.threeWebgpu) failures.push(`three-webgpu ${size} > ${BUDGETS.threeWebgpu}`)
  if (chunk && eager.includes(chunk)) {
    failures.push('three-webgpu is in the EAGER graph — it must be reachable only from gated islands')
  }
}

// CSS total — Tailwind 4 + material layers must not bloat the stylesheet.
const cssTotal = files
  .filter((f) => f.endsWith('.css'))
  .reduce((sum, f) => sum + gzSize(f), 0)
report.push(['css total', cssTotal, BUDGETS.cssTotal])
if (cssTotal > BUDGETS.cssTotal) failures.push(`css total ${cssTotal} > ${BUDGETS.cssTotal}`)

// Prerendered index.html — currently the bare SPA shell; P9 replaces the
// body with real markup and this ceiling is what keeps that honest.
const htmlGz = gzipSync(readFileSync(join(DIST, 'index.html'))).length
report.push(['prerendered html', htmlGz, BUDGETS.prerenderedHtml])
if (htmlGz > BUDGETS.prerenderedHtml) failures.push(`prerendered html ${htmlGz} > ${BUDGETS.prerenderedHtml}`)

// Fonts total (raw — woff2 is already compressed) — currently 11 static
// faces (~174 KB); P6 replaces them with 2 variable fonts under budget.
// Reported, not yet enforced: failing the build on a phase that has not
// been reached yet would violate "never leave main broken between phases".
let fontsTotal = 0
if (existsSync(PUBLIC_FONTS)) {
  fontsTotal = readdirSync(PUBLIC_FONTS)
    .filter((f) => f.endsWith('.woff2'))
    .reduce((sum, f) => sum + statSync(join(PUBLIC_FONTS, f)).size, 0)
}
report.push(['fonts total (target, P6)', fontsTotal, BUDGETS.fontsTotal, 'target'])

// shaders/ source total (raw) — unbounded shader growth is unbounded compile
// time. Empty until P1/P2 introduce src/shaders/.
let shadersTotal = 0
if (existsSync(SHADERS_DIR)) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
    )
  shadersTotal = walk(SHADERS_DIR).reduce((sum, f) => sum + statSync(f).size, 0)
}
report.push(['shaders source', shadersTotal, BUDGETS.shadersTotal])
if (shadersTotal > BUDGETS.shadersTotal) failures.push(`shaders source ${shadersTotal} > ${BUDGETS.shadersTotal}`)

// ── glob guard (§11) ──────────────────────────────────────────────────────
// The P0-1 class of bug — a glob that silently matches nothing — can never
// ship again: if the screenshots are not in dist, the build fails.
const derivatives = files.filter((f) =>
  /^(peercode|flowshield|voiceans|onecart|lms)-/.test(f) && /\.(avif|webp)$/.test(f)
).length
report.push(['project image derivatives', derivatives, MIN_PROJECT_DERIVATIVES, 'min'])
if (derivatives < MIN_PROJECT_DERIVATIVES) {
  failures.push(`only ${derivatives} project image derivatives in dist (expected ≥ ${MIN_PROJECT_DERIVATIVES}) — the Projects image glob is matching nothing again`)
}

// ── output ────────────────────────────────────────────────────────────────
const fmt = (n) => (n / KB).toFixed(1).padStart(7) + ' KB'
console.log('\nBundle budgets (gzipped)\n' + '─'.repeat(52))
for (const [label, actual, limit, kind] of report) {
  const ok = kind === 'min' ? actual >= limit : actual <= limit
  const shown = kind === 'min' ? `${actual} / min ${limit}` : `${fmt(actual)} / ${fmt(limit)}`
  const mark = kind === 'target' ? (ok ? '✓' : '○') : ok ? '✓' : '✗'
  console.log(`${mark} ${label.padEnd(26)} ${shown}`)
}
console.log('─'.repeat(52))
console.log(`eager chunks: ${eager.join(', ')}\n`)

if (failures.length) {
  console.error('BUDGET FAILURES:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('All budgets green.\n')
