/**
 * effects/registry.js — T-060. Every effect declares itself.
 *
 * There are 49 components under `ui/`, many of them effects, and each had its
 * own idea of tier gating, reduced-motion handling and cleanup. There was no
 * inventory, so there was no way to answer the only question that matters
 * about an effect system: **what does all of this cost together?**
 *
 * A descriptor is not documentation. It is the input to a CI gate
 * (`scripts/check-effect-budget.mjs`) that sums the declared cost per tier and
 * fails the build when the total exceeds the frame budget in Appendix B. The
 * numbers are honest estimates measured once and revised when an effect
 * changes; the point is not that they are exact, it is that they are *stated*
 * and that adding a tenth canvas has to be a decision rather than an
 * accident.
 *
 * The five laws this encodes (§8.1):
 *   1. Meaning before motion — `purpose` is required, and "it looks nice" is
 *      not one. An effect that cannot answer it is deleted.
 *   2. Additive, never load-bearing — every effect defines a tier-0 behaviour,
 *      and no information may exist only inside an effect.
 *   3. One budget, spent deliberately — `cost` is summed in CI.
 *   4. Four tiers, four defined behaviours — "off" is a valid answer but it
 *      has to be a written one.
 *   5. Choreographed, not simultaneous — `group` feeds src/lib/choreo.js.
 */

/**
 * @typedef {object} EffectDescriptor
 * @property {string} id
 * @property {'webgl'|'canvas2d'|'css'|'waapi'|'scroll-driven'|'dom'} kind
 * @property {string} purpose            what this tells the visitor
 * @property {{3:string,2:string,1:string,0:string}} tiers
 * @property {{gpuMs:number,cpuMs:number,bytes:number}} cost   per frame, per tier 3
 * @property {string[]} requires         capabilities without which it does not mount
 * @property {string[]} respects         preference axes it obeys
 * @property {string} [group]            choreography group
 */

