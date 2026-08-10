# Baseline — the Another-Level Pass, Phase 0

**Captured:** 2026-08-10, immediately before Phase 1.
**Tree:** the 103 uncommitted files of the previous pass (see PROGRESS.md B1).
**Commands:** `npm run build`, `node scripts/size-report.mjs`, headless Chromium
harness (below), `npm run check:encoding`.

Every later phase quotes this file. So the first thing it has to be is honest
about which of its numbers can be quoted and which cannot.

---

## 0. The measurement environment — read this before quoting any frame number

This machine renders WebGL through **ANGLE + SwiftShader (Vulkan 1.3.0,
Subzero)** — a *software* rasteriser. There is no GPU.

That single fact invalidates the frame-timing half of this baseline for
comparison against real hardware:

- On a real GPU, `renderer.render()` submits commands to a driver and returns.
  The rasterisation happens asynchronously and does **not** block the main
  thread.
- On SwiftShader, that same rasterisation runs **on the CPU, on the main
  thread**, and lands in the long-task log.

So a page drawing four WebGL scenes reports enormous blocking time here and may
report almost none on a laptop with integrated graphics. Quoting these figures
as "before" and comparing them to a "after" measured anywhere else would
manufacture an improvement that did not happen — or hide a regression that did.

**Rule for every later phase: frame-timing numbers are comparable only against
other numbers from this same harness.** LCP/CLS/TBT targets from PLAN.md §11.1
must be verified on real hardware via `?perf=1`, and that is recorded as
UNTESTABLE here rather than guessed.

---

## 1. Item 0.1 — the encoding suspects: BOTH DISMISSED

PLAN.md §1.8 flagged two comment openers that appeared as `\*`.

| Suspect | Verdict | Evidence |
|---|---|---|
| `src/styles/index.css:2455` | **Not a defect** | Opens with a valid `/*`. The rule immediately after it, `.spark-counter[data-started='false']`, parses and applies. |
| `src/components/ui/MoonForestClock.jsx:1483` | **Not a defect** | A valid JS comment in JSX attribute position; the production build compiles it. |

```
npm run check:encoding  →  ENCODING-CLEAN (178 files)
```

No `\*` rule was added to `scripts/check-encoding.mjs`. A gate for a bug that
has never occurred in this repo is a gate that will rot; `check:encoding`
already covers the class that has.

**The same read confirmed §1.4 exactly**, which is Phase 3's work and is
deliberately untouched here:

| §1.4 claim | Confirmed at |
|---|---|
| `MAX_TILT = 0.087` (5°), doubled | `MoonForestClock.jsx:1210, 1216–1217` |
| `pointermove` / `pointerleave` on the host | `MoonForestClock.jsx:1220–1221` |
| `pointerEvents: 'auto'` overriding the CSS | `MoonForestClock.jsx:1485` |

---

## 2. Item 0.2 — the baseline numbers

### 2.1 Bundle (measured, and fully comparable — this is CPU-independent)

```
✓ entry                         26.8 KB /    60.0 KB
✓ motion (2 candidates)         41.6 KB /    42.0 KB
✓ three                        129.3 KB /   135.0 KB
✓ eager total                   26.8 KB /    95.0 KB
✓ css total                     44.4 KB /    45.0 KB
✓ prerendered html               6.8 KB /    24.0 KB
○ fonts total (target, P6)     173.8 KB /   120.0 KB   ← over target, reported not enforced
✓ shaders source                 0.0 KB /    60.0 KB
✓ project image derivatives  68 / min 15
```

Largest chunks: `three` 129.3 KB · `react` ~55 KB · `index.css` 44.4 KB ·
`motion` 41.6 KB · entry 26.8 KB · `BackgroundEngine` ~17 KB.

