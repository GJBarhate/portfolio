#!/usr/bin/env node
/**
 * P1.3 — hold `index.html` and `lib/appearance.js` level.
 *
 * There is exactly one piece of duplication in the appearance system that
 * cannot be removed: the theme list, the legacy id remap and the default all
 * have to exist inside the inline `<script>` in `index.html`, because that
 * script runs before any module is fetched and it is the reason the site never
 * flashes the wrong palette. Deleting it would trade a real, visible defect
 * for a tidy dependency graph.
 *
 * Duplication that cannot be removed has to be *enforced* instead. Everything
 * else in the system now has one definition (`lib/appearance.js`); this script
 * makes the one exception safe by failing the build when the two disagree.
 *
 * `ThemeContext.jsx:63–71` already says in prose that "the two must agree —
 * change them together". A comment is not a mechanism.
 *
 * Checks, in order of how badly each would break a visitor:
 *
 *   1. the THEME ID SETS are identical            (an unknown id → wrong palette)
 *   2. the LEGACY REMAP is identical              (a returning visitor loses their theme)
 *   3. the DEFAULT is identical                   (a first-time visitor lands on the wrong one)
 *   4. every MOTION mode the script can write is one CSS knows          (dead attribute)
 *   5. index.html does not write a theme colour for a theme that is gone
 *
 * Usage: node scripts/check-appearance-parity.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const appearanceSrc = readFileSync(root('src/lib/appearance.js'), 'utf8')
const htmlSrc = readFileSync(root('index.html'), 'utf8')
const motionSrc = readFileSync(root('src/lib/motion.js'), 'utf8')

const failures = []

// ── 1. the theme id sets ──────────────────────────────────────────────────

/**
 * Slice a top-level `export const NAME = [ … ]` array out of the source. The
 * first draft of this used one regex over the whole file and happily matched
 * the BACKDROPS entries too, reporting `calm | motifs | forest` as themes —
 * a gate that finds a failure that is not there is as useless as one that
 * misses a failure that is.
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

/** `{ id: 'eclipse', … }` entries in the THEMES array — and only that array. */
const moduleThemes = [...arrayBlock(appearanceSrc, 'THEMES').matchAll(/id:\s*'([a-z]+)'/g)]
  .map((m) => m[1])
  .filter((id) => id !== 'system')

/** `var THEME_BG = { eclipse: '#…', … }` in the pre-paint script. */
const htmlThemeBg = htmlSrc.match(/THEME_BG\s*=\s*\{([^}]*)\}/)
if (!htmlThemeBg) failures.push('index.html: could not find the THEME_BG map in the pre-paint script')
const htmlThemes = htmlThemeBg
  ? [...htmlThemeBg[1].matchAll(/([a-z]+)\s*:/g)].map((m) => m[1])
  : []

if (!moduleThemes.length) failures.push('appearance.js: parsed zero themes — the THEMES shape changed and this gate is now blind')

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
if (moduleThemes.length && !sameSet(moduleThemes, htmlThemes)) {
  failures.push(
    `theme ids disagree — appearance.js has [${moduleThemes.join(', ')}], ` +
    `index.html's THEME_BG has [${htmlThemes.join(', ')}]`
  )
}

// ── 2. the legacy remap ───────────────────────────────────────────────────

const pairs = (source, name) => {
  const block = source.match(new RegExp(`${name}\\s*=\\s*\\{([^}]*)\\}`))
  if (!block) return null
  return Object.fromEntries(
    [...block[1].matchAll(/([a-z]+)\s*:\s*'([a-z]+)'/g)].map((m) => [m[1], m[2]])
  )
}

const moduleLegacy = pairs(appearanceSrc, 'LEGACY_THEME_MAP')
const htmlLegacy = pairs(htmlSrc, 'LEGACY')
if (!moduleLegacy) failures.push('appearance.js: could not parse LEGACY_THEME_MAP')
if (!htmlLegacy) failures.push('index.html: could not parse the LEGACY map')
if (moduleLegacy && htmlLegacy) {
  const a = JSON.stringify(moduleLegacy, Object.keys(moduleLegacy).sort())
  const b = JSON.stringify(htmlLegacy, Object.keys(htmlLegacy).sort())
  if (a !== b) {
    failures.push(
      `the legacy theme remap disagrees — appearance.js ${JSON.stringify(moduleLegacy)} ` +
      `vs index.html ${JSON.stringify(htmlLegacy)}. A returning visitor whose saved id is ` +
      `in one map and not the other gets a different theme before and after hydration.`
    )
  }
}

// ── 3. the default ────────────────────────────────────────────────────────

const moduleDefault = appearanceSrc.match(/DEFAULT_THEME\s*=\s*'([a-z]+)'/)?.[1]
// The pre-paint script's fallback: `theme = 'eclipse';` in the else branch.
const htmlDefault = htmlSrc.match(/\}\s*else\s*if\s*\(!theme\s*\|\|\s*!THEME_BG\[theme\]\)\s*\{\s*\n?\s*theme\s*=\s*'([a-z]+)'/)?.[1]
if (!moduleDefault) failures.push('appearance.js: could not parse DEFAULT_THEME')
if (!htmlDefault) failures.push("index.html: could not find the pre-paint script's default-theme fallback")
if (moduleDefault && htmlDefault && moduleDefault !== htmlDefault) {
  failures.push(
    `the default theme disagrees — appearance.js says '${moduleDefault}', index.html says ` +
    `'${htmlDefault}'. A first-time visitor would see one for a frame and the other after.`
  )
}

