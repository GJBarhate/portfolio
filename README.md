# Gaurav Barhate — Portfolio

Personal portfolio website. Built with React and Vite.

**Live:** [Portfolio](https://gauravportfolio-beryl.vercel.app/)

## Stack

- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS + a token layer in OKLCH (`src/styles/index.css`)
- **Scroll:** Lenis, driven by the app's own frame loop
- **3-D / GPU:** raw WebGL for the background field and the card hover shader; three.js only inside tier-gated islands
- **Motion:** CSS transitions, WAAPI and scroll-driven animations first; Framer Motion only in lazily-mounted chunks
- **Forms:** EmailJS (contact form delivery)
- **Type:** Self-hosted Clash Display, Space Grotesk, JetBrains Mono

## Architecture

Three rules explain most of the code.

**1. One frame loop.** Every canvas, shader, cursor, physics and scroll-linked
effect subscribes to `src/lib/raf.js` instead of calling `requestAnimationFrame`
itself — one callback per frame, one shared timestamp, and one place to pause
everything when the tab is hidden. A frame-rate governor drops a graphics tier
when the machine cannot keep up and publishes it on `data-gfx-tier`, so CSS can
respond too. `src/lib/scrollState.js` sits on top and reads scroll position
once per frame for everyone who needs it. ESLint forbids a bare
`requestAnimationFrame` outside `raf.js`.

**2. One GPU owner.** `src/lib/glStage.js` is the only module allowed to
construct a `WebGLRenderer` (ESLint enforces that too). The site-wide ambient
background is not three.js at all — it is a single fullscreen quad and one
fragment shader in `src/lib/bgEngine.js`, with the project-card hover
distortion doing the same thing in `src/lib/rawGL.js`. Neither needs a scene
graph, and between them they keep three.js off the default visit entirely.

**3. Nothing heavy on the critical path.** First paint is React plus the app
entry — about 65 KB gzipped. `three` (127 KB) and `framer-motion` (40 KB) are
reachable only from gated islands: the hero gem and the About desk scene mount
on tier ≥ 2 desktop, the hover shader warms when the deck toggle enters the
viewport on a hover-capable device, and every below-fold section carries
`content-visibility: auto`. `npm run build` fails if any of that regresses.

### Layout of `src`

| Path | What lives there |
|---|---|
| `lib/raf.js` | the shared ticker + graphics-tier governor |
| `lib/scrollState.js` | one scroll read per frame, shared |
| `lib/glStage.js` | the single three.js renderer owner |
| `lib/bgEngine.js` | background shader (raw WebGL, no three) |
| `lib/rawGL.js` | card hover distortion (raw WebGL, no three) |
| `lib/palette.js` | theme colours for canvases, lerped across the theme sweep |
| `lib/animationGate.js` | pauses off-screen CSS loops via `data-loop` |
| `lib/content.js` | all copy, project data, metrics and alt text |
| `styles/critical.css` | inlined into `<head>` at build time |

## Features

- Three theme palettes (Eclipse, Ember, Paper) swapped through a circular
  View-Transition sweep; canvases re-read the palette and lerp with it
- **Recruiter mode** (navbar chip or ⌘⇧R) — folds away the arcade chrome and
  every looping animation, leaving outcomes, screenshots and the résumé
- Case-study lightbox per project: screenshot carousel, architecture diagram
  and metric chips, focus-trapped and keyboard-navigable
- Build-time live-status pings on every deployed app (no runtime requests)
- Cinema deck that pins and translates on desktop and uses native scroll-snap
  on touch — never two scroll systems on one axis
- Command palette (⌘K), five-game arcade, Konami code, spark hunt, XP tracking
- Fully responsive, reduced-motion aware, APCA-targeted contrast

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

`build` runs the production build and then the budget gate. Other scripts:

| Script | Purpose |
|---|---|
| `npm run preview` | serve the production build |
| `npm run lint` | ESLint, including the import/rAF/WebGL guardrails |
| `npm run check:budgets` | bundle budgets + the project-image glob guard |
| `npm run check:live` | ping every deployed project, rewrite `liveStatus.json` |
| `npm run build:only` | build without the budget gate |

## Performance budgets

Enforced by `scripts/check-budgets.mjs` on every build:

| Gate | Ceiling | Current |
|---|---|---|
| Entry chunk | 75 KB gz | ~21 KB |
| Eager total | 115 KB gz | ~65 KB |
| `motion` chunk | 45 KB gz, absent from the eager graph | 40 KB, lazy |
| `three` chunk | 135 KB gz, absent from the eager graph | 127 KB, lazy |
| Project image derivatives in `dist` | ≥ 15 | 68 |

That last row is a guard, not a statistic. `import.meta.glob` matches its
pattern against real filenames, so an inline `?w=640&…` query inside the
pattern silently matches nothing — which is exactly how this site once shipped
with no project screenshots at all. The query belongs in the options object,
and the build now fails if the derivatives go missing again.

## Environment

EmailJS credentials live in `src/lib/emailConfig.js`. The service/template/public-key
trio is intended to be client-side; EmailJS rate-limits and domain-restricts requests
from its dashboard.

## License

© Gaurav Barhate. All rights reserved.
