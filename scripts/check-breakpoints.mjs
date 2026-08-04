#!/usr/bin/env node
/**
 * check-breakpoints.mjs — T-010.5.
 *
 * Two rules, both structural:
 *
 *  1. **No raw px inside a `@media` prelude.** px in a media query does not
 *     respond to the browser's font size, so a visitor who has raised their
 *     default text size gets the desktop layout in a window that is, to them,
 *     phone-sized. rem does the right thing for free.
 *
 *  2. **No bare `min-width`/`max-width`.** They are a matched pair only by
 *     convention: `max-width: 767px` and `min-width: 768px` leave a gap that
 *     any fractional viewport width — every zoom level, every Windows scaling
 *     factor other than 100 % — falls straight into, matching neither. Range
 *     syntax (`width < 48rem` / `width >= 48rem`) is exact complements, and
 *     the gap cannot exist.
 *
 * Both rules are about making a class of bug unrepresentable rather than
 * about catching instances of it.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.cwd()
const STYLES = fileURLToPath(new URL('../src/styles', import.meta.url))

/** `min-resolution`, `min-color-index` and friends are not breakpoints. */
const DIMENSIONAL = /\b(min|max)-(width|height|inline-size|block-size)\b/

const failures = []
let checked = 0

for (const name of readdirSync(STYLES)) {
  if (!name.endsWith('.css')) continue
  const path = join(STYLES, name)
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n')
  checked += 1

  lines.forEach((line, i) => {
    const at = line.indexOf('@media')
    if (at === -1) return
    // The prelude is everything up to the opening brace on this line.
    const prelude = line.slice(at, line.includes('{') ? line.indexOf('{', at) : undefined)
    const where = `${relative(ROOT, path).replace(/\\/g, '/')}:${i + 1}`

    if (/\b\d+(\.\d+)?px\b/.test(prelude)) {
      failures.push(`${where}: raw px in a media prelude — use rem\n      ${prelude.trim()}`)
    }
    if (DIMENSIONAL.test(prelude)) {
      failures.push(`${where}: bare min-/max- dimension — use range syntax (width < 48rem)\n      ${prelude.trim()}`)
    }
  })
}

if (failures.length) {
  console.error('Breakpoint check failed:\n')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(`BREAKPOINTS-OK — ${checked} stylesheets, every media prelude in rem range syntax`)