// ── 4. motion modes ───────────────────────────────────────────────────────

const motionModes = motionSrc.match(/MOTION_MODES\s*=\s*\[([^\]]*)\]/)
const modes = motionModes ? [...motionModes[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : []
const appearanceMotions = [...arrayBlock(appearanceSrc, 'MOTIONS').matchAll(/id:\s*'([a-z]+)'/g)].map((m) => m[1])
const missing = modes.filter((m) => !appearanceMotions.includes(m))
if (missing.length) {
  failures.push(
    `motion modes [${missing.join(', ')}] exist in motion.js but have no card in ` +
    `appearance.js's MOTIONS — they would be settable from the store and unreachable from the UI, ` +
    `which is the exact defect (D-2) this phase exists to fix.`
  )
}

// ── 5. uScene comes from the visitor's preference and nothing else ────────
//
// P1.2. The background scene is the one uniform a performance heuristic must
// never touch. Lowering it is not "degrading gracefully", it is overriding a
// stated preference with a guess about the hardware — and the visitor cannot
// tell that apart from the control being broken.
//
// The rule is structural rather than textual: find every write to
// `uniforms.uScene`, take the variable it passes, and assert that every
// assignment to that variable in the same file comes from `bgSceneId()`.

const GL_FILES = ['src/components/ui/BackgroundEngine.jsx']
let sceneWrites = 0
for (const file of GL_FILES) {
  let source
  try { source = readFileSync(root(file), 'utf8') } catch { continue }
  for (const m of source.matchAll(/uniform1f\s*\(\s*uniforms\.uScene\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    sceneWrites += 1
    const variable = m[1]
    const assignments = [
      ...source.matchAll(new RegExp(`\\b${variable}\\b\\s*=\\s*([^\\n;]+)`, 'g')),
    ].map((a) => a[1].trim()).filter((rhs) => !rhs.startsWith('='))
    if (!assignments.length) {
      failures.push(`${file}: uScene is written from \`${variable}\`, which is never assigned in this file`)
      continue
    }
    for (const rhs of assignments) {
      /*
       * EXACT match, not "contains".
       *
       * The first version of this test asked whether the right-hand side
       * mentioned `bgSceneId()` anywhere. Verified against a deliberate
       * violation — `let scene = getTier() < 2 ? 0 : bgSceneId()` — and it
       * passed, because the tier-gated expression still contains the call.
       * That is precisely the line this gate exists to reject, so "contains"
       * makes it decoration. The assignment must BE the call and nothing else.
       */
      const clean = rhs
        .replace(/\/\/.*$/, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // A single-expression arrow body — `() => { scene = bgSceneId() }` —
        // runs to the end of the line, so the capture picks up the closing
        // brace. Stripping unbalanced trailing braces is what keeps the
        // legitimate re-read in `onSceneChange` from being reported as a
        // violation. Verified in both directions before this was called done.
        .replace(/[)\s]*[}\s]*$/, (m) => m.replace(/[}\s]/g, ''))
        .trim()
      if (!/^bgSceneId\s*\(\s*\)$/.test(clean)) {
        failures.push(
          `${file}: uScene is written from \`${variable}\`, which is assigned \`${rhs}\`. ` +
          `The background scene must come from bgSceneId() — the visitor's stored preference — ` +
          `and from nothing else. Tier scales resolution, never existence (P5).`
        )
      }
    }
  }
}
if (!sceneWrites) {
  failures.push(
    'no uScene write found in BackgroundEngine.jsx — this gate has gone blind. ' +
    'Update GL_FILES rather than deleting the check.'
  )
}

// ── 6. no theme colour for a theme that no longer exists ──────────────────

const extra = htmlThemes.filter((id) => !moduleThemes.includes(id))
if (extra.length && moduleThemes.length) {
  failures.push(`index.html declares a theme colour for [${extra.join(', ')}], which appearance.js does not define`)
}

// ── output ────────────────────────────────────────────────────────────────

console.log('\nAppearance parity — index.html ↔ src/lib/appearance.js')
console.log('─'.repeat(52))
console.log(`  themes    ${moduleThemes.join(' | ') || '(none parsed)'}`)
console.log(`  default   ${moduleDefault ?? '(none parsed)'}`)
console.log(`  legacy    ${moduleLegacy ? Object.entries(moduleLegacy).map(([k, v]) => `${k}→${v}`).join(' ') : '(none parsed)'}`)
console.log(`  motion    ${modes.join(' | ') || '(none parsed)'}`)
console.log(`  uScene    ${sceneWrites} write(s), all traced to bgSceneId()`)
console.log('─'.repeat(52))

if (failures.length) {
  console.error('APPEARANCE-PARITY FAILURES:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('APPEARANCE-PARITY-OK — the pre-paint script and the façade agree.\n')
