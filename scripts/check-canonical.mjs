#!/usr/bin/env node
/**
 * check-canonical.mjs — T-005.
 *
 * Fails when more than one *first-party* origin appears across the built
 * HTML, sitemap and robots.txt. Third-party origins (GitHub, LeetCode,
 * schema.org, the five deployed project apps) are expected and ignored — what
 * this catches is the specific regression that caused D-05: two different
 * spellings of "this site" shipping in the same build.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE_URL } from '../src/lib/siteConfig.js'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const FILES = ['index.html', 'sitemap.xml', 'robots.txt']

/**
 * Hosts that are legitimately not us. Anything else that looks like a
 * portfolio origin is a canonical bug.
 */
const THIRD_PARTY = [
  'schema.org', 'github.com', 'leetcode.com', 'codechef.com', 'linkedin.com',
  'w3.org', 'sitemaps.org', 'vercel.com', 'onrender.com', 'peercode-iota.vercel.app',
  'flowshield-delta.vercel.app', 'voice-ans-frontend.vercel.app',
  'ai-powered-ecommerce-platform-frontendone.onrender.com',
  'learning-management-system-frontend-tx7b.onrender.com',
  'googleapis.com', 'gstatic.com', 'api.emailjs.com', 'emailjs.com',
]

const canonicalHost = new URL(SITE_URL).host
const found = new Map()
const missing = []

for (const name of FILES) {
  const path = join(DIST, name)
  if (!existsSync(path)) { missing.push(name); continue }
  const text = readFileSync(path, 'utf8')
  for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const host = m[1].toLowerCase()
    if (THIRD_PARTY.some((t) => host === t || host.endsWith('.' + t))) continue
    if (!found.has(host)) found.set(host, new Set())
    found.get(host).add(name)
  }
}

const failures = []
if (missing.length) failures.push(`missing from dist/: ${missing.join(', ')}`)

const hosts = [...found.keys()]
for (const host of hosts) {
  if (host !== canonicalHost) {
    failures.push(`foreign first-party origin "${host}" in ${[...found.get(host)].join(', ')} (canonical is "${canonicalHost}")`)
  }
}
if (!hosts.includes(canonicalHost)) {
  failures.push(`canonical origin "${canonicalHost}" appears in none of ${FILES.join(', ')}`)
}

if (failures.length) {
  console.error('Canonical check failed:')
  for (const f of failures) console.error('  ✗ ' + f)
  process.exit(1)
}

console.log(`CANONICAL-OK — exactly one first-party origin: ${canonicalHost}`)
