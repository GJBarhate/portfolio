# PLAN.md — The Another-Level Pass

**Repo:** `gaurav-barhate-portfolio`
**Written:** 2026-08-10
**Scope:** Every complaint in the brief, traced to real code, with a fix, a cost, a
test and an acceptance criterion.

**The headline change:** the background stops being a forest and becomes a
**biome** — one continuous world with forest at one end of a single `aridity`
axis and desert at the other, and a real savanna ecotone in between. It is built
as *one* parameterised function, not two scenes blended, which is why it costs
~33 % more shader instead of 200 % more. §4.0 is the section to read first.

---

## 0. How to read this document

This plan is **evidence-first**. Nothing below says "make it better". Every item
has four parts:

| Part | Meaning |
|---|---|
| **Observed** | What the code actually does today, with `file:line`. |
| **Why it fails** | The mechanism, not the feeling. |
| **Change** | The exact edit, in the exact file. |
| **Proof** | The command, test or measurement that makes it true. |

**Ground rules for the whole pass — non-negotiable:**

1. **No regressions to the build gates.** `npm run check:all` must stay green.
   That is `lint`, `build`, `test`, `check:encoding`, `check:contrast`,
   `check:breakpoints`, `check:effects`, `check:overflow`, `check:layout`,
   `check:attrs`, `check:dupes`, `check:parity`, `check:colorspace`,
   `check:structured`. If a change needs a budget raised, the budget is raised
   **explicitly in `scripts/check-budgets.mjs` with a comment saying why** — it is
   never silently exceeded.
2. **Degrade by resolution, never by deletion.** Already the repo's P5 principle.
   A weak GPU gets a *lower-resolution* forest, not a flat wash.
3. **One owner per value.** The repo already enforces this (`appearance.js` owns
   the vocabulary, `glStage.js` owns the WebGL contexts, `overlayBus.js` owns
   interruptions). Every new behaviour goes through the existing owner or becomes
   a new one — never a second writer.
4. **Measure before and after.** `scripts/measure-baseline.mjs` and `?perf=1`
   (the `perfHud`) exist. Capture numbers at the start of each phase.
5. **Ship in phases.** Each phase is independently revertable and independently
   shippable. No phase depends on a later phase.

---

## 1. Verified current state — the audit

I read the code. Here is what is actually true, because three of the six
complaints turn out to have a different cause than they appear to.

### 1.1 Eclipse and Forest are **already** the defaults

| Fact | Evidence |
|---|---|
| `DEFAULT_THEME = 'eclipse'` | `src/lib/appearance.js:118` |
| Pre-paint script resolves to eclipse | `index.html:99–105` |
| `DEFAULT_SCENE = 'forest'` | `src/lib/bgScene.js:53` |
| Parity gate holds the two in step | `scripts/check-appearance-parity.mjs` |

**So the defaults are correct in code.** If a visitor is not seeing them, the
cause is one of four things, and the plan below closes all four:

- **A stored preference from an earlier visit.** `bgScene()` reads
  `getStore().prefs?.bgScene`. Anyone who ever tapped `Calm` or `Motifs` — or
  who was on a build where a different default was written eagerly — is pinned
  to that value forever. There is no "back to recommended" path anywhere.
- **A silent tier downgrade.** `deviceProfile.js` / `glResilience.js` /
  `animationGate.js` can reduce what the background does. This must be audited:
  a downgrade that *replaces* forest with a wash violates P5 and looks
  identical to "forest is not the default".
- **No WebGL → no forest.** `Clock.jsx:36` returns `null` with no WebGL, and
  `BackgroundEngine` presumably does something similar. That case needs a
  **CSS forest fallback**, not nothing.
- **The label discourages it.** `BACKDROPS` in `appearance.js:151–173` labels
  the default `Forest — a living scene. Costs the most.` Telling a visitor the
  default is the expensive one is an invitation to change it. Honest, and the
  wrong emphasis for a default.

### 1.2 The notification system is well-built but tuned too long

| Surface | Dwell | Manual close? | File |
|---|---|---|---|
| `overlayBus` default TTL | **6000 ms** | — | `src/lib/overlayBus.js:145` |
| Achievement toast | **2200 ms** | no | `src/contexts/GameContext.jsx:20` |
| Spark completion toast | **6000 ms** | **yes — "Close" button** | `src/components/ui/SparkHunt.jsx:10, 212` |
| Session interruption budget | **2** | — | `src/lib/overlayBus.js:55` |
| Quiet period after load | 10 000 ms | — | `src/lib/overlayBus.js:64` |

**The `overlayBus` is genuinely excellent** — TTL, budget, priority, pre-empt
window, 30-day memory and a recruiter refusal all live in one arbiter that a
component cannot forget. The problem is not architecture, it is **numbers and
one leftover button**:

- 6000 ms is a long time to look at something you did not ask for.
- The spark toast still ships a `Close` button (`SparkHunt.jsx:212–214`) —
  exactly the "user has to click the cross" the brief objects to.
- Two interruptions per session is still two.

### 1.3 The "5 dots" is the Spark Hunt, and it never resets

`SPARK_IDS` is five ids (`SparkHunt.jsx:7`). The counter renders `n/5` always
(`SparkCounter`, line 106). On the fifth find it fires `forge:unlock` →
`forge-master`, then `SparkCompleteToast` claims the overlay slot for 6 s.

**The counter then sits at `5/5` forever.** `reset()` exists (line 52) but is
only ever called from `RunComplete`. The brief's "make it to 0" is asking for
exactly that reset, automatically, once the celebration has passed.

### 1.4 The watch moves under the cursor — confirmed, three separate causes

`MoonForestClock.jsx`:

- **`pointermove` → tilt.** Lines 1211–1221 read the pointer, lines 1444–1451
  drive `diorama.rotation.x/y` and `moonGroup.rotation.x/y` up to
  `MAX_TILT = 0.087` rad (5°) × 2. The dial (numerals + hands) correctly never
  tilts — but the whole scene behind it does, and at a 260 px widget that is a
  visible wobble following the mouse.
- **`pointerEvents: 'auto'`** is set inline at line 1485, overriding the CSS
  `pointer-events: none` at `index.css:5158`. So the widget is a live hit target
  sitting over the bottom-left corner of the page.
- **The entrance animation** (`forge-clock-in`, `index.css:5160`) animates
  `transform` on the host, and `filter: drop-shadow(...)` at line 5159 forces a
  filter pass on a `position: fixed` element on every repaint.

### 1.5 The forest is analytic and clever — and missing seven realism cues

`src/lib/bgEngine.js`, `forest()` at line 571. What it **has**, and it is a lot:
three parallax tree lines with clumped domain repetition (line 458), two ridges,
a three-point tonal ramp with warm highlights and cool shadows (`depthRamp`,
line 421), wavelength-dependent aerial extinction (`aerialExtinction`, line 416
— R 0.55 / G 0.78 / B 1.15, which is real Rayleigh behaviour), mirrored water
with ripple and glints (line 681), a deer, an elephant and three birds drawn
from signed-distance capsules.

What it **does not have**, in descending order of realism-per-millisecond:

| Missing | Why it matters |
|---|---|
| **Trunks** | `treeLine()` returns a filled region *below* the canopy line. There is no gap between trunks, so the near line is a solid black mass with a spiky top. Real forest silhouettes have vertical stripes of sky through them. **This is the single biggest tell.** |
| **Silhouette break-up** | The canopy edge is `1 - abs(f - 0.5 + lean) * 2` — a clean triangle. Conifer edges are ragged at every scale. |
| **God rays** | The horizon *is* the light source (`sunGlow`, line 640) but no light leaves it. Shafts through the canopy are the postcard cue. |
| **Ground / undergrowth** | Between `waterY` and the near tree line there is nothing. The animals stand on a colour boundary. |
| **Low mist** | No fog hugging the water. Aerial perspective is applied per-layer as extinction, but there is no *volume* in the air. |
| **Contact shadows** | `deerMask` / `elephantMask` are composited straight onto the ground colour — they float. |
| **Dither** | The sky is `mix(tint, lit, pow(sky,3.0)*0.72)` — a smooth ramp over ~800 px in 8-bit. That bands. `ditherOverlay.js` exists; confirm it covers this canvas. |

Plus two motion tells: the wind (`windAt`, line 432) moves every layer on the
*same* phase, and the birds (line 730) are three independent sines rather than a
flock.

**And the structural finding that reframes the whole phase:** `forest()` takes
`variant` (the damped section index) and already varies nine of its constants
along it continuously — `density`, `waterY`, `haze`, `canopyH`, `phase`,
`sunX`. **The scene is already parameterised.** It has one biome's worth of
parameters, but the machinery for a continuous landscape gradient is in place
and working. Adding a second biome is therefore not a second scene — it is
**more range on constants that already vary**. See §4.0.

### 1.6 Controls: correct hit targets, invisible presence

`.appearance-btn` is `min-block-size: 44px` (`index.css:1872`) — the target is
fine. But `.appearance-btn__label { display: none }` until **100rem = 1600 px**
(`index.css:1909–1910`). On a 1440-wide laptop — the single most common
recruiter screen — the control is a **22 × 22 px swatch** with no word next to
it. The comment at 1900–1907 explains this honestly: the header row overflowed
by 3 px at 1440, so the label was dropped rather than the row re-planned.

`.spark-counter` is the same shape: 44 px tall, 12 px mono digits
(`index.css:2439–2454`), visually indistinguishable from the appearance button
at a glance.

### 1.7 The games are functional and unjuiced

`ForgeRunner.jsx`: `LANES = [0,1,2]`, `GRAVITY = 0.5`, `JUMP_VEL = -9`,
`BASE_SPEED = 3` capped at 9, obstacles every `max(18, 55 - speed*3)` frames,
coins, and a linear `speed += 0.25` every 5 points.

That is a complete game loop and **zero** of the things that make a game feel
good: no coyote time, no input buffering, no hitstop, no screen shake, no
particles, no combo, no near-miss reward, no power-up, no run objective, no
adaptive audio, no difficulty *shape* (only a ramp).

### 1.8 Two encoding suspects to verify first

While reading, two comment openers appeared as `\*` rather than `/*`:

- `src/styles/index.css:2455` — `\* Before the first find: ...` inside a CSS file.
  A CSS comment that opens with `\*` is invalid; the parser will consume until
  the next `*/` and may swallow the rule that follows.
- `src/components/ui/MoonForestClock.jsx:1483` — same shape, inside a JSX opening tag.

**Phase 0, item 1: confirm or dismiss both.** `npm run check:encoding` exists
precisely for this class of bug. If they are real, they are a two-character fix
with an outsized blast radius.

---

## 2. The bar — what "another level" means here, concretely

A visitor decides in about 800 ms. The five things that carry that decision, and
the number each one has to hit:

| Signal | Target |
|---|---|
| First frame is the designed palette | Already met (pre-paint script). Keep it. |
| The background is a *place*, not a texture | Biome legible within 2 s of paint, at every breakpoint; forest, ecotone and desert all reachable by scrolling |
| The background never competes with the text | APCA passes at every aridity value; the ecotone is the *quietest* zone, by construction |
| Nothing interrupts | ≤ 1 uninvited overlay per session, ≤ 2.2 s each, zero close buttons |
| Nothing stutters | p95 frame ≤ 16.7 ms desktop tier 3, ≤ 22 ms tier 2, no long task > 200 ms |
| Every control is obviously a control | 44 px minimum, labelled at ≥ 1024 px, one hover state, one focus ring |

**And the honest constraint:** this site already runs a full-screen WebGL
shader, a second WebGL diorama, framer-motion, matter-js and five games. Every
addition below is costed. Where a realism cue costs more than it returns, the
plan says so and skips it — that judgement is what separates this from a wish
list.

---

## 3. PHASE 0 — Baseline and safety (half a day)

Nothing visual ships in this phase. It exists so every later claim is provable.

### 0.1 Verify the encoding suspects
```
npm run check:encoding
```
Open `src/styles/index.css:2455` and `src/components/ui/MoonForestClock.jsx:1483`
directly. If either really opens a comment with `\*`, fix to `/*` and add a rule
to `scripts/check-encoding.mjs` that fails on `\*` at the start of a comment.

**Proof:** `check:encoding` green; the CSS rule after line 2455
(`.spark-counter[data-started='false']`) confirmed to apply in DevTools.

### 0.2 Capture the baseline
```
npm run build
node scripts/measure-baseline.mjs
node scripts/size-report.mjs
```
Then in the browser, on **Eclipse + Forest + Full motion**:

- `?perf=1` → record p95 for `moon-forest-clock` and the bg engine
- DevTools Performance, 10 s scroll of the whole page: record **total blocking
  time**, **longest task**, **dropped frames**
- Lighthouse: LCP, CLS, INP, TBT

Write the numbers into `docs/baseline-2026-08.md`. **Every later phase quotes
these.**

### 0.3 Establish the device matrix
Test on, at minimum: a 1440 laptop (integrated GPU), a 1920 desktop (discrete),
one mid-range Android, one iPhone. Record the resolved `getTier()` on each.

**Exit criteria for Phase 0:** encoding clean, baseline recorded, matrix known.

---

## 4. PHASE 1 — Defaults that actually reach the visitor (1 day)

> Brief: *"make eclipse and forest default — anyone can see those by default,
> they can change."*

### 1.1 A one-time "recommended defaults" migration

**Observed:** `bgScene()` (`bgScene.js:56`) returns the stored value if it is one
of the three. There is no way to distinguish *"the visitor chose Calm"* from
*"an old build wrote Calm"*.

**Change** — in `src/lib/store.js`, add a schema bump:

