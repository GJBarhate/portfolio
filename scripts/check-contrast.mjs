#!/usr/bin/env node
/**
 * check-contrast.mjs — T-042.
 *
 * The palette is authored in OKLCH, which is the right choice: perceptual
 * lightness means a lightness ramp *is* a contrast ramp, and the same L
 * across different hues reads as the same weight — something HSL cannot
 * promise. What OKLCH says nothing about is the **WCAG 2.1 contrast ratio**,
 * which is computed from sRGB relative luminance and is the number an
 * accessibility audit will actually measure.
 *
 * So this script does the conversion the palette does not: it parses the
 * token layer, resolves every theme (including the wide-gamut P3 branch,
 * converted back to sRGB), and computes the ratio for every declared
 * foreground/background role pair.
 *
 * Thresholds are WCAG 2.1 AA:
 *   4.5:1  body text
 *   3.0:1  large text (>= 24px, or 18.66px bold) and UI boundaries
 *
 * Fixes go in one direction only — **lightness** — so the palette's hue and
 * chroma character survives the correction.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSS = fileURLToPath(new URL('../src/styles/index.css', import.meta.url))
const source = readFileSync(CSS, 'utf8')

// ── colour maths ──────────────────────────────────────────────────────────

/** OKLCH → linear sRGB → gamma sRGB, clamped. */
function oklchToRgb(L, C, h) {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((v) => Math.min(1, Math.max(0, v)))
}

/** WCAG relative luminance takes LINEAR values, which is what we already have. */
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function ratio(fg, bg) {
  const a = luminance(fg) + 0.05
  const b = luminance(bg) + 0.05
  return a > b ? a / b : b / a
}

// ── token parsing ─────────────────────────────────────────────────────────

const OKLCH = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/

/**
 * Pull `--name: oklch(...)` declarations out of one selector's block.
 * Alpha-carrying tokens (`--accent-ghost`) are skipped: a translucent colour
 * has no single contrast ratio, it has one per surface it lands on, and the
 * surfaces are already checked.
 */
function parseBlock(selector) {
  const start = source.indexOf(selector)
  if (start === -1) return null
  const open = source.indexOf('{', start)
  // Nested blocks (@supports, @media) inside :root would break a naive scan,
  // so the scan is brace-balanced.
  let depth = 0
  let end = open
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  const block = source.slice(open, end)

  const tokens = {}
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*(oklch\([^)]*\))/g)) {
    const parsed = m[2].match(OKLCH)
    if (!parsed) continue
    if (parsed[4] !== undefined) continue // has alpha — see above
    tokens[m[1]] = oklchToRgb(Number(parsed[1]) / 100, Number(parsed[2]), Number(parsed[3]))
  }
  return tokens
}

const base = parseBlock(':root {')
if (!base) {
  console.error('check-contrast: could not find the :root token block.')
  process.exit(1)
}

const themes = {
  eclipse: base,
  ember: { ...base, ...parseBlock('[data-theme="ember"]') },
  paper: { ...base, ...parseBlock('[data-theme="paper"]') },
}

// The P3 branch overrides a handful of accents on wide-gamut displays. Those
// overrides are converted back to sRGB and checked as their own theme, since
// a visitor on a P3 display sees them and an audit tool will measure them.
const p3 = parseBlock('@media (color-gamut: p3)')
if (p3 && Object.keys(p3).length) {
  themes['eclipse-p3'] = { ...base, ...p3 }
}

// ── the pairs that matter ─────────────────────────────────────────────────
// Every one of these is a combination the site actually renders. A matrix of
// every token against every other token would produce hundreds of failures
// for pairs nothing puts together.
const PAIRS = [
  // [foreground, background, minimum, description]
  ['--ink-hi', '--surface-0', 4.5, 'headings on the page'],
  ['--ink', '--surface-0', 4.5, 'body copy on the page'],
  ['--ink-mid', '--surface-0', 4.5, 'secondary copy on the page'],
  ['--ink-low', '--surface-0', 3.0, 'tertiary/meta copy (large or non-essential)'],
  ['--ink', '--surface-1', 4.5, 'body copy on a card'],
  ['--ink-mid', '--surface-1', 4.5, 'secondary copy on a card'],
  ['--ink-mid', '--surface-2', 4.5, 'copy on a raised surface'],
  ['--ink-low', '--surface-2', 3.0, 'meta copy on a raised surface'],
  ['--accent', '--surface-0', 3.0, 'accent as a UI boundary'],
  ['--accent-bright', '--surface-0', 4.5, 'accent as text'],
  ['--accent-bright', '--surface-1', 4.5, 'accent as text on a card'],
  ['--warm', '--surface-0', 3.0, 'warm accent as a boundary'],
  ['--violet', '--surface-0', 3.0, 'violet accent as a boundary'],
  ['--success', '--surface-0', 3.0, 'success state'],
  ['--danger', '--surface-0', 3.0, 'error state'],
]

const failures = []
const rows = []

for (const [themeName, tokens] of Object.entries(themes)) {
  for (const [fgName, bgName, min, what] of PAIRS) {
    const fg = tokens[fgName]
    const bg = tokens[bgName]
    // A token that is not defined in OKLCH (a hex `--accent-glow`, say) is not
    // this script's business.
    if (!fg || !bg) continue
    const r = ratio(fg, bg)
    const ok = r >= min
    rows.push([themeName, `${fgName} on ${bgName}`, r, min, ok])
    if (!ok) {
      failures.push(
        `${themeName}: ${fgName} on ${bgName} is ${r.toFixed(2)}:1, needs ${min}:1 — ${what}\n` +
        '        fix by changing LIGHTNESS only, so the hue and chroma character survives'
      )
    }
  }
}

const pad = (s, n) => String(s).padEnd(n)
console.log('\nWCAG 2.1 contrast (sRGB, computed from the OKLCH tokens)')
console.log('─'.repeat(74))
for (const [theme, pair, r, min, ok] of rows) {
  console.log(`${ok ? '✓' : '✗'} ${pad(theme, 12)} ${pad(pair, 34)} ${r.toFixed(2).padStart(6)}:1  (min ${min})`)
}
console.log('─'.repeat(74))

if (failures.length) {
  console.error(`\n${failures.length} contrast failure(s):`)
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}

console.log(`CONTRAST-OK — ${rows.length} role pairs across ${Object.keys(themes).length} theme variants\n`)
