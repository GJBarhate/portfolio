# PROGRESS
Branch: `another-level-pass`
Baseline: docs/baseline-2026-08.md

## Phase 0 — Baseline and safety
- [x] 0.1 Verify encoding suspects
- [x] 0.2 Capture baseline
- [x] 0.3 Device matrix
Gate: green
Commit: `c6e0a06`

## Phase 1 — Defaults that actually reach the visitor
- [x] 1.1 A one-time "recommended defaults" migration
- [x] 1.2 Audit the tier path for a silent forest downgrade
- [x] 1.3 A real forest fallback with no WebGL
- [x] 1.4 Reword the Forest card so the default reads as the default
- [x] 1.5 A "Restore recommended" action
Gate: lint · unit (109) · build+budgets · encoding · attrs · dupes · parity · colorspace · effects · contrast · breakpoints · structured — all green
Commit: (shared with Phase 2 — the two share edits in AppearanceConsole.jsx, CommandPalette.jsx and index.css)

**Acceptance, verified in a real browser against the production build:**

| Criterion | Result |
|---|---|
| Fresh profile → Eclipse + Forest | PASS — `theme=eclipse`, `bgScene=forest` |
| v1 profile, `bgScene: 'calm'`, no other state → Forest | PASS — corrected to forest |
| v1 profile, `bgScene: 'calm'` + sparks → Calm preserved | PASS — stayed calm |
| WebGL disabled → CSS forest, no console error | PASS — `data-gl-fallback='true'`, `.bg-css-forest` display **block**, zero page errors |
| Tier 1 → forest present at reduced DPR, not replaced | PASS — enforced by the new `uScene` provenance gate, verified to fail on a deliberate violation |
| `check:parity` + `test:unit` green | PASS — 109 unit tests |

**1.2 audit result:** exactly **one** `uScene` write exists
(`BackgroundEngine.jsx:321`) and it traces only to `bgSceneId()`. No tier path
touches it. The rule is now enforced by `check-appearance-parity.mjs`, and the
gate was verified in both directions — it fails on
`getTier() < 2 ? 0 : bgSceneId()` and passes on the real tree. Its first draft
had a false negative (it asked whether the RHS *contained* `bgSceneId()`, which
a tier-gated ternary does) and then a false positive (an arrow-function body
captured its closing brace). Both are fixed and noted in the script.

**Budget raised, with the reason in the file:** `cssTotal` 45 → 46 KB for the
CSS forest. Three reclamation attempts first — `find-dead-css` found nothing,
halving the SVG tile saved 62 B, folding the water gradients saved 20 B —
which took the overage from 110 B to 28 B. The remaining 28 B is not
reclaimable without deleting the feature. Full justification in
`scripts/check-budgets.mjs`. **This moves against Phase 5's target of cutting
CSS and should be the first thing re-examined when the stylesheet is split.**

## Phase 2 — Do Not Disturb
- [x] 2.1 The policy, written once
- [x] 2.2 Toasts become non-interactive by construction
- [x] 2.3 Keep the countdown rail, shorten it
- [x] 2.4 The spark counter returns to 0
- [x] 2.5 An explicit Do Not Disturb setting
- [x] 2.6 Nothing is lost
Gate: lint · unit (109) · build+budgets · parity · colorspace · effects · attrs · dupes · overflow · layout · contrast · breakpoints — all green
Commit: (this phase, shared with Phase 1)

**What changed, and why the numbers moved from the plan's first draft:**

