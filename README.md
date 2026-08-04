# Gaurav Barhate — Portfolio

Personal portfolio website. Built with React and Vite.

**Live:** [Portfolio](https://gauravportfolio-beryl.vercel.app/)

## Stack

- **Framework:** React 19 + Vite 8 (Rolldown), with the React Compiler
- **Styling:** Tailwind CSS 4 + a token layer in OKLCH (`src/styles/`)
- **Scroll:** Lenis, driven by the app's own frame loop
- **3-D / GPU:** raw WebGL for the background field and the card hover shader; three.js only inside tier-gated islands
- **Motion:** CSS transitions, WAAPI and scroll-driven animations first; Framer Motion only in lazily-mounted chunks
- **Forms:** EmailJS (contact form delivery)
- **Type:** Self-hosted Clash Display, Space Grotesk, JetBrains Mono
- **Tests:** Vitest (unit) + Playwright (16 device/preference projects)

## Architecture

Five rules explain most of the code. The first three predate this rewrite; the
last two came out of it.

**1. One frame loop.** Every canvas, shader, cursor, physics and scroll-linked
effect subscribes to `src/lib/raf.js` instead of calling `requestAnimationFrame`
itself — one callback per frame, one shared timestamp, and one place to pause
everything when the tab is hidden. ESLint forbids a bare
`requestAnimationFrame` outside `raf.js`.

Subscribers declare a **priority band**: `input` (the cursor, magnetic
buttons) runs first and is never dropped, `layout` second, `ambient` (the
canvases) last and first to be skipped when a frame has already spent its
budget. A per-subscriber cost average unsubscribes any callback that sustains
8 ms/frame and reports it, so one slow effect cannot take the page down.

**2. One GPU owner.** `src/lib/glStage.js` is the only module allowed to
construct a `WebGLRenderer` (ESLint enforces that too). The site-wide ambient
background is not three.js at all — it is a single fullscreen quad and one
fragment shader in `src/lib/bgEngine.js`, with the project-card hover
distortion doing the same in `src/lib/rawGL.js`. Every context is guarded
against loss: `preventDefault()` on `webglcontextlost` (without it the browser
never sends `restored`), one rebuild, and after two losses a permanent
fallback to the CSS layer.

**3. Nothing heavy on the critical path.** First paint is React plus the app
entry. `three` and `framer-motion` are reachable only from gated islands, and
`npm run build` fails if either enters the eager graph.

**4. One source of truth per axis.** Breakpoints, the type scale, the motion
scalar, the layout primitives and the accessibility rules each live in exactly
one file, and each has a script that fails the build when something drifts
from it. This is what replaced 38 hand-written reduced-motion blocks, three
competing type scales, and five breakpoint values typed as literals across
4,755 lines.

**5. Capability is measured, not guessed.** `src/lib/deviceProfile.js` combines
five proxies (cores, memory, connection, motion preference, the WebGL renderer
string) with one real measurement — the actual background shader, rendered
off-screen at 1/8 scale for 15 frames. It runs after LCP and then at idle,
because nothing heavy may be *measured* on the critical path either.

### Layout of `src`

| Path | What lives there |
|---|---|
| `lib/raf.js` | the shared ticker, priority bands + graphics-tier governor |
| `lib/scrollState.js` | one scroll read per frame, shared |
| `lib/deviceProfile.js` | the capability probe and tier resolver |
| `lib/store.js` | all persisted state, versioned, with a migration chain |
| `lib/forgeCli.js` | the command registry behind both the console and the palette terminal |
| `lib/effects/registry.js` | every effect's purpose, tier behaviour and cost |
| `lib/glStage.js` | the single three.js renderer owner |
| `lib/bgEngine.js` · `lib/rawGL.js` | raw-WebGL shaders, no three |
| `lib/siteConfig.js` | the one origin, name and social set |
| `lib/content.js` | all copy, project data, metrics and alt text |
| `styles/breakpoints·type·motion·layout·a11y·print.css` | one axis each |
| `styles/critical.css` | inlined into `<head>` at build time |

## Features

- Three theme palettes (Eclipse, Ember, Paper), following the OS on a first
  visit, swapped through a circular View-Transition sweep
- **A command palette that opens on any device** — header button, drawer row,
  or ⌘K — with a `>` terminal mode running the same command registry the
  console easter egg uses
- **Recruiter mode** (navbar chip or ⌘⇧R) — folds away the arcade chrome and
  every looping animation, leaving outcomes, screenshots and the résumé
- **Motion control** — full / reduced / off / follow-system, from the palette,
  because respecting the OS preference is the floor and letting the visitor
  override it is the ceiling
- Case-study lightbox per project, focus-trapped and keyboard-navigable
- Build-time live-status pings and daily platform-stat refresh (no runtime
  requests, no keys in the bundle)
- Five-game arcade, Konami code, spark hunt, XP tracking
- A `<noscript>` floor: with JavaScript off the page is still a readable,
  styled, linked summary

## Getting started

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`build` runs the production build and then three gates: bundle budgets, the
canonical-origin check and the CSP hash check.

| Script | Purpose |
|---|---|
| `npm run lint` | ESLint, including the import/rAF/WebGL guardrails |
| `npm test` | Vitest unit tests, then the full Playwright matrix |
| `npm run test:unit` | unit tests only |
| `npm run test:e2e` | Playwright only |
| `npm run check:budgets` | bundle budgets + the project-image glob guard |
| `npm run check:encoding` | BOMs and mojibake (runs in `prebuild`) |
| `npm run check:breakpoints` | no raw px, no bare min/max, in any media query |
| `npm run check:contrast` | WCAG ratios for every role pair, every theme, both gamuts |
| `npm run check:overflow` | names the element that overflows, 14 widths × 3 themes |
| `npm run check:effects` | summed effect cost per tier; regenerates `docs/effects.md` |
| `npm run check:csp` | inline-script hashes in `vercel.json` still match the build |
| `npm run check:live` | ping every deployed project, rewrite `liveStatus.json` |
| `npm run check:all` | everything above, in order |

## Performance budgets

Enforced by `scripts/check-budgets.mjs` on every build, and by
`scripts/size-report.mjs` on every PR (which fails on >3 % growth in any
chunk, even under budget — an absolute ceiling alone lets a chunk grow 40 %
and still pass).

| Gate | Ceiling | Current |
|---|---|---|
| Entry chunk | 75 KB gz | ~26 KB |
| Eager total | 115 KB gz | ~26 KB |
| CSS total | 40 KB gz | ~36 KB |
| `motion` chunk | 45 KB gz, absent from the eager graph | ~42 KB, lazy |
| `three` chunk | 135 KB gz, absent from the eager graph | ~128 KB, lazy |
| Project image derivatives in `dist` | ≥ 15 | 68 |

That last row is a guard, not a statistic. `import.meta.glob` matches its
pattern against real filenames, so an inline `?w=640&…` query inside the
pattern silently matches nothing — which is exactly how this site once shipped
with no project screenshots at all.

## Documentation

| Document | What it holds |
|---|---|
| `docs/baseline/2026-08.md` | measured LCP/FCP/CLS/TTFB per theme and device class, generated by `scripts/measure-baseline.mjs` |
| `docs/gates/PHASE-*.md` | what each phase closed, with evidence, and what it did not |
| `docs/effects.md` | generated from the effect registry — purpose, tier behaviour and cost for every effect |
| `docs/interaction-parity.md` | pointer / touch / keyboard behaviour for every interactive surface |
| `docs/layout.md` | the seven layout primitives and the breakpoint scale |
| `docs/maintenance.md` | the cadence that keeps this from decaying |
| `docs/adr/001-framework.md` | why this stays on Vite, and what would change that |
| `docs/a11y/sr-transcript.md` | what is verified automatically, and what still needs a real screen reader |

## Environment

EmailJS credentials live in `src/lib/emailConfig.js`. The service/template/public-key
trio is intended to be client-side; EmailJS rate-limits and domain-restricts
requests from its dashboard. The form additionally carries a honeypot, a
minimum time-to-submit and a client-side rate limit (`src/lib/formGuard.js`).

## License

© Gaurav Barhate. All rights reserved.