```js
// forge:v1 → forge:v2
// v1 could not tell an explicit backdrop choice from an inherited one, so a
// visitor who never touched the control could be pinned to a scene they never
// picked. v2 stores prefs.bgSceneExplicit alongside prefs.bgScene; the
// migration sets it true only when a non-default value is already present AND
// the visitor has any other evidence of interaction (sparks, progress, theme).
// Everyone else is returned to Forest, once.
```

- Add `prefs.bgSceneExplicit: boolean` and `prefs.themeExplicit: boolean`.
- `setBgScene()` / `setTheme()` set the corresponding flag to `true`.
- Migration: if `!prefs.bgSceneExplicit`, delete `prefs.bgScene` so
  `DEFAULT_SCENE` applies.

**Proof:** new unit test `src/lib/__tests__/store.migration.test.js` covering:
fresh visitor → forest; v1 visitor with `bgScene: 'calm'` and no other state →
forest; v1 visitor with `bgScene: 'calm'` + sparks → calm preserved.

### 1.2 Audit the tier path for a silent forest downgrade

**Files to read and reconcile:** `src/lib/deviceProfile.js`,
`src/lib/glResilience.js`, `src/lib/animationGate.js`, `src/lib/bgEngine.js`
(the `uIntensity` path), `src/components/ui/BackgroundEngine.jsx`.

**Rule to enforce:** tier may change **pixel ratio, frame rate, octave count and
the wildlife guard band**. Tier may **never** change `uScene`. Write this as a
comment and as an assertion:

```js
// P5 — degrade by resolution, never by deletion. uScene comes from the
// visitor's stored preference and from nowhere else. If you are reading this
// because you want a "low-end fallback scene": lower uIntensity, drop
// DPR to 0.75, halve the frame rate, skip the god-ray taps. Do not change
// this uniform.
```

**Add a gate:** `scripts/check-appearance-parity.mjs` grows a rule that fails
the build if `uScene` is assigned anywhere except from `bgSceneId()`.

### 1.3 A real forest fallback with no WebGL

**Observed:** no WebGL → `Clock.jsx:36` returns `null`; the background engine
similarly has nothing to draw with.

**Change:** add a pure-CSS forest to `src/styles/index.css`, applied by
`html[data-bg-scene='forest'][data-gl='none']`:

- a layered `linear-gradient` sky matching the shader's `tint → lit` ramp
- three `background-image` SVG tree-line silhouettes (inline `data:` URIs,
  < 1.5 KB each, gzip) at three parallax speeds driven by
  `background-position` on the existing scroll variable
- a `repeating-linear-gradient` water band with a `mask-image` fade

Cost: **zero JS, zero GPU context**. `glResilience.js` already knows how to
publish a "no GL" state — reuse it, do not add a second detector.

### 1.4 Reword the Forest card so the default reads as the default

**Observed:** `appearance.js:167–172` —
`cost: 'Costs the most'`.

**Change:**

```js
{
  id: 'forest',
  label: 'Forest',
  meaning: 'A living scene — wind, water and wildlife',
  cost: 'Richest',           // was 'Costs the most'
  detail: 'The default. Scales itself down on slower machines.',
  glyph: '▲',
  recommended: true,
},
```

Add `recommended: true` to `eclipse` in `THEMES` too, and render a small
`Recommended` chip in `AppearanceConsole.jsx`. Honesty is preserved — the panel
still states the cost — but the *default* is framed as the intended experience
rather than as a warning.

**Parity:** `index.html`'s inline script duplicates the theme list by necessity.
`check:parity` already guards it. Confirm the new fields do not need mirroring
(they are console-only copy, so they do not) and note that in the parity script.

### 1.5 A "Restore recommended" action

Add to `AppearanceConsole.jsx` footer and to the Command Palette:

> **Restore recommended** — Eclipse, Forest, Full motion.

One call to `setTheme('eclipse'); setBackdrop('forest'); setMotion('system')`.
Clears the `*Explicit` flags. This is the escape hatch that makes 1.1 safe: if
the migration guesses wrong for someone, one keystroke fixes it.

**Phase 1 acceptance:**

- [ ] Fresh profile, 5 browsers → Eclipse + Forest on first paint, no flash
- [ ] Old `forge:v1` profile with `bgScene: 'calm'`, no other state → Forest
- [ ] Old profile with `bgScene: 'calm'` + sparks found → Calm preserved
- [ ] WebGL disabled (`chrome://flags`) → CSS forest visible, no console error
- [ ] Tier 1 device → forest present at reduced DPR, **not** replaced
- [ ] `npm run check:parity && npm run test:unit` green

---

## 5. PHASE 2 — Do Not Disturb (1 day)

> Brief: *"if notification or anything comes, it comes and within a sec is gone
> — should not need the user to click a cross button… and make it to 0… so that
> the user does not get disturbed."*

### 2.1 The policy, written once

Add to `src/lib/overlayBus.js` — this is the module that already owns the
contract, so it is the only place the numbers change:

```js
/**
 * DND v2 — the numbers, and why each one is what it is.
 *
 *   SESSION_BUDGET      2 → 1    One moment of personality per visit. Two was
 *                                already the ceiling before it reads as a site
 *                                that wants something; the first-run
 *                                choreography spends one by design, so two
 *                                meant a visitor could be interrupted twice
 *                                before reaching the work.
 *   DEFAULT_TTL      6000 → 2200 Matched to GameContext's achievement toast,
 *                                which is the one that has always felt right.
 *                                Long enough to read four words and a number
 *                                (~1.4 s), short enough that it is gone before
 *                                it is annoying.
 *   ACTIONABLE_TTL      —  8000  A toast with a control the visitor might use
 *                                keeps a longer dwell, because WCAG 2.2.1
 *                                says a time limit on an action is a failure.
 *                                There is currently exactly one candidate
 *                                (exit-intent) and it is the only overlay
 *                                allowed to keep a button.
 *   QUIET_PERIOD_MS   10000      Unchanged. Nothing during the entrance.
 */
export const SESSION_BUDGET = 1
const DEFAULT_TTL = 2200
const ACTIONABLE_TTL = 8000
```

### 2.2 Toasts become non-interactive by construction

**Change every status toast to `pointer-events: none`.** A thing that cannot be
clicked cannot need a close button, and it can never eat a click meant for the
page underneath it.

- `index.css` — add to `.spark-toast`, `.welcome-toast` and the achievement
  toast container (`AchievementToast.jsx:60` already has
  `pointer-events-none` on the wrapper; the cards inside do not need it back).
- **Delete** `SparkHunt.jsx:212–214` — the `Close` button — and
  `index.css:2510–2520` (`.spark-toast__close`).
- **Delete** the Escape / click-outside handlers at `SparkHunt.jsx:184–194`.
  They exist to dismiss something that now dismisses itself, and a global
  `pointerdown` listener that fires on every click on the page is not free.

### 2.3 Keep the countdown rail, shorten it

`.spark-toast__rail` (`index.css:2489–2499`) is the right idea and it stays: a
card that vanishes without warning reads as a bug. Retarget `--toast-ms` to the
new 2200 ms. Extend the same rail to the achievement toast and the welcome-back
toast so **every** auto-dismissing surface says it is leaving.

### 2.4 The spark counter returns to 0

**Change** in `SparkHunt.jsx`:

```js
// The counter returning to 0/5 is not a reset of the visitor's achievement —
// `forge:unlock` has already fired and the XP is banked in GameContext. It is
// the hunt becoming available again, which is the difference between a
// collectible and a trophy case. Fires after the toast has left, so the
// visitor sees 5/5 for the length of the celebration and 0/5 afterward.
useEffect(() => {
  if (collected.length !== total || total === 0) return
  const id = setTimeout(reset, 800 + TOAST_MS + 400)
  return () => clearTimeout(id)
}, [collected.length, total, reset])
```

`TOAST_MS` drops from 6000 to 2200, so the counter is back to `0/5` about 3.4 s
after the fifth find.

### 2.5 An explicit Do Not Disturb setting

The brief wants zero disturbance *by default*. WCAG 2.2.1 wants the timing to be
adjustable. Both are satisfiable:

Add a fourth row to `AppearanceConsole.jsx`, owned by `appearance.js`:

```js
export const NOTICES = [
  { id: 'brief',  label: 'Brief',  meaning: 'A moment, then gone (default)' },
  { id: 'longer', label: 'Longer', meaning: 'Stays until you have read it' },
  { id: 'off',    label: 'Off',    meaning: 'Nothing appears uninvited' },
]
export const DEFAULT_NOTICES = 'brief'
```

- `brief` → TTL 2200, budget 1
- `longer` → TTL 22 000 (**10× the default — this is what satisfies WCAG 2.2.1
  Timing Adjustable**), budget 2
- `off` → `claimOverlay` returns `null` unconditionally, same code path as
  Recruiter Mode

Persist in `prefs.notices`. Publish as `html[data-notices]` so CSS can react.

### 2.6 Nothing is lost

Because toasts are now brief and un-clickable, the information has to live
somewhere non-timed. It already does — achievements are in `GameContext`
(`progress.unlocked`) and rendered by `LevelRibbon` / `XPBar` / `RunComplete`.
**Verify** that every toast's content is reachable from a non-timed surface, and
add the missing one: a compact "Recent" list in the Command Palette under a
`Progress` group.

**Phase 2 acceptance:**

- [ ] No toast anywhere has a close button
- [ ] No toast has `pointer-events: auto`
- [ ] Every toast has a visible countdown rail
- [ ] Longest possible uninvited dwell at `brief` = 2200 ms; measured with a
      Playwright test that asserts the node is gone by 2600 ms
- [ ] `notices: 'longer'` gives ≥ 10× the `brief` dwell (WCAG 2.2.1)
- [ ] `notices: 'off'` → `claimOverlay` returns `null`, nothing mounts
- [ ] Spark counter reads `0/5` within 4 s of the fifth find
- [ ] At most **one** uninvited overlay in a 5-minute session, asserted in e2e
- [ ] Recruiter Mode still shows zero

---

## 6. PHASE 3 — The clock: pin it, then make it beautiful (1.5 days)

> Brief: *"when the cursor goes to the watch, the watch moves — remove this,
> the watch should be fixed, not move a little bit… and the watch should be more
> realistic, you didn't fill colours, real birds, deer, mountains."*

### 3.1 Pin it — three edits, all in one direction

**Edit 1 — remove the pointer tilt entirely.**
`MoonForestClock.jsx:1206–1221` (`tiltX/tiltY/tiltXTarget/tiltYTarget`, `onMove`,
`onLeave`, the two `addEventListener` calls) and `1444–1451` (the damped tilt
application) are deleted.

Replace with a **fixed, authored tilt** so the diorama keeps its depth without
tracking anything:

```js
/*
 * A CONSTANT lean, not a tracked one.
 *
 * The hover tilt was doing real work — rotating the diorama slid each layer
 * sideways by z*sin(theta), which is what separated the near pines from the
 * far ridge. Deleting it flattens the scene. Deleting the TRACKING and keeping
 * the ROTATION keeps every bit of that separation and costs nothing per frame,
 * because a constant does not need a damper, a pointer listener, or a
 * per-frame write.
 *
 * 3.2 degrees on each axis: enough that the layers visibly stack, small enough
 * that the dial still reads as facing the viewer.
 */
diorama.rotation.x = 0.056
diorama.rotation.y = -0.042
moonGroup.rotation.x = 0.022
moonGroup.rotation.y = -0.017
```

**Edit 2 — the host stops being a hit target.**
`MoonForestClock.jsx:1485`: delete `style={{ pointerEvents: 'auto' }}`. The CSS
`pointer-events: none` at `index.css:5158` then applies as it was always meant
to. Update the comment above it, which currently describes the opposite.

**Edit 3 — stop the host from ever repainting.**
In `index.css` `.forge-clock`:

```css
.forge-clock {
  /* … existing … */
  pointer-events: none;
  /* The widget is a fixed, self-contained 260px square that never affects
     anything outside itself. Telling the browser that is what lets it skip
     the box during page-level layout and paint. */
  contain: layout paint size style;
  /* drop-shadow on a fixed element re-runs a filter pass on every composite.
     A pre-multiplied box-shadow on a round element is the same picture for
     none of the cost. */
  filter: none;
  box-shadow: 0 0 20px color-mix(in oklch, var(--accent) 38%, transparent);
  border-radius: 50%;
}
```

**Proof:** DevTools → Rendering → *Paint flashing*. Moving the cursor across the
clock produces **no** repaint anywhere. Layer count unchanged.

### 3.2 Make it real — the seven changes worth their cost

The file's own reversal note (lines 758–781) is right: `antialias`, `shadowMap`
and `transmission` were removed because they cost 15.4 s of blocked main thread.
**None of them come back.** Everything below is either free per-frame or costs
under 0.3 ms.

**(a) Fill the colours — a real palette, not two inks.**
`SKY` (line 330) drives everything through `SKY[bucket].ink`, and *both* the
island and the far ridge take that one ink (`inkFor()`, line 903). One colour for
the whole landmass is why it reads flat. Give each layer its own hue, still
keyed on the bucket:

```js
const SCENE = {
  dawn:  { far: '#4a3f63', ridge: '#3a3252', island: '#2b2440', grass: '#3d4a35',
           water: '#4a5f7a', rim: '#ffb894' },
  day:   { far: '#4a6b82', ridge: '#35566b', island: '#264150', grass: '#3f5c38',
           water: '#3d6f8a', rim: '#ffe0a8' },
  dusk:  { far: '#3d2f4a', ridge: '#2d2238', island: '#1f1828', grass: '#2a3026',
           water: '#3a3d5c', rim: '#ff9d5c' },
  night: { far: '#1a2438', ridge: '#131b2b', island: '#0d131f', grass: '#121a16',
           water: '#16233d', rim: '#7fa8d8' },
}
```

