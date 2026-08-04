#!/usr/bin/env node
/**
 * fetch-stats.mjs — T-081.
 *
 * The site claims "LeetCode Knight · 1972 max · 800+ solved". A static number
 * ages, and an ageing number reads as an abandoned site — which is the
 * opposite of what a portfolio is for.
 *
 * Three decisions, all of which follow from one rule: **a third-party outage
 * must never be visible to a visitor.**
 *
 *  1. **Build time, not runtime.** No API keys in the bundle, no request on
 *     the critical path, and no failure mode where GitHub being slow makes
 *     the portfolio slow.
 *  2. **Fault-tolerant per source.** Each fetch that fails keeps the previous
 *     value. A platform changing its API surface degrades to "this number is
 *     a few days old", not to zero.
 *  3. **`lastUpdated` is written every run**, successful or not, and shown in
 *     the UI. "Updated 3 hours ago" is a small, unmistakable signal that the
 *     site is maintained; it is also the thing that makes a stale number
 *     honest rather than misleading.
 *
 * Run daily from `.github/workflows/refresh.yml`, which commits the diff.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/*
 * Its own file, not `liveStatus.json`. That file is owned by
 * `scripts/check-live.mjs`, which rewrites it wholesale from a fresh ping of
 * every deployed app — so sharing one file would mean the daily stats refresh
 * and the live-status check silently erased each other's work, on alternating
 * days, in a way that would look like a flaky API.
 */
const TARGET = fileURLToPath(new URL('../src/lib/platformStats.json', import.meta.url))
const TIMEOUT_MS = 10_000

const GITHUB_USER = 'GJBarhate'
const LEETCODE_USER = 'chgyCygKwQ'
const CODECHEF_USER = 'gaurav_jb'

/** Never let one slow host hold up the whole refresh. */
async function withTimeout(promise, label) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await promise(controller.signal)
  } catch (error) {
    console.warn(`  ! ${label}: ${error?.message || error} — keeping the previous value`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const json = async (url, signal) => {
  const response = await fetch(url, { signal, headers: { 'user-agent': 'forge-portfolio-stats' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function github(signal) {
  const [user, repos] = await Promise.all([
    json(`https://api.github.com/users/${GITHUB_USER}`, signal),
    json(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100`, signal),
  ])
  return {
    repos: user.public_repos,
    followers: user.followers,
    stars: repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0),
  }
}

async function leetcode(signal) {
  // The public GraphQL endpoint, queried the way the site's own profile page
  // does. No key, no auth, and it may change without notice — which is
  // exactly why the failure path keeps the previous value.
  const query = `query($username: String!) {
    matchedUser(username: $username) {
      submitStatsGlobal { acSubmissionNum { difficulty count } }
    }
    userContestRanking(username: $username) { rating topPercentage }
  }`
  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', referer: 'https://leetcode.com' },
    body: JSON.stringify({ query, variables: { username: LEETCODE_USER } }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const { data } = await response.json()
  const all = data?.matchedUser?.submitStatsGlobal?.acSubmissionNum
    ?.find((d) => d.difficulty === 'All')?.count
  return {
    solved: all ?? null,
    rating: data?.userContestRanking?.rating ? Math.round(data.userContestRanking.rating) : null,
  }
}

async function codechef(signal) {
  // CodeChef has no public JSON API; the rating is in the profile HTML. A
  // scrape is fragile by definition, so it is the source most likely to fall
  // back — and falling back costs nothing.
  const response = await fetch(`https://www.codechef.com/users/${CODECHEF_USER}`, { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  const rating = html.match(/class="rating">(\d+)/)?.[1]
  const stars = html.match(/class="rating-star"[^>]*>([^<]*)/)?.[1]?.trim()
  return { rating: rating ? Number(rating) : null, stars: stars || null }
}

const previous = (() => {
  try { return JSON.parse(readFileSync(TARGET, 'utf8')) } catch { return {} }
})()

console.log('fetch-stats: refreshing platform data')

const [gh, lc, cc] = await Promise.all([
  withTimeout(github, 'github'),
  withTimeout(leetcode, 'leetcode'),
  withTimeout(codechef, 'codechef'),
])

/** Merge: a null field keeps whatever was there before. */
const merge = (before = {}, after) => {
  if (!after) return before
  const out = { ...before }
  for (const [key, value] of Object.entries(after)) {
    if (value !== null && value !== undefined) out[key] = value
  }
  return out
}

const next = {
  ...previous,
  github: merge(previous.github, gh),
  leetcode: merge(previous.leetcode, lc),
  codechef: merge(previous.codechef, cc),
  lastUpdated: new Date().toISOString(),
  // Which sources answered this time — so a silent, permanent failure is
  // visible in the committed diff rather than only in a log nobody reads.
  sources: { github: !!gh, leetcode: !!lc, codechef: !!cc },
}

writeFileSync(TARGET, `${JSON.stringify(next, null, 2)}\n`, 'utf8')

const ok = Object.entries(next.sources).filter(([, v]) => v).map(([k]) => k)
console.log(`fetch-stats: wrote ${TARGET.split(/[\\/]/).pop()} — ${ok.length ? ok.join(', ') : 'no source responded'}`)
