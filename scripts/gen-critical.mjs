#!/usr/bin/env node
/**
 * §P0.5 — critical.css used to hand-duplicate token values from index.css,
 * with a comment begging future-you to keep them in sync. This generates the
 * token half of critical.css FROM index.css so that can never drift again.
 *
 * Only a small whitelist of tokens is pulled in — critical.css exists to
 * paint the first frame before the real stylesheet arrives, not to mirror
 * the whole design system.
 *
 * **It regenerates the marked region and nothing else.** The previous version
 * rebuilt the entire file from a template held inside this script, which
 * meant every hand-authored rule in critical.css — the safe-area padding, the
 * compact hero composition, the `<noscript>` styles, the `@font-face`
 * declarations — was silently deleted the next time anyone ran it. A
 * generator that owns a whole file has to *be* the whole file's source; this
 * one owns twenty lines, so it edits twenty lines.
 *
 * Usage:
 *   node scripts/gen-critical.mjs         regenerate the token region
 *   node scripts/gen-critical.mjs --check fail if the committed file is stale
 */
import { readFileSync, writeFileSync } from 'node:fs'

const INDEX_CSS = new URL('../src/styles/index.css', import.meta.url)
const CRITICAL_CSS = new URL('../src/styles/critical.css', import.meta.url)

const BEGIN = '/* ── GENERATED: token subset from :root / [data-theme] in index.css ── */'
const END = '/* ── END GENERATED ── */'

// The only custom properties the first paint actually needs. Anything not
// listed here stays out of critical.css even if it exists in the source block.
const WHITELIST = [
  'surface-0', 'surface-1', 'surface-2', 'surface-3',
  'ink-hi', 'ink', 'ink-mid', 'ink-low',
  'accent', 'accent-bright', 'accent-dim',
  'violet', 'warm',
  'glass-border',
]

/** Extracts the first `selector { ... }` block's body, brace-balanced. */
function extractBlock(css, selectorRe) {
  const m = selectorRe.exec(css)
  if (!m) throw new Error(`gen-critical: selector not found: ${selectorRe}`)
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') depth--
    i++
  }
  return css.slice(start, i - 1)
}

/** Pulls `--name: value;` declarations matching the whitelist, in file order. */
function pickTokens(blockBody) {
  const out = []
  const re = /--([a-z0-9-]+):\s*([^;]+);/gi
  let m
  while ((m = re.exec(blockBody))) {
    const [, name, value] = m
    if (WHITELIST.includes(name)) out.push(`  --${name}: ${value.trim()};`)
  }
  return out
}

/** The generated region: three token blocks, derived from index.css. */
function generateRegion() {
  const css = readFileSync(INDEX_CSS, 'utf8')
  const rootTokens = pickTokens(extractBlock(css, /:root\s*\{/))
  const emberTokens = pickTokens(extractBlock(css, /\[data-theme=["']ember["']\]\s*\{/))
  const paperTokens = pickTokens(extractBlock(css, /\[data-theme=["']paper["']\]\s*\{/))

  return `${BEGIN}
:root {
${rootTokens.join('\n')}
}
[data-theme='ember'] {
${emberTokens.join('\n')}
}
[data-theme='paper'] {
${paperTokens.join('\n')}
}
${END}`
}

/** Splice the region into the existing file, leaving everything else alone. */
function splice(existing, region) {
  const start = existing.indexOf(BEGIN)
  const end = existing.indexOf(END)
  if (start === -1 || end === -1) {
    throw new Error(
      'gen-critical: the GENERATED markers are missing from critical.css. ' +
      'They delimit the only part of that file this script owns.'
    )
  }
  return existing.slice(0, start) + region + existing.slice(end + END.length)
}

const current = readFileSync(CRITICAL_CSS, 'utf8')
const next = splice(current, generateRegion())

if (process.argv.includes('--check')) {
  if (current !== next) {
    console.error('gen-critical: the token region in src/styles/critical.css is stale.')
    console.error('A token in index.css changed but critical.css was not regenerated.')
    console.error('Run `npm run gen:critical`, review the diff, and commit it.')
    process.exit(1)
  }
  console.log('gen-critical: critical.css is up to date.')
} else {
  writeFileSync(CRITICAL_CSS, next)
  console.log('gen-critical: regenerated the token region of src/styles/critical.css')
}