Cost: **zero.** Same number of materials, different `.color` values.

**(b) Trees get trunks and two greens.**
`addPine()` (line 991) draws three stacked triangles and nothing else. Add:
- a `limbGeo(0.006, 0.008, h*0.25)` trunk below each pine, in a brown
  (`#3a2a1c`), z one unit behind the foliage
- alternate each pine between two greens (`#0c2318`, `#16351f`) by
  `prand(i) > 0.5`, so the tree line is not one silhouette

Cost: 9 extra meshes on the near line, 7 on the far. **~16 draw calls.** At
`getTier() >= 2` only; tier 1 keeps the current 3-triangle pines.

**(c) The deer and elephant get ground contact.**
Both currently float on a `position.y` (lines 1425, 1431). Add a flattened
ellipse — `discGeo(0.05, 12)` scaled `(1, 0.22, 1)` — in a 40 %-opacity
`MeshBasicMaterial` at the animal's feet, following its x. Two meshes, two
`position.x` writes per frame.

**This is the highest realism-per-byte change in the whole file.** A shadow is
what tells the eye an object is *on* a surface rather than *in front of* it.

**(d) The birds become a flock.**
Currently 4 independent lanes (line 1059). Change to a lead bird plus followers,
each lagging the lead's y by `0.02 * i` with a `0.35 * i` phase delay on the
flap. Same 4 meshes, same cost, completely different read.

**(e) Mountains get snow and a real profile.**
`farProfile` (line 915) is `-0.30 + 0.13 sin(3.1x + 0.7) + 0.05 sin(7.3x)` — two
sines, so it is smooth and wave-like rather than jagged. Add a third, higher
term with an `abs()` to make peaks:

```js
const farProfile = (x) =>
  -0.28
  + 0.15 * Math.sin(x * 3.1 + 0.7)
  + 0.06 * Math.sin(x * 7.3)
  + 0.045 * Math.abs(Math.sin(x * 5.7 + 1.9))   // <- the ridgeline's teeth
```

Then a **snow cap**: a second `ridgeGeo` band from `farProfile(x)` down to
`farProfile(x) - 0.018`, but only where `farProfile(x) > -0.24`, in a pale
`#e8eef5` at 0.7 opacity. One extra mesh.

**(f) Water gets a horizon reflection band and a shoreline.**
The water (line 983) is one physical material with an env-map reflection. Add:
- a **shore line** — a 0.006-unit bright band at the water/island boundary,
  `MeshBasicMaterial` at the bucket's `rim` colour, 0.5 opacity. Real water
  always has a bright edge where it meets land.
- a **moon path** — a vertical `quadGeo(0.10, 0.30)` with the glow texture,
  positioned at the sun/moon's `x`, additively blended at 0.25. This is the
  single most recognisable water cue there is.

Two meshes, no per-frame cost beyond one `position.x` write.

**(g) Keep the environment, add one rim light.**
`makeEnvironment` is already in use (line 818) and that stays. Add one
`DirectionalLight` from behind-left at 0.6 intensity in the bucket's `rim`
colour, positioned to catch the animals' backs. One light, no shadow map.

**Cost budget for 3.2:** target **≤ 0.4 ms** added to the clock's p95, measured
via the existing `trackCost('moon-forest-clock', …)` at line 1374. The Phase-4
budget in the file's own comment is ≤ 4 ms at tier 3 and ≤ 1.5 ms at tier 2.
**If any item pushes past that, item (b) is the first to go** — it is the most
draw calls for the least silhouette change at 150 px.

### 3.3 What is deliberately NOT done

- **No `antialias: true`.** Measured at 11.4 s of blocked main thread.
- **No shadow map.** A few pixels of soft gradient for a full depth pass.
- **No transmission / crystal.** A separate render target every frame.
- **No R3F, no drei, no postprocessing.** ~250 KB gzipped against a build gate.
- **No bloom pass.** The halo sprite at line 877 is indistinguishable at 260 px.

These are all in the file's own reversal note. **They stay reversed.** The plan
is not allowed to re-add a known 15-second regression in the name of realism.

**Phase 3 acceptance:**

- [ ] Cursor across the clock → zero repaint (Paint flashing), zero rotation change
- [ ] Clock never intercepts a pointer event (Playwright: click at the clock's
      centre reaches the element beneath it)
- [ ] Each of dawn / day / dusk / night has ≥ 5 distinguishable colours
      (screenshot diff against the four buckets)
- [ ] Animals cast a contact shadow at all four buckets
- [ ] `trackCost('moon-forest-clock')` p95 ≤ baseline + 0.4 ms at tier 3
- [ ] `npm run check:budgets` green

---

## 7. PHASE 4 — The biome: one world, forest at one end, desert at the other (3 days)

> Brief: *"in forest, one forest and desert both mix and look real… god premium
> elite level… optimised so it does not take much load, no lag… but do not
> disturb the eye."*

All work is in `src/lib/bgEngine.js`, in and around `forest()` (line 571). The
architecture is right — one program, `uScene` branch, everything analytic — so
**every change below is additive GLSL inside the existing branch.** No new
passes, no new render targets, no second program, no new dependency.

---

### 4.0 THE ARCHITECTURE — and why the obvious way is the wrong way

This is the most important section in the document. Get it wrong and the site
runs at half the frame rate for a picture that looks like two photographs
sellotaped together.

#### 4.0.1 The obvious implementation, and why it is rejected

```glsl
// ✗ DO NOT DO THIS
vec3 col = mix(forest(p, t, v, light), desert(p, t, v, light), biome);
```

Three fatal problems, in order of severity:

1. **It costs 2× everywhere.** Both functions run for every pixel, on every
   frame, forever — including the 100 % of the screen where one of them is
   multiplied by zero. `forest()` is already ~200 ops/px. This makes the shader
   ~400 ops/px before a single new feature is added. That is the lag.
2. **Wrapping it in `if (biome < 0.5)` makes it worse, not better.** Per the
   research: *"branch divergence within a warp makes all parts of the branch
   execute in sequence."* A biome boundary is precisely where adjacent pixels
   disagree, so the branch diverges exactly where the picture is most
   interesting, and both sides run anyway — you pay the 2× **and** the branch.
3. **It looks wrong.** A cross-dissolve between two finished pictures is a
   *dissolve*, not a *place*. Halfway through you get semi-transparent pine
   trees floating over semi-transparent dunes. That is the "weird" the brief
   explicitly rules out.

#### 4.0.2 The implementation that ships: ONE parameterised world

There is no `forest()` and no `desert()`. There is **`biome()`**, and forest and
desert are the two ends of the *same* parameter vector.

```glsl
/*
 * ── ONE WORLD, TWO ENDS ───────────────────────────────────────────────────
 *
 * A forest and a desert are not two pictures. They are one landscape at two
 * values of ONE variable: how much water there is.
 *
 * Every visual difference between them is downstream of that:
 *
 *   water ↓  →  tree density ↓        trees compete for it and lose
 *   water ↓  →  tree shape changes    a spire sheds snow; a parasol sheds sun
 *   water ↓  →  ground litter → sand  nothing rots where nothing grows
 *   water ↓  →  river → wadi → dune   the channel outlives the river
 *   water ↓  →  mist → dust           the same fbm, different altitude + hue
 *   water ↓  →  blue haze → amber     Rayleigh gives way to Mie (see 4.0.4)
 *   water ↓  →  soft light → hard     no canopy, no cloud, no diffuser
 *   water ↓  →  deer → oryx           different animal, same four legs
 *
 * So the shader takes ONE float — `aridity` — and every constant in the scene
 * becomes a `mix()` along it. There is no second scene to evaluate, no branch
 * to diverge, and no dissolve: at aridity 0.5 you do not get half a forest
 * over half a desert, you get the thing that actually exists at aridity 0.5,
 * which is a SAVANNA. Sparse trees on dry ground. A real place.
 *
 * Measured cost of the whole biome axis: ~+28 ops/px over the current
 * forest-only shader. Not +200. The mixes are 2-op `mix()` calls on values
 * that were already being computed.
 */
```

**The parameter vector — every one of these is a `mix(forestValue, desertValue, f(aridity))`:**

| Parameter | Forest (a=0) | Desert (a=1) | Curve | Why that curve |
|---|---|---|---|---|
| `treeDensity` | 7.6 | 0.35 | `a²` | Trees do not thin linearly — they hold on, then collapse. Squaring is the observed NDVI gradient across the Sahel. |
| `treeHeight` | 1.00 | 0.42 | `a` | Linear is fine; height tracks water directly. |
| `crownWidth` | 0.38 | 0.95 | `smoothstep(.3,.8,a)` | Conifer spire → acacia parasol. **The single strongest species cue.** |
| `trunkFrac` | 0.30 | 0.62 | `a` | Desert trees are mostly trunk — the crown sits high to escape browsers. |
| `duneAmp` | 0.0 | 0.055 | `smoothstep(.45,1,a)` | Dunes need bare sand. They cannot exist under litter, so they appear *after* the vegetation goes. |
| `waterLevel` | 1.0 | 0.0 | `1-smoothstep(.3,.7,a)` | River → braided stream → dry wash. The channel stays after the water leaves. |
| `groundLift` | 0.05 | 0.34 | `a` | Sand is bright. Forest floor is the darkest thing in the frame. |
| `hazeHue` | blue | amber | `a` | Rayleigh → Mie. See 4.0.4. |
| `sunHardness` | 0.25 | 1.0 | `a²` | Shadow edge softness and specular tightness. |
| `mistAlt` | `+0.018` | `+0.004` | `a` | Mist floats; dust hugs the ground. |
| `lifeMix` | deer | oryx | `smoothstep(.4,.7,a)` | One crossfade, inside a band that is already guarded. |

**Cost of the entire table: 11 `mix()` calls. 22 ops. Once per pixel.** Not per
layer, not per sample — the parameters are computed once at the top of
`biome()` and every layer reads them.

#### 4.0.3 Where `aridity` comes from — and the one detail that sells it

```glsl
/*
 * Aridity is a FIELD, not a uniform.
 *
 * If it came only from uSection it would be uniform across the draw — free,
 * coherent, and it would mean you never see both biomes at once. The brief
 * asks for them MIXED, so aridity has to vary across the screen.
 *
 * Three terms, and the third is the one that makes it look real:
 */
float aridityAt(vec2 p, float variant, float terrainY) {
  /* 1. WHERE YOU ARE. Scrolling walks you across the ecotone, so the whole
   *    page is one traverse from wet to dry and back. Slow — a full crossing
   *    takes about four sections, which is roughly a minute of reading. */
  float journey = 0.5 + 0.42 * sin(variant * 0.55 - 0.9);

  /* 2. WHICH WAY YOU ARE LOOKING. A horizontal ramp, so the boundary is IN
   *    the frame rather than behind you. ±0.28 puts genuine forest at one
   *    edge and genuine desert at the other at the midpoint of the journey. */
  float bearing = (p.x - 0.5) * 0.56;

  /* 3. THE FINGERS. ← this is the one.
   *
   *    A real forest/desert boundary is never a line. Trees follow the water
   *    table, water collects in the low ground, so the forest reaches INTO the
   *    desert along every valley and the desert climbs every ridge. The
   *    boundary is interdigitated — "fingered" — at every scale.
   *
   *    Two terms buy all of it: low-frequency noise for the large fingers, and
   *    a coupling to the terrain's own height so that trees genuinely cluster
   *    in the dips of the ground they are standing on. The second term is FREE
   *    — terrainY is already computed for the ridges — and it is the single
   *    most convincing detail in this entire phase. Without it the boundary
   *    reads as a gradient someone applied; with it, it reads as ecology. */
  float fingers = snoise(vec2(p.x * 1.9, variant * 0.4)) * 0.16;
  float hollow  = -terrainY * 0.34;

  return clamp(journey + bearing + fingers + hollow, 0.0, 1.0);
}
```

**Branch-coherence analysis (this is the "no lag" answer):**

`aridity` varies over the *whole screen width*. Across a 32-pixel warp tile it
changes by roughly `0.56 × 32/1920 ≈ 0.009`. So within any warp, aridity is
effectively constant. Every branch that *does* remain (the wildlife crossfade,
the dune band) is therefore **coherent in ~97 % of warps** — divergence is
confined to the thin bands that straddle a threshold.

Per the research: *"branching divergence between warps does not affect
runtime."* This is exactly that case. **We get a spatially-varying biome at
uniform-branch cost.**

#### 4.0.4 The colour science — two lines that do most of the work

This is the difference between "a desert-coloured forest" and a desert.

```glsl
/*
 * RAYLEIGH → MIE.
 *
 * The existing aerialExtinction() (line 416) uses density (0.55, 0.78, 1.15) —
 * blue scattered out fastest. That is RAYLEIGH scattering, off molecules, and
 * it is why distant forest goes blue. It is correct, and it is correct for a
 * FOREST.
 *
 * A desert's air is full of suspended dust — particles far larger than a
 * wavelength — which is MIE scattering, and Mie is very nearly wavelength-
 * INDEPENDENT with a slight forward-red bias. That is why every desert
 * photograph ever taken has an amber horizon and why a blue-hazed desert looks
 * like a forest with the trees deleted.
 *
 * Two lines. This is the highest colour-return-per-op in the file.
 */
vec3 aerialExtinction(float depth, float aridity) {
  vec3 rayleigh = vec3(0.55, 0.78, 1.15);   /* molecules — blue goes first  */
  vec3 mie      = vec3(1.05, 0.92, 0.74);   /* dust      — red survives     */
  vec3 density  = mix(rayleigh, mie, aridity);
  return 1.0 - exp(-depth * density * mix(2.2, 3.1, aridity));
  /*                                        ↑ desert air is dustier, so the
  /*                                          same distance hazes harder    */
}
```

