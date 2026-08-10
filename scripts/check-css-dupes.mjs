#!/usr/bin/env node
/**
 * P0.6 — the duplicate-selector gate (D-8.1).
 *
 * `index.css` is the largest file in the repo and it had grown two definitions
 * of `.grade-wash` (lines 851 and 2830) and three fragments of `.film-grain`.
 * Nobody wrote them twice on purpose; they were written months apart by
 * someone who searched, did not find, and added.
 *
 * A duplicate is not always a bug — a base rule plus a `@media` override is
 * the normal way to write CSS — so the check is deliberately narrow:
 *
 *   FAIL   the same selector, in the same at-rule context, setting the same
 *          PROPERTY twice with different values — the later write silently
 *          destroys the earlier one and neither author knows
 *   PASS   the same selector inside different @media / @supports / @container
 *   PASS   a later rule that only ADDS properties (the normal way a sheet
 *          grows: a base rule, then a decoration rule further down)
 *   PASS   a shared base written as a selector list, then a narrower override
 *          — `.floor, .roof { … }` followed by `.roof { … }` is deliberate
 *          factoring, not a collision, and the whole point of writing the list
 *   PASS   byte-identical duplicates (harmless, and gzip eats them)
 *
 * That narrowness is the point, and the first draft of this script did not
 * have it: "same selector twice with different bodies" reported ~200 hits on
 * this repo, almost all of them the legitimate additive pattern. A gate that
 * fires on the normal case gets an allow-list, then the allow-list gets
 * everything in it, and then the gate is decoration. Property collision is the
 * subset that is always a mistake.
 *
 * Usage: node scripts/check-css-dupes.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STYLES = fileURLToPath(new URL('../src/styles', import.meta.url))

/**
 * Split a selector list on top-level commas only. `:where(a, button)` is ONE
 * selector; splitting it naively produced phantom entries like `:where( a` and
 * reported them as duplicated across unrelated rules.
 */
function splitSelectors(prelude) {
  const out = []
  let depth = 0
  let current = ''
  for (const ch of prelude) {
    if (ch === '(' || ch === '[') depth += 1
    else if (ch === ')' || ch === ']') depth -= 1
    if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; continue }
    current += ch
  }
  out.push(current.trim())
  return out.filter(Boolean)
}

/** `color: red; margin: 0` → Map(color → red, margin → 0). Longhand-blind on
 *  purpose: `margin` vs `margin-top` are different properties and only an
 *  exact name collision is unambiguously a lost declaration. */
function declMap(body) {
  const map = new Map()
  for (const decl of body.split(';')) {
    const at = decl.indexOf(':')
    if (at === -1) continue
    const property = decl.slice(0, at).trim()
    if (!property || property.startsWith('/')) continue
    map.set(property, decl.slice(at + 1).trim().replace(/\s+/g, ' '))
  }
  return map
}

/**
 * A brace-matching walk, not a regex. CSS nesting, `@media` blocks and
 * `@supports` all nest, and a regex over a 7,000-line sheet gets the nesting
 * wrong in exactly the places that matter.
 */
