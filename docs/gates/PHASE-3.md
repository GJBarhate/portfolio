# Phase 3 gate — performance

**Exit condition (planned):** LCP ≤ 1.8 s, INP ≤ 120 ms, CLS ≤ 0.02, critical
CSS ≤ 14 KB gz, on a Moto G Power over Slow 4G.

**Status: partially met.** This file records which parts are done, which are
not, and what the measurement says — because a gate that is marked green
without the numbers is not a gate.

## Done

| Task | Result |
|---|---|
| **T-056** the ticker, hardened | Three priority bands (`input` → `layout` → `ambient`). Ambient work is skipped when a frame has already spent 12 ms, and paused entirely while the window is unfocused. A per-subscriber cost average unsubscribes any callback that sustains 8 ms/frame for 90 frames and reports it to RUM, so one slow effect cannot take the page down. |
| **T-058** canvas cost discipline | Background field: DPR ceiling 1.5 → 1.25 (fill rate is quadratic in the scale factor, so that is ~30 % of its GPU cost) and a 30 fps cap with remainder carry, because the eye cannot tell on a slow-drifting gradient. Fluid simulation: Jacobi iterations by tier, 8 / 4 / 0 / 0, down from a flat 12 — pressure convergence is asymptotic, so the last iterations cost as much as the first and change almost nothing. Both are `powerPreference: 'low-power'` and IntersectionObserver-gated. |
| **T-060** the effect registry | Twelve effects, each declaring purpose, four tier behaviours, cost and the preference axes it respects. `scripts/check-effect-budget.mjs` sums them per tier and fails the build over the Appendix B budget; it also generates `docs/effects.md`, so the documentation cannot drift. Cost is summed as **globals + the most expensive single region**, because the hero's canvases and the project cards are never on screen together. |
| **T-057** service worker | Three strategies (cache-first for hashed assets and fonts, stale-while-revalidate for images, network-first for the document), a genuinely useful offline page, and — written first, before any caching logic — a kill switch reachable as `window.forgeSwKill()` from the console or the palette terminal. Never registered on the dev server. |
| **T-051** partial | `font-display: optional` for the display and body faces with **measured** metric-matched fallbacks (Clash Display 700 is 813.7px where Arial 700 is 744.8px for the hero string, so `size-adjust: 115%`, not the 94% that was there). Every `@font-face` moved into the inlined critical sheet so no late stylesheet can introduce a face mid-load. |
| **D-34** size trend | `scripts/size-report.mjs` records every chunk's gzipped size and fails a PR on >3 % growth in any chunk, even under budget. |

## Current numbers

From `docs/baseline/2026-08.md` (CDP throttling, Moto G Power profile, three
runs, medians):

| Metric | Target | Measured | |
|---|---|---|---|
| LCP | ≤ 1.8 s | 2.1–2.3 s (eclipse/ember) | ✗ |
| CLS | ≤ 0.02 | bimodal: ~0.0005 or ~0.257 | ✗ |
| Critical CSS | ≤ 14 KB gz | 35.8 KB total CSS | ✗ |
| Entry JS | ≤ 18 KB gz | 26.2 KB | ✗ |
| Long tasks | ≤ 1 | ~50 over load + full scroll | ✗ |

## Not done, and why it matters

**T-050 — splitting the stylesheet — is the blocker for three of those five
rows.** The stylesheet is one 4,755-line file, ~36 KB gzipped, render-relevant
on every route, of which roughly 40 % styles the arcade, the lightbox and the
level map — surfaces the median visitor never opens. Until it is split:

- critical CSS cannot reach 14 KB;
- and the CLS bimodality persists, because the gap between "the inlined
  critical sheet is laying out the first viewport" and "Tailwind is" is where
  `.hero-copy` reflows. Four other fixes were tried and measured against this;
  the results are in the baseline's *Open items*.

**T-053 (`three` ≤ 110 KB or removed) and T-054 (`framer-motion` removed) are
not started.** `three` is 128.3 KB against a 135 KB budget and `framer-motion`
is 41.6 KB against 45 KB — both still green, both still tight. `framer-motion`
is imported by 38 components; removing it is a large, high-regression-risk
refactor that should be done component-by-component behind the visual
baselines, not in one pass.

**T-055 (INP) is unmeasured.** INP needs field data or a scripted interaction
harness; the baseline's "palette open" column is the closest lab proxy and it
is dominated by lazy-chunk fetch time on a throttled connection.

## Verification

```bash
npm run build && npm run check:effects && node scripts/measure-baseline.mjs
```


## A note on the Lighthouse assertions

`lighthouserc.json` asserts the numbers **this build actually holds**, with the
plan's end-of-P3 targets kept as warnings rather than errors:

| Assertion | Level | Why |
|---|---|---|
| accessibility ≥ 0.95, SEO ≥ 0.95, contrast, heading order, lang, viewport | error | held today, and a regression is a real defect |
| CLS ≤ 0.1 | error | Google's "good" band; the plan's 0.02 is the target, not the floor |
| LCP ≤ 2.5 s, TBT ≤ 600 ms, performance ≥ 0.8 | warn | the measured values sit near these; the P3 targets (1.8 s / 0.95) are not met and are blocked on T-050 |

A gate set to a number the build does not meet is red on every run, and a gate
that is always red is a gate everyone learns to ignore — which is worse than
not having one. These move down as T-050 lands, and the failing targets are
recorded above rather than asserted into permanent failure.