And the tonal poles (`ink` / `lit`, lines 614–626) gain an aridity term:

```glsl
/* Forest ink is near-black — a conifer against a bright sky. Desert ink is a
   warm mid-brown — a rock at noon is never black, because the sky is filling
   its shadow from every direction and the ground is bouncing light up into it.
   A pure-black desert silhouette is the most common tell in amateur work. */
ink = mix(ink, mix(ink, vec3(0.34, 0.24, 0.16), 0.62), aridity);

/* Forest `lit` is the accent glow at the horizon. Desert `lit` is a hot,
   desaturated near-white — sand at midday is the brightest natural surface
   most people ever see, and it is NOT saturated. Pushing it toward the theme
   accent is what makes procedural deserts look like orange plastic. */
lit = mix(lit, mix(lit, vec3(0.97, 0.93, 0.84), 0.55), aridity);
```

#### 4.0.5 The three-zone read, so the eye is never disturbed

The brief's constraint — *"do not disturb the eye"* — is a legibility
requirement, and it is satisfiable by construction because **aridity also
drives contrast**:

| Zone | aridity | Character | Local contrast |
|---|---|---|---|
| **Forest** | 0.00 – 0.35 | Dense conifers, river, mist, blue haze, cool | High — but it is *dark*, and text sits on it well |
| **Ecotone** | 0.35 – 0.65 | Scattered acacia, banded scrub (4.13), dry grass, braided wash | **Deliberately the LOWEST** — see below |
| **Desert** | 0.65 – 1.00 | Dunes, rock, mirage, dust, amber haze, hot | Medium — dunes are smooth, which is quiet |

The ecotone is the busiest zone *conceptually* and must be the quietest
*optically*, because it is where the two halves of the frame meet and the eye
naturally goes there. So:

```glsl
/* The ecotone is where the eye lands, so it is where the picture whispers.
   A bell curve on aridity, peaking at 0.5, that pulls every layer toward the
   scene's own midtone. This is one multiply and it is the whole reason the
   composition does not fight the text. */
float calm = 1.0 - 0.34 * exp(-pow((aridity - 0.5) * 3.4, 2.0));
col = mix(sceneMid, col, calm);
```

**And the scrim still wins.** `check:contrast` is a build gate. If any biome at
any section at any theme drops text below APCA threshold, **the scrim behind
the text darkens — the picture is never dimmed to fix it.**

---

### 4.1 Trunks — the single biggest tell (**do this first**)

**Observed:** `treeLine()` (line 445) returns `smoothstep(top+0.004, top-0.004, p.y)`
— **1 everywhere below the canopy line.** The near tree line is therefore a
solid mass of ink from the canopy down to the bottom of the screen. Real forest
silhouettes have sky between trunks.

**Change:** split the return into canopy and trunk regions.

```glsl
/*
 * A tree line is two things, and drawing it as one is the whole reason the
 * near line reads as a wall.
 *
 *   ABOVE the trunk band: the canopy — a filled, ragged triangle.
 *   BELOW it:             trunks — a narrow column per cell, with SKY between.
 *
 * The trunk is centred on the same hashed lean as the spike, so a leaning tree
 * has a leaning trunk. Width is proportional to the tree's own height, which
 * is the cheapest correlation available and reads as "older trees are thicker".
 */
float treeLineDetailed(vec2 p, float t, float density, float base,
                       float height, float sway, float trunkFrac) {
  float clump = sin(p.x * 0.7 + hash1(floor(p.x * 0.35)) * 6.28) * 0.14;
  float x = (p.x + clump) * density;
  float cell = floor(x);
  float f = fract(x);
  float h = 0.45 + 0.55 * hash1(cell);
  float hL = 0.45 + 0.55 * hash1(cell - 1.0);
  float hR = 0.45 + 0.55 * hash1(cell + 1.0);
  float lean = (hash1(cell + 31.7) - 0.5) * 0.34;

  float spike  = 1.0 - abs(f - 0.5 + lean) * 2.0;
  float spikeL = 1.0 - abs(f + 0.5) * 2.0;
  float spikeR = 1.0 - abs(f - 1.5) * 2.0;
  float canopy = max(max(spike * h, spikeL * hL), spikeR * hR);

  float w = windAt(p.x, t, sway);
  float top = base + canopy * height + w * canopy;

  /* 4.2 — the silhouette is ragged, not clean. One hash sampled along the
     canopy edge at ~12x the cell frequency, scaled by how close this column is
     to the edge so the interior is untouched. Two ops. */
  top += (hash1(floor(x * 12.0)) - 0.5) * height * 0.055 * canopy;

  float canopyMask = smoothstep(top + 0.004, top - 0.004, p.y);

  /* The trunk band: from the base of the canopy down to the ground. */
  float trunkTop = base + canopy * height * trunkFrac;
  float trunkHalf = 0.012 + h * 0.010;
  float dx = abs(f - 0.5 + lean * 0.6) / max(density, 1e-4);
  float trunkMask = smoothstep(trunkHalf, trunkHalf * 0.55, dx * density)
                  * step(p.y, trunkTop);

  /* Below the canopy the pixel is tree only if it is inside a trunk. */
  return mix(canopyMask, max(trunkMask, step(trunkTop, p.y) * canopyMask),
             step(p.y, trunkTop));
}
```

Simpler and cheaper equivalent, which is what actually ships:

```glsl
float above = smoothstep(top + 0.004, top - 0.004, p.y);       // canopy region
float inTrunkBand = step(p.y, trunkTop);
return mix(above, above * trunkMask, inTrunkBand);
```

**Apply to the NEAR line only** (`trunkFrac = 0.30`). The mid and far lines keep
the current solid fill — at their scale the trunks would be sub-pixel and would
alias into a shimmer, which is worse than no trunks.

**Cost:** ~8 extra ALU ops on ~25 % of the screen. Negligible.
**Return:** enormous. This is the change.

### 4.2 Ragged silhouette

Included in 4.1 above — one `hash1(floor(x * 12.0))` term on `top`, scaled by
`canopy` so it only affects the edge. **Two ops, applied to all three lines.**

### 4.3 God rays from the horizon sun

**Observed:** `sunGlow` (line 640) is `exp(-9.0 * distance(p, sunPos))` — a
radial falloff that lights the sky near the sun and goes nowhere.

**Change:** a screen-space radial blur toward the sun, occluded by the canopy.
This is the classic post-process (Mitchell, *GPU Gems 3* ch. 13) done in-line
with **6 taps instead of 100**, which is all a soft shaft needs:

```glsl
/*
 * Light shafts, 6 taps.
 *
 * The textbook version marches 64–100 samples from the pixel toward the light
 * and accumulates an occlusion buffer. That is a second pass and a render
 * target, neither of which this engine has or wants. Six taps of the CANOPY
 * MASK along the same ray gives a shaft that is soft rather than banded —
 * because the thing being blurred is already a soft function, not a depth
 * buffer.
 *
 * Dithered by a per-pixel hash so the six steps do not resolve as six bands;
 * this is the same trick blue-noise raymarching uses, at 1/10th the cost.
 */
vec3 lightShafts(vec2 p, vec2 sunPos, float t, float density,
                 float waterY, float canopyH, vec3 lit) {
  vec2 ray = (sunPos - p) / 6.0;
  float jitter = hash1(p.x * 311.7 + p.y * 191.3) * 0.5;
  vec2 s = p + ray * jitter;
  float acc = 0.0;
  float decay = 1.0;
  for (int i = 0; i < 6; i++) {
    /* Only the FAR canopy occludes — the near line is in front of the light
       source, so shafts through it would be backwards. */
    float occ = treeLine(vec2(s.x * 0.55, s.y), t, density * 1.9,
                         waterY + 0.075, canopyH * 0.55, 0.004);
    acc += (1.0 - occ) * decay;
    decay *= 0.82;
    s += ray;
  }
  acc /= 6.0;
  /* Shafts only exist near the sun and only above the waterline. */
  float reach = exp(-2.6 * distance(p, sunPos)) * smoothstep(waterY - 0.02, waterY + 0.10, p.y);
  return lit * acc * reach * 0.34;
}
```

Added **after** the tree lines and **before** the water, as
`col += lightShafts(...)` (additive — light adds, it does not replace).

**Cost:** 6 `treeLine` evaluations. `treeLine` is ~20 ALU ops, so ~120 ops, but
**only where `reach > 0`** — wrap the whole call in
`if (distance(p, sunPos) < 0.75 && p.y > waterY - 0.02)`. That is ~15 % of the
screen. Net: **~18 ops/pixel averaged.**

**Tier gate:** taps drop 6 → 3 at tier 2, and the whole call is skipped at
tier 1. Wire through the existing `uIntensity` uniform so no new uniform is
needed.

### 4.4 Ground and undergrowth

**Observed:** between `waterY` and the near canopy base there is a colour
boundary and nothing else. The animals stand on it.

**Change:** a ground band with a noisy top edge and a grass texture:

```glsl
/* The bank: a band from waterY up to the near tree base, with a broken top
   edge and a second, much smaller tree line standing in for undergrowth. */
float bankTop = waterY + 0.022 + fbm2(vec2(p.x * 6.0, 0.0)) * 0.010;
float bank = smoothstep(bankTop + 0.004, bankTop - 0.004, p.y)
           * step(waterY - 0.002, p.y);
vec3 groundCol = depthRamp(ink, lit, 0.045, 0.05);
col = mix(col, groundCol, bank);

/* Undergrowth — the same treeLine primitive at 1/6 the height and 4x the
   density. Ferns for free. */
float scrub = treeLine(p, t, density * 4.2, waterY + 0.004, canopyH * 0.14, 0.020);
col = mix(col, mix(ink, lit, 0.02), scrub * bank);
```

**Cost:** one `fbm2` + one `treeLine`, both guarded to the ~10 % of screen below
`waterY + 0.16` where the wildlife guard already runs. Fold it into that
existing `if`.

### 4.5 Low mist over the water

**Observed:** aerial extinction is per-layer, so distance is handled — but there
is no *volume*. Real forest photographs almost always have a mist band sitting
on the water.

```glsl
/* Mist: an fbm band centred on the waterline, drifting sideways slower than
   the wind. Additive toward `lit`, because mist is scattered light, not paint. */
float mistBand = exp(-pow((p.y - waterY - 0.018) * 16.0, 2.0));
float mistN = fbm2(vec2(p.x * 2.2 - t * 0.035, p.y * 5.0 + t * 0.012)) * 0.5 + 0.5;
col = mix(col, lit, mistBand * mistN * 0.24);
```

**Cost:** one `fbm2` (2 `snoise` calls) + one `exp`. `mistBand` falls below
1/255 outside ±0.04 of the waterline, so guard it:
`if (abs(p.y - waterY - 0.018) < 0.05)`. **~3 % of the screen.**

### 4.6 Water: Fresnel, shoreline, sun glitter

The water block (line 681) already mirrors the canopy and the ridge, darkens the
reflection, and adds crest glints. Three additions:

```glsl
/* Fresnel: reflectivity rises toward grazing angles, i.e. toward the horizon.
   In a 2D scene "grazing" is simply "near waterY" — so the mirror is strong at
   the far shore and weak in the foreground, which is what a photograph does. */
float fres = pow(1.0 - clamp(depth * 3.4, 0.0, 1.0), 3.0);
water = mix(mix(ink, lit, 0.10), water, 0.35 + fres * 0.65);

/* Shoreline: a bright line where water meets land. Every body of water has
   one and its absence is why the boundary reads as a colour change. */
float shore = exp(-depth * 260.0);
water = mix(water, lit, shore * 0.45);

/* Glitter path: the crest glints already exist but are spread across the whole
   width. Real sun glitter is a COLUMN under the light source. */
float pathMask = exp(-pow((p.x - sunX) * 3.2, 2.0));
water = mix(water, lit, glint * 0.30 * pathMask * (1.0 - depth * 2.0));
```

**Cost:** two `exp`, one `pow`, inside the existing `p.y < waterY` branch.

### 4.7 Wind that travels, and a flock

**Observed:** `windAt(x, t, scale)` (line 432) — every layer gets the same phase.
A gust hits the far ridge and the near trees on the same frame.

```glsl
/* A gust is a wave with a speed. Delaying each layer by its own depth is one
   subtraction and it is the difference between "trees swaying" and "wind". */
float windAt(float x, float t, float scale, float depthDelay) {
  float tt = t - depthDelay;
  float gust = 0.55 + 0.45 * sin(tt * 0.23);
  /* A third octave, so a gust has texture rather than being a pure tone. */
  return (sin(x * 1.7 - tt * 0.85) * 0.55
        + sin(x * 3.9 - tt * 1.31) * 0.32
        + sin(x * 8.7 - tt * 2.10) * 0.13) * gust * scale;
}
```

Pass `depthDelay` = 0.0 (near), 0.45 (mid), 0.95 (far).

**Birds:** replace the three independent sines (line 730) with a lead and two
followers:

```glsl
float leadX = fract(t * 0.030 + 0.37) * 1.9 - 0.45;
float leadY = waterY + 0.34 + sin(t * 0.7) * 0.022;
for (int i = 0; i < 3; i++) {
  float fi = float(i);
  vec2 bp = vec2(leadX - fi * 0.055, leadY - fi * 0.018 + sin(t * 0.7 - fi * 0.5) * 0.006);
  float b = birdMask(p - bp, t * 5.5 - fi * 0.9, 0.020 - fi * 0.002);
  col = mix(col, mix(ink, lit, 0.06), b * (0.7 - fi * 0.08));
}
```

