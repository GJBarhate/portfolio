#!/usr/bin/env node
/**
 * §8.6 — dead-selector report.
 *
 * Conservative on purpose: it only reports plain single-class selectors whose
 * class name appears NOWHERE in src (JSX, JS or the rest of the CSS). Anything
 * built dynamically, composed with another selector, or produced by Tailwind
 * is left alone, because a stylesheet that deletes a rule someone is still
 * using is worse than one carrying a few dead bytes.
 *
 * Usage: node scripts/find-dead-css.mjs [--delete]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const CSS_FILES = [join(SRC, 'styles', 'index.css')]
const DO_DELETE = process.argv.includes('--delete')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const codeFiles = walk(SRC).filter((f) => ['.jsx', '.js', '.html'].includes(extname(f)))
codeFiles.push(join(ROOT, 'index.html'))
const code = codeFiles.map((f) => readFileSync(f, 'utf8')).join('\n')

for (const cssPath of CSS_FILES) {
  const css = readFileSync(cssPath, 'utf8')

  // Class names referenced from anywhere else in the stylesheet itself count
  // as used (a rule may only exist to support a compound selector).
  const dead = []
  const lines = css.split('\n')

  // Match a rule that opens on its own line with exactly one simple class
  // selector, optionally with pseudo-elements/classes.
  const simple = /^(\.[a-zA-Z][\w-]*)(::?[a-zA-Z-]+(\([^)]*\))?)?\s*\{\s*$/

  for (let i = 0; i < lines.length; i++) {
    const m = simple.exec(lines[i].trim())
    if (!m) continue
    const cls = m[1].slice(1)
    // Referenced in markup or JS?
    if (new RegExp(`[\`'"\\s]${cls}[\`'"\\s:]`).test(code)) continue
    if (code.includes(cls)) continue
    // Referenced elsewhere in the stylesheet (compound selectors, @media)?
    const occurrences = css.split('.' + cls).length - 1
    const own = lines.filter((l) => simple.test(l.trim()) && simple.exec(l.trim())[1] === '.' + cls).length
    if (occurrences > own) continue
    dead.push({ cls, line: i + 1 })
  }

  if (!dead.length) {
    console.log(`${cssPath}: no unambiguously dead single-class rules found.`)
    continue
  }

  console.log(`\n${cssPath} — ${dead.length} candidate dead rules:`)
  for (const d of dead) console.log(`  line ${String(d.line).padStart(5)}  .${d.cls}`)

  if (DO_DELETE) {
    // Remove each rule body by brace matching.
    let out = css
    for (const { cls } of dead) {
      const re = new RegExp(`(^|\\n)\\.${cls}(::?[a-zA-Z-]+(\\([^)]*\\))?)?\\s*\\{[^}]*\\}\\n?`, 'g')
      out = out.replace(re, '$1')
    }
    writeFileSync(cssPath, out)
    console.log(`\nDeleted ${dead.length} rules from ${cssPath}.`)
  } else {
    console.log('\nRe-run with --delete to remove them.')
  }
}