/** @type {EffectDescriptor[]} */
export const EFFECTS = [
  {
    id: 'background-field',
    kind: 'webgl',
    purpose: 'Establishes that the page is a live rendering surface rather than a document, and carries the section-to-section character shift. §14.5 — three selectable scenes, each designed against each of the three themes.',
    tiers: {
      3: 'one of three scenes at up to 1.25 dpr, 30 fps — CALM (a theme wash), MOTIFS (eleven per-section patterns crossfading on the damped section index), or FOREST (parallax wind-blown canopies, receding ridges, rippled water, a running deer, a walking elephant, birds and drifting motes, all varying continuously with the section)',
      2: 'the same three scenes at 0.5 dpr, 30 fps',
      1: 'the .hero-mesh CSS gradient — compositor only',
      0: 'a static gradient',
    },
    /*
     * 1.6 -> 2.2 ms, and the number is an estimate rather than a measurement.
     *
     * Parked in a section the shader evaluates ONE motif and costs what the
     * old single-field version did; the increase is the crossfade, where two
     * are live at once, and the worst pair is net-into-waves (a 3x3 neighbour
     * loop alongside a heightfield). 2.2 is that worst case reasoned from the
     * old field's 1.6 for six noise calls, not a timer reading — this machine
     * renders in software, where GPU timings mean nothing.
     *
     * The engine already prints its real per-frame GPU cost in dev via
     * EXT_disjoint_timer_query. That reading, on real hardware, is what should
     * replace this number.
     *
     * §14.5 — unchanged by the three-scene split, and that is a claim rather
     * than an oversight. The scenes are branches on a uniform, so exactly one
     * of them is evaluated per draw and the cost is the most expensive branch,
     * not the sum. FOREST is that branch, and it is built to sit at roughly
     * the crossfading-motifs worst case it replaces: every layer is analytic
     * (a whole canopy costs one hash, not one per tree), the animals and the
     * water reflection are behind a y-compare that ~80 % of the screen fails
     * coherently, and nothing loops over scene content. CALM is far cheaper
     * than both.
     */
    cost: { gpuMs: 2.2, cpuMs: 0.2, bytes: 7400 },
    requires: ['webgl'],
    respects: ['reduced-motion', 'save-data', 'reduced-transparency'],
    group: 'ambient',
    region: 'global',
  },
  {
    id: 'hero-gem',
    kind: 'webgl',
    purpose: 'One object rendered in real time in the first viewport — the claim the whole site makes, stated once where it is cheapest to prove.',
    tiers: {
      3: 'thin-film iridescent metal on the shared environment, AgX-graded, pointer- and scroll-velocity-reactive',
      2: 'same material, reduced dpr',
      1: 'static poster image',
      0: 'none',
    },
    // 1.2 -> 1.4 ms: iridescence is a per-channel term added to the existing
    // shading pass (no second render, no transmission buffer), and the AgX
    // curve is a handful of ALU ops on the output. The environment lighting
    // that came with it is free — it replaced two of the four lamps.
    cost: { gpuMs: 1.4, cpuMs: 0.3, bytes: 5600 },
    requires: ['webgl'],
    respects: ['reduced-motion', 'save-data'],
    group: 'hero',
    region: 'hero',
  },
  {
    id: 'moon-forest-clock',
    kind: 'webgl',
    purpose: 'Tells the actual time, and gives the page a fixed point that keeps living while the visitor scrolls — the one element that is still moving when everything else has been read.',
    tiers: {
      3: 'full PBR diorama — crescent backlight, day/night sky, running deer, walking elephant, bird flock, sun arc on local time, three live hands under a glass crystal, real metal bezel, one shadow, hover parallax',
      2: 'same scene at 1.0 dpr',
      /*
       * P3.2 — "none" at both of these was the entry that made D-5 invisible
       * to this gate: the registry agreed there should be no clock below
       * tier 2, so the budget check passed on a defect.
       *
       * The wording matters to two regexes in this file, and both readings are
       * true rather than convenient. `CSS` puts tier 1 past `CSS_ONLY`, which
       * is correct — the dial is SVG plus one compositor animation, and the
       * GPU budget here measures SHADER cost, which is why tier 1's budget is
       * 0 rather than a small number. `static` puts tier 0 past `INERT`, which
       * is also correct: tier 0 is the no-effects floor, so the sweep stops
       * and the dial still shows the time to the minute.
       */
      1: 'CSS/SVG dial — same hands, same accent, no WebGL',
      0: 'static dial — no sweeping second hand',
    },
    /*
     * The predecessor of this effect — the corner skeleton watch — was never
     * registered here, which is the reason the budget gate never caught it
     * while a CDP profile put its texture uploads at 11.7 % of all samples.
     * An effect that is not in this list does not exist to the gate, and the
     * most expensive thing on the page was exactly the thing missing from it.
     *
     * So this entry is deliberately conservative rather than flattering:
     * 260x260 at 1.5 dpr is ~152 k fragments (the background field is ~322 k
     * with two octaves of noise per fragment for 2.2 ms), and textures are
     * 512/512/128, drawn on bucket changes rather than on a timer — which is
     * the whole difference from what it replaced.
     *
     * RE-COSTED AFTER PHASE 4, which is part of the work and not paperwork
     * after it. Three changes push it up and one pushes it down:
     *
     *   + the materials are PBR with an environment map, not MeshBasic
     *   + there is a transmissive crystal, which is a second render pass
     *   + there is a 512² shadow map
     *   + MSAA is on for this renderer alone (a 260px viewport, so cheap)
     *   − the hands render every frame but the DIORAMA only mutates at 30 fps,
     *     and `bytes` falls because the flat dial is a separate chunk
     *
     * The ceiling this must stay under is 4 ms at tier 3 and 1.5 ms at tier 2
     * (§9.6), measured live via `?perf=1` — the HUD turns the clock row red
     * above it. An effect whose declared cost is stale passes the gate on
     * false data, which App.jsx:110–118 documents as a bug that shipped once.
     */
    cost: { gpuMs: 0.85, cpuMs: 0.2, bytes: 5700 },
    // No longer `requires: ['webgl']` — the flat rendition is the answer when
    // WebGL is absent, so this effect is present on every device that has a
    // screen. That is the entire point of P3.2.
    requires: [],
    respects: ['reduced-motion', 'save-data'],
    group: 'ambient',
    region: 'global',
  },
  /*
   * `fluid-canvas` was here — a ~20-pass Navier-Stokes hero backdrop on its
   * own dedicated renderer, 1.2 ms GPU.
   *
   * Deleted in P5 to pay for Phase 4's material work on the clock. Tier 3 was
   * at exactly 5.00 of 5 ms before that work; the honest re-cost of the clock
   * put it at 5.65, and the rule is that budgets are tightened rather than
   * raised. See the header of components/ui/FluidHero.jsx for why this was the
   * right 1.2 ms to give back — briefly: it was the largest removable cost, it
   * owned the only dedicated WebGL context, it duplicated three other things
   * the hero already does, and six gates meant almost nobody saw it.
   */
  {
    id: 'card-distortion',
    kind: 'webgl',
    purpose: 'Communicates that a project card is a surface with depth, and rewards the hover that a recruiter is already making.',
    tiers: {
      3: 'displacement + RGB split, warmed on pointer intent',
      2: 'displacement only',
      1: 'CSS transform and colour change',
      0: 'static — a colour change on tap, no animation',
    },
    cost: { gpuMs: 1.1, cpuMs: 0.1, bytes: 2300 },
    requires: ['webgl', 'hover'],
    respects: ['reduced-motion'],
    group: 'cards',
    region: 'cards',
  },
  {
    id: 'custom-cursor',
    kind: 'dom',
    purpose: 'Signals what each element does before it is clicked, through one shared pointer object rather than eight hover states.',
    tiers: {
      3: 'dot + velocity trail + magnetic pull',
      2: 'dot + trail',
      1: 'native cursor',
      0: 'native cursor',
    },
    cost: { gpuMs: 0.1, cpuMs: 0.2, bytes: 1900 },
    requires: ['hover', 'fine-pointer'],
    respects: ['reduced-motion'],
    group: 'input',
    region: 'input',
  },
  {
    id: 'scroll-progress',
    kind: 'scroll-driven',
    purpose: 'Tells the visitor how much of the page is left, which is the one thing a long single-page site otherwise hides.',
    tiers: {
      3: 'native scroll timeline on the compositor',
      2: 'native scroll timeline',
      1: 'native scroll timeline',
      0: 'static bar',
    },
    cost: { gpuMs: 0.05, cpuMs: 0, bytes: 400 },
    requires: [],
    respects: ['reduced-motion'],
    group: 'chrome',
    region: 'chrome',
  },
  {
    id: 'reveal',
    kind: 'scroll-driven',
    purpose: 'Marks the boundary between one idea and the next as the visitor arrives at it.',
    tiers: {
      3: 'view() timeline, staggered by grid position',
      2: 'view() timeline, no stagger',
      1: 'fade only',
      0: 'no animation — content is present from the start',
    },
    cost: { gpuMs: 0.1, cpuMs: 0, bytes: 700 },
    requires: [],
    respects: ['reduced-motion'],
    group: 'entrance',
    region: 'cards',
  },
  {
    id: 'parallax',
    kind: 'scroll-driven',
    purpose: 'Separates the hero content from its backdrop so the first screen reads as having depth.',
    tiers: {
      3: 'view() timeline translate',
      2: 'view() timeline translate, halved',
      1: 'off',
      0: 'off',
    },
    cost: { gpuMs: 0.1, cpuMs: 0, bytes: 600 },
    requires: [],
    respects: ['reduced-motion'],
    group: 'hero',
    region: 'hero',
  },
  {
    id: 'kinetic-name',
    kind: 'dom',
    purpose: 'The signature interaction: the visitor’s pointer disturbs the name, which makes the page feel authored rather than templated.',
    tiers: {
      3: 'per-character proximity displacement',
      2: 'per-character, reduced radius',
      1: 'static text',
      0: 'static text',
    },
    cost: { gpuMs: 0.2, cpuMs: 0.4, bytes: 1400 },
    requires: ['hover', 'fine-pointer'],
    respects: ['reduced-motion'],
    group: 'hero',
    region: 'hero',
  },
  {
    id: 'physics-footer',
    kind: 'canvas2d',
    purpose: 'A last, deliberately playful note at the end of the page, where nothing is competing for attention.',
    tiers: {
      3: 'full matter-js simulation, draggable',
      2: 'simulation without drag',
      1: 'static type',
      0: 'static type',
    },
    cost: { gpuMs: 0.4, cpuMs: 1.1, bytes: 8800 },
    requires: [],
    respects: ['reduced-motion', 'save-data'],
    group: 'ambient',
    region: 'footer',
  },
  /*
   * `film-grain` was here. It is deleted, not disabled — P5.5 removed the DOM
   * node and the CSS in the same change.
   *
   * Recorded rather than silently dropped because this registry is the source
   * of truth for `check-effect-budget.mjs` and for docs/effects.md: an entry
   * left behind for an effect that no longer exists means the gate passes on
   * a 0.3 ms GPU cost that nothing is paying, and the docs describe a layer
   * nobody can see. The grain now lives in the background shader (4C.4).
   */
  {
    id: 'orrery',
    kind: 'css',
    purpose:
      'Fills the largest dead rectangle on the page with a Sun and eight planets that never stop turning — the "this is a live rendering surface" claim restated where a static gradient used to sit.',
    tiers: {
      3: 'Sun, eight planets, orbit rings, grid floor and ceiling, six star motes',
      2: 'Sun, eight planets, orbit rings, grid floor and ceiling, six star motes',
      1: 'Sun, eight planets, orbit rings and grid floor — motes and ceiling stand down',
      0: 'static, no animation, no promoted layers',
    },
    // Deliberately CSS rather than a fifth WebGL context: transforms on a
    // preserve-3d stage cannot be tier-gated off, cannot lose a context and
    // cannot be starved by the frame budget — all three of which have been
    // observed stopping the two three.js scenes on this page.
    cost: { gpuMs: 0.5, cpuMs: 0, bytes: 2600 },
    requires: [],
    respects: ['reduced-motion', 'forced-colors'],
    group: 'ambient',
    region: 'about',
  },
  {
    id: 'journey-rail',
    kind: 'scroll-driven',
    purpose:
      'Gives the one section that had no depth a track that recedes — each year arrives angled and set back, swings upright as it passes, and turns away behind you.',
    tiers: {
      3: 'cars swing on a view() timeline, year badges raised toward the camera, a light running the rail',
      2: 'same — it is one compositor transform per car and does not scale down usefully',
      1: 'same, and still free: the timeline is driven by the scroll, not by a frame loop',
      0: 'static — the plain upright list, which is also what any browser without view() timelines gets',
    },
    // Cheap for a reason that is structural rather than lucky: there is no
    // frame callback here at all. The compositor advances these keyframes from
    // the scroll offset, so the cost is the same transform work it would spend
    // scrolling the section anyway, plus one extra layer per car.
    cost: { gpuMs: 0.3, cpuMs: 0, bytes: 1500 },
    requires: [],
    respects: ['reduced-motion', 'forced-colors'],
    group: 'entrance',
    region: 'timeline',
  },
  {
    id: 'skill-reactor',
    kind: 'css',
    purpose:
      'Turns the skills illustration from a picture OF a 3-D stack into a 3-D object, and gives the section the one thing it was missing — something that moves before you touch it.',
    tiers: {
      3: 'two counter-turning rings, six billboarded panels, tethers, hub, gyros, motes; pointer tilts the gimbal',
      2: 'two counter-turning rings, six billboarded panels, tethers, hub, gyros, motes; pointer tilts the gimbal',
      1: 'rings, panels and tethers keep turning — corona, bloom and motes stand down',
      0: 'static — rings held a quarter turn apart, every panel facing the camera and at full opacity',
    },
    // The predecessor used `backface-visibility: hidden` to stop far faces
    // reading mirrored, which meant four of six were never drawn. Panels now
    // counter-rotate against their ring on the same clock, so every one of
    // them faces the camera at all times and none has to be hidden.
    cost: { gpuMs: 0.5, cpuMs: 0.1, bytes: 3400 },
    requires: [],
    respects: ['reduced-motion', 'forced-colors'],
    group: 'ambient',
    region: 'skills',
  },
  {
    id: 'skill-card-holo',
    kind: 'css',
    purpose:
      'Makes the skill card read as a material rather than as a rectangle with a highlight: a hue-rotating diffraction grating composited color-dodge, a caustic tracking the pointer along the rim, and a second grid seventy pixels behind the plate so two depths parallax past each other.',
    tiers: {
      3: 'crossed gratings, caustic, far grid — all driven by the pointer angle and position',
      2: 'crossed gratings, caustic, far grid — all driven by the pointer angle and position',
      1: 'far grid only; the blended grating and the blurred caustic are the two most expensive layers here and stand down',
      0: 'static — grating and caustic removed entirely, far grid held at a fixed opacity with no pointer response',
    },
    // Everything is opacity * --glare, which the pointer handler drives to 0
    // on leave, and `will-change` is scoped to :hover — six idle cards holding
    // nine promoted layers each would be fifty-four layers of nothing.
    // forced-colors takes it out entirely: color-dodge against a forced
    // palette produces luminance nobody chose.
    cost: { gpuMs: 0.35, cpuMs: 0.05, bytes: 2100 },
    requires: [],
    respects: ['reduced-motion', 'forced-colors'],
  },
  {
    id: 'theme-sweep',
    kind: 'waapi',
    purpose: 'Makes a theme change legible as one deliberate event rather than a flicker.',
    tiers: {
      3: 'View Transition with a clip-path reveal from the toggle',
      2: 'View Transition cross-fade',
      1: 'instant swap',
      0: 'instant swap',
    },
    cost: { gpuMs: 0.6, cpuMs: 0.2, bytes: 900 },
    requires: [],
    respects: ['reduced-motion'],
    group: 'transition',
    region: 'chrome',
  },
]