Same three evaluations, same guard band, reads as a skein rather than three
unrelated birds.

### 4.8 Contact shadows for the wildlife

```glsl
/* An animal without a shadow is a sticker on a photograph. */
float shadowOf(vec2 p, float cx, float groundY, float w) {
  vec2 q = (p - vec2(cx, groundY)) / vec2(w, w * 0.16);
  return smoothstep(1.0, 0.25, length(q));
}
col = mix(col, ink, shadowOf(p, deerX, groundY, 0.085) * 0.34);
col = mix(col, ink, shadowOf(p, eleX,  groundY + 0.004, 0.095) * 0.30);
```

Two `length()` calls inside the existing wildlife guard.

### 4.9 Dither the output

**Observed:** the sky is a smooth cubic ramp over ~800 px. In 8-bit sRGB that is
a visible band roughly every 40 px on a dark theme.

`src/lib/ditherOverlay.js` exists — **first, verify it applies to the background
canvas.** If it does not, add an ordered-dither at the end of `main()`:

```glsl
/* A 4x4 Bayer matrix, ±0.5/255, applied in the LAST line before gl_FragColor.
   One texture-free lookup. Cheaper and steadier than blue noise for a static
   gradient, and it removes 100% of the banding on the sky ramp. */
float bayer4(vec2 c) {
  vec2 f = floor(mod(c, 4.0));
  int i = int(f.x + f.y * 4.0);
  float m[16];
  m[0]=0.;   m[1]=8.;   m[2]=2.;   m[3]=10.;
  m[4]=12.;  m[5]=4.;   m[6]=14.;  m[7]=6.;
  m[8]=3.;   m[9]=11.;  m[10]=1.;  m[11]=9.;
  m[12]=15.; m[13]=7.;  m[14]=13.; m[15]=5.;
  return m[i] / 16.0 - 0.5;
}
gl_FragColor = vec4(col + bayer4(gl_FragCoord.xy) / 255.0, 1.0);
```

*(GLSL ES 1.00 needs the array unrolled or expressed as a `mod`-based
polynomial — the shipping version uses the standard bit-trick form, which is
four ops and no array.)*

### 4.10 Per-layer pointer parallax

`uMouse` already exists. Offset each tree line by a different multiple **of the
existing uniform** — no new uniform, no new JS:

```glsl
vec2 par = (uMouse - 0.5) * 0.012;
float far  = treeLine(vec2((p.x + par.x * 0.25) * 0.55, p.y + par.y * 0.10), ...);
float mid  = treeLine(vec2((p.x + par.x * 0.55) * 0.80, p.y + par.y * 0.22), ...);
float near = treeLineDetailed(vec2(p.x + par.x, p.y + par.y * 0.4), ...);
```

