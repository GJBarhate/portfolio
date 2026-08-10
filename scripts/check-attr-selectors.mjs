#!/usr/bin/env node
/**
 * P0.5 — the dead-selector gate (D-1).
 *
 * `RecruiterMode.jsx` writes `data-recruiter=""`. `index.css` selected
 * `[data-recruiter='true']`. `'' !== 'true'`, so that rule had never matched
 * in the entire life of the file, and no gate could see it: the CSS was valid,
 * the JS was valid, the build was green, and the corner clock stayed on screen
 * in the one mode that exists to remove it.
 *
 * This is a whole class of bug, not one instance. A `data-*` attribute is a
 * contract between one JS file that writes it and N CSS rules that read it,
 * and nothing in the toolchain checks the two ends agree. So: enumerate the
 * values each attribute is ACTUALLY written with, by parsing the module that
 * owns it, then fail on any selector asking for a value outside that set.
 *
 * Deliberately not a lint rule and deliberately not a regex over both sides:
 * the writers are the source of truth and they are read from source, so adding
 * a fourth theme updates the allow-list automatically.
 *
 * Usage: node scripts/check-attr-selectors.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STYLES = join(ROOT, 'src', 'styles')

const read = (...parts) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Pull a `export const NAME = ['a', 'b']` array out of a module's source. */
function arrayLiteral(source, name) {
  const m = source.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`))
  if (!m) throw new Error(`check-attr-selectors: could not find ${name}`)
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
}

/**
 * Slice a whole `export const NAME = [ … ]` array, braces and all.
 *
 * Needed because `appearance.js` declares THEMES, BACKDROPS and MOTIONS in the
 * same file with the same `{ id: '…' }` shape. A file-wide regex for theme ids
 * happily returned `calm | motifs | forest | full | reduced | off` as well —
 * which does not fail the build, it does something worse: it quietly widens
 * the allow-list until `[data-theme='forest']` would have passed.
 */
function arrayBlock(source, name) {
  const start = source.indexOf(`export const ${name} = [`)
  if (start === -1) return ''
  let depth = 0
  for (let i = source.indexOf('[', start); i < source.length; i += 1) {
    if (source[i] === '[') depth += 1
    else if (source[i] === ']') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return ''
}

const motionSrc = read('src', 'lib', 'motion.js')
const bgSceneSrc = read('src', 'lib', 'bgScene.js')
// The theme vocabulary moved out of ThemeContext and into the appearance
// façade in P1 — one place now describes all three settings.
const themeSrc = read('src', 'lib', 'appearance.js')
const busSrc = read('src', 'lib', 'overlayBus.js')

// `system` writes NO attribute (motion.js deletes it), so it is not a legal
// selector value even though it is a legal mode.
const motionValues = arrayLiteral(motionSrc, 'MOTION_MODES').filter((m) => m !== 'system')
const bgSceneValues = arrayLiteral(bgSceneSrc, 'BG_SCENES')
const themeValues = [...arrayBlock(themeSrc, 'THEMES').matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
const overlayValues = [...busSrc.matchAll(/^\s*'([a-z-]+)':\s*\d/gm)].map((m) => m[1])

if (!themeValues.length) throw new Error('check-attr-selectors: no theme ids parsed')
if (!overlayValues.length) throw new Error('check-attr-selectors: no overlay ids parsed')

/**
 * `values: null` means the attribute is written as an empty string, so ONLY
 * the presence form `[attr]` can ever match. This is the D-1 case.
 */
const CONTRACTS = {
  'data-motion': { values: motionValues, writer: 'src/lib/motion.js' },
  'data-bg-scene': { values: bgSceneValues, writer: 'src/lib/bgScene.js' },
  'data-theme': { values: themeValues, writer: 'src/contexts/ThemeContext.jsx' },
  'data-overlay': { values: overlayValues, writer: 'src/lib/overlayBus.js' },
  'data-recruiter': { values: null, writer: 'src/components/ui/RecruiterMode.jsx' },
  'data-theme-changing': { values: null, writer: 'src/contexts/ThemeContext.jsx' },
}

const cssFiles = readdirSync(STYLES).filter((f) => f.endsWith('.css'))
const failures = []
let checked = 0

/** Blank out comment bodies, keeping newlines so line numbers stay true. A
 *  comment that *documents* a broken selector (like the one recording D-1 in
 *  index.css) is prose, not a rule, and must not fail the build. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

for (const file of cssFiles) {
  const source = stripComments(readFileSync(join(STYLES, file), 'utf8'))
  const lines = source.split(/\r?\n/)
  lines.forEach((line, i) => {
    // [data-foo], [data-foo='bar'], [data-foo="bar"], [data-foo*='bar']
    for (const m of line.matchAll(/\[(data-[a-z-]+)\s*([~^|*$]?=)?\s*(?:'([^']*)'|"([^"]*)")?\s*[a-zA-Z]?\]/g)) {
      const [, attr, op, single, double] = m
      const contract = CONTRACTS[attr]
      if (!contract) continue
      checked += 1
      const value = single ?? double
      if (op === undefined) continue // presence form is always legal
      if (contract.values === null) {
        failures.push(
          `${file}:${i + 1}  [${attr}${op}'${value}'] — ${attr} is written as an EMPTY string ` +
          `by ${contract.writer}, so only the presence form html[${attr}] can match.`
        )
        continue
      }
      if (op !== '=' ) continue // substring/prefix matches are intentional escapes
      if (!contract.values.includes(value)) {
        failures.push(
          `${file}:${i + 1}  [${attr}='${value}'] — ${contract.writer} only ever writes ` +
          `${contract.values.map((v) => `'${v}'`).join(', ')}.`
        )
      }
    }
  })
}

console.log(`\nAttribute-selector contracts (${cssFiles.length} sheets, ${checked} selectors)`)
console.log('─'.repeat(52))
for (const [attr, { values }] of Object.entries(CONTRACTS)) {
  console.log(`  ${attr.padEnd(20)} ${values === null ? '(presence only)' : values.join(' | ')}`)
}
console.log('─'.repeat(52))

if (failures.length) {
  console.error('\nATTRIBUTE-SELECTOR FAILURES — these rules can never match:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('ATTR-SELECTORS-OK — every data-* selector asks for a value something writes.\n')