/** Per-tier frame budgets, from Appendix B. */
export const TIER_BUDGETS = {
  3: { gpuMs: 5, cpuMs: 3 },
  2: { gpuMs: 2, cpuMs: 1.5 },
  1: { gpuMs: 0, cpuMs: 0.5 },
  0: { gpuMs: 0, cpuMs: 0 },
}

/**
 * Whether an effect still does work at a tier. The tier description is the
 * source: anything that degrades to a static image, the native cursor, an
 * instant swap or a CSS-only version is not spending a frame budget.
 */
const INERT = /^(off|none|static|native|instant|no animation|a static)/i
const CSS_ONLY = /(^|[^A-Za-z])CSS([^A-Za-z]|$)|gradient|poster|fade only/i

export const runsAtTier = (effect, tier) => !INERT.test(effect.tiers[tier] || 'off')

/**
 * GPU cost is *shader* cost. Below tier 2 every effect that still runs has
 * degraded to a CSS fallback, and compositor work on a gradient is not what
 * the Appendix B GPU budget is measuring — that is why tier 1's GPU budget is
 * 0 rather than "a small number". CSS fallbacks still cost a little main
 * thread, so they keep counting against the CPU budget.
 */
const spendsGpuAt = (effect, tier) =>
  runsAtTier(effect, tier) &&
  (effect.kind === 'webgl' || effect.kind === 'canvas2d') &&
  !CSS_ONLY.test(effect.tiers[tier])

