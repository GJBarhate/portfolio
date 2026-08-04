#!/usr/bin/env node
/**
 * check-encoding.mjs — T-001
 *
 * Two failure modes, one script.
 *
 *  1. A UTF-8 BOM (`EF BB BF`) at the start of a source file. Harmless in CSS,
 *     a latent parse hazard in front of an `import` in a `.jsx` file, and
 *     invisible in every diff — which is exactly what makes it expensive.
 *  2. Mojibake: UTF-8 bytes that were once decoded as CP1252 and re-encoded.
 *     An em-dash written as `—` survives one such round trip as `â€"`. The
 *     giveaway is a lead byte from the Latin-1 supplement (`â`, `Â`, `Ã`, `Ð`)
 *     followed by a character from the CP1252 punctuation block — a bigram
 *     that essentially never occurs in real text in this repository.
 *
 * Run in `prebuild`, so a paste from a Word document can never reach a user.
 *
 * `--fix` repairs in place: BOMs are stripped and every mojibake run is
 * re-decoded through CP1252 back to the character that was meant.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const ROOT = process.cwd()
const FIX = process.argv.includes('--fix')

/** Trees that are ours to police. `dist/` and `node_modules/` are not. */
const ROOTS = ['src', 'scripts', 'tests', 'index.html', 'public', 'api']
/** Binary payloads. Reading them as text proves nothing. */
const BINARY = new Set([
  '.woff2', '.woff', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.webp',
  '.avif', '.gif', '.ico', '.pdf', '.mp4', '.webm', '.zip',
])
/** Text extensions worth checking under `public/`. */
const PUBLIC_TEXT = new Set(['.xml', '.txt', '.json', '.js', '.webmanifest'])

/**
 * CP1252 → Unicode for the 0x80–0x9F range, where CP1252 differs from
 * Latin-1. Every mojibake sequence in the wild passes through this table,
 * which is why undoing it needs the table rather than a plain latin1 decode.
 */
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
}

/** A character that could have come from a single CP1252 byte. */
const toByte = (ch) => {
  const cp = ch.codePointAt(0)
  if (cp <= 0xff) return cp
  return CP1252[cp] ?? null
}

/**
 * A mojibake run: a lead byte in the C3/C2/C4/C5/D0 range followed by one or
 * two continuation-shaped characters. Matched greedily so a three-byte
 * sequence (`â€"`) is repaired in one pass rather than two.
 */
const MOJIBAKE = /[Â-ÃÐÑâ-ã][-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]{1,2}/g

function demojibake(text) {
  return text.replace(MOJIBAKE, (run) => {
    const bytes = []
    for (const ch of run) {
      const b = toByte(ch)
      if (b === null) return run
      bytes.push(b)
    }
    const decoded = Buffer.from(bytes).toString('utf8')
    // A failed decode yields U+FFFD; in that case the run was innocent text.
    return decoded.includes('�') ? run : decoded
  })
}

function walk(p, out = []) {
  let st
  try { st = statSync(p) } catch { return out }
  if (st.isDirectory()) {
    for (const entry of readdirSync(p)) walk(join(p, entry), out)
  } else {
    out.push(p)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(join(ROOT, r))).filter((f) => {
  const ext = extname(f).toLowerCase()
  if (BINARY.has(ext)) return false
  if (f.includes(`${'public'}${process.platform === 'win32' ? '\\' : '/'}`)) {
    return PUBLIC_TEXT.has(ext)
  }
  return true
})

const problems = []
let fixed = 0

for (const file of files) {
  const raw = readFileSync(file)
  const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
  let text = raw.toString('utf8')
  if (hasBom) text = text.slice(1)

  const repaired = demojibake(text)
  const hasMojibake = repaired !== text

  if (!hasBom && !hasMojibake) continue

  const rel = relative(ROOT, file).replace(/\\/g, '/')
  if (FIX) {
    writeFileSync(file, repaired, 'utf8')
    fixed++
    console.log(`fixed  ${rel}${hasBom ? '  [BOM]' : ''}${hasMojibake ? '  [mojibake]' : ''}`)
  } else {
    if (hasBom) problems.push(`${rel}: starts with a UTF-8 BOM`)
    if (hasMojibake) {
      const first = text.match(MOJIBAKE)?.[0] ?? ''
      const line = text.slice(0, text.indexOf(first)).split('\n').length
      problems.push(`${rel}:${line}: mojibake — ${JSON.stringify(first)} should be ${JSON.stringify(demojibake(first))}`)
    }
  }
}

if (FIX) {
  console.log(`\nENCODING-FIXED (${fixed} file${fixed === 1 ? '' : 's'})`)
  process.exit(0)
}

if (problems.length) {
  console.error('Encoding check failed:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\n${problems.length} problem(s). Run: node scripts/check-encoding.mjs --fix`)
  process.exit(1)
}

console.log(`ENCODING-CLEAN (${files.length} files)`)
