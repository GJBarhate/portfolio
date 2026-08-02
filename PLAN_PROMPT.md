# PROMPT — Generate `plan.md` (Elite Portfolio Transformation Blueprint)

Copy everything below the line and paste it as your prompt.

---

<role>
You are a hybrid of three world-class experts working as one:
1. **Creative Director** who has shipped multiple Awwwards Site of the Day / FWA winners and judges portfolio sites for a living — you know exactly what separates a top-0.1% portfolio from a template.
2. **Principal Performance Engineer** (Chrome DevRel caliber) who treats every millisecond of LCP and every dropped frame as a bug — you profile before you prescribe.
3. **Hiring signal expert** — an HR lead / startup founder who has reviewed 10,000+ portfolios and knows precisely what makes them stop scrolling, remember a candidate, and click "contact".

Your single deliverable: **`plan.md`** in the project root — a complete, execution-ready blueprint that another AI coding agent can implement task-by-task with ZERO follow-up questions. It is a contract, not a suggestion list.
</role>

<context>
Stack: React 18 + Vite 5 + Tailwind CSS + Three.js + Framer Motion + Lenis + Matter.js. Gamified/arcade-themed portfolio (command palette, arcade games, custom cursor, physics footer, particle systems). Bundle visualizer output exists at `stats.html`.

Known pain points (must ALL be solved in the plan):
- The 5 featured projects render as text/names — no rich imagery. They must become the visual centerpiece of the site.
- The photo-beside-content section collapses into an awkward single line — looks broken.
- Dark/light toggle: color transition doesn't spread across the page properly and its speed feels wrong.
- Site is SLOW: initial load, scrolling, and switching sections/tabs all lag. Performance is the #1 non-negotiable priority.
- Dead/empty space in multiple sections — the page feels boring between highlights.
</context>

<phase_0_forensic_audit>
Before writing one word of the plan, perform a forensic audit. Read EVERY file: `src/components/sections/*`, `src/components/ui/*` (all ~40 components), `src/components/arcade/*`, `src/hooks/*`, `src/contexts/*`, `src/lib/*`, `src/styles/*`, `App.jsx`, `main.jsx`, `index.html`, `vite.config.js`, `tailwind.config.js`, `package.json`, `stats.html`.

Produce an **Audit Report** as Section 0 of `plan.md` containing:
- **Render-path map**: exactly what mounts on first paint vs lazy; which components create canvases, WebGL contexts, rAF loops, scroll listeners, observers. Count the total simultaneous animation loops — this is almost certainly the lag source.
- **Bundle autopsy**: from `stats.html` and imports — top 10 heaviest modules, what's eagerly imported that shouldn't be (Three.js? Matter.js? all arcade games?), duplicate/overlapping components (e.g., multiple particle/cursor/fluid systems — flag redundant ones for deletion).
- **Jank inventory**: every animation that touches layout properties (width/top/margin) instead of transform/opacity; every unthrottled scroll/mousemove handler; every component that keeps animating while offscreen.
- **Layout defect list**: every section with broken/awkward responsive behavior (starting with the photo-beside-content line collapse), with the exact CSS cause.
- **Severity ranking**: every finding rated P0 (kills performance/looks broken) → P2 (polish).
</phase_0_forensic_audit>

<phase_1_deep_research>
Research BEFORE planning. Two tracks, and you must cite what you adopt and why:

**Track A — Design excellence.** Study current award-tier developer portfolios and agency sites (Awwwards SOTD/SOTM winners, Godly, FWA, siteinspire; reference-class creative devs like Bruno Simon, Jesper Landberg, Adham Dannaway-tier work, top Cursor/Lusion/Locomotive-style agency sites). Extract 2026-current patterns for: hero composition, project showcase treatments (sticky galleries, WebGL image hovers, device mockups, horizontal cinema scrollers), scroll choreography, kinetic typography, section transitions, dark/light palettes with glow/gradient systems, micro-interaction vocabulary. For each pattern you adopt: name the pattern, the class of site it comes from, and why it fits a gamified arcade identity.

**Track B — Performance engineering.** Research and encode: Core Web Vitals 2026 thresholds (LCP/INP/CLS), single-shared-rAF architecture, IntersectionObserver-gated canvas pausing, devicePixelRatio capping, OffscreenCanvas/worker options, `content-visibility: auto` + `contain-intrinsic-size`, View Transitions API for theme switching, speculative loading on hover-intent, Vite manualChunks strategy for three/matter/games, font subsetting + `size-adjust` fallback matching to kill CLS, AVIF/WebP srcset pipelines via vite-imagetools, priority hints/preload for LCP asset.

Distill both tracks into a **"Research Findings"** section: 10–15 concrete, adopted decisions (not generic advice).
</phase_1_deep_research>

<phase_2_the_plan>
Write `plan.md` with these sections, in this order:

**Section 0 — Audit Report** (from Phase 0).
**Section 1 — Research Findings** (from Phase 1).

**Section 2 — Design System Contract.** Lock these globally before any feature work:
- Full color token system for BOTH themes as CSS variables: surfaces (3 elevation levels), text (3 tiers), accent + accent-glow, gradient stops, border/glass tokens. Exact hex values, WCAG AA contrast-verified pairs.
- Typography scale (clamp()-based fluid sizes for h1→body→caption), letter-spacing and line-height rules, which weights get subset into the font files.
- Spacing rhythm: one scale (e.g., 8px base), section padding rules desktop/mobile, one max-width container rule. This kills both the dead-space problem and the cramped-space problem.
- Motion vocabulary: 3 standard easings (name them, cubic-bezier values), 3 standard durations, stagger rules for text reveals. Every animation in the plan must use tokens from this vocabulary — no ad-hoc values.