/**
 * Tier 2 and below run reduced versions, so cost is scaled by the same
 * factors the tier descriptions promise (half resolution, half frame rate).
 */
export const TIER_SCALE = { 3: 1, 2: 0.35, 1: 0.1, 0: 0 }

/**
 * The honest sum.
 *
 * Adding every effect's cost together assumes all of them run at once, which
 * is not what happens: the hero's gem and fluid canvas are two viewports
 * above the project cards, and the physics footer is below everything. Each
 * effect declares the `region` it lives in, and only one region can be on
 * screen at a time — so the frame cost is the globals plus the most expensive
 * single region. `animationGate.js` and the IntersectionObserver gating in
 * T-058 are what make that true rather than merely plausible.
 */
export function totalCost(tier) {
  const scale = TIER_SCALE[tier]
  const regions = new Map()
  let globalGpu = 0
  let globalCpu = 0
  let bytes = 0

  for (const effect of EFFECTS) {
    if (!runsAtTier(effect, tier)) continue
    bytes += effect.cost.bytes
    const gpu = spendsGpuAt(effect, tier) ? effect.cost.gpuMs * scale : 0
    const cpu = effect.cost.cpuMs * scale
    if (!effect.region || effect.region === 'global' || effect.region === 'chrome' || effect.region === 'input') {
      globalGpu += gpu
      globalCpu += cpu
    } else {
      const current = regions.get(effect.region) || { gpuMs: 0, cpuMs: 0 }
      regions.set(effect.region, { gpuMs: current.gpuMs + gpu, cpuMs: current.cpuMs + cpu })
    }
  }

  const worstGpu = Math.max(0, ...[...regions.values()].map((r) => r.gpuMs))
  const worstCpu = Math.max(0, ...[...regions.values()].map((r) => r.cpuMs))

  return { gpuMs: globalGpu + worstGpu, cpuMs: globalCpu + worstCpu, bytes }
}

export const findEffect = (id) => EFFECTS.find((e) => e.id === id)