`css total` has **0.6 KB of headroom** and `motion` has **0.4 KB**. Phase 4 adds
GLSL to `bgEngine.js`, which is JS, not CSS — but Phase 5's control work and
Phase 6's game juice both touch budgets that are nearly full. Any raise must
carry a comment in `check-budgets.mjs` saying what grew and why.

### 2.2 Runtime (measured HERE ONLY — see §0)

Headless Chromium, production build via `npm run preview`, 9 s settle then a
10-step full-page scroll.

| | laptop 1440×900 | desktop 1920×1080 |
|---|---|---|
| resolved `getTier()` | **2** | **2** |
| probe (`data-gfx-probe`, ms) | 1.34 | 4.00 |
| live WebGL canvases | **4** | **4** |
| p95 frame during scroll | 366.7 ms | not sampled¹ |
| longest task | 2,624 ms | 4,601 ms |
| TBT (Σ over 50 ms) | 18,500 ms | 21,529 ms |
| CLS | **0.0000** | **0.0000** |
| LCP | n/a² | n/a² |

¹ The rAF sampler starved under software rasterisation at 1920 — itself a
symptom rather than a gap in the harness.
² `largest-contentful-paint` did not report in this headless configuration; LCP
must come from a real browser run.

**CLS is genuinely 0.0000 at both widths.** That number *is* comparable and it
is a real strength worth protecting through Phases 4 and 7.

**The four canvases** are the hero gem, the About desk, the corner clock and the
background field. PLAN.md §12 wants "never more than 2 live at once" — that is
already a known gap and is Phase 7 (Hero) work, where the plan says to cut to
two if more than two are live. Recorded here so the later phase has its start
number.

### 2.3 Gate status at baseline

| Gate | Result |
|---|---|
| lint | green |
| unit (96 tests, 7 files) | green |
| build + budgets + canonical + csp | green |
| encoding · contrast · breakpoints · effects · attrs · dupes · parity · colorspace · structured | green |
| e2e, laptop + modern-phone | **177 passed, 1 failed** |

The single failure is `appearance-matrix › eclipse-forest-reduced`, a stale
screenshot baseline (the hero gained a mobile résumé CTA; `glStage` lost its
dead scissor stage). It needs a baseline regeneration, not a code change.

---

## 3. Item 0.3 — the device matrix

PLAN.md §0.3 asks for four devices. Two are reachable from here, two are not,
and inventing them would corrupt every later comparison.

| Device | `getTier()` | Status |
|---|---|---|
| 1440 laptop (headless, **software GL**) | 2 | measured — but the GPU is simulated, so this is *not* the "integrated GPU laptop" row the plan wants |
| 1920 desktop (headless, **software GL**) | 2 | measured, same caveat |
| 1440 laptop, real integrated GPU | — | **UNTESTABLE here** |
| 1920 desktop, discrete GPU | — | **UNTESTABLE here** |
| Mid-range Android | — | **UNTESTABLE here** |
| iPhone | — | **UNTESTABLE here** |

**How to fill these in, in seconds each:** open the site on the device with
`?perf=1`. The HUD prints fps, frame time, `tier` and `floor`, per-band rAF
subscriber counts, throttled-callback count, live WebGL context count, and the
clock's own p95. Those six rows are what Phase 4's §4.20 30 %-overshoot trigger
needs to be meaningful.

Note that **both synthetic rows resolve to tier 2, not 3** — so nothing measured
here exercises the tier-3 path at all, and PLAN.md §11.1's tier-3 budget
(p95 ≤ 16.7 ms) is unverified by this baseline.

---

## 4. What Phase 0 deliberately did not do

- Did not add a `\*` rule to `check-encoding.mjs` — §1 explains why.
- Did not touch the clock's hover tilt, despite confirming all three causes.
  That is Phase 3, and the plan is explicit that phases do not bleed.
- Did not fix the stale screenshot baseline yet — it belongs in the Phase 0
  commit, which is blocked on the branching decision in PROGRESS.md B1.
- Did not commit. See PROGRESS.md B1.