**Section 3 — Projects Showcase (flagship redesign).** The 5 projects become the site's centerpiece:
- Choose ONE showcase pattern from research (justify vs 2 rejected alternatives). E.g., scroll-pinned cinematic gallery where each project fills the viewport with a large visual, or WebGL-distortion hover gallery.
- Per-project card spec: real screenshot/mockup imagery — exact dimensions, aspect ratio, AVIF+WebP+PNG fallback, srcset breakpoints, blur-up LQIP placeholder, how to capture/generate the screenshots if none exist.
- Depth & interaction: layered parallax inside the card, tilt/magnetic hover, accent glow, tech-stack chips, live-demo + repo CTAs. Exact hover choreography (what moves, duration, easing tokens).
- Desktop layout AND mobile layout specified separately — mobile must never degrade into a plain text list.
- Performance clause: images lazy + decoded async, hover effects GPU-only, any WebGL hover effect shares the global rAF and pauses offscreen.

**Section 4 — Motion & 3D choreography, section by section.** A table covering EVERY section (Hero, About, Skills, Projects, HowIBuild, Timeline, PlayerStats, Contact, Footer): background treatment (shader gradient / particle field / 3D object / none — "none" is a valid, deliberate choice), entrance choreography (staggered kinetic headline reveals — "Olympic-level" word-by-word orchestration), scroll-linked behavior, and its performance budget (max ms/frame, pause condition, mobile downgrade, reduced-motion fallback). Consolidate the current redundant ambient systems into ONE coherent background engine.

**Section 5 — Layout repairs.** Every defect from the audit with its exact fix: the photo-beside-content collapse (prescribe the grid template, breakpoints, min-width guards, image treatment), plus every other awkward/empty/cramped zone. Before/after description per fix with acceptance criteria ("at 320px–1920px widths, no wrap-to-one-line, no overflow, no orphaned whitespace >120px tall").

**Section 6 — Theme toggle rebuilt.** CSS-variable tokens (from Section 2) so every color transitions; View Transitions API circular reveal expanding from the toggle button (with clip-path fallback for unsupported browsers); exact duration (~500–700ms) and easing; how canvases/WebGL scenes swap palettes without re-mount; FOUC-proof theme persistence (inline head script).

**Section 7 — Signature "wow" features.** 6–8 memorable, hiring-signal features beyond what exists. For each: concept, section, effort (S/M/L), perf cost, and the one-line impression it leaves on an HR/founder. Insane-but-fast only; must fit the arcade identity.

**Section 8 — PERFORMANCE MASTER PLAN (most important, most detailed).**
- **Budgets (hard numbers)**: initial JS ≤ 150KB gz critical path; LCP < 1.8s (mid-tier Android, Slow 4G), INP < 200ms, CLS < 0.02, 60fps scroll, Lighthouse mobile ≥ 95.
- **Code-splitting map**: exact lazy boundaries — three.js scenes, matter.js footer, each arcade game, command palette — with the loading trigger for each (viewport proximity, hover-intent, explicit click) and Vite `manualChunks` config.
- **Runtime architecture**: one shared rAF ticker all animated components subscribe to; global IntersectionObserver service that pauses ANY canvas/loop offscreen; DPR cap (≤1.5 desktop, 1 mobile); pointer-events throttled via rAF; Lenis + passive listeners; transform/opacity-only rule enforced.
- **Asset pipeline**: font subset + preload + fallback metric matching; image pipeline per Section 3; preload LCP asset; `content-visibility: auto` on all below-fold sections with intrinsic sizes.
- **Deletion list**: redundant components/effects to REMOVE (removal is optimization — be ruthless; several overlapping cursor/particle/fluid systems likely coexist).
- **Verification protocol**: `npm run build` → bundle diff vs audit baseline → Lighthouse (mobile, throttled) → manual 4x-CPU-throttle scroll test → Web Vitals field check. Pass/fail gates per milestone.

**Section 9 — Execution roadmap.** Every task numbered, dependency-ordered, grouped: M1 Performance foundation (splitting, shared ticker, observers, deletions) → M2 Design system + theme rebuild → M3 Layout repairs → M4 Projects showcase → M5 Motion/3D choreography → M6 Wow features → M7 Final audit & verification. Each task: file(s) touched, precise change, acceptance criteria, est. effort. M1 comes FIRST — speed is the foundation everything else builds on.
</phase_2_the_plan>

<self_review>
Before finalizing, re-read `plan.md` and grade it 1–10 against: (a) could an agent execute every task without asking anything? (b) does every visual feature carry its own performance strategy? (c) would an Awwwards judge call the design direction distinctive? (d) would the site hit the perf budgets? If any dimension < 9, revise that section and re-grade. State final scores at the bottom of the plan.
</self_review>

<rules>
- Specificity or nothing: every item names files, values, tokens, durations, breakpoints. "Improve X" is banned.
- Performance vetoes visuals — always. Nothing ships without its pause/downgrade/fallback strategy.
- `prefers-reduced-motion`, keyboard navigation, and WCAG AA are mandatory throughout.
- Preserve and elevate the gamified/arcade identity — do not genericize it.
- Mobile is a first-class design target, not an afterthought.
- Output ONLY `plan.md` in the project root.
</rules>