- `overlayBus.js` now owns a `NOTICES` policy (`brief`/`longer`/`off`) rather
  than a single `SESSION_BUDGET` constant. `brief` (default) is budget 1 / ttl
  2200 ms — the plan's numbers exactly. `longer` relaxes to budget 2 and
  multiplies every ttl ×10 (WCAG 2.2.1's Timing Adjustable threshold). `off`
  refuses every claim unconditionally, the same code path as Recruiter Mode.
  `SESSION_BUDGET` is kept as an export (= `NOTICES_POLICY.brief.budget`) for
  anything still reading the old name.
- **Found and fixed a real interaction bug while wiring this up:** at budget 1,
  a second *budgeted* claim from a different id is refused by the budget check
  before priority is ever consulted — which silently broke `RunComplete`'s
  documented ability to pre-empt the coach chip (D-47). Fixed by giving
  `RunComplete.jsx`'s claim `budgeted: false`, matching what `overlayBus.js`'s
  own jsdoc already claimed was true for it. `ExitIntent.jsx` now uses the
  exported `ACTIONABLE_TTL` (8000 ms) instead of a local `4000`, since the
  plan's own comment names it as the one candidate for that constant.
- `SparkHunt.jsx` — `TOAST_MS` 6000 → 2200; the Close button and the
  Escape/click-outside handlers are deleted (`SparkCompleteToast` claims the
  slot and is bus-timed, so there is nothing left for either to do); the spark
  counter now auto-resets to `0/5` ~3.4 s after the fifth find.
- `WelcomeBackToast.jsx` and `CoachChip.jsx` — close buttons deleted,
  `pointer-events: none`, countdown rail added. CoachChip's whole message is a
  keystroke the visitor can act on without touching the chip, so it lost its
  click-to-open-palette button too, not just the ✕ — exit-intent is the only
  overlay on the site still allowed to keep one (§2.1).
- `AchievementToast.jsx` — countdown rail added, matched to GameContext's
  existing 2200 ms `TOAST_MS` (already correct, untouched).
- `AppearanceConsole.jsx` — a fourth group, **Notices**, reading/writing
  `overlayBus.js`'s preference directly (not through `appearance.js`, since
  notices governs interruptions, not theme/backdrop/motion). `App.jsx` now
  calls `installNotices()` alongside `installBgScene()`.
- `CommandPalette.jsx` — a **Progress** group, generated at render time from
  `GameContext` (`unlocked`, most recent 5) and `SparkHunt` (`collected`/
  `total`), satisfying §2.6: everything a toast said is reachable from a
  non-timed surface.
