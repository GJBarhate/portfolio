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
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const ASSETS = join(DIST, 'assets')

const KB = 1024
const BUDGETS = {
  entry: 75 * KB,
  motion: 45 * KB,
  three: 135 * KB,
  eagerTotal: 115 * KB,
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
// Everything the document asks for before any interaction: the entry module
// plus its modulepreloads plus whatever the entry statically imports.
const preloaded = [...html.matchAll(/href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
const entry = chunkOf('index') || preloaded.find((f) => f.startsWith('index-'))
const entrySrc = readFileSync(join(ASSETS, entry), 'utf8')
const staticImports = [...entrySrc.matchAll(/(?:^|[};])import[^;]*?from"\.\/([^"]+\.js)"/g)].map((m) => m[1])

const eager = [...new Set([entry, ...preloaded, ...staticImports])]

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
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(26)} ${shown}`)
}
console.log('─'.repeat(52))
console.log(`eager chunks: ${eager.join(', ')}\n`)

if (failures.length) {
  console.error('BUDGET FAILURES:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('All budgets green.\n')
