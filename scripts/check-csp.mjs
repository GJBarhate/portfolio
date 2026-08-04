#!/usr/bin/env node
/**
 * check-csp.mjs — T-046.
 *
 * A strict `script-src` needs a hash for every inline script and, because the
 * critical-CSS plugin emits `onload="this.media='all'"`, for that inline
 * handler too (`'unsafe-hashes'` plus the handler's own hash — the modern,
 * narrow replacement for `'unsafe-inline'`).
 *
 * Hashes are a maintenance hazard: change one character of the theme script
 * and the site silently loses its theme resolution in production, where the
 * CSP is enforced and the local dev server has no CSP at all. So the hashes
 * are computed from the *built* HTML and compared against `vercel.json`, and
 * the build fails on a mismatch rather than the deployment failing on a blank
 * page.
 *
 *   node scripts/check-csp.mjs          verify (runs in the build)
 *   node scripts/check-csp.mjs --write  update vercel.json with the real hashes
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DIST_HTML = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const VERCEL = fileURLToPath(new URL('../vercel.json', import.meta.url))
const WRITE = process.argv.includes('--write')

if (!existsSync(DIST_HTML)) {
  console.error('check-csp: no dist/index.html — run `npm run build` first.')
  process.exit(1)
}

const html = readFileSync(DIST_HTML, 'utf8')
const sha = (source) => `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`

/**
 * Executable inline scripts only. `application/ld+json` blocks are data, not
 * script, and browsers do not apply `script-src` to them.
 */
const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs]) => !/type\s*=\s*["']application\/ld\+json["']/.test(attrs))
  .map(([, , body]) => body)

/** Inline event handlers, which need `'unsafe-hashes'` alongside their hash. */
const handlers = [...html.matchAll(/\son[a-z]+="([^"]*)"/g)].map((m) => m[1])

const required = new Set([...inlineScripts, ...handlers].map(sha))

const vercel = JSON.parse(readFileSync(VERCEL, 'utf8'))
const rule = vercel.headers
  ?.flatMap((h) => h.headers)
  ?.find((h) => h.key === 'Content-Security-Policy')

if (!rule) {
  console.error('check-csp: no Content-Security-Policy header in vercel.json.')
  process.exit(1)
}

const present = new Set([...rule.value.matchAll(/'sha256-[A-Za-z0-9+/=]+'/g)].map((m) => m[0]))

const missing = [...required].filter((h) => !present.has(h))
const extra = [...present].filter((h) => !required.has(h))

if (WRITE) {
  let value = rule.value
  // Replace the whole hash set in script-src with the computed one.
  value = value.replace(/script-src [^;]*/, () => {
    const hashes = [...required].join(' ')
    return `script-src 'self' ${hashes}${handlers.length ? " 'unsafe-hashes'" : ''}`
  })
  rule.value = value
  writeFileSync(VERCEL, `${JSON.stringify(vercel, null, 2)}\n`, 'utf8')
  console.log(`check-csp: wrote ${required.size} hash(es) into vercel.json`)
  process.exit(0)
}

if (missing.length || extra.length) {
  console.error('CSP hash check failed:')
  for (const h of missing) console.error(`  ✗ missing from vercel.json: ${h}`)
  for (const h of extra) console.error(`  ✗ stale in vercel.json (nothing in dist matches): ${h}`)
  console.error('\n  Run: node scripts/check-csp.mjs --write')
  process.exit(1)
}

console.log(`CSP-OK — ${required.size} inline hash(es) match dist/index.html`)
