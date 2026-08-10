#!/usr/bin/env node
/**
 * P8.1 — the five projects exist ONCE (D-10d).
 *
 * They were written out three times: in `src/lib/content.js`, in the
 * `ItemList` JSON-LD in `index.html`, and again in `index.html`'s `<noscript>`
 * block. Three copies of the same five facts, none of them checked against
 * the others, and two of them invisible to anyone working on the site — you
 * edit a project's live URL in `content.js`, ship, and the structured data
 * that Google reads still points at the old one.
 *
 * The email was a fourth instance of the same problem (D-10e): `siteConfig.js`,
 * `content.js`, the JSON-LD, the noscript list and `RecruiterMode.jsx` each
 * carried their own copy.
 *
 * This script regenerates the two derived copies from `content.js` and
 * `siteConfig.js` between two marker comments, and `--check` fails the build
 * if what is in the file does not match what would be generated. That is what
 * makes the duplication safe: it still exists in the HTML (it has to — it is
 * what a crawler and a scripting-disabled visitor read), but it can no longer
 * disagree.
 *
 * Usage:
 *   node scripts/gen-structured-data.mjs           rewrite index.html
 *   node scripts/gen-structured-data.mjs --check   fail if it is out of date
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HTML = fileURLToPath(new URL('../index.html', import.meta.url))
const CHECK = process.argv.includes('--check')

const { PROJECTS, SOCIALS } = await import(pathToFileURL(fileURLToPath(new URL('../src/lib/content.js', import.meta.url))).href)
const { AUTHOR, SITE_URL, SOCIAL } = await import(pathToFileURL(fileURLToPath(new URL('../src/lib/siteConfig.js', import.meta.url))).href)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The projects with a live URL, in the order `content.js` declares them. */
const live = PROJECTS.filter((p) => p.live)

// ── the Person ────────────────────────────────────────────────────────────
//
// `%SITE_URL%` is left as a literal on purpose: the `siteMeta` Vite plugin
// substitutes it at build and dev time from the same siteConfig, so the origin
// still has exactly one definition.

const person = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: AUTHOR.name,
  url: '%SITE_URL%',
  email: AUTHOR.email,
  jobTitle: AUTHOR.role,
  alumniOf: { '@type': 'CollegeOrUniversity', name: AUTHOR.alumniOf },
  knowsAbout: ['React', 'Node.js', 'WebRTC', 'CRDT', 'Socket.IO', 'Competitive Programming', 'AI Systems'],
  sameAs: [SOCIAL.github, SOCIAL.leetcode, SOCIAL.codechef, SOCIAL.linkedin],
}

const personLd = `    <script type="application/ld+json">
${JSON.stringify(person, null, 2).split(String.fromCharCode(10)).map((l) => '    ' + l).join(String.fromCharCode(10))}
    </script>`

// ── the ItemList ──────────────────────────────────────────────────────────

const itemList = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Selected work',
  itemListElement: live.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'SoftwareApplication',
      name: p.title,
      url: p.live,
      applicationCategory: 'WebApplication',
      operatingSystem: 'Any',
      description: p.tagline || p.description || '',
      author: { '@type': 'Person', name: AUTHOR.name, url: SITE_URL },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  })),
}

const jsonLd = `    <script type="application/ld+json">
${JSON.stringify(itemList, null, 2).split('\n').map((l) => '    ' + l).join('\n')}
    </script>`

// ── the noscript list ─────────────────────────────────────────────────────

const noscriptList = `        <ul class="noscript-list">
${live.map((p) => `          <li>
            <a href="${esc(p.live)}">${esc(p.title)}</a> —
            ${esc(p.outcome || p.tagline || p.description || '')}
          </li>`).join('\n')}
        </ul>`

const contactList = `        <ul class="noscript-list">
          <li><a href="mailto:${esc(AUTHOR.email)}">${esc(AUTHOR.email)}</a></li>
          <li><a href="/Gaurav_Resume.pdf">Download résumé (PDF)</a></li>
          <li><a href="${esc(SOCIALS.github)}">GitHub</a></li>
          <li><a href="${esc(SOCIALS.linkedin)}">LinkedIn</a></li>
          <li><a href="${esc(SOCIALS.leetcode)}">LeetCode</a></li>
        </ul>`

// ── splice between markers ────────────────────────────────────────────────

const BLOCKS = [
  ['PERSON', personLd],
  ['ITEMLIST', jsonLd],
  ['NOSCRIPT-PROJECTS', noscriptList],
  ['NOSCRIPT-CONTACT', contactList],
]

let html = readFileSync(HTML, 'utf8')
const missing = []

for (const [name, body] of BLOCKS) {
  // Matched by NAME, not by the whole comment: each marker names its own
  // source file in prose ("from src/lib/content.js" vs "from siteConfig.js"),
  // so an exact-string match found none of them.
  const openAt = html.indexOf(`<!-- GENERATED:${name}`)
  const close = `<!-- /GENERATED:${name} -->`
  const end = html.indexOf(close)
  if (openAt === -1 || end === -1) { missing.push(name); continue }
  const openEnd = html.indexOf('-->', openAt) + 3
  html = html.slice(0, openEnd) + '\n' + body + '\n    ' + html.slice(end)
}

if (missing.length) {
  console.error(`gen-structured-data: missing markers for ${missing.join(', ')} in index.html`)
  process.exit(1)
}

const current = readFileSync(HTML, 'utf8')
if (CHECK) {
  if (current !== html) {
    console.error(
      '\nSTRUCTURED-DATA STALE — index.html does not match src/lib/content.js.\n' +
      '  The JSON-LD a crawler reads, or the <noscript> list a scripting-disabled\n' +
      '  visitor reads, has drifted from the one source of truth.\n' +
      '  Fix: node scripts/gen-structured-data.mjs\n'
    )
    process.exit(1)
  }
  console.log(`STRUCTURED-DATA-OK — ${live.length} projects and one email, generated from content.js.\n`)
} else {
  writeFileSync(HTML, html)
  console.log(`gen-structured-data: wrote ${live.length} projects and ${AUTHOR.email} into index.html.`)
}