Damp `uMouse` on the JS side (it may already be damped — verify in
`bgEngine.js`'s uniform update) so this glides rather than tracks. **12 px of
travel maximum** — this is a background, not a toy, and the clock's lesson
applies: motion that tracks the cursor is distracting above a very small
threshold.

---

### 4.11 Dunes — the terrain becomes sand

**The mistake to avoid:** drawing dunes as "hills with a sand colour". A dune is
not a hill. It has a **slip face** — a sharp brink at the crest, a long windward
slope at ~12° and a short leeward slope at the angle of repose, ~33°. That
asymmetry *is* the shape. A symmetric sine-hill in beige reads as a beach towel.

```glsl
/*
 * A dune field, as an asymmetric heightfield.
 *
 * `pow(x, 0.35)` on the rising half and a near-linear drop on the falling half
 * gives the windward/slip-face asymmetry for two ops. The brink — the sharp
 * line at the crest — comes free as the derivative discontinuity between them,
 * and it is the single feature that makes the eye say "sand" rather than
 * "hill".
 *
 * Three octaves, because dune fields are self-similar: barchans ride on draas
 * ride on the underlying sand sheet. Amplitudes 1 : 0.38 : 0.14.
 */
float duneField(float x, float phase, float amp) {
  float h = 0.0;
  float a = 1.0;
  float f = 1.0;
  for (int i = 0; i < 3; i++) {
    float u = fract(x * f * 0.6 + phase * (0.3 + float(i) * 0.21));
    /* windward: long, shallow, convex.   slip face: short, straight, steep. */
    float d = u < 0.72 ? pow(u / 0.72, 0.35) : (1.0 - (u - 0.72) / 0.28);
    h += d * a;
    a *= 0.38;
    f *= 2.3;
  }
  return h * amp * 0.55;
}
```

**Crest lighting.** A dune reads almost entirely from the bright line along its
brink. One `smoothstep` on the height's own gradient:

```glsl
float brink = smoothstep(0.008, 0.0, abs(p.y - duneTop));
col = mix(col, mix(lit, vec3(1.0), 0.25), brink * 0.55 * aridity);
```

**Ripples.** Wind ripples run *perpendicular* to the dune crest and are ~10 cm
apart — sub-pixel at any distance, so they are **not** drawn as geometry. They
are drawn as a **micro-normal on the shading term only**, faded out with
distance, exactly as the sand-shader literature does it:

```glsl
/* Ripples exist to break the flatness of the lit slope, not to be seen
   individually. High frequency, tiny amplitude, faded by depth so they never
   alias — this is the whole reason they are a shading term and not geometry. */
float ripple = sin(p.x * 210.0 + duneTop * 60.0) * 0.5 + 0.5;
float rippleFade = exp(-depthOf(p) * 4.0);
col *= 1.0 + ripple * rippleFade * 0.035 * aridity;
```

**Cost:** 3-iteration loop (unrolled by every compiler), ~14 ops, gated on
`aridity > 0.4` — which is a **coherent** branch by 4.0.3.

### 4.12 Wadi — the river that dried up

The water block (4.6) already handles `p.y < waterY`. As `waterLevel` falls, the
same channel becomes a **dry wash**, which is one of the most evocative shapes in
a desert and costs almost nothing because the geometry already exists.

```glsl
/*
 * The channel outlives the river.
 *
 * `waterLevel` going to zero does not delete the water block — it converts it.
 * Wet: reflection, Fresnel, shoreline, glitter (all from 4.6).
 * Dry: a braided pale-gravel bed with darker cut banks either side, and the
 *      SAME meander shape, because a wadi is literally the bed of the river
 *      that was there in the wetter section three screens ago.
 *
 * That continuity is the point. The visitor scrolls from a river, through a
 * braided stream, to a dry bed with the same curves. Nobody will consciously
 * notice; everybody will feel that it is one place.
 */
vec3 bed = mix(lit, vec3(0.86, 0.78, 0.63), 0.55);
float braid = smoothstep(0.35, 0.65, fbm2(vec2(p.x * 7.0, p.y * 22.0)) * 0.5 + 0.5);
vec3 dryChannel = mix(mix(ink, bed, 0.62), bed, braid * 0.5);
/* Cut banks: the channel edge is a hard shadow line in a desert, not a soft
   shoreline. Two smoothsteps at the boundary, both already computed. */
dryChannel = mix(dryChannel, ink, smoothstep(0.010, 0.002, depth) * 0.5);

water = mix(dryChannel, water, waterLevel);
```

**Cost:** one `fbm2` inside a branch that already exists. **~12 ops on ~25 % of
screen**, and it *replaces* rather than adds — at `aridity = 1` the reflection
terms multiply out to zero and a good compiler folds them.

### 4.13 Banded vegetation — the ecotone's signature, and it is real science

This is the detail that will make anyone who knows what they are looking at stop
scrolling.

Semi-arid vegetation does not thin out evenly. It self-organises into **regular
bands, spots and labyrinths** — a Turing pattern driven by water competition,
documented across the Sahel, Australia and Mexico ("tiger bush", *brousse
tigrée*). Stripes on a slope, spots and gaps on the flat.

It is also, conveniently, **the cheapest possible thing to draw**: a threshold
on banded noise.

```glsl
/*
 * TIGER BUSH — real, published, and nearly free.
 *
 * Semi-arid vegetation self-organises into bands perpendicular to the slope
 * because each band harvests the runoff from the bare strip above it. The
 * pattern shifts with aridity: labyrinths → stripes → spots → nothing, which
 * is exactly the sequence the ecotone needs to walk through anyway.
 *
 * One sin, one noise, two smoothsteps. It is the highest realism-per-op item
 * in the entire plan and almost nobody implements it.
 */
float tiger(vec2 p, float aridity, float t) {
  /* Bands run across the slope; the noise breaks them so they are organic
     rather than corduroy. */
  float band = sin(p.y * 78.0 + snoise(vec2(p.x * 3.2, p.y * 1.4)) * 2.4);
  /* Duty cycle shifts with aridity: wide vegetation / narrow gaps at the wet
     end, narrow stripes / wide bare ground at the dry end, then nothing. */
  float duty = mix(-0.55, 0.62, aridity);
  float veg = smoothstep(duty, duty + 0.35, band);
  /* Only in the ecotone. A bell, so it fades in and out rather than switching. */
  float zone = exp(-pow((aridity - 0.52) * 3.1, 2.0));
  return veg * zone;
}
```

Applied to the ground band from 4.4, tinted with a dry-grass olive
(`#6b6a3c` × the scene's own lighting) rather than a forest green.

**Cost:** 1 `snoise` + 2 `smoothstep` + 1 `exp`. **~16 ops**, and it is
multiplied by `zone`, which is < 1/255 outside aridity ∈ [0.28, 0.76] — so guard
it and it runs on roughly a third of the screen at the ecotone sections and
**nowhere at all** in the pure-forest and pure-desert sections.

### 4.14 The mirage — the one desert effect everybody recognises

An **inferior mirage** is a real, simple optical phenomenon: a layer of very hot
air sits on the ground with a lower refractive index, so rays from the sky bend
upward into the eye, and you see an inverted image of the *sky* on the *ground*.
That is why it looks like water. It is not a hallucination and it is not fog.

Which means it renders as **one texture-coordinate flip in a band above the
horizon** — no raymarching, no second pass, no distortion buffer:

```glsl
/*
 * The inferior mirage — physics, not a filter.
 *
 * Below a critical height above the ground, the ray you are looking along has
 * been bent up out of the SKY. So in that band, sample the scene's sky colour
 * at the MIRRORED height instead of the ground colour. That is the entire
 * effect and it is why a mirage looks like standing water: it IS the sky.
 *
 * The shimmer on top is the buoyant turbulence in that same hot layer — one
 * noise term on the mirrored coordinate, animated fast (that convection is
 * genuinely quick) and with a tiny amplitude.
 *
 * Rejected: a full heat-haze post-pass. It is a second render target and a
 * screen-space distortion for something that only ever occupies a 30-pixel
 * band directly above the horizon line.
 */
float mirageBand = smoothstep(0.0, 0.030, p.y - groundY)
                 * (1.0 - smoothstep(0.030, 0.052, p.y - groundY));
float shimmer = snoise(vec2(p.x * 26.0, p.y * 90.0 - t * 3.4)) * 0.004;
float skyY = groundY + 0.14 + (p.y - groundY) * -1.6 + shimmer;
vec3 mirageCol = mix(tint, lit, pow(smoothstep(0.92, waterY, skyY), 3.0) * 0.72);
/* Only in real heat: dry, and only when the sun is high. */
float heat = aridity * aridity * sunHeight;
col = mix(col, mirageCol, mirageBand * heat * 0.62);
```

**Cost:** 1 `snoise`, ~10 ops, inside a band that is **~4 % of the screen** and
guarded by an `aridity > 0.55` coherent branch.

### 4.15 Dust replaces mist — same code, different constants

4.5 built a mist band. Desert air does the same thing at a different altitude,
a different hue and a different speed, so **it is the same three lines** with
the constants driven off `aridity`:

```glsl
/* Mist floats and drifts slowly; dust hugs the ground and moves with the wind.
   Same fbm, same exp band, three mixed constants. Zero additional ops. */
float bandY   = waterY + mix(0.018, 0.004, aridity);   /* dust sits lower  */
float bandW   = mix(16.0, 9.0, aridity);               /* dust is thicker  */
float bandSpd = mix(0.035, 0.115, aridity);            /* dust moves faster*/
vec3  bandCol = mix(lit, mix(lit, vec3(0.82, 0.68, 0.47), 0.7), aridity);
```

Plus, at high aridity only, a **dust devil**: one narrow vertical column of the
same noise, sheared with height, at a position that loops on `t`. ~8 ops, in a
band that is 2 % of the screen. This is optional and is the **first item cut**
if the budget is tight.

### 4.16 Desert wildlife — the crossfade that costs almost nothing

The wildlife block (line 702) is already guarded to `p.y < waterY + 0.16` — about
10 % of the screen. Inside it, add two masks and crossfade:

- **Oryx** — the deer mask with three changes: straight vertical horns instead
  of branched antlers, a level back instead of an arched one, and a blockier
  body. `deerMask` is 7 `segDist` calls; the oryx is 7 as well, with different
  constants. **Reuse the same function with a `shape` parameter** rather than
  writing a second one.
- **Camel** — the elephant mask with a hump instead of a dome, a long neck, and
  a small head. Same trick: parameterise `elephantMask`, do not duplicate it.
- **Vulture** replaces the bird flock at `aridity > 0.7` — same `birdMask`, wings
  held flat in a soar (`flap` amplitude → 0.05) and a slow circling path instead
  of a straight line. **A soaring bird that does not flap is instantly a raptor.**

```glsl
/* One mask, two species, one lerp of the CONSTANTS — not of two rendered
   masks. Interpolating the shape parameters means the intermediate is a
   plausible animal rather than a double-exposure, which is the same principle
   as 4.0.2 applied at the smallest scale. */
float quad = quadrupedMask(p - pos, gait, size, /*shape=*/ lifeMix);
```

**Cost: zero net.** Same number of `segDist` calls, different arguments.

### 4.17 Two suns, one sky

Forest light and desert light are different light, and the sky has to say so:

| | Forest | Desert |
|---|---|---|
| Sun disc | Hidden behind canopy; only the glow | **Visible**, small, hard-edged, very bright |
| Sky gradient | Deep overhead, bright band at horizon | **Bright overhead too** — a desert sky is washed out at zenith because of the dust load |
| Cloud | None (the motif scene has clouds; forest does not) | A thin, high, wind-stretched band at ~0.75 height |
| Shadow | Long, soft, cool | **Short, hard, warm** |

All four are `mix()` on existing values. The one genuinely new thing is the sun
disc:

```glsl
/* A hard disc, not a glow. `smoothstep` over ~1.5px so it does not alias, and
   it only exists once the canopy is thin enough to see through — which is
   `aridity` again. */
float disc = smoothstep(0.021, 0.019, distance(p, sunPos));
col = mix(col, vec3(1.0), disc * aridity * 0.9);
```

### 4.18 The one thing that ties both biomes to the clock

`MoonForestClock` already computes a time-of-day bucket from the device clock
(`bucketFor`, line 312). The background does not.

**Change:** pass the same normalised hour into `bgEngine` as a `uHour` uniform
(one float, updated once a minute — not per frame). Drive `sunHeight`, the sky
poles and the shadow direction from it.

**Why this matters more than it sounds:** right now the corner clock can show a
midnight sky while the background shows a bright horizon. Two elements of the
same page disagreeing about what time it is, is the kind of thing nobody names
and everybody registers as "cheap". Making them agree is **one uniform** and it
is the difference between a page with effects on it and a page that is a place.

---

### 4.19 Total cost budget — the whole biome

| Item | Ops/px added | Screen coverage | Coherent branch? |
|---|---|---|---|
| 4.0 biome parameter vector | +22 | 100 % | n/a (arithmetic) |
| 4.0.4 Mie/Rayleigh haze | +4 | 100 % | n/a |
| 4.0.5 ecotone calm | +5 | 100 % | n/a |
| 4.1 trunks | +8 | ~25 % | yes |
| 4.2 ragged edge | +2 | 100 % | n/a |
| 4.3 god rays (6 taps) | +18 | ~15 % | yes |
| 4.4 ground + scrub | +22 | ~10 % | yes |
| 4.5 mist / 4.15 dust | +14 | ~3 % | yes |
| 4.6 water / 4.12 wadi | +21 | ~28 % | yes |
| 4.7 wind + flock | +4 | 100 % | n/a |
| 4.8 contact shadows | +6 | ~10 % | yes |
| 4.9 dither | +4 | 100 % | n/a |
| 4.10 parallax | +3 | 100 % | n/a |
| 4.11 dunes + brink + ripple | +16 | ~22 % | yes |
| 4.13 tiger bush | +16 | ~12 % | yes |
| 4.14 mirage | +10 | ~4 % | yes |
| 4.16 desert wildlife | **0** | — | reuses existing |
| 4.17 sun disc + sky | +6 | 100 % | n/a |
| 4.18 uHour | +2 | 100 % | n/a |
| **TOTAL** | **≈ +66 ops/px screen-averaged** | | |

Current `forest()` is roughly 180–220 ops/px, so this is a **~33 % increase** on
the background shader alone.

**What that actually costs, measured against the hardware:**

| Device class | Fill rate | 1920×1080 @ DPR 1.0 | Estimated Δ |
|---|---|---|---|
| Discrete GPU (tier 3) | > 100 GOps/s | 2.07 Mpx × 66 ops | **≈ 0.15 ms** |
| Integrated (tier 2) | ~25 GOps/s | 2.07 Mpx × 66 ops | **≈ 0.55 ms** |
| Mobile (tier 1) | ~8 GOps/s | 0.9 Mpx @ DPR 0.75 × 66 | **≈ 0.75 ms** — too much |

**So tier 1 does not run the full set.** That is what the ladder is for.

**The tier ladder — this is the whole "no lag" answer:**

| Feature | Tier 3 | Tier 2 | Tier 1 |
|---|---|---|---|
| Biome axis (4.0) | full | full | **full** — never cut; it is the picture |
| Mie/Rayleigh haze | yes | yes | yes (4 ops) |
| Trunks | yes | yes | no |
| God rays | 6 taps | 3 taps | off |
| Ground + scrub | yes | yes | no |
| Mist / dust | yes | yes | flat band, no fbm |
| Water reflection | full | canopy only | flat colour + shoreline |
| Wadi | yes | yes | flat gravel, no braid |
| Dunes | 3 octaves | 2 octaves | 1 octave |
| Ripples | yes | no | no |
| Tiger bush | yes | yes | **yes** — 16 ops for the best cue on the list |
| Mirage | yes | yes | no |
| Dust devil | yes | no | no |
| Contact shadows | yes | yes | yes (6 ops) |
| Dither | yes | yes | yes |
| Parallax | yes | yes | no |
| DPR | ≤ 1.5 | 1.0 | 0.75 |
| Target Δ | ≤ 0.20 ms | ≤ 0.60 ms | **≤ 0.15 ms** |

**Tier 1 ends up with a net op count within 8 % of today's shader** while gaining
the entire biome axis, the Mie haze, tiger bush, contact shadows and dither —
because the things it drops (god rays, trunks, scrub, ripples, mirage, parallax)
are worth more ops than the things it gains.

**That is the elite-optimisation answer:** the low-end device does not get a
worse *picture*, it gets a **differently-chosen** picture, built from the cues
with the highest realism-per-op. P5, applied properly.

All toggles ride the **existing** `uIntensity` uniform plus one new `uDetail`
float and one new `uHour` float. **Two uniforms. No new programs, no new passes,
no new textures, no new dependencies.**

`scripts/check-effect-budget.mjs` gets a rule asserting the tier-1 op count does
not exceed **today's + 10 %**, and it is a build gate.

### 4.20 The implementation order inside Phase 4

Do them in this order, and **measure after every single one**. Stop and re-plan
if any item exceeds its row in the table by more than 30 %.

| Day | Items | Why this order |
|---|---|---|
| **1 — morning** | 4.0 (the whole architecture), 4.0.4 (Mie) | Nothing else can be built until the parameter vector exists. Mie is 4 ops and transforms the desert end immediately, so you can *see* whether the axis works. |
| **1 — afternoon** | 4.1 trunks, 4.2 ragged edge | The biggest single realism win, and it is on the axis (`trunkFrac` is a biome parameter). |
| **2 — morning** | 4.11 dunes, 4.12 wadi | The desert end gets its terrain. After this the two ends are genuinely different places. |
| **2 — afternoon** | 4.13 tiger bush, 4.4 ground | The ecotone stops being an interpolation and becomes a zone. |
| **3 — morning** | 4.3 god rays, 4.14 mirage, 4.5/4.15 mist-dust | The atmosphere, both ends. |
| **3 — afternoon** | 4.6 water, 4.7 wind, 4.8 shadows, 4.9 dither, 4.10 parallax, 4.16–4.18 | Polish, the cheap items, and the clock handshake. |

**Phase 4 acceptance:**

- [ ] Screenshot matrix: 9 sections × 3 themes × 3 window widths = 81 shots,
      reviewed by a human. **No shot may contain a visible boundary line
      between biomes** — if one does, the fingers term (4.0.3) is too weak.
- [ ] At aridity ≈ 0.5 the frame reads as a **savanna**, not as a forest
      dissolving into a desert. This is a judgement call and it is the single
      most important acceptance criterion in the phase.
- [ ] Forest end: sky between trunks, blue haze, mist, river, deer
- [ ] Ecotone: banded scrub, scattered parasol trees, braided wash, dry grass
- [ ] Desert end: dunes with visible brinks, amber haze, mirage, dry wadi,
      oryx, soaring vulture, hard sun disc
- [ ] The terrain-coupled fingers are visible — trees demonstrably cluster in
      the low ground
- [ ] Zero banding on the sky at 8-bit (histogram check on a screenshot column)
- [ ] Background and corner clock agree on the time of day
- [ ] p95 GPU frame time: ≤ baseline + 0.20 ms (tier 3), + 0.60 ms (tier 2),
      **+ 0.15 ms (tier 1)**
- [ ] `npm run check:effects` green — including the new tier-1 op-count rule
- [ ] `npm run check:contrast` green at **every** aridity value, sampled at
      0.0 / 0.25 / 0.5 / 0.75 / 1.0. **If it fails, the scrim darkens; the
      picture is never dimmed.**
- [ ] No dropped frame during a full top-to-bottom scroll on the tier-2 device

---

## 8. PHASE 5 — Controls a recruiter can see (0.5 day)

> Brief: *"that colour toggle button and movie change look very small — this is
> life, the user should see this heart, and the recruiter as well."*

### 5.1 The appearance button gets its word back at 1024 px

**Observed:** `index.css:1909–1910` hides the label below 100rem (1600 px). The
comment explains the header overflowed by 3 px at 1440.

**Change — re-plan the header row rather than hiding the label.** At < 1600 px,
move the three lowest-value chrome items into a single overflow control:

- Keep visible always: **Appearance**, **Résumé CTA**, **Search (⌘K)**
- Move into a `⋯ More` popover below 1600 px: sound switch, spark counter,
  recruiter chip, progress ring

Then:

```css
.appearance-btn__label { display: none; }
@media (width >= 64rem) { .appearance-btn__label { display: inline; } }  /* 1024 */
```

**Proof:** `npm run check:layout` must report **no** `CONTROL-OFF-SCREEN` at
320 / 375 / 768 / 1024 / 1152 / 1280 / 1440 / 1600 / 1920.

### 5.2 The swatch becomes a preview, not a stripe

`.appearance-btn__swatch` is 22 × 22 with three equal bars. Make it read as a
theme:

```css
.appearance-btn__swatch {
  inline-size: 26px;
  block-size: 26px;
  border-radius: 8px;
  /* Diagonal, not three stacked bars: the eye reads a diagonal split as
     "two things" and three horizontal bars as "a loading indicator". */
}
.appearance-btn__swatch > span:nth-child(1) { flex: 2; }   /* bg    */
.appearance-btn__swatch > span:nth-child(2) { flex: 1.2; } /* accent */
.appearance-btn__swatch > span:nth-child(3) { flex: 0.8; } /* glow  */
```

Plus a `box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08)` so it has an edge
on Paper as well as on Eclipse.

### 5.3 A first-visit hint, spent from the interruption budget

Once, on a first visit, after the quiet period, a **2.2 s ring pulse** on the
appearance button — no card, no text, no dismiss. It claims the overlay slot
(`claimOverlay('appearance-hint', { ttl: 2200, once: true })`) so it obeys the
same budget as everything else and cannot stack with a toast.

```css
@keyframes appearanceHintRing {
  0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--accent) 55%, transparent); }
  100% { box-shadow: 0 0 0 14px transparent; }
}
html[data-overlay='appearance-hint'] .appearance-btn {
  animation: appearanceHintRing 1100ms var(--ease-forge) 2;
}
html[data-motion='off'] .appearance-btn { animation: none; }
```

### 5.4 The "movie change" control

The brief's "movie change" is the **Projects view toggle** (`data-view-mode`,
the CINEMA deck referenced at `index.css:1938`). Same treatment:

- 44 px minimum, label visible at ≥ 768 px
- two clearly-drawn states, not a subtle tint — the inactive state gets
  `opacity: 0.55` and no border accent; the active state gets the accent border
  and a 2 px underline
- a `title` and an `aria-pressed` on each

### 5.5 One focus ring, one hover, everywhere

Audit every interactive element for:
- `:focus-visible` → the same 2 px accent ring with a 2 px offset
- `:hover` → border to `--accent-dim`, colour to `--ink`
- `:active` → `scale: 0.97`, 80 ms

Add `scripts/check-layout.mjs` assertions for min 44 × 44 on every
`button, a[href], [role="button"]`.

**Phase 5 acceptance:**

- [ ] "Appearance" word visible at 1024, 1280, 1440, 1600, 1920
- [ ] `check:layout` reports no off-screen control at any of the 9 widths
- [ ] Every interactive element ≥ 44 × 44 (automated)
- [ ] First-visit ring pulse fires once, never twice, never in Recruiter Mode
- [ ] `check:contrast` green

---

## 9. PHASE 6 — Games that are worth playing (2 days)

> Brief: *"game also looks very boring — deep research, I want it to look real
> and another level."*

Research is unambiguous on what makes a small game feel good: **response,
readability, and juice** — in that order. Controls that answer instantly,
feedback the player can read, and then polish. The current games have the loop
and none of the three.

### 6.1 The shared juice layer — build once, use in all five

New file: **`src/lib/juice.js`**. Every game imports it. This is the "one owner"
rule applied to game feel.

```js
/**
 * juice.js — the five effects that make a canvas game feel like a game.
 *
 * Deliberately a plain module with no React and no framer-motion: these run
 * inside a requestAnimationFrame loop that is already tight, and a re-render
 * per particle is the opposite of the goal.
 *
 * Every effect is a no-op when `prefersReducedMotion()` — juice is motion, and
 * P5 says motion is a preference, not a feature.
 */

// ── 1. Hitstop ────────────────────────────────────────────────────────────
// 60–80 ms of frozen time on a consequential event. The micro-pause is what
// gives the player's brain a beat to register that something happened. It is
// the single highest-impact effect on this list and it costs one integer.
export function createHitstop() { /* frames-to-skip counter */ }

// ── 2. Screen shake ───────────────────────────────────────────────────────
// Trauma-based, not duration-based: `trauma` decays at ~1.6/s and offset is
// `trauma^2 * maxOffset * noise(t)`. Squaring is what makes a small hit barely
// shake and a big one slam — a linear shake reads as a rattle at every
// magnitude. Capped at 8 px; anything more is nausea, not impact.
export function createShake() { /* trauma, decay, offset(t) */ }

// ── 3. Particles ──────────────────────────────────────────────────────────
// A fixed-size pool (256), no allocation after construction. Particles erupt
// ALONG the vector of the event, because directionality is what separates
// "impact" from "confetti".
export function createParticles(capacity = 256) { /* emit, step, draw */ }

// ── 4. Squash & stretch ───────────────────────────────────────────────────
// scaleY on landing, scaleX on launch, recovering over ~120 ms. Two floats.
export function squash(t, impactAt) { /* returns [sx, sy] */ }

// ── 5. Input forgiveness ──────────────────────────────────────────────────
// COYOTE TIME: accept a jump for 100 ms after leaving the ground.
// INPUT BUFFER: remember a jump pressed up to 120 ms before landing.
// Neither is a cheat — both remove the class of failure the player correctly
// feels was not their fault, which is the difference between "hard" and
// "unfair".
export function createInputForgiveness({ coyoteMs = 100, bufferMs = 120 } = {}) {}
```

**Cost:** ~4 KB before gzip, shared across five games that already ship. Net
bundle impact after removing each game's ad-hoc equivalents: roughly neutral.

### 6.2 ForgeRunner — from "a runner exists" to "one more go"

| Change | Detail |
|---|---|
| **Coyote + buffer** | Wire `createInputForgiveness` into `applyAction('jump')` (`ForgeRunner.jsx:238`). |
| **Combo** | Coins collected without hitting an obstacle multiply score: ×1 → ×2 at 5 → ×3 at 12 → ×5 at 25. Resets on hit. **This is the single change that creates a reason to keep playing.** |
| **Near-miss** | Passing within 6 px of an obstacle without collision awards +1 and flashes the lane. Rewards skill instead of caution. |
| **Difficulty shape** | Replace `speed += 0.25 every 5 points` with a curve: fast ramp to 5.0 over 20 s, plateau 15 s, then slow climb to 9.0. A plateau is what lets a player feel competent before the next squeeze. |
| **Power-ups** | Three, spawning every ~25 s: **Shield** (one free hit, 12 s), **Magnet** (coins curve to the lane, 8 s), **Slow** (speed × 0.6, 6 s). Each drawn as a distinct glyph, each with its own sound. |
| **Run objective** | One per run, shown at start: *"Collect 20 coins"*, *"Survive 60 s"*, *"5 near-misses"*. Completing it awards XP into `GameContext`, which ties the arcade to the portfolio's own progression. |
| **Juice** | Hitstop 70 ms on obstacle hit; shake trauma 0.55 on hit / 0.15 on coin; 12 particles on coin (gold, upward cone), 24 on crash (red, radial); squash on landing. |
| **Read** | Score, combo and speed in three separate corners with different type sizes — currently all one 12 px mono line at `ForgeRunner.jsx:223`. |
| **Audio** | Coin pitch rises with the combo (a simple `detune` on the existing sound). A rising pitch is the cheapest possible "you are doing well". |

### 6.3 The other four

| Game | The one change that matters most |
|---|---|
| **Snake (Classic)** | Grid-snapped movement with **input buffering** — the classic Snake failure is a turn eaten because it arrived mid-cell. Buffer one turn. Plus: food pulse, 60 ms hitstop on eat, trail fade. |
| **Memory Match** | Card **flip is a 3D transform** with a 180 ms ease, not an instant swap; a matched pair does a 90 ms scale-punch and dissolves into 8 particles; a mismatch shakes the two cards 4 px. Add a move counter and a par. |
| **Snakes & CV** | The token **travels** square by square (120 ms each) instead of teleporting; the snake/ladder animates as a slide along its path; the board square that was landed on pulses. Add the CV fact for that square as a caption — this is the one game that carries content. |
| **Ludo: Recruiter** | The dice gets a real **3D roll** (`Dice3D.jsx` already exists — use it) with a 700 ms tumble; captures get hitstop + shake; each token reaching home fires a burst. |

### 6.4 The cabinet itself

`ArcadeHub.jsx` currently lists five games as emoji + label + one-line desc.
Add per card:

- a **live preview** — a 6-frame animated canvas thumbnail, 96 × 64, drawn from
  the game's own draw function at 8 fps, paused when off-screen
- the **best score** (already fetched at line 41) rendered as a large numeral,
  not a chip
- a **"NEW"** flag for anything not yet played (from `getStore().scores`)

**Cost:** the previews are the only real cost. One shared canvas, one `IntersectionObserver`, paused when the hub is closed. Skip entirely at tier 1.

**Phase 6 acceptance:**

- [ ] Every game reaches 60 fps on the tier-2 device, measured
- [ ] `juice.js` is a no-op under `prefers-reduced-motion` and under
      `data-motion='off'` — asserted in a unit test
- [ ] No allocation inside any game's rAF loop (Chrome allocation profiler:
      flat sawtooth, not a climb)