function parseRules(source) {
  const rules = []
  const stack = []
  let i = 0
  let preludeStart = 0

  const lineAt = (index) => source.slice(0, index).split('\n').length

  while (i < source.length) {
    const ch = source[i]

    // skip comments and strings so braces inside them do not confuse the walk
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      i += 1
      while (i < source.length && source[i] !== quote) i += source[i] === '\\' ? 2 : 1
      i += 1
      continue
    }

    if (ch === '{') {
      // Strip comments FROM THE PRELUDE too. The walk skips over comment
      // bodies but `preludeStart` still points before them, so a rule preceded
      // by a block comment used to take the comment's prose as its selector —
      // which is where the phantom `no context` and `no JavaScript` "selectors"
      // in the first run came from.
      const prelude = source
        .slice(preludeStart, i)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
      const bodyStart = i + 1
      // Report the line the SELECTOR is on, not the line the previous rule
      // closed on — `preludeStart` sits immediately after the last `}`, which
      // is usually a blank line and a comment earlier than the reader expects.
      const raw = source.slice(preludeStart, i)
      const lead = raw.length - raw.replace(/^[\s]*(?:\/\*[\s\S]*?\*\/[\s]*)*/, '').length
      stack.push({ prelude, bodyStart, line: lineAt(preludeStart + lead) })
      i += 1
      preludeStart = i
      continue
    }

    if (ch === '}') {
      const frame = stack.pop()
      if (frame) {
        const body = source.slice(frame.bodyStart, i)
        const isAtRule = frame.prelude.startsWith('@')
        if (!isAtRule) {
          // The context is every enclosing at-rule prelude, joined. Two
          // `.foo` rules in two different @media blocks are NOT duplicates.
          const context = stack.map((f) => f.prelude).filter((p) => p.startsWith('@')).join(' >> ')
          // Only the declarations of this rule, not of its nested children.
          const declarations = declMap(
            body
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/[^{}]*\{[\s\S]*?\}/g, '')
          )
          // A rule whose body is only nested rules carries no declarations of
          // its own and cannot conflict with anything.
          if (declarations.size) {
            const members = splitSelectors(frame.prelude)
            for (const selector of members) {
              // A COPY per selector. Sharing one Map across the members of a
              // selector list meant the merge below wrote `.foo::before`'s
              // later declarations into `.foo::after`'s record, and the script
              // then reported the two as clobbering each other. Six of the
              // first run's twenty findings were that bug, not the sheet's.
              rules.push({ selector, members, context, declarations: new Map(declarations), line: frame.line })
            }
          }
        }
      }
      i += 1
      preludeStart = i
      continue
    }

    if (ch === ';' && stack.length === 0) {
      i += 1
      preludeStart = i
      continue
    }

    i += 1
  }

  return rules
}

const files = readdirSync(STYLES).filter((f) => f.endsWith('.css'))
const failures = []
let total = 0

for (const file of files) {
  const rules = parseRules(readFileSync(join(STYLES, file), 'utf8'))
  total += rules.length
  const seen = new Map()
  for (const rule of rules) {
    const key = `${rule.context}||${rule.selector}`
    const prior = seen.get(key)
    if (!prior) { seen.set(key, rule); continue }
    // Which properties does the later rule overwrite with a DIFFERENT value?
    const clobbered = [...rule.declarations]
      .filter(([property, value]) => prior.declarations.has(property) && prior.declarations.get(property) !== value)
      .map(([property]) => property)
    // `.floor, .roof { shared }` then `.roof { different animation-duration }`
    // is the factoring idiom, not a collision: the author wrote the list
    // precisely so the exception could follow it. Recognised structurally —
    // the earlier rule was a list and this one is a subset of it — rather than
    // by an allow-list of selectors, which would rot.
    const narrowingAnEarlierList =
      prior.members.length > 1 && rule.members.every((m) => prior.members.includes(m))
    // Fold the later rule in so a third copy is compared against everything
    // written so far, not just the first block.
    for (const [property, value] of rule.declarations) prior.declarations.set(property, value)
    prior.members = rule.members
    if (!clobbered.length || narrowingAnEarlierList) continue
    failures.push(
      `${file}: \`${rule.selector}\`${rule.context ? ` inside ${rule.context}` : ''} ` +
      `is defined at line ${prior.line} AND line ${rule.line}, and the later block silently ` +
      `overwrites ${clobbered.map((p) => `\`${p}\``).join(', ')}. Merge them or scope one.`
    )
  }
}

console.log(`\nCSS duplicate selectors (${files.length} sheets, ${total} rules)`)
console.log('─'.repeat(52))

if (failures.length) {
  console.error('DUPLICATE-SELECTOR FAILURES:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('CSS-DUPES-OK — no selector is defined twice in one context.\n')
