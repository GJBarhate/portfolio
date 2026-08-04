# ADR 001 — Stay on Vite; add prerendering when routes exist

**Status:** accepted, with a review trigger
**Date:** 3 August 2026

## Context

The site is a client-rendered Vite SPA on one route. The plan's Phase 5/6 adds
per-project case studies, a lab and a notes section — roughly twenty routes of
mostly static content — at which point "one route, client-rendered" stops
being the right shape: every route would pay for hydration of the whole app,
and every crawler would see an empty shell until JS ran.

The four options considered, with the migration cost the plan estimated:

| Option | Shape | Cost | Main risk |
|---|---|---:|---|
| **A. Vite + `vite-plugin-ssg`** | prerender routes at build, hydrate | ~30 h | manual routing, no image pipeline |
| **B. Next.js App Router** | RSC, streaming, ISR, image optimisation, edge | ~120 h | the ticker and WebGL layer all become client components |
| **C. Astro + React islands** | zero JS by default, islands where needed | ~80 h | the site *is* one big island |
| **D. TanStack Start / React Router 7** | SSR on Vite, keeps the build | ~50 h | younger ecosystem |

## Decision

**Stay on Vite. Add prerendering (option A) when there is more than one route
to prerender — not before.**

## Why

**The differentiator is coupled to the browser, and every migration asks it to
move house.** What makes this site unusual is not its rendering strategy; it
is a hand-built single frame loop with a governing tier system, a single
enforced GPU owner, a device-capability probe, and a bundle-budget build gate.
That is ~130 KB of carefully sequenced browser code whose invariants are
enforced by ESLint rules that reference specific file paths. Options B and C
both require reorganising it around a server-component boundary that it does
not currently have, and the risk is not "it takes 120 hours" — it is that the
frame loop and the GPU stage come out the other side subtly different and
nobody notices until the tier governor stops governing.

**The payoff is smaller than it looks.** SSR's headline win is TTFB and
first-paint content. Measured on this build (`docs/baseline/2026-08.md`), TTFB
is 7–13 ms from the CDN and FCP is 60–90 ms on desktop; the throttled-mobile
FCP is ~500 ms and is dominated by network round trips, which SSR does not
remove. The metric that *is* poor — LCP on a slow connection — is a chunking
and stylesheet problem (T-050), and it would still be a chunking and
stylesheet problem after a migration.

**Prerendering captures most of the SEO benefit for a quarter of the risk.**
Crawlers that matter need HTML on arrival; they do not need React Server
Components. `vite-plugin-ssg` renders each route to static HTML at build time
and hydrates the same app — no new mental model, no change to the frame loop,
and the existing budget gates keep working unchanged.

**Do not migrate on aesthetics. Migrate on a number.**

## Review trigger

Reopen this decision if any of these becomes true:

- more than ~30 routes, or content that must change without a deploy (a CMS)
- a measured TTFB above 200 ms from any of Mumbai, Singapore, Frankfurt or
  São Paulo that prerendering cannot fix
- a need for per-request personalisation (the recruiter-mode referrer
  detection is currently client-side and cheap; if it has to move to the edge,
  that is a real reason)
- the hand-built rendering layer stops being the differentiator — if the site's
  value moves to its content, the argument above loses its force

## Consequences

- Routing, when it arrives, is manual. That is the accepted cost.
- Per-route metadata and OG images are generated at build time
  (`scripts/gen-sitemap.mjs` already derives every URL from
  `src/lib/siteConfig.js`; the same source feeds the OG generator).
- API routes (contact, RUM) are Vercel functions alongside the static output
  rather than framework routes.
- If option A is ever prototyped, it must be measured against this baseline
  before being adopted, not instead of it.
