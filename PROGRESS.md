# PROGRESS
Branch: `main` — **see "Blocked / open questions", this is not what the plan expects**
Baseline: docs/baseline-2026-08.md

## Phase 0 — Baseline and safety
- [x] 0.1 Verify encoding suspects
- [x] 0.2 Capture baseline
- [x] 0.3 Device matrix
Gate: `check:encoding` green · full suite 177 passed / 1 failed (stale matrix baseline, see below)
Commit: — **awaiting a branching decision**

## Phase 1 — Defaults that actually reach the visitor
- [ ] 1.1 A one-time "recommended defaults" migration
- [ ] 1.2 Audit the tier path for a silent forest downgrade
- [ ] 1.3 A real forest fallback with no WebGL
- [ ] 1.4 Reword the Forest card so the default reads as the default
- [ ] 1.5 A "Restore recommended" action
Gate: not run
Commit: —

## Phase 2 — Do Not Disturb
- [ ] 2.1 The policy, written once
- [ ] 2.2 Toasts become non-interactive by construction
- [ ] 2.3 Keep the countdown rail, shorten it
- [ ] 2.4 The spark counter returns to 0
- [ ] 2.5 An explicit Do Not Disturb setting
- [ ] 2.6 Nothing is lost
Gate: not run
Commit: —

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

### B1 — The tree is not clean and we are on `main` (needs your decision)

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

### B2 — One failing test, pre-existing, mine to fix

`appearance-matrix.spec.js › eclipse-forest-reduced` fails on a screenshot
baseline that went stale when the hero gained a mobile résumé CTA and `glStage`
lost its dead scissor stage. 177 other tests pass. It needs a baseline
regeneration, not a code change — folding it into the Phase 0 commit once B1 is
answered.

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
