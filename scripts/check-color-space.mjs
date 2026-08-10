#!/usr/bin/env node
/**
 * P4A.6 — the gate that stops the cartoon coming back one commit at a time.
 *
 * Phase 4 is a rendering-pipeline replacement, and the thing about a pipeline
 * is that it is only as good as its worst participant. One `new Color('#ffe3b4')`
 * added six months from now, unconverted, is a colour that blends wrongly
 * against everything around it — and it will look *fine in isolation*, which is
 * exactly why nobody will catch it in review.
 *
 * Two rules:
 *
 *   1. Every sRGB literal in the 3-D layer goes through `srgb()` from
 *      `filmGrade.js`. `new Color('#…')` treats display-encoded hex digits as
 *      linear light; the difference is a 2.2 power curve and it lands squarely
 *      on the midtones.
 *   2. Every `new WebGLRenderer(...)` is followed by `applyFilmGrade(...)`.
 *      Before Phase 4A, one of the three factories was graded and two were
 *      not, so the gem and the desk sat on AgX while the background field and
 *      the fluid sat on no curve at all.
 *
 * Scope: files that construct three.js colours or renderers. CSS is not in
 * scope — the token layer is OKLCH and correct, and `check-contrast.mjs` owns
 * it. The cartoon was never the palette; it was the renderers.
 *
 * Usage: node scripts/check-color-space.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

/**
 * `filmGrade.js` itself defines the helper, so it is the one file allowed to
 * call `new Color()` on a literal without routing through it.
 */
const HELPER_FILE = join('src', 'lib', 'filmGrade.js')

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return /\.(js|jsx)$/.test(entry.name) ? [path] : []
  })
}

const files = walk(SRC)
const failures = []
let literals = 0
let renderers = 0

for (const path of files) {
  const rel = relative(ROOT, path)
  const source = readFileSync(path, 'utf8')
  if (!source.includes('three') && !source.includes('Color(')) continue

  const lines = source.split(/\r?\n/)

  lines.forEach((line, i) => {
    // Comments and doc blocks talk about `new Color('#…')` constantly — this
    // file's own header does. A gate that fires on prose is a gate people
    // learn to ignore.
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')

    // ── rule 1: sRGB literals ────────────────────────────────────────────
    for (const m of code.matchAll(/new\s+Color\s*\(\s*(['"`])(#[0-9a-fA-F]{3,8})\1/g)) {
      literals += 1
      if (rel === HELPER_FILE) continue
      failures.push(
        `${rel}:${i + 1}  new Color('${m[2]}') — an sRGB literal handed to the renderer as if it ` +
        `were linear light. Use \`srgb('${m[2]}')\` from lib/filmGrade.js.`
      )
    }
  })

  // ── rule 2: every renderer is graded ───────────────────────────────────
  const constructions = [...source.matchAll(/new\s+WebGLRenderer\s*\(/g)]
  renderers += constructions.length
  if (constructions.length) {
    const graded = (source.match(/applyFilmGrade\s*\(/g) || []).length
    if (graded < constructions.length) {
      failures.push(
        `${rel}  constructs ${constructions.length} WebGLRenderer(s) but calls applyFilmGrade ` +
        `${graded} time(s). An ungraded renderer beside a graded one is two different websites.`
      )
    }
  }
}

console.log(`\nColour pipeline (${files.length} modules scanned)`)
console.log('─'.repeat(52))
console.log(`  sRGB literals routed through srgb()   ${literals}`)
console.log(`  WebGLRenderer constructions            ${renderers}`)
console.log('─'.repeat(52))

if (failures.length) {
  console.error('COLOUR-SPACE FAILURES:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('COLOR-SPACE-OK — linear working space, AgX, sRGB out.\n')
