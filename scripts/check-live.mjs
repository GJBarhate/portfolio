#!/usr/bin/env node
/**
 * W2 — live status pings.
 *
 * Pings every deployed project once, at build time, and writes the result to
 * src/lib/liveStatus.json. The card badges then read a static import: the
 * visitor's browser makes zero extra requests, and there is no API rate limit
 * to run into (which is why the runtime-GitHub-widget idea was rejected).
 *
 * Free-tier hosts cold-start, so "slow" is a real state, not a failure:
 *   ok        — responded < 2.5 s
 *   degraded  — responded, but slowly, or with a 4xx/5xx
 *   down      — no response at all
 *
 * Usage: npm run check:live
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../src/lib/liveStatus.json', import.meta.url))
const CONTENT = fileURLToPath(new URL('../src/lib/content.js', import.meta.url))

const TIMEOUT_MS = 12000
const SLOW_MS = 2500

/** The single source of truth is content.js, so the two cannot drift. */
function readProjects() {
  const src = readFileSync(CONTENT, 'utf8')
  const projects = []
  const idRe = /id:\s*'([^']+)'/g
  let match
  while ((match = idRe.exec(src))) {
    const rest = src.slice(match.index, match.index + 2600)
    const live = /live:\s*'([^']+)'/.exec(rest)
    if (live) projects.push({ id: match[1], url: live[1] })
  }
  return projects
}

async function ping(url) {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    // Some hosts reject HEAD outright; GET with an aborted body read is the
    // portable option.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'forge-portfolio-livecheck' },
    })
    const elapsed = Date.now() - started
    if (!res.ok) return { status: 'degraded', elapsed, code: res.status }
    return { status: elapsed > SLOW_MS ? 'degraded' : 'ok', elapsed, code: res.status }
  } catch {
    return { status: 'down', elapsed: Date.now() - started, code: 0 }
  } finally {
    clearTimeout(timer)
  }
}

const projects = readProjects()
if (!projects.length) {
  console.error('check-live: found no projects with a `live:` URL in content.js')
  process.exit(1)
}

const results = await Promise.all(
  projects.map(async (p) => [p.id, await ping(p.url)])
)

const out = {}
for (const [id, r] of results) {
  out[id] = r.status
  const mark = r.status === 'ok' ? '●' : r.status === 'degraded' ? '◐' : '○'
  console.log(`${mark} ${id.padEnd(12)} ${String(r.status).padEnd(9)} ${r.elapsed}ms  (HTTP ${r.code})`)
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`\nwrote ${OUT}`)