- [ ] Playtest: 5 people, 5 minutes each, on ForgeRunner. **Target: median 4+
      runs.** Fewer than 3 means the combo/objective loop is not landing and
      that is the thing to iterate, not the particles.
- [ ] `npm run check:budgets` green — arcade chunk stays under its cap

---

## 10. PHASE 7 — Section-by-section pass (1.5 days)

> Brief: *"in each section see what needs to be fixed or improved so it looks
> insane, not weird."*

For **each** section, the same five questions. Answer them in a table in
`docs/section-audit.md`, then fix.

1. **Read** — can a stranger say what this section is about in 3 seconds?
2. **Hierarchy** — is there exactly one thing the eye lands on first?
3. **Motion** — does anything move that does not earn it?
4. **Density** — does it breathe at 1440, and does it still work at 375?
5. **Proof** — is there a number, a screenshot or a link, or is it just a claim?

### The sections and the specific things to check

| Section | File | Watch for |
|---|---|---|
| **Hero** | `sections/Hero.jsx`, `ui/FluidHero.jsx`, `ui/HeroAurora.jsx`, `ui/HeroForgeObject.jsx` | Four hero effects in one viewport is a lot. Measure which of `FluidHero`, `HeroAurora`, `WebGLDistortion` and `HeroForgeObject` are simultaneously live. **If more than two are, cut to two.** LCP element must be the headline, not a canvas. |
| **About** | `sections/About.jsx`, `ui/AvatarScrub.jsx`, `ui/AvatarShowcase.jsx` | The 5-frame turntable (`assets/avatar/turntable/`) — verify all 5 preload before the scrub is interactive, or the first drag stutters. |
| **Player Stats** | `sections/PlayerStats.jsx`, `ui/RatingGraph.jsx`, `ui/ContributionHeatmap.jsx`, `ui/CountUp.jsx` | The strongest proof on the page (Knight, 1972, 800+). Make the numbers the largest type in the section. `CountUp` must not run below the fold. |
| **Skills** | `sections/Skills.jsx`, `ui/SkillLanes.jsx` | Skill bars without a scale are decoration. Either label the axis or drop the bars for grouped tags. |
| **Projects** | `sections/Projects.jsx`, `ui/ProjectLightbox.jsx`, `ui/HorizontalScroll.jsx` | The `content-visibility` opt-out for sticky (`index.css:1936–1938`) — confirm the CINEMA deck does not cause CLS. Each project needs one number: users, latency, uptime. |
| **How I Build** | `sections/HowIBuild.jsx` | The most skippable section. Either make it a 4-step diagram or fold it into About. |
| **Timeline** | `sections/Timeline.jsx`, `ui/LevelMap.jsx` | Verify the scroll-driven fill (`ui/ScrollInkFill.jsx`) reaches 100 % exactly at the last node, at every viewport height. |
| **Contact** | `sections/Contact.jsx`, `lib/formGuard.js`, `lib/emailConfig.js` | Success and failure states must be inline and permanent — **not** a toast, since Phase 2 makes toasts 2.2 s. A form result is not an interruption. |
| **Footer** | `sections/Footer.jsx`, `ui/PhysicsFooter.jsx` | matter-js runs a physics world. Confirm it is torn down when off-screen. |

### Cross-cutting

- **Scroll smoothness.** `SmoothScrollContext.jsx` + `scroller.js` + `lenis`-like
  damping — verify there is exactly one scroll driver and that it does not fight
  `scroll-behavior: smooth` in CSS.
- **View transitions.** `viewTransition.js` — confirm the theme sweep does not
  run during a scroll (it will drop frames).
- **`content-visibility`.** Confirm `contain-intrinsic-size` matches real
  heights within 15 %, or the scrollbar lurches.

---

## 11. The smoothness contract

> Brief: *"everything should be smooth, no lag, no error, no issue, no stop."*

This is the part that is easiest to promise and hardest to keep. It is a
**budget**, enforced in CI.

### 11.1 Numbers

| Metric | Tier 3 | Tier 2 | Tier 1 |
|---|---|---|---|
| p95 frame time | ≤ 16.7 ms | ≤ 22 ms | ≤ 33 ms |
| Longest task | ≤ 150 ms | ≤ 200 ms | ≤ 250 ms |
| Total blocking time | ≤ 200 ms | ≤ 400 ms | ≤ 600 ms |
| LCP | ≤ 2.0 s | ≤ 2.5 s | ≤ 3.5 s |
| CLS | ≤ 0.02 | ≤ 0.05 | ≤ 0.05 |
| INP | ≤ 150 ms | ≤ 200 ms | ≤ 250 ms |
| Live WebGL contexts | **≤ 2, always** | | |

### 11.2 The rules that keep them

1. **One rAF.** `raf.js` owns the loop. Nothing calls
   `requestAnimationFrame` directly. Add an ESLint rule banning it outside
   `src/lib/raf.js`.
2. **Two bands, and the split is deliberate.** `critical` (never throttled) is
   for the clock hands and nothing else. Everything else is `ambient`.
3. **No allocation in a frame callback.** The clock already fixed this
   (`clockNow`, line 1291). Audit every `onFrame` subscriber for `new`, `[]`,
   `{}`, `.map`, `.filter`.
4. **No layout read after a write in the same frame.** Grep for
   `getBoundingClientRect` inside `onFrame` callbacks. `MoonForestClock`'s
   `onMove` did this (line 1213) and Phase 3 deletes it.
5. **Every `will-change` is temporary.** A permanent `will-change` is a
   permanent layer. Set on interaction, remove on `transitionend`.
6. **Passive listeners everywhere.** Already largely done — verify with a grep
   for `addEventListener` without options on `scroll`, `touchstart`, `wheel`,
   `pointermove`.
7. **Errors are visible in dev, silent in prod.** `ErrorBoundary.jsx` exists.
   Confirm it wraps each section independently, so one section's failure does
   not blank the page.

### 11.3 Scale

- **Bundle:** `check-budgets.mjs` is the gate. Every new dependency needs a line
  in the plan justifying it. Currently: react, react-dom, three, framer-motion,
  matter-js, @emailjs/browser. **This pass adds zero dependencies.**
- **Code-split:** the arcade, the lightbox, the clock and the physics footer are
  all lazy. Verify with `rollup-plugin-visualizer` that no eager chunk grew.
- **Adding a section later:** the pattern is `sections/<Name>.jsx`, registered
  in `lib/content.js`, with a `SectionSkeleton` fallback, an entry in
  `SECTION_IDS` (GameContext), a motif index in `bgEngine.js`, and a
  `contain-intrinsic-size`. Write that list into `CONTRIBUTING.md` so it is
  five minutes, not an afternoon.

---

## 12. Verification matrix

Every phase, before it is called done:

| Check | Command |
|---|---|
| Lint | `npm run lint` |
| Unit | `npm run test:unit` |
| E2E | `npm run test:e2e` |
| Build + budgets | `npm run build` |
| Encoding | `npm run check:encoding` |
| Contrast (APCA) | `npm run check:contrast` |
| Breakpoints | `npm run check:breakpoints` |
| Effect budget | `npm run check:effects` |
| Overflow | `npm run check:overflow` |
| Layout / controls | `npm run check:layout` |
| Attribute selectors | `npm run check:attrs` |
| CSS dupes | `npm run check:dupes` |
| Appearance parity | `npm run check:parity` |
| Colour space | `npm run check:colorspace` |
| Structured data | `npm run check:structured` |
| **Everything** | `npm run check:all` |

Plus, manually, once per phase:

- Paint flashing across the whole page — nothing repaints on idle
- 10 s Performance trace while scrolling top to bottom — no long task
- Lighthouse on the four device profiles
- Screenshot diff of all 9 sections × 3 themes × 3 backdrops (81 shots) —
  a script for this belongs in `scripts/shoot-matrix.mjs`

### New tests this plan requires