- Three overlayBus unit tests failed against the new budget=1 default and were
  updated to assert the new behaviour rather than the old; four more were
  added for the notices policy itself (default ttl, `longer`'s budget and 10×
  multiplier, `off`'s unconditional refusal).

**Acceptance, verified:**

| Criterion | Result |
|---|---|
| No toast anywhere has a close button | PASS — deleted from spark, welcome-back, coach; achievement never had one |
| No toast has `pointer-events: auto` | PASS — `none` on all four, inline or via class |
| Every toast has a visible countdown rail | PASS — spark, welcome-back, achievement, coach all share the `sparkToastRail` keyframe |
| Longest uninvited dwell at `brief` = 2200 ms | PASS — unit-tested (`holds a default claim for exactly DEFAULT_TTL`) |
| `notices: 'longer'` gives ≥10× the `brief` dwell | PASS — unit-tested (10× multiplier, budget relaxes to 2) |
| `notices: 'off'` → `claimOverlay` returns `null` | PASS — unit-tested AND verified live: `forge:coach` dispatched at `off` mounted nothing, `data-overlay` stayed unset |
| Spark counter reads `0/5` within 4 s of the fifth find | PASS — timer is `800 + TOAST_MS(2200) + 400` = 3400 ms |
| At most one uninvited overlay in a session | PASS — unit-tested (`brief` budget = 1); live e2e against the wave-staggered lazy components (coach chip, welcome-back) was inconclusive in this sandbox — see note below |
| Recruiter Mode still shows zero | PASS — unchanged, `recruiterActive()` refuses first |

**Note on live verification:** this dev sandbox has no GPU (SwiftShader
software rasterization, per `docs/baseline-2026-08.md`), which appears to
starve the `requestIdleCallback` chain App.jsx uses to stagger in `wave >= 3`
components (coach chip, welcome-back, exit-intent, run-complete) — on a fresh
load, `wave` had not even reached 1 after 45+ seconds of wall-clock time in
this environment. The bus contract itself is thoroughly covered by 15 unit
tests including 4 new ones for the notices policy, and the `notices: off`
refusal was confirmed end-to-end through the real `AppearanceConsole` UI and
`forge:coach` in a live browser. The wave-staggering timing itself is
unrelated to this phase's changes and should be re-checked on real hardware.

## Phase 3 — The clock: pin it, then make it beautiful
- [ ] 3.1 Pin it — three edits, all in one direction
- [ ] 3.2 Make it real — the seven changes worth their cost
- [ ] 3.3 What is deliberately NOT done
Gate: not run
Commit: —

## Phase 4 — The biome: one world, forest at one end, desert at the other
- [ ] 4.0 THE ARCHITECTURE — one `biome()`, one `aridity`
- [ ] 4.1 Trunks — the single biggest tell (do this first)
- [ ] 4.2 Ragged silhouette
- [ ] 4.3 God rays from the horizon sun
- [ ] 4.4 Ground and undergrowth
- [ ] 4.5 Low mist over the water
- [ ] 4.6 Water: Fresnel, shoreline, sun glitter
- [ ] 4.7 Wind that travels, and a flock
- [ ] 4.8 Contact shadows for the wildlife
- [ ] 4.9 Dither the output
- [ ] 4.10 Per-layer pointer parallax
- [ ] 4.11 Dunes — the terrain becomes sand
- [ ] 4.12 Wadi — the river that dried up
- [ ] 4.13 Banded vegetation — the ecotone's signature
- [ ] 4.14 The mirage
- [ ] 4.15 Dust replaces mist
- [ ] 4.16 Desert wildlife — the crossfade
- [ ] 4.17 Two suns, one sky
- [ ] 4.18 Tie both biomes to the clock
- [ ] 4.19 Total cost budget — the whole biome
- [ ] 4.20 The implementation order inside Phase 4
Gate: not run
Commit: —

## Phase 5 — Controls a recruiter can see
- [ ] 5.1 The appearance button gets its word back at 1024 px
- [ ] 5.2 The swatch becomes a preview, not a stripe
- [ ] 5.3 A first-visit hint, spent from the interruption budget
- [ ] 5.4 The "movie change" control
- [ ] 5.5 One focus ring, one hover, everywhere
Gate: not run
Commit: —

## Phase 6 — Games that are worth playing
- [ ] 6.1 The shared juice layer — build once, use in all five
- [ ] 6.2 ForgeRunner — from "a runner exists" to "one more go"
- [ ] 6.3 The other four
- [ ] 6.4 The cabinet itself
Gate: not run
Commit: —

## Phase 7 — Section-by-section pass
- [ ] 7.1 Hero — measure simultaneous effects; cut to two if more than two are live
- [ ] 7.2 About — verify all 5 turntable frames preload before the scrub is interactive
- [ ] 7.3 Player Stats — the numbers become the largest type; CountUp must not run below the fold
- [ ] 7.4 Skills — label the axis or drop the bars for grouped tags
- [ ] 7.5 Projects — confirm the CINEMA deck causes no CLS; one number per project
- [ ] 7.6 How I Build — 4-step diagram or fold into About
- [ ] 7.7 Timeline — scroll-driven fill reaches 100 % exactly at the last node
- [ ] 7.8 Contact — success/failure inline and permanent, not a toast
- [ ] 7.9 Footer — confirm matter-js is torn down off-screen
- [ ] 7.10 Cross-cutting
Gate: not run
Commit: —

> Phase 7's items are unnumbered in PLAN.md §10 (they are a table of sections).
> Numbered 7.1–7.10 here in the table's own order so each has a checkbox, as
> rule 1 requires. No items invented, none merged.

## Measurements

| Phase | p95 frame (t3) | p95 frame (t2) | TBT | LCP | CLS | Bundle |
|---|---|---|---|---|---|---|
| 0 (baseline) | see note | see note | see note | see note | see note | entry 26.8 KB / eager 26.8 KB / css 44.4 KB / three 129.3 KB |

**Note on the frame/TBT/LCP/CLS columns:** this environment renders through
**ANGLE + SwiftShader** — software WebGL, no GPU. Every `renderer.render()`
therefore executes on the CPU and lands in the long-task log, so the absolute
numbers here are not comparable to any real machine and would poison every later
"before/after" claim if quoted as if they were. They are recorded in
`docs/baseline-2026-08.md` with that caveat attached, and marked UNTESTABLE
rather than invented. See "Blocked / open questions".

## Blocked / open questions

### B1 — RESOLVED. Branched and committed.

Took option A. `another-level-pass` created; the 103 files of the previous pass
committed as one unit (`644be6f`), Phase 0 on top (`c6e0a06`). Per-phase revert
now works as the plan intends.

<details><summary>original entry</summary>

#### The tree was not clean and we were on `main`

The kickoff guide requires a clean `git status` on a dedicated branch, so that
"you revert one phase, not the whole thing". Neither is true right now:

- branch: **`main`**
- uncommitted files: **103**
- last commit: `35f150d add styles`

Those 103 files are the previous pass (Appearance Console, the clock rewrite,
the background/Suspense fixes, the mobile-drawer scroll fix, ~10 new gates and
specs). PLAN.md is written *against that tree* — it cites
`appearance.js:118`, `check:attrs`, `check:dupes`, `check:parity`,
`check:colorspace`, all of which only exist in the uncommitted work. So the plan
assumes this state; it simply is not committed.

**If I commit Phase 0 now, its commit contains 103 unrelated files**, which
destroys the per-phase revertability the whole scheme depends on. That is why
Phase 0 is finished but uncommitted.

I did not choose for you because all three options are consequential:

| Option | Effect |
|---|---|
| **A (recommended)** — `git checkout -b another-level-pass`, commit the 103 files as one "prior pass" commit, then commit Phase 0 on top | Clean base, previous work preserved and revertable as one unit, plan's scheme intact |
| **B** — commit the 103 files to `main` first, then branch | Same, but the prior pass lands on `main` unreviewed |
| **C** — discard the 103 files | Throws away the previous pass entirely. Not recommended; PLAN.md's own line references would stop resolving. |

</details>

### B2 — RESOLVED. Not a stale baseline.

`appearance-matrix › eclipse-forest-reduced` passes on its own (11 s). The
failure in the 20-minute full-suite run was contention between parallel
workers, not a changed pixel. No baseline regeneration was needed — which is
worth recording, because regenerating it would have silently blessed whatever
the page looked like at that moment.

<details><summary>original entry</summary>

#### One failing test, pre-existing

`appearance-matrix.spec.js › eclipse-forest-reduced` fails on a screenshot
baseline that went stale when the hero gained a mobile résumé CTA and `glStage`
lost its dead scissor stage. 177 other tests pass. It needs a baseline
regeneration, not a code change — folding it into the Phase 0 commit once B1 is
answered.

</details>

### B3 — §1.8 was wrong, and that is fine

PLAN.md §1.8 flagged two `\*` comment openers as likely-invalid. **Both are
dismissed** — `index.css:2455` and `MoonForestClock.jsx:1483` both open with a
valid `/*`, `check:encoding` is green over 178 files, and the CSS rule after
2455 parses and applies. The `\*` was an artefact of how the file was quoted,
not a defect in it. Per the honesty clause: the hypothesis was reasonable and
the code does not have the bug. No `\*` rule was added to
`scripts/check-encoding.mjs`, because a gate for a bug that has never occurred
is a gate nobody will maintain.

**However, the same read confirmed §1.4 exactly**, at the cited lines:
`MAX_TILT` at 1210, `pointermove`/`pointerleave` at 1220–1221, and
`style={{ pointerEvents: 'auto' }}` at 1485. Those are Phase 3 and are
deliberately untouched.

### B4 — Device matrix is partial, and cannot be completed from here

PLAN.md §0.3 asks for a 1440 laptop, a 1920 desktop, a mid-range Android and an
iPhone, with the resolved `getTier()` on each. I can only run headless Chromium
on a software rasteriser. Recorded honestly in `docs/baseline-2026-08.md`:
measured rows for the two synthetic widths, and UNTESTABLE for the two physical
devices. The `?perf=1` HUD prints the resolved tier, so those four rows can be
filled in from real hardware in a few seconds each.
