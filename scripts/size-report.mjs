#!/usr/bin/env node
/**
 * size-report.mjs — T-048.1.
 *
 * D-34: budgets are absolute ceilings, so a chunk can grow 40 % and still
 * pass. That is how a bundle gets heavy — never in one careless commit, but
 * in twenty reasonable ones, each of which was individually under the limit.
 *
 * This records every chunk's gzipped size and compares it against the base
 * branch, failing on **> 3 % growth in any chunk** even when the chunk is
 * comfortably under budget. Three per cent is deliberately tight: real
 * additions are usually much larger and get a deliberate budget conversation;
 * accidental ones are usually smaller and get caught before they accumulate.
 *
 *   node scripts/size-report.mjs --write size-report.json
 *   node scripts/size-report.mjs --compare origin/main
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { execSync } from 'node:child_process'

const ASSETS = fileURLToPath(new URL('../dist/assets', import.meta.url))
const GROWTH_LIMIT = 0.03

if (!existsSync(ASSETS)) {
  console.error('size-report: no dist/assets — run `npm run build` first.')
  process.exit(1)
}

/**
 * Chunk names carry a content hash, so `index-CyxRDqtb.js` and
 * `index-DAltxsnw.js` are the same chunk at two commits. The hash is stripped
 * to make them comparable — that is the whole trick this report needs.
 */
const stripHash = (name) => name.replace(/-[A-Za-z0-9_-]{8,}(\.[a-z0-9]+)$/, '$1')

function measure() {
  const sizes = {}
  for (const file of readdirSync(ASSETS)) {
    if (!/\.(js|css)$/.test(file)) continue
    const gz = join(ASSETS, `${file}.gz`)
    const bytes = existsSync(gz)
      ? readFileSync(gz).length
      : gzipSync(readFileSync(join(ASSETS, file))).length
    const key = stripHash(file)
    // Rolldown can emit several chunks that strip to the same name; summing
    // them keeps the comparison stable rather than arbitrary.
    sizes[key] = (sizes[key] || 0) + bytes
  }
  return sizes
}

const current = measure()
const args = process.argv.slice(2)

if (args[0] === '--write') {
  const out = args[1] || 'size-report.json'
  writeFileSync(out, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
  console.log(`size-report: wrote ${Object.keys(current).length} chunk sizes to ${out}`)
  process.exit(0)
}

if (args[0] === '--compare') {
  const ref = args[1] || 'origin/main'
  let baseline = null
  try {
    // The base branch's report is not in the working tree, so it is read from
    // git — which also means this works without a second checkout.
    baseline = JSON.parse(execSync(`git show ${ref}:size-report.json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  } catch {
    console.log(`size-report: no baseline at ${ref}:size-report.json — nothing to compare against yet.`)
    process.exit(0)
  }

  const rows = []
  const failures = []
  for (const [name, bytes] of Object.entries(current)) {
    const before = baseline[name]
    if (before == null) { rows.push([name, null, bytes, null]); continue }
    const delta = (bytes - before) / before
    rows.push([name, before, bytes, delta])
    if (delta > GROWTH_LIMIT) {
      failures.push(`${name} grew ${(delta * 100).toFixed(1)}% (${(before / 1024).toFixed(1)} → ${(bytes / 1024).toFixed(1)} KB)`)
    }
  }

  const kb = (n) => (n == null ? '—' : `${(n / 1024).toFixed(1)} KB`)
  console.log('\n| Chunk | Base | This build | Δ |')
  console.log('|---|---:|---:|---:|')
  for (const [name, before, after, delta] of rows.sort((a, b) => b[2] - a[2])) {
    const arrow = delta == null ? 'new' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`
    console.log(`| \`${name}\` | ${kb(before)} | ${kb(after)} | ${arrow} |`)
  }

  if (failures.length) {
    console.error(`\nBundle growth over ${GROWTH_LIMIT * 100}%:`)
    for (const failure of failures) console.error(`  ✗ ${failure}`)
    process.exit(1)
  }
  console.log(`\nSIZE-OK — no chunk grew more than ${GROWTH_LIMIT * 100}%\n`)
  process.exit(0)
}

// Default: just print the table.
for (const [name, bytes] of Object.entries(current).sort((a, b) => b[1] - a[1])) {
  console.log(`${(bytes / 1024).toFixed(1).padStart(8)} KB  ${name}`)
}