| Test | File |
|---|---|
| Store v1→v2 migration, three cases | `src/lib/__tests__/store.migration.test.js` |
| `claimOverlay` TTL under each `notices` mode | `src/lib/__tests__/overlayBus.dnd.test.js` |
| No toast has a close button | `e2e/no-close-buttons.spec.js` |
| Toast is gone within 2600 ms | `e2e/toast-dwell.spec.js` |
| Spark counter returns to 0/5 | `e2e/spark-reset.spec.js` |
| Clock never intercepts a pointer event | `e2e/clock-inert.spec.js` |
| `juice.js` is inert under reduced motion | `src/lib/__tests__/juice.motion.test.js` |
| `uScene` is only ever assigned from `bgSceneId()` | `scripts/check-appearance-parity.mjs` |
| Every control ≥ 44 × 44 at 9 widths | `scripts/check-layout.mjs` |
| Tier-1 shader op count ≤ today's + 10 % | `scripts/check-effect-budget.mjs` |
| No `desert(` function exists; no two-scene `mix` | `scripts/check-effect-budget.mjs` (source grep) |
| APCA passes at aridity 0 / .25 / .5 / .75 / 1 | `scripts/check-contrast.mjs` (5 new samples) |
| Screenshot matrix, 9 sections × 3 themes × 3 widths | `scripts/shoot-matrix.mjs` |

---

## 13. Sequencing

| Phase | Days | Depends on | Shippable alone? |
|---|---|---|---|
| 0 — Baseline & encoding | 0.5 | — | yes |
| 1 — Defaults reach the visitor | 1.0 | 0 | yes |
| 2 — Do Not Disturb | 1.0 | 0 | yes |
| 3 — Clock: pin, then beautify | 1.5 | 0 | yes |
| 4 — **The biome (forest ↔ desert)** | **3.0** | 0 | yes |
| 5 — Control affordances | 0.5 | 1 | yes |
| 6 — Game feel | 2.0 | 0 | yes |
| 7 — Section pass | 1.5 | 3, 4, 5 | yes |
| **Total** | **11 days** | | |

**Do them in this order.** Phases 2 and 3 are the two the visitor notices in the
first ten seconds, and both are mostly *deletion* — the cheapest wins available.
Phase 4 is the biggest single visual return and the biggest risk, so it goes
after the two cheap wins are banked.

**If only three days are available:** Phase 0, Phase 2, Phase 3.1 (pin the
clock), Phase 4.0 (**the biome axis and the Mie haze — half a day, and it is the
single largest visual change in the entire plan**), Phase 4.1 (trunks) and
Phase 5.1 (the label). That is the 80 %.

**If only one day is available:** Phase 0.1, Phase 2 (all of it — it is mostly
deleting code), and Phase 3.1 (three edits). Nothing on this list is prettier
than "it stopped interrupting me and the clock stopped moving".

---

## 14. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Biome additions blow the GPU budget on integrated graphics | **High** | High | Tier ladder in §4.19 is written *before* the code, and §4.20 says measure after **every single item** with a 30 % stop-and-re-plan trigger. `check:effects` gates it. |
| Someone implements the biome as `mix(forest(), desert())` | **High** | **Critical** | §4.0.1 exists solely to prevent this. It is a 2× shader cost and it looks like a dissolve. The reason is written in the code comment, not only in the plan. |
| The ecotone reads as a gradient someone applied, not as ecology | Medium | High | The terrain-coupled `hollow` term (§4.0.3) and tiger bush (§4.13) are the two things that fix this. Both are cheap. If the boundary still reads as a line at review, strengthen `fingers` before adding anything new. |
| The desert end looks like orange plastic | Medium | High | The most common failure in procedural deserts, and it has two causes, both addressed in §4.0.4: saturated `lit`, and pure-black `ink`. Sand at noon is bright and *desaturated*; desert shadows are warm and *open*. |
| The dunes read as beige hills | Medium | Medium | §4.11 — the asymmetric slip face and the lit brink are the shape. A symmetric dune is the tell. |
| Both biomes on screen at once creates a busy frame that fights the text | Medium | **High** | §4.0.5 — the ecotone is deliberately the lowest-contrast zone, and `check:contrast` samples five aridity values as a build gate. The scrim darkens; the picture never dims. |
| The v1→v2 migration overrides a real preference | Medium | Medium | The `*Explicit` flags are conservative — any other evidence of interaction preserves the choice. "Restore recommended" (§1.5) is the escape hatch either way. |
| 2.2 s toasts fail an accessibility review | Medium | High | `notices: 'longer'` gives exactly 10× — the WCAG 2.2.1 threshold. Documented in the code comment so a reviewer finds the reasoning. |
| God rays create a bright band that breaks text contrast | Medium | High | `check:contrast` is a build gate. The scrim darkens; the forest does not dim. |
| Game juice makes the arcade chunk exceed its budget | Low | Medium | `juice.js` replaces five ad-hoc implementations. Net-neutral or better. Measure with the visualizer. |
| Deleting the clock's hover tilt flattens the diorama | Medium | Low | Replaced with a constant tilt (§3.1), which preserves every bit of the layer separation at zero per-frame cost. |
| Scope creep — "insane" has no definition | **High** | High | §2 defines it as five numbers. Anything not moving one of those five numbers is out of scope for this pass. |

---

## 15. The one-page acceptance checklist

Ship when every line is true.

**Defaults**
- [ ] Fresh visitor, any browser, any OS theme → Eclipse + Forest on the first frame
- [ ] A returning visitor who never chose a backdrop → Forest
- [ ] A returning visitor who did choose one → their choice, untouched
- [ ] No WebGL → a CSS forest, not a blank wash
- [ ] Tier 1 → forest at reduced detail, never replaced
- [ ] "Restore recommended" exists in the console and the palette

**Do Not Disturb**
- [ ] Zero close buttons anywhere
- [ ] Zero clickable toasts
- [ ] Max one uninvited overlay per session
- [ ] Max 2.2 s dwell at the default setting
- [ ] Every toast shows a countdown rail
- [ ] Spark counter returns to `0/5` within 4 s of completion
- [ ] `Notices: Off` genuinely mounts nothing
- [ ] `Notices: Longer` gives ≥ 10× the default (WCAG 2.2.1)

**Clock**
- [ ] Does not move, at all, ever, under the cursor
- [ ] Never intercepts a click
- [ ] Zero repaint on hover
- [ ] Four distinct times of day, each with ≥ 5 colours
- [ ] Trees have trunks; animals have shadows; mountains have snow
- [ ] Birds fly as a flock
- [ ] p95 within budget

**The biome**
- [ ] There is **one** `biome()` function. There is no `desert()`. Nothing
      anywhere calls `mix(sceneA, sceneB, k)` on two rendered scenes.
- [ ] Scrolling the page traverses forest → ecotone → desert → back, continuously
- [ ] Both biomes are visible in the same frame at the crossing sections
- [ ] No visible boundary **line** anywhere in the 81-shot matrix
- [ ] At aridity ≈ 0.5 the frame reads as a savanna, not as a dissolve
- [ ] Trees demonstrably cluster in the low ground (terrain coupling)
- [ ] Banded tiger-bush visible in the ecotone
- [ ] **Forest end:** sky between trunks, blue Rayleigh haze, mist, river with
      shoreline and Fresnel, deer with a contact shadow, light shafts, flocking birds
- [ ] **Desert end:** asymmetric dunes with lit brinks, amber Mie haze, mirage
      band above the horizon, dry braided wadi following the river's own meander,
      oryx, soaring vulture, hard sun disc, dust hugging the ground
- [ ] Wind travels front-to-back through the layers
- [ ] Zero banding on the sky at 8-bit
- [ ] Background and corner clock agree on the time of day
- [ ] Text contrast passes APCA at aridity 0.0 / 0.25 / 0.5 / 0.75 / 1.0
- [ ] Tier 1 op count ≤ today's + 10 %, enforced by `check:effects`

**Controls**
- [ ] "Appearance" is a readable word at 1024 px and up
- [ ] Every control ≥ 44 × 44
- [ ] One focus ring, one hover, one active — the same three everywhere
- [ ] No control off-screen at any of the 9 tested widths

**Games**
- [ ] Coyote time and input buffering in every game that jumps or turns
- [ ] Hitstop, shake, particles and squash in all five
- [ ] A combo or an objective in all five
- [ ] 60 fps on the tier-2 device
- [ ] Zero allocation in any rAF loop

**Everything**
- [ ] `npm run check:all` green
- [ ] Zero console errors or warnings on any route, any theme, any backdrop
- [ ] Zero unhandled promise rejections
- [ ] Every metric in §11.1 met on every tier
- [ ] The 81-shot screenshot matrix reviewed by a human

---

## Appendix A — Files this plan touches

**Modified**

```
index.html                                  §1.4 parity note only
package.json                                new test scripts
src/lib/store.js                            v1→v2 migration, explicit flags
src/lib/bgScene.js                          explicit-choice flag
src/lib/appearance.js                       BACKDROPS copy, NOTICES vocabulary
src/lib/overlayBus.js                       budget 1, TTL 2200, notices modes
src/lib/bgEngine.js                         §4 — the biome, all of it. The
                                            largest single change in the plan:
                                            forest() becomes biome(), gains an
                                            aridity field, and every constant
                                            in it becomes a mix along that axis.
                                            Two new uniforms (uDetail, uHour).
src/lib/deviceProfile.js                    tier ladder for uDetail
src/lib/glResilience.js                     publish a no-GL flag for the CSS forest
src/lib/ditherOverlay.js                    verify coverage of the bg canvas
src/components/ui/MoonForestClock.jsx       §3 — pin it, then colour it
src/components/ui/Clock.jsx                 no change expected; verify
src/components/ui/SparkHunt.jsx             delete close button, auto-reset
src/components/ui/AchievementToast.jsx      countdown rail
src/components/ui/WelcomeBackToast.jsx      countdown rail, no close
src/components/ui/TimeSuggestionToast.jsx   countdown rail, no close
src/components/ui/AppearanceButton.jsx      swatch, hint ring
src/components/ui/AppearanceConsole.jsx     Notices row, Recommended chip, Restore
src/components/ui/Navbar.jsx                header re-plan, overflow menu
src/components/sections/Projects.jsx        view-toggle affordance
src/components/arcade/*.jsx                 §6 — all five
src/contexts/GameContext.jsx                TOAST_MS alignment
src/styles/index.css                        §2455 encoding, clock, controls, toasts
scripts/check-appearance-parity.mjs         uScene assignment rule
scripts/check-encoding.mjs                  \* comment rule
scripts/check-layout.mjs                    44px rule
scripts/check-effect-budget.mjs             tier-1 op-count assertion
```

**New**

```
src/lib/juice.js                            the shared game-feel layer
src/lib/__tests__/store.migration.test.js
src/lib/__tests__/overlayBus.dnd.test.js
src/lib/__tests__/juice.motion.test.js
e2e/no-close-buttons.spec.js
e2e/toast-dwell.spec.js
e2e/spark-reset.spec.js
e2e/clock-inert.spec.js
scripts/shoot-matrix.mjs                    81-shot screenshot matrix
docs/baseline-2026-08.md                    Phase 0 numbers
docs/section-audit.md                       Phase 7 answers
CONTRIBUTING.md                             how to add a section
```

**Deleted**

```
src/components/ui/SparkHunt.jsx:184-194      Escape / click-outside handlers
src/components/ui/SparkHunt.jsx:212-214      the Close button
src/components/ui/MoonForestClock.jsx:1206-1221, 1444-1451   the hover tilt
src/styles/index.css:2510-2520               .spark-toast__close
```

---

## Appendix B — What this plan deliberately refuses

Writing these down matters as much as the work, because each one is a thing a
future pass will be tempted to add back.

| Refused | Why |
|---|---|
| **`mix(forest(p), desert(p), k)`** | 2× shader cost everywhere, divergent branches exactly at the boundary, and it renders as a cross-dissolve rather than a place. §4.0.1. **This is the single most important refusal in the document.** |
| A second shader program per biome | A program switch per draw, a second compile, and the crossfade problem unsolved. One program, one `uScene`, one `aridity`. |
| A heat-haze post-process pass | A second render target and a screen-space distortion for a 30-pixel band above the horizon. §4.14 does it in-line for ~10 ops. |
| Sand normal-map textures | A texture fetch and a download for something `sin()` produces at higher quality and zero bytes. The whole engine is texture-free by design. |
| Raymarched dunes | Beautiful, and 40–100 samples per pixel. This is a *background*. §4.11 is a heightfield and costs 16 ops. |
| A separate desert wildlife mask set | §4.16 — parameterise the existing masks. Two species from one function is the same principle as one biome from one function. |
| React Three Fiber / drei / postprocessing | ~250 KB gzipped, a second renderer, a second reconciler. `glStage.js` exists because this site once ran nine WebGL contexts. |
| `antialias: true` on the clock | Measured: 11.4 s of blocked main thread. `devicePixelRatio` already supersamples. |
| Shadow maps on the clock | A full depth pass for a few pixels of soft gradient at 260 px. |
| `transmission` / a glass crystal | The most expensive material feature in three.js. A separate render target every frame. |
| An UnrealBloomPass | Two blur passes and a render target for a halo nine pixels wide. The glow sprite is indistinguishable. |
| A 64-tap raymarched god-ray pass | Six dithered taps of an already-soft function look the same at this scale for 1/10th the cost. |
| Any new npm dependency | The whole pass adds zero. |
| A "low-end fallback scene" | P5: degrade by resolution, never by deletion. |
| Making the forest dimmer to fix text contrast | The scrim darkens. The picture does not. |
| Toasts longer than 2.2 s by default | The brief's central complaint. `Longer` exists for anyone who needs it. |
| A cursor-tracking clock tilt | The brief's other central complaint, and it was never worth its frame cost. |

---

*Every number in this document came from reading the code or from a
measurement. Where a number is a target rather than a measurement, it says so.
Where a change might not be worth its cost, the plan says which item gets cut
first.*
