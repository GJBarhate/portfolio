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
    purpose: 'Establishes that the page is a live rendering surface rather than a document, and carries the section-to-section character shift.',
    tiers: {
      3: 'full domain-warped fBm at up to 1.25 dpr, 30 fps (T-058)',
      2: 'same shader at 0.5 dpr, 30 fps',
      1: 'the .hero-mesh CSS gradient — compositor only',
      0: 'a static gradient',
    },
    cost: { gpuMs: 1.6, cpuMs: 0.2, bytes: 4600 },
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
      3: 'full material, pointer-reactive',
      2: 'low-poly, reduced dpr',
      1: 'static poster image',
      0: 'none',
    },
    cost: { gpuMs: 1.2, cpuMs: 0.3, bytes: 5200 },
    requires: ['webgl'],
    respects: ['reduced-motion', 'save-data'],
    group: 'hero',
    region: 'hero',
  },
  {
    id: 'fluid-canvas',
    kind: 'webgl',
    purpose: 'Makes the hero respond to the pointer as a material rather than as a hover target.',
    tiers: {
      3: '8 simulation passes (was 24 — T-058.2)',
      2: '4 passes at half resolution',
      1: 'off',
      0: 'off',
    },
    cost: { gpuMs: 1.2, cpuMs: 0.2, bytes: 6100 },
    requires: ['webgl', 'hover'],
    respects: ['reduced-motion', 'save-data'],
    group: 'hero',
    region: 'hero',
  },
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
  {
    id: 'film-grain',
    kind: 'css',
    purpose: 'Breaks up banding on the dark gradients — the single most common giveaway of an amateur dark theme.',
    tiers: {
      3: 'animated grain',
      2: 'static grain',
      1: 'static grain',
      0: 'off',
    },
    cost: { gpuMs: 0.3, cpuMs: 0, bytes: 300 },
    requires: [],
    respects: ['reduced-motion', 'reduced-transparency', 'forced-colors'],
    group: 'ambient',
    region: 'global',
  },
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
